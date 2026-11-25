'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deployer-device-security-'));
process.env.DEPLOY_DB_PATH = path.join(root, 'deployer.db');
process.env.DEPLOY_WORKSPACE = path.join(root, 'workspace');
const access = require('../app/service/access');
const database = require('../app/service/database');
const loginSecurity = require('../app/service/loginSecurity');
const devices = require('../app/service/deviceSecurity');
const secret = 'device-security-test-secret';
const app = { jwt, config: { jwt: { secret, expiresIn: '120m' } } };
const ownerDevice = '2387f212-8994-47a2-aa63-dd22d7ef77da';
const newDevice = '39ec135d-5a47-481f-89ab-d7ad7d4128c3';
const adminDevice = '8fa8e80d-b87d-42d2-a775-cc755a36cd3d';

test.before(() => {
  access.register('root', 'root-password');
  access.register('member', 'member-password');
  devices.trustInitialDevice(access.user('root').id, adminDevice);
});

test.after(() => {
  delete process.env.DEPLOY_KEY;
  database.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test('first device is trusted; another device needs approval from a trusted device', () => {
  const first = loginSecurity.authenticate('member', 'member-password', ownerDevice, { ip: '192.0.2.1' });
  assert.equal(first.user.deviceId, ownerDevice);
  assert.equal(devices.isTrusted(access.user('member').id, ownerDevice), true);

  const second = loginSecurity.authenticate('member', 'member-password', newDevice, { ip: '192.0.2.2', userAgent: 'Test browser' });
  assert.ok(second.pending.approvalToken);
  assert.equal(devices.isTrusted(access.user('member').id, newDevice), false);
  assert.equal(devices.listRequests(access.user('member'))[0].user_agent, 'Test browser');

  assert.deepEqual(devices.approve(second.pending.requestId, access.user('member')), { approved: true });
  assert.equal(devices.isTrusted(access.user('member').id, newDevice), true);
  const poll = devices.poll(app, second.pending.approvalToken);
  assert.equal(poll.status, 'approved');
  assert.equal(jwt.verify(poll.token, secret).deviceId, devices.deviceHash(newDevice));
  assert.equal(devices.poll(app, second.pending.approvalToken).status, 'consumed');
});

test('superadmin approval requires a configured Google TOTP code', () => {
  const pending = loginSecurity.authenticate('member', 'member-password', '2f854ee1-2bf1-4639-990d-dcc387c3f08a');
  assert.ok(pending.pending);
  const superadmin = access.user('root');
  assert.match(devices.approve(pending.pending.requestId, superadmin, '123456').error, /验证码错误或服务端未配置/);

  process.env.DEPLOY_KEY = speakeasy.generateSecret({ length: 20 }).base32;
  const code = speakeasy.totp({ secret: process.env.DEPLOY_KEY, encoding: 'base32' });
  assert.deepEqual(devices.approve(pending.pending.requestId, superadmin, code), { approved: true });
});

test('device identifiers and approval capabilities are validated', () => {
  assert.throws(() => devices.deviceHash('not-a-uuid'), /设备编号无效/);
  assert.equal(devices.poll(app, 'short-token').status, 'invalid');
  const pending = loginSecurity.authenticate('member', 'member-password', '666c23e4-2f3a-4e3f-9cb8-ef2a6f0805ef');
  const unauthorized = devices.approve(pending.pending.requestId, { ...access.user('root'), role: 'admin' });
  assert.equal(unauthorized.error, '无权批准此设备');
  assert.deepEqual(devices.deny(pending.pending.requestId, access.user('member')), { denied: true });
  assert.equal(devices.poll(app, pending.pending.approvalToken).status, 'denied');
});
