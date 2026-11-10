'use strict';

// Manual integration check: node scripts/verify-self-update.js
// Uses a private PM2 daemon and a disposable HTTP service, never the real app.
// Only GitHub/download/npm are simulated; PM2 and unzip run for real.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const archiver = require('archiver');

const execFileAsync = promisify(execFile);
const sourceDir = path.resolve(__dirname, '..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deployer-update-check-'));
const fixtureDir = path.join(root, 'app');
const pm2Cli = require('../app/service/pm2Cli').findPm2Cli();
const env = { ...process.env, PM2_HOME: path.join(root, 'pm2'), PM2_SILENT: 'true' };
// Do not inherit the caller's PM2 app identity if this check runs under PM2.
for (const key of ['pm_id', 'NODE_APP_INSTANCE', 'name', 'NODE_OPTIONS']) delete env[key];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let baseUrl;

async function pm2(...args) {
  const result = await execFileAsync(process.execPath, [pm2Cli, ...args], {
    env, cwd: fixtureDir, timeout: 45000, maxBuffer: 2 * 1024 * 1024,
  });
  return result.stdout;
}

async function processes() {
  return JSON.parse(await pm2('jlist'));
}

async function until(probe, description, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await probe();
    if (result) return result;
    await delay(150);
  }
  throw new Error(`Timed out: ${description}`);
}

async function health() {
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1000) });
    return await response.json();
  } catch {
    return null;
  }
}

async function submit(version) {
  const response = await fetch(`${baseUrl}/update`, {
    method: 'POST', body: JSON.stringify({ version }),
    signal: AbortSignal.timeout(20000),
  });
  return { status: response.status, body: await response.json() };
}

async function makeArchive(version) {
  await new Promise((resolve, reject) => {
    const archive = archiver('zip');
    const output = fs.createWriteStream(path.join(root, `${version}.zip`));
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    archive.append(JSON.stringify({ version }), { name: 'version.json' });
    archive.finalize();
  });
}

async function setup() {
  fs.mkdirSync(path.join(fixtureDir, 'app/service'), { recursive: true });
  fs.mkdirSync(path.join(fixtureDir, 'scripts'), { recursive: true });
  fs.symlinkSync(path.join(sourceDir, 'node_modules'), path.join(fixtureDir, 'node_modules'), 'dir');

  // Copy the production code unchanged except redirecting its fixed /tmp files
  // into this check's directory, so it cannot collide with a real update.
  for (const name of ['app/service/utils.js', 'scripts/upgrade.js']) {
    const text = fs.readFileSync(path.join(sourceDir, name), 'utf8')
      .replaceAll('/tmp/deployer-', `${root}/deployer-`);
    fs.writeFileSync(path.join(fixtureDir, name), text);
  }
  fs.copyFileSync(path.join(sourceDir, 'app/service/pm2Config.js'), path.join(fixtureDir, 'app/service/pm2Config.js'));
  fs.copyFileSync(path.join(sourceDir, 'app/service/pm2Environment.js'), path.join(fixtureDir, 'app/service/pm2Environment.js'));
  fs.copyFileSync(path.join(sourceDir, 'app/service/pm2Cli.js'), path.join(fixtureDir, 'app/service/pm2Cli.js'));
  fs.writeFileSync(path.join(fixtureDir, 'version.json'), JSON.stringify({ version: 'v1' }));
  fs.writeFileSync(path.join(fixtureDir, 'ecosystem.config.js'), `
    const config = require('./app/service/pm2Config');
    config.apps.find(app => app.name === 'deployer-updater').node_args =
      ['--require', require('path').join(__dirname, 'adapter.cjs')];
    module.exports = config;
  `);
  fs.writeFileSync(path.join(fixtureDir, 'scripts/start.js'), `
    const http = require('http');
    const fs = require('fs');
    const path = require('path');
    const { selfUpdate } = require('../app/service/utils');
    const version = require('../version.json').version;
    const root = path.resolve(__dirname, '../..');
    const server = http.createServer(async (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/health') {
        res.end(JSON.stringify({ version, pid: process.pid, parentPid: process.ppid }));
        return;
      }
      try {
        let body = '';
        for await (const chunk of req) body += chunk;
        await selfUpdate(JSON.parse(body).version);
        res.end(JSON.stringify({ accepted: true }));
      } catch (error) {
        res.statusCode = 409;
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    const portFile = path.join(root, 'port');
    const port = fs.existsSync(portFile) ? Number(fs.readFileSync(portFile, 'utf8')) : 0;
    server.listen(port, '127.0.0.1', () => {
      fs.writeFileSync(portFile, String(server.address().port));
      if (process.send) process.send('ready');
    });
    process.on('SIGINT', () => server.close(() => process.exit(0)));
    process.on('SIGTERM', () => server.close(() => process.exit(0)));
  `);

  fs.writeFileSync(path.join(fixtureDir, 'adapter.cjs'), `
    const fs = require('fs');
    const path = require('path');
    const Module = require('module');
    const childProcess = require('child_process');
    const root = path.resolve(__dirname, '..');
    const version = process.env.UPGRADE_VERSION;
    const record = event => fs.appendFileSync(path.join(root, 'events.jsonl'),
      JSON.stringify({ event, version, pid: process.pid, parentPid: process.ppid }) + '\\n');
    record('updater-started');
    const load = Module._load;
    Module._load = function(name, ...args) {
      if (name === 'axios') return { default: { get: async url => {
        record('release-request');
        if (!url.endsWith('/' + version)) throw new Error('Target version was not passed correctly');
        return { data: { tag_name: version, assets: [{ browser_download_url: 'https://fixture/release.zip' }] } };
      } } };
      return load.call(this, name, ...args);
    };
    const exec = childProcess.exec;
    childProcess.exec = function(cmd, options, callback) {
      if (cmd.startsWith('wget -O ')) {
        // Keep A alive briefly to exercise concurrent submission rejection.
        setTimeout(() => {
          try {
            if (version === 'download-failure') throw new Error('Simulated release download failure');
            fs.copyFileSync(path.join(root, version + '.zip'), path.join(root, 'deployer-release.zip'));
            record('downloaded');
            callback(null, 'local archive copied', '');
          } catch (error) { callback(error, '', ''); }
        }, 1800);
        return;
      }
      if (cmd.endsWith(' install --omit=dev')) {
        record('dependencies-installed');
        queueMicrotask(() => callback(null, 'dependency installation simulated', ''));
        return;
      }
      // PM2 delete/start, ps and unzip execute without substitution.
      return exec.call(this, cmd, options, callback);
    };
    childProcess.exec[require('util').promisify.custom] = (cmd, options) =>
      new Promise((resolve, reject) => childProcess.exec(cmd, options, (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
        } else resolve({ stdout, stderr });
      }));
  `);
  await makeArchive('v2');
  await makeArchive('v3');
}

