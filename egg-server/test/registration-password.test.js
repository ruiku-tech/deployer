'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deployer-registration-'));
process.env.DEPLOY_DB_PATH = path.join(root, 'deployer.db');
process.env.DEPLOY_WORKSPACE = path.join(root, 'workspace');
const database = require('../app/service/database');
const DeployController = require('../app/controller/deploy');
const passwords = require('../app/service/registrationPassword');
const app = { jwt, config: { jwt: { secret: 'registration-test-only-secret' } } };
const originalKey = process.env.DEPLOY_KEY;
process.env.DEPLOY_KEY = speakeasy.generateSecret().base32;

test.after(() => {
  if (originalKey === undefined) delete process.env.DEPLOY_KEY;
  else process.env.DEPLOY_KEY = originalKey;
  database.close();
  fs.rmSync(root, { recursive: true, force: true });
});

function context(body) {
  return { app, request: { body, ip: '127.0.0.1' }, response: {}, status: 200, headers: {},
    set(key, value) { this.headers[key] = value; },
    assert(value, status, message) { if (!value) throw new Error(message); },
  };
}

test('generated passwords are unique and credentials bind the username, password and purpose', () => {
  const first = passwords.generate(app, 'alice');
  const second = passwords.generate(app, 'alice');
  assert.match(first.password, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.password, second.password);
  assert.equal(passwords.verify(app, 'alice', first.password, first.registrationToken), true);
  assert.equal(passwords.verify(app, 'bob', first.password, first.registrationToken), false);
  assert.equal(passwords.verify(app, 'alice', second.password, first.registrationToken), false);
  assert.equal(passwords.verify(app, 'alice', first.password, `${first.registrationToken}x`), false);
  const payload = jwt.verify(first.registrationToken, app.config.jwt.secret);
  assert.equal(payload.exp - payload.iat, 1800);
  assert.equal(JSON.stringify(payload).includes(first.password), false);
  const expired = jwt.sign({ ...payload, exp: 1 }, app.config.jwt.secret);
  assert.equal(passwords.verify(app, 'alice', first.password, expired), false);
  const wrongPurpose = jwt.sign({ ...payload, purpose: 'other' }, app.config.jwt.secret);
  assert.equal(passwords.verify(app, 'alice', first.password, wrongPurpose), false);
});

test('invalid usernames cannot inject extra lines in downloaded credentials', () => {
  for (const username of [ '', '  ', null, [], 'a\n密码：fake', 'a\rname', 'a\0', 'a'.repeat(129) ]) {
    assert.throws(() => passwords.generate(app, username), /有效用户名/);
  }
  assert.doesNotThrow(() => passwords.generate(app, '开发人员'));
});

test('the generation endpoint forbids caching and registration rejects manually chosen passwords', async () => {
  const generated = context({ username: 'new-member' });
  await DeployController.prototype.generateRegistrationPassword(generated);
  assert.equal(generated.headers['Cache-Control'], 'no-store');
  const credentials = generated.body.data;
  const bypass = context({ username: 'new-member', password: 'ReusedPassword1!', code: '123456' });
  await DeployController.prototype.postRegister(bypass);
  assert.equal(bypass.status, 400);
  assert.equal(database.findUsers({ username: 'new-member' }).length, 0);

  const request = context({ username: 'new-member', ...credentials, code: 'invalid' });
  await DeployController.prototype.postRegister(request);
  assert.ok(request.body.err);
  assert.equal(database.findUsers({ username: 'new-member' }).length, 0);
  request.request.body.code = speakeasy.totp({ secret: process.env.DEPLOY_KEY, encoding: 'base32' });
  await DeployController.prototype.postRegister(request);
  assert.equal(request.body.data, 'sccess');
  assert.equal(database.findUsers({ username: 'new-member', password: credentials.password }).length, 1);
  await DeployController.prototype.postRegister(request);
  assert.equal(request.body.err.code, '用户名已注册');
  assert.equal(database.findUsers({ username: 'new-member' }).length, 1);
});
