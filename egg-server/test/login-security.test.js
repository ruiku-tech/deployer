'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deployer-login-security-'));
process.env.DEPLOY_DB_PATH = path.join(root, 'deployer.db');
process.env.DEPLOY_WORKSPACE = path.join(root, 'workspace');
const access = require('../app/service/access');
const database = require('../app/service/database');
const { authenticate } = require('../app/service/loginSecurity');
const DeployController = require('../app/controller/deploy');
const deviceId = 'd90a68b0-1a11-4bb3-8c88-ea9162941a54';

test.before(() => {
  access.register('root', 'correct-password');
  access.register('disabled', 'correct-password');
  database.getDb().prepare('UPDATE users SET disabled=1 WHERE username=?').run('disabled');
});

test.after(() => {
  database.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test('three failed attempts within three minutes lock the account for ten minutes', () => {
  const originalNow = Date.now;
  let now = 1800000000000;
  Date.now = () => now;
  try {
    assert.deepEqual(authenticate('root', 'wrong-1', deviceId), { invalid: true });
    now += 60000;
    assert.deepEqual(authenticate('root', 'wrong-2', deviceId), { invalid: true });
    now += 60000;
    const result = authenticate('root', 'wrong-3', deviceId);
    assert.equal(result.retryAfter, 600);
    assert.equal(result.lockedUntil, now + 600000);

    now += 300000;
    assert.equal(authenticate('root', 'correct-password', deviceId).retryAfter, 300);
    now += 300000;
    assert.equal(authenticate('root', 'correct-password', deviceId).user.username, 'root');
    assert.equal(database.getDb().prepare('SELECT 1 FROM login_attempts WHERE username=?').get('root'), undefined);
  } finally {
    Date.now = originalNow;
  }
});

test('failures older than three minutes no longer count toward a lock', () => {
  const originalNow = Date.now;
  let now = 1800000100000;
  Date.now = () => now;
  try {
    assert.deepEqual(authenticate('new-user', 'bad', deviceId), { invalid: true });
    now += 181000;
    assert.deepEqual(authenticate('new-user', 'bad', deviceId), { invalid: true });
    assert.equal(database.getDb().prepare('SELECT failed_at FROM login_attempts WHERE username=?').get('new-user').failed_at, JSON.stringify([ now ]));
  } finally {
    Date.now = originalNow;
  }
});

test('malformed credentials are rejected and disabled accounts count as failures', () => {
  assert.deepEqual(authenticate(undefined, 'password'), { invalid: true });
  assert.deepEqual(authenticate('root', null), { invalid: true });
  assert.deepEqual(authenticate('disabled', 'correct-password', deviceId), { invalid: true });
});

test('successful login clears previous failures and database initialization preserves the table', () => {
  authenticate('root', 'wrong', deviceId);
  assert.equal(authenticate('root', 'correct-password', deviceId).user.role, 'superadmin');
  database.close();
  authenticate('root', 'wrong', deviceId);
  assert.ok(database.getDb().prepare('SELECT 1 FROM login_attempts WHERE username=?').get('root'));
});

test('login endpoint responds with HTTP 429, Retry-After and a clear lock message', async () => {
  const controller = Object.create(DeployController.prototype);
  const headers = {};
  const ctx = controller.ctx = {
    request: { body: { username: 'blocked-user', password: 'wrong', deviceId }, ip: '127.0.0.1', get: () => 'test' },
    response: {},
    set(name, value) { headers[name.toLowerCase()] = value; },
    status: 200,
    body: null,
  };
  await controller.postLogin(ctx);
  await controller.postLogin(ctx);
  await controller.postLogin(ctx);
  assert.equal(ctx.status, 429);
  assert.equal(headers['retry-after'], '600');
  assert.match(ctx.body.message, /账号已锁定/);
  assert.equal(ctx.body.err.retryAfter, 600);
});