async function checkUpgrade(version) {
  const before = await health();
  assert.ok(before, 'A must be serving before submitting an update');
  assert.equal((await submit(version)).status, 200, 'A must confirm PM2 accepted the task');
  const duplicate = await submit(version);
  assert.equal(duplicate.status, 409, 'Concurrent updates must be rejected');
  assert.match(duplicate.body.error, /正在/);

  await until(async () => !(await health()), 'old A stops');
  const running = await until(async () => {
    const list = await processes();
    return !list.some(app => app.name === 'deployer') && list;
  }, 'PM2 finishes removing old A');
  const updater = running.find(app => app.name === 'deployer-updater');
  assert.equal(updater?.pm2_env.status, 'online', 'Updater must survive after A stops');
  process.kill(updater.pid, 0);
  assert.ok(!running.some(app => app.name === 'deployer'), 'Old A must have been removed by PM2');
  const event = fs.readFileSync(path.join(root, 'events.jsonl'), 'utf8').trim().split('\n')
    .map(line => JSON.parse(line)).find(item => item.event === 'updater-started' && item.version === version);
  assert.ok(event, 'Updater must receive the current target version');
  assert.equal(event.parentPid, before.parentPid, 'PM2 must own A and updater as sibling processes');
  assert.notEqual(event.parentPid, before.pid, 'A must not own updater');

  const after = await until(async () => {
    const value = await health();
    return value?.version === version && value;
  }, `new A serves ${version}`);
  assert.notEqual(after.pid, before.pid, 'New version must run in a new service process');
  await until(async () => {
    const item = (await processes()).find(app => app.name === 'deployer-updater');
    return item?.pm2_env.status === 'stopped';
  }, 'one-shot updater exits');
  assert.ok(fs.readFileSync(path.join(root, 'deployer-upgrade.log'), 'utf8').includes('升级完成！版本: ' + version));
  console.log(`PASS ${before.version} -> ${version}: A ${before.pid} stopped; updater ${updater.pid} survived; A ${after.pid} serves ${version}; duplicate rejected`);
}

async function main() {
  console.log('Isolated fixture: ' + root);
  await setup();
  try {
    await pm2('start', 'ecosystem.config.js', '--only', 'deployer');
    baseUrl = 'http://127.0.0.1:' + fs.readFileSync(path.join(root, 'port'), 'utf8');
    await checkUpgrade('v2');
    await checkUpgrade('v3');
    const beforeFailure = await health();
    assert.equal((await submit('download-failure')).status, 200);
    await until(async () => {
      const app = (await processes()).find(item => item.name === 'deployer-updater');
      return app?.pm2_env.status === 'stopped' && app.pm2_env.exit_code === 1;
    }, 'failed updater exits without restarting');
    assert.deepEqual(await health(), beforeFailure, 'Download failure must preserve running A');
    const log = fs.readFileSync(path.join(root, 'deployer-upgrade.log'), 'utf8');
    assert.match(log, /升级失败: Simulated release download failure/);
    assert.equal(fs.existsSync(path.join(root, 'deployer-upgrade.lock')), false);
    assert.equal(fs.existsSync(path.join(root, 'deployer-updater-submit.lock')), false);
    console.log('PASS download failure: A unchanged; updater exits with code 1; locks released');
    console.log('PASS self-update lifecycle verified with real PM2 and unzip; GitHub and npm simulated');
  } finally {
    await pm2('kill');
    console.log('Private PM2 daemon stopped. Evidence retained at ' + root);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
