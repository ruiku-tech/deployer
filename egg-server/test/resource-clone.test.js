'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deployer-resource-clone-'));
process.env.DEPLOY_DB_PATH = path.join(root, 'deployer.db');
process.env.DEPLOY_WORKSPACE = path.join(root, 'workspace');
const database = require('../app/service/database');
const access = require('../app/service/access');
const config = require('../app/service/config');
const install = require('../app/service/install');
const DeployController = require('../app/controller/deploy');

let users;
function makeContext(username, env, body = {}, query = {}) {
  const ctx = {
    state: { user: { username } }, headers: { env }, request: { body }, query,
    assert(condition, status, message) {
      if (!condition) { const err = new Error(message); err.status = status; throw err; }
    },
  };
  return ctx;
}

test.before(() => {
  access.register('root', 'password');
  access.register('alice', 'password');
  access.register('bob', 'password');
  users = Object.fromEntries([ 'root', 'alice', 'bob' ].map(name => [ name, access.user(name) ]));
  const db = access.init();
  const sourceTeam = 1;
  const targetTeam = Number(db.prepare("INSERT INTO teams(name) VALUES ('目标组')").run().lastInsertRowid);
  db.prepare('INSERT INTO team_members(team_id,user_id) VALUES(?,?)').run(sourceTeam, users.alice.id);
  db.prepare('INSERT INTO team_members(team_id,user_id) VALUES(?,?)').run(targetTeam, users.alice.id);
  db.prepare('INSERT INTO environments(name,team_id) VALUES(?,?)').run('source', sourceTeam);
  db.prepare('INSERT INTO environments(name,team_id) VALUES(?,?)').run('target', targetTeam);
  db.prepare('INSERT INTO environments(name,team_id) VALUES(?,?)').run('private', sourceTeam);
  db.prepare('INSERT INTO team_members(team_id,user_id) VALUES(?,?)').run(sourceTeam, users.bob.id);
  for (const env of [ 'source', 'target', 'private' ]) install.create(env);
  fs.writeFileSync(path.join(config.createContext('source').configDir, 'app.conf'), 'source config');
  fs.writeFileSync(path.join(config.createContext('source').scriptDir, 'deploy.sh'), 'run: echo deploy');
  database.setNote('source', 'config', 'app.conf', '配置信息');
  database.setNote('source', 'script', 'deploy.sh', '脚本信息');
});

test.after(() => {
  database.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test('cloning copies a single config or script and its note across authorized groups', async () => {
  for (const type of [ 'config', 'script' ]) {
    const name = type === 'config' ? 'app.conf' : 'deploy.sh';
    const ctx = makeContext('alice', 'source', { type, name, targetEnv: 'target' });
    await DeployController.prototype.cloneResource(ctx);
    assert.deepEqual(ctx.body, { data: 'success' });
    const sourceDir = type === 'config' ? config.createContext('source').configDir : config.createContext('source').scriptDir;
    const targetDir = type === 'config' ? config.createContext('target').configDir : config.createContext('target').scriptDir;
    assert.equal(fs.readFileSync(path.join(targetDir, name), 'utf8'), fs.readFileSync(path.join(sourceDir, name), 'utf8'));
    assert.equal(database.getNote('target', type, name), type === 'config' ? '配置信息' : '脚本信息');
  }
});

test('same-name targets return conflict without changing the existing file', async () => {
  const target = path.join(config.createContext('target').configDir, 'app.conf');
  fs.writeFileSync(target, 'keep target value');
  const ctx = makeContext('alice', 'source', { type: 'config', name: 'app.conf', targetEnv: 'target' });
  await DeployController.prototype.cloneResource(ctx);
  assert.equal(ctx.status, 409);
  assert.match(ctx.body.message, /同名配置/);
  assert.equal(fs.readFileSync(target, 'utf8'), 'keep target value');
});

test('target listing and clone requests enforce membership in both environments', async () => {
  const list = makeContext('bob', 'source', {}, { type: 'config', targetEnv: 'target' });
  await DeployController.prototype.getResourceNames(list);
  assert.equal(list.status, 403);

  const targetScript = path.join(config.createContext('target').scriptDir, 'deploy.sh');
  const original = fs.readFileSync(targetScript, 'utf8');
  const clone = makeContext('bob', 'source', { type: 'script', name: 'deploy.sh', targetEnv: 'target' });
  await DeployController.prototype.cloneResource(clone);
  assert.equal(clone.status, 403);
  assert.equal(fs.readFileSync(targetScript, 'utf8'), original);
});

test('resource listing only returns regular files and their notes', async () => {
  const context = config.createContext('target');
  fs.mkdirSync(path.join(context.configDir, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(context.configDir, 'visible.conf'), 'visible');
  database.setNote('target', 'config', 'visible.conf', '目标备注');
  const ctx = makeContext('alice', 'source', {}, { type: 'config', targetEnv: 'target' });
  await DeployController.prototype.getResourceNames(ctx);
  assert.deepEqual(ctx.body.data.map(item => item.name), [ 'app.conf', 'visible.conf' ]);
  assert.equal(ctx.body.data.find(item => item.name === 'visible.conf').note, '目标备注');
});
