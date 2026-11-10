'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');
const { once } = require('node:events');

test('real Egg boot serves HTTP without looking up PM2', { timeout: 30000 }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deployer-boot-'));
  const child = fork('-e', [ `
    const http = require('http');
    // Prevent an empty test database from triggering the legacy Mongo migration.
    const db = require('./app/service/database');
    db.setMigrated();
    require('egg').start({ baseDir: process.cwd(), env: 'prod' }).then(app => {
      const server = http.createServer(app.callback());
      server.once('error', error => { console.error(error); process.exit(1); });
      app.emit('server', server);
      server.listen(0, '127.0.0.1', () => {
        process.send({ port: server.address().port });
      });
    }).catch(error => {
      console.error(error);
      process.exit(1);
    });
  ` ], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PATH: '',
      DEPLOY_PM2_BIN: '/nonexistent/pm2',
      DEPLOY_DB_PATH: path.join(root, 'deployer.db'),
      DEPLOY_WORKSPACE: path.join(root, 'workspace'),
      NODE_ENV: 'production',
      EGG_SERVER_ENV: 'prod',
      EGG_APP_CONFIG: JSON.stringify({ logger: { dir: path.join(root, 'logs') } }),
    },
    silent: true,
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = once(child, 'exit');
      child.kill('SIGKILL');
      await stopped;
    }
    fs.rmSync(root, { recursive: true, force: true });
  });
  const message = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Egg boot timed out\n${output}`)), 20000);
    child.once('message', value => { clearTimeout(timer); resolve(value); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Egg exited ${code}\n${output}`)); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
  });
  const response = await fetch(`http://127.0.0.1:${message.port}/index.html`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<html/);
  assert.doesNotMatch(output, /app\._options is deprecated/);
});
