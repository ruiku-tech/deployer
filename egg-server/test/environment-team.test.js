'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deployer-env-team-test-'));
process.env.DEPLOY_DB_PATH = path.join(root, 'deployer.db');
process.env.DEPLOY_WORKSPACE = path.join(root, 'workspace');
fs.mkdirSync(process.env.DEPLOY_WORKSPACE, { recursive: true });

const database = require('../app/service/database');
const access = require('../app/service/access');
const EnvController = require('../app/controller/env');
const { setTeam } = EnvController.prototype;
let superadmin, member, teamId;

function controller(username, body) {
  const ctx = {
    state: { user: { username } },
    request: { body },
    status: 200,
    assert(condition, status, message) {
      if (!condition) { const error = new Error(message); error.status = status; throw error; }
    },
  };
  const instance = Object.create(EnvController.prototype);
  instance.ctx = ctx;
  return { ctx, run: () => setTeam.call(instance) };
}

test.before(() => {
  access.register('admin', 'password');
  access.register('member', 'password');
  access.register('old-member', 'password');
  superadmin = access.user('admin');
  member = access.user('member');
  const db = access.init();
  teamId = Number(db.prepare("INSERT INTO teams(name) VALUES ('第二分组')").run().lastInsertRowid);
  db.prepare('INSERT INTO team_members(team_id,user_id) VALUES (?,?)').run(teamId, member.id);
  db.prepare('INSERT INTO team_members(team_id,user_id) VALUES (?,?)').run(1, access.user('old-member').id);
  db.prepare('INSERT INTO environments(name,team_id) VALUES (?,?)').run('staging', 1);
  fs.mkdirSync(path.join(process.env.DEPLOY_WORKSPACE, 'staging'));
});

test.after(() => {
  database.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test('superadmin can assign an environment to exactly one team and access follows ownership', async () => {
  const request = controller(superadmin.username, { name: 'staging', teamId });
  await request.run();
  assert.deepEqual(request.ctx.body, { data: 'success' });
  assert.equal(database.getDb().prepare('SELECT team_id FROM environments WHERE name=?').get('staging').team_id, teamId);
  assert.equal(access.canAccess('member', 'staging'), true);
  assert.equal(access.canAccess('admin', 'staging'), true);
  assert.equal(access.canAccess('old-member', 'staging'), false);
  assert.equal(database.getDb().prepare('SELECT count(*) AS total FROM environments WHERE name=?').get('staging').total, 1);
});

test('members cannot reassign environments and invalid teams are rejected', async () => {
  const denied = controller(member.username, { name: 'staging', teamId: 1 });
  await assert.rejects(denied.run(), { status: 403 });
  const invalid = controller(superadmin.username, { name: 'staging', teamId: 9999 });
  await assert.rejects(invalid.run(), { status: 404 });
  assert.equal(database.getDb().prepare('SELECT team_id FROM environments WHERE name=?').get('staging').team_id, teamId);
});

test('unknown environments cannot acquire a team through the settings endpoint', async () => {
  const request = controller(superadmin.username, { name: 'missing', teamId });
  await assert.rejects(request.run(), { status: 404 });
});

test('empty or multiple team selections are rejected without removing the existing team', async () => {
  for (const teamId of [null, '', 0, [1, 2], [1], 1.5]) {
    await assert.rejects(controller(superadmin.username, { name: 'staging', teamId }).run(), { status: 400 });
  }
});

test('the environment list shows its team and hides it from the original team', async () => {
  const ctx = { state: { user: member } };
  await EnvController.prototype.getList.call({ ctx });
  assert.deepEqual(ctx.body.data, [{ name: 'staging', teamId, teamName: '第二分组' }]);
  const old = { state: { user: access.user('old-member') } };
  await EnvController.prototype.getList.call({ ctx: old });
  assert.deepEqual(old.body.data, []);
});

test('assigning back replaces ownership and applies immediately', async () => {
  await controller(superadmin.username, { name: 'staging', teamId: 1 }).run();
  assert.equal(access.canAccess('member', 'staging'), false);
  assert.equal(access.canAccess('old-member', 'staging'), true);
  assert.equal(database.getDb().prepare('SELECT count(*) AS total FROM environments WHERE name=?').get('staging').total, 1);
});
