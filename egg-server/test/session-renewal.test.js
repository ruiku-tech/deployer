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
const auth = require('../app/middleware/auth')();
const secret = session.signingSecret();
const app = { jwt, config: { jwt: { secret, expiresIn: '120m', renewBeforeSeconds: 1800 } } };

function context(token) {
  const headers = {};
  return {
    header: token ? { authorization: token } : {},
    app,
    state: {},
    status: 200,
    body: null,
    set(name, value) { headers[name.toLowerCase()] = value; },
    headers,
  };
}

test.before(() => access.register('member', 'password'));
test.after(() => {
  database.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test('active requests renew near-expiry tokens and expose the header to browsers', async () => {
  const token = jwt.sign({ username: 'member' }, secret, { expiresIn: 600 });
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
  const ctx = context(jwt.sign({ username: 'member' }, secret, { expiresIn: 7200 }));
  let called = false;
  await auth(ctx, async () => { called = true; });
  assert.equal(called, true);
  assert.equal(ctx.headers['x-access-token'], undefined);
});

test('expired tokens and disabled accounts cannot be renewed', async () => {
  const expired = context(jwt.sign({ username: 'member' }, secret, { expiresIn: -1 }));
  let called = false;
  await auth(expired, async () => { called = true; });
  assert.equal(expired.status, 401);
  assert.equal(called, false);
  assert.equal(expired.headers['x-access-token'], undefined);

  database.getDb().prepare('UPDATE users SET disabled=1 WHERE username=?').run('member');
  const disabled = context(jwt.sign({ username: 'member' }, secret, { expiresIn: 600 }));
  await auth(disabled, async () => { called = true; });
  assert.equal(disabled.status, 401);
  assert.equal(disabled.headers['x-access-token'], undefined);
});

test('the signing secret survives a database connection restart', () => {
  const token = jwt.sign({ username: 'member' }, secret, { expiresIn: 3600 });
  database.close();
  assert.equal(session.signingSecret(), secret);
  assert.equal(jwt.verify(token, session.signingSecret()).username, 'member');
});
