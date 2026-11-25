'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deployer-session-test-'));
process.env.DEPLOY_DB_PATH = path.join(root, 'deployer.db');
process.env.DEPLOY_WORKSPACE = path.join(root, 'workspace');
fs.mkdirSync(process.env.DEPLOY_WORKSPACE, { recursive: true });

const database = require('../app/service/database');
const access = require('../app/service/access');
const session = require('../app/service/session');
const devices = require('../app/service/deviceSecurity');
const auth = require('../app/middleware/auth')();
const secret = session.signingSecret();
const deviceId = '35f4e4d8-91f2-4cbd-87b2-925b08d8f857';
const deviceHash = devices.deviceHash(deviceId);
const app = { jwt, config: { jwt: { secret, expiresIn: '120m', renewBeforeSeconds: 1800 } } };

function context(token, requestDeviceId = deviceId) {
  const headers = {};
  return {
    header: token ? { authorization: token, 'x-device-id': requestDeviceId } : {},
    get(name) { return name.toLowerCase() === 'x-device-id' ? requestDeviceId : ''; },
    app,
    state: {},
    status: 200,
    body: null,
    set(name, value) { headers[name.toLowerCase()] = value; },
    headers,
  };
}

test.before(() => {
  access.register('member', 'password');
  devices.trustInitialDevice(access.user('member').id, deviceId);
});
test.after(() => {
  database.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test('active requests renew near-expiry tokens and expose the header to browsers', async () => {
  const token = jwt.sign({ username: 'member', deviceId: deviceHash }, secret, { expiresIn: 600 });
  const ctx = context(token);
  let called = false;
  await auth(ctx, async () => { called = true; });
  assert.equal(called, true);
  assert.equal(ctx.state.user.username, 'member');
  assert.ok(ctx.headers['x-access-token']);
  assert.ok(jwt.verify(ctx.headers['x-access-token'], secret).exp > jwt.verify(token, secret).exp);
  assert.equal(ctx.headers['cache-control'], 'no-store');
});

test('tokens outside the renewal window pass without changing the session', async () => {
  const ctx = context(jwt.sign({ username: 'member', deviceId: deviceHash }, secret, { expiresIn: 7200 }));
  let called = false;
  await auth(ctx, async () => { called = true; });
  assert.equal(called, true);
  assert.equal(ctx.headers['x-access-token'], undefined);
});

test('a valid session token cannot be replayed with another device identifier', async () => {
  const token = jwt.sign({ username: 'member', deviceId }, secret, { expiresIn: 7200 });
  const ctx = context(token, '26fb052b-218e-4c3c-a36c-b7574d56e960');
  let called = false;
  await auth(ctx, async () => { called = true; });
  assert.equal(ctx.status, 401);
  assert.equal(called, false);
});

test('a session token is rejected when its matching device has not been approved', async () => {
  const untrusted = '26fb052b-218e-4c3c-a36c-b7574d56e960';
  const token = jwt.sign({ username: 'member', deviceId: devices.deviceHash(untrusted) }, secret, { expiresIn: 7200 });
  const ctx = context(token, untrusted);
  let called = false;
  await auth(ctx, async () => { called = true; });
  assert.equal(ctx.status, 401);
  assert.equal(called, false);
});

test('expired tokens and disabled accounts cannot be renewed', async () => {
  const expired = context(jwt.sign({ username: 'member', deviceId: deviceHash }, secret, { expiresIn: -1 }));
  let called = false;
  await auth(expired, async () => { called = true; });
  assert.equal(expired.status, 401);
  assert.equal(called, false);
  assert.equal(expired.headers['x-access-token'], undefined);

  database.getDb().prepare('UPDATE users SET disabled=1 WHERE username=?').run('member');
  const disabled = context(jwt.sign({ username: 'member', deviceId: deviceHash }, secret, { expiresIn: 600 }));
  await auth(disabled, async () => { called = true; });
  assert.equal(disabled.status, 401);
  assert.equal(disabled.headers['x-access-token'], undefined);
});

test('the signing secret survives a database connection restart', () => {
  const token = jwt.sign({ username: 'member', deviceId: deviceHash }, secret, { expiresIn: 3600 });
  database.close();
  assert.equal(session.signingSecret(), secret);
  assert.equal(jwt.verify(token, session.signingSecret()).username, 'member');
});
