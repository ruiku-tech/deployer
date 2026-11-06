'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deployer-admin-test-'));
process.env.DEPLOY_DB_PATH = path.join(root, 'deployer.db');
process.env.DEPLOY_WORKSPACE = path.join(root, 'workspace');
fs.mkdirSync(process.env.DEPLOY_WORKSPACE, { recursive: true });

const database = require('../app/service/database');
const access = require('../app/service/access');
const TeamController = require('../app/controller/team');
const auth = require('../app/middleware/auth')();
let users, secondTeam;

function controller(username, body, method = 'setRole') {
  const ctx = {
    state: { user: { username } }, request: { body },
    assert(condition, status, message) {
      if (!condition) { const error = new Error(message); error.status = status; throw error; }
    },
  };
  return { ctx, run: () => TeamController.prototype[method].call({ ctx }) };
}

test.before(() => {
  for (const name of ['root', 'alice', 'bob', 'disabled']) access.register(name, 'password');
  users = Object.fromEntries(['root', 'alice', 'bob', 'disabled'].map(name => [name, access.user(name)]));
  const db = access.init();
  secondTeam = Number(db.prepare("INSERT INTO teams(name) VALUES ('第二分组')").run().lastInsertRowid);
  db.prepare('INSERT INTO team_members(team_id,user_id) VALUES (?,?)').run(1, users.alice.id);
  db.prepare('INSERT INTO environments(name,team_id) VALUES (?,?)').run('owned', 1);
  db.prepare('INSERT INTO environments(name,team_id) VALUES (?,?)').run('other', secondTeam);
  db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(users.disabled.id);
});
test.after(() => {
  database.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test('only the superadmin can grant administrator access to all teams and environments', async () => {
  assert.equal(access.user('root').role, 'superadmin');
  assert.equal(access.canAccess('alice', 'other'), false);
  await assert.rejects(controller('bob', { id: users.alice.id, role: 'admin' }).run(), { status: 403 });
  const request = controller('root', { id: users.alice.id, role: 'admin' });
  await request.run();
  assert.deepEqual(request.ctx.body, { data: 'success' });
  assert.equal(access.user('alice').role, 'admin');
  access.assertAdmin(controller('alice', {}).ctx);
  assert.equal(access.canAccess('alice', 'owned'), true);
  assert.equal(access.canAccess('alice', 'other'), true);
  assert.equal(access.teams('alice').length, 2);
});

test('administrators manage members and teams but cannot grant or revoke roles', async () => {
  await assert.rejects(controller('alice', { id: users.bob.id, role: 'admin' }).run(), { status: 403 });
  await assert.rejects(controller('alice', { id: users.alice.id, role: 'member' }).run(), { status: 403 });
  await controller('alice', { id: users.bob.id, disabled: true }, 'setUser').run();
  assert.equal(access.user('bob').disabled, 1);
  await controller('alice', { id: users.bob.id, disabled: false }, 'setUser').run();
  const request = controller('alice', { name: '管理员创建的组', members: [users.bob.id] }, 'save');
  await request.run();
  assert.ok(access.teams('bob').some(team => team.name === '管理员创建的组'));
});

test('superadmin is protected and administrators cannot disable themselves or other administrators', async () => {
  for (const actor of ['root', 'alice']) {
    await assert.rejects(controller(actor, { id: users.root.id, disabled: true }, 'setUser').run(), { status: 400 });
  }
  await assert.rejects(controller('root', { id: users.root.id, role: 'member' }).run(), { status: 400 });
  await assert.rejects(controller('alice', { id: users.alice.id, disabled: true }, 'setUser').run(), { status: 403 });
  await controller('root', { id: users.bob.id, role: 'admin' }).run();
  await assert.rejects(controller('alice', { id: users.bob.id, disabled: true }, 'setUser').run(), { status: 403 });
  await controller('root', { id: users.bob.id, disabled: true }, 'setUser').run();
  assert.equal(access.isAdmin(access.user('bob')), false);
  assert.equal(access.canAccess('bob', 'other'), false);
  assert.deepEqual(access.teams('bob'), []);
});

test('invalid grants are rejected without changing roles', async () => {
  for (const role of ['superadmin', '', null, ['admin']]) {
    await assert.rejects(controller('root', { id: users.alice.id, role }).run(), { status: 400 });
  }
  for (const id of [0, null, '', [], [users.alice.id], 1.5, {}, 'invalid']) {
    await assert.rejects(controller('root', { id, role: 'admin' }).run(), { status: 400 });
  }
  await assert.rejects(controller('root', { id: 99999, role: 'admin' }).run(), { status: 404 });
  await assert.rejects(controller('root', { id: users.disabled.id, role: 'admin' }).run(), { status: 400 });
  assert.equal(access.user('alice').role, 'admin');
  assert.equal(access.user('disabled').role, 'member');
});

test('revocation applies to existing tokens immediately and preserves original group membership', async () => {
  const secret = 'admin-role-test-secret';
  const token = jwt.sign({ username: 'alice' }, secret, { expiresIn: 7200 });
  async function authenticated() {
    const ctx = {
      ...controller('alice', {}).ctx,
      header: { authorization: token },
      app: { jwt, config: { jwt: { secret, renewBeforeSeconds: 1800 } } },
    };
    let called = false;
    await auth(ctx, async () => { called = true; });
    assert.equal(called, true);
    return ctx;
  }
  access.assertAdmin(await authenticated());
  await controller('root', { id: users.alice.id, role: 'member' }).run();
  const ctx = await authenticated();
  assert.equal(ctx.state.user.role, 'member');
  assert.throws(() => access.assertAdmin(ctx), { status: 403 });
  assert.equal(access.canAccess('alice', 'owned'), true);
  assert.equal(access.canAccess('alice', 'other'), false);
  assert.deepEqual(access.teams('alice').map(team => team.id), [1]);
  await assert.rejects(controller('alice', { id: users.bob.id, disabled: false }, 'setUser').run(), { status: 403 });
});
