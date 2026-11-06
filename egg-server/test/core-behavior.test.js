const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deployer-test-'));
process.env.DEPLOY_DB_PATH = path.join(root, 'deployer.db');
process.env.DEPLOY_WORKSPACE = path.join(root, 'workspace');
fs.mkdirSync(process.env.DEPLOY_WORKSPACE, { recursive: true });

const database = require('../app/service/database');
const access = require('../app/service/access');
const config = require('../app/service/config');
const install = require('../app/service/install');
const disk = require('../app/service/disk');
const Releases = require('../app/service/releases');

test.after(() => {
  database.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test('first registration is the only automatic superadmin', () => {
  access.register('alice', 'password');
  access.register('bob', 'password');
  assert.equal(database.findUsers({ username: 'alice' })[0].role, 'superadmin');
  assert.equal(database.findUsers({ username: 'bob' })[0].role, 'member');
  assert.deepEqual(access.teams('bob'), []);
});

test('team membership controls environment access and disabled users lose access', () => {
  const db = access.init();
  const teamId = Number(db.prepare("INSERT INTO teams(name) VALUES ('发布组')").run().lastInsertRowid);
  const bob = database.findUsers({ username: 'bob' })[0];
  db.prepare('INSERT INTO team_members(team_id,user_id) VALUES (?,?)').run(teamId, bob.id);
  db.prepare('INSERT INTO environments(name,team_id) VALUES (?,?)').run('production', teamId);
  assert.equal(access.canAccess('bob', 'production'), true);
  assert.equal(access.canAccess('bob', 'missing'), false);
  db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(bob.id);
  assert.equal(access.canAccess('bob', 'production'), false);
});

test('environment copy preserves files and rejects symlink trees', async () => {
  install.create('source');
  const source = config.createContext('source');
  fs.writeFileSync(path.join(source.fileDir, 'package.tgz'), 'package');
  database.setNote('source', 'config', 'app.conf', '保留备注');
  await disk.requireSpace(process.env.DEPLOY_WORKSPACE, 1);
  await install.copy('target', 'source');
  assert.equal(fs.readFileSync(path.join(config.createContext('target').fileDir, 'package.tgz'), 'utf8'), 'package');

  install.create('linked');
  fs.symlinkSync(source.fileDir, path.join(config.createContext('linked').dir, 'outside'));
  await assert.rejects(() => disk.directorySize(config.createContext('linked').dir), /符号链接/);
});

test('script history is scoped to environments while legacy rows remain admin-only', () => {
  database.createScriptRecord({ env: 'production', text: 'echo prod' });
  database.createScriptRecord({ env: 'staging', text: 'echo stage' });
  assert.deepEqual(database.findScriptRecords('production').map(x => x.text), [ 'echo prod' ]);
  assert.deepEqual(database.findScriptRecords('staging').map(x => x.text), [ 'echo stage' ]);
  database.getDb().prepare('INSERT INTO script_records(text) VALUES (?)').run('legacy');
  assert.equal(database.findScriptRecords('production').some(x => x.text === 'legacy'), false);
  assert.equal(database.findScriptRecords('production', true).some(x => x.text === 'legacy'), true);
});

test('scheduled releases are persisted and can be cancelled within the environment scope', async () => {
  const db = access.init();
  install.create('scheduled');
  const scheduled = config.createContext('scheduled');
  fs.writeFileSync(scheduled.hostsFile, JSON.stringify({ server: '127.0.0.1:password:22' }));
  fs.writeFileSync(path.join(scheduled.scriptDir, 'deploy.sh'), 'echo ok');
  db.prepare('INSERT OR IGNORE INTO environments(name,team_id) VALUES (?,?)').run('scheduled', 1);
  const releases = Object.create(Releases.prototype);
  releases.ctx = { service: { executer: { parse: () => [] } }, logger: { warn() {} } };
  const id = await releases.create('scheduled', { list: [{ host: 'server', cmds: [ 'deploy.sh' ] }] }, 'alice', Date.now() + 60000);
  assert.equal(db.prepare('SELECT status FROM release_schedules WHERE id=?').get(id).status, 'pending');
  db.prepare("UPDATE release_schedules SET status='cancelled' WHERE id=? AND status='pending'").run(id);
  assert.equal(db.prepare('SELECT status FROM release_schedules WHERE id=?').get(id).status, 'cancelled');
});
