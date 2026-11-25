'use strict';

const crypto = require('crypto');
const speakeasy = require('speakeasy');
const access = require('./access');
const session = require('./session');

const CHALLENGE_MS = 30 * 60 * 1000;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeDeviceId(value) {
  if (typeof value !== 'string' || !UUID_V4.test(value)) throw new Error('设备编号无效，请刷新页面后重新登录');
  return value.toLowerCase();
}

function deviceHash(deviceId) {
  return crypto.createHash('sha256').update(normalizeDeviceId(deviceId)).digest('hex');
}

function hashChallenge(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function trustInitialDevice(userId, deviceId) {
  const hash = deviceHash(deviceId);
  const db = access.init();
  return db.transaction(() => {
    const found = db.prepare('SELECT 1 FROM trusted_devices WHERE user_id=? AND device_hash=?').get(userId, hash);
    if (found) {
      db.prepare('UPDATE trusted_devices SET last_seen=? WHERE user_id=? AND device_hash=?').run(Date.now(), userId, hash);
      return true;
    }
    const existingCount = db.prepare('SELECT COUNT(*) AS count FROM trusted_devices WHERE user_id=?').get(userId).count;
    if (existingCount === 0) {
      db.prepare('INSERT INTO trusted_devices(user_id,device_hash,created_at,last_seen) VALUES(?,?,?,?)').run(userId, hash, Date.now(), Date.now());
      return true;
    }
    return false;
  }).immediate();
}

function requestApproval(userId, deviceId, { ip = '', userAgent = '' } = {}) {
  const idHash = deviceHash(deviceId);
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashChallenge(token);
  const now = Date.now();
  const db = access.init();
  const result = db.transaction(() => {
    db.prepare('UPDATE device_approvals SET status=\'expired\' WHERE status=\'pending\' AND expires_at<=?').run(now);
    db.prepare('DELETE FROM device_approvals WHERE status IN (\'expired\',\'denied\',\'consumed\') AND created_at<?').run(now - 7 * 24 * 60 * 60 * 1000);
    const pending = db.prepare('SELECT id FROM device_approvals WHERE user_id=? AND device_hash=? AND status=\'pending\'').get(userId, idHash);
    if (pending) {
      db.prepare('UPDATE device_approvals SET challenge_hash=?,user_agent=?,ip=?,created_at=?,expires_at=? WHERE id=?')
        .run(tokenHash, userAgent.slice(0, 500), ip.slice(0, 100), now, now + CHALLENGE_MS, pending.id);
      return pending.id;
    }
    const inserted = db.prepare(`INSERT INTO device_approvals
      (user_id,device_hash,challenge_hash,user_agent,ip,created_at,expires_at)
      VALUES(?,?,?,?,?,?,?)`).run(userId, idHash, tokenHash, userAgent.slice(0, 500), ip.slice(0, 100), now, now + CHALLENGE_MS);
    return Number(inserted.lastInsertRowid);
  }).immediate();
  return { requestId: result, approvalToken: token, expiresAt: now + CHALLENGE_MS };
}

function isTrusted(userId, deviceId) {
  try {
    return !!access.init().prepare('SELECT 1 FROM trusted_devices WHERE user_id=? AND device_hash=?')
      .get(userId, deviceHash(deviceId));
  } catch { return false; }
}

function listRequests(actor) {
  const db = access.init();
  db.prepare('UPDATE device_approvals SET status=\'expired\' WHERE status=\'pending\' AND expires_at<=?').run(Date.now());
  const superadmin = actor.role === 'superadmin';
  const rows = superadmin
    ? db.prepare('SELECT a.id,a.user_id,u.username,a.user_agent,a.ip,a.created_at,a.expires_at FROM device_approvals a JOIN users u ON u.id=a.user_id WHERE a.status=\'pending\' ORDER BY a.created_at').all()
    : db.prepare('SELECT a.id,a.user_id,u.username,a.user_agent,a.ip,a.created_at,a.expires_at FROM device_approvals a JOIN users u ON u.id=a.user_id WHERE a.user_id=? AND a.status=\'pending\' ORDER BY a.created_at').all(actor.id);
  return rows;
}

function verifySuperadminCode(code) {
  const secret = process.env.DEPLOY_KEY;
  if (!secret) return false;
  return speakeasy.totp.verify({ secret, encoding: 'base32', token: String(code || ''), window: 1 });
}

function approve(requestId, actor, code) {
  const db = access.init();
  return db.transaction(() => {
    const row = db.prepare('SELECT * FROM device_approvals WHERE id=? AND status=\'pending\' AND expires_at>?').get(Number(requestId), Date.now());
    if (!row) return { error: '设备申请不存在或已过期' };
    const isOwner = row.user_id === actor.id;
    if (!isOwner && actor.role !== 'superadmin') return { error: '无权批准此设备' };
    if (actor.role === 'superadmin' && !verifySuperadminCode(code)) return { error: 'Google 验证码错误或服务端未配置 DEPLOY_KEY' };
    const timestamp = Date.now();
    db.prepare(`INSERT INTO trusted_devices(user_id,device_hash,created_at,last_seen) VALUES(?,?,?,?)
      ON CONFLICT(user_id,device_hash) DO UPDATE SET last_seen=excluded.last_seen`)
      .run(row.user_id, row.device_hash, timestamp, timestamp);
    db.prepare('UPDATE device_approvals SET status=\'approved\' WHERE id=?').run(row.id);
    return { approved: true };
  }).immediate();
}

function deny(requestId, actor) {
  const db = access.init();
  const row = db.prepare('SELECT user_id FROM device_approvals WHERE id=? AND status=\'pending\' AND expires_at>?').get(Number(requestId), Date.now());
  if (!row) return { error: '设备申请不存在或已过期' };
  if (row.user_id !== actor.id && actor.role !== 'superadmin') return { error: '无权拒绝此设备' };
  db.prepare('UPDATE device_approvals SET status=\'denied\' WHERE id=? AND status=\'pending\'').run(Number(requestId));
  return { denied: true };
}

function poll(app, token) {
  if (typeof token !== 'string' || token.length < 40 || token.length > 100) return { status: 'invalid' };
  const db = access.init();
  return db.transaction(() => {
    const row = db.prepare('SELECT * FROM device_approvals WHERE challenge_hash=?').get(hashChallenge(token));
    if (!row) return { status: 'invalid' };
    if (row.status === 'pending' && row.expires_at <= Date.now()) {
      db.prepare('UPDATE device_approvals SET status=\'expired\' WHERE id=?').run(row.id);
      return { status: 'expired' };
    }
    if (row.status !== 'approved') return { status: row.status };
    const user = access.userById(row.user_id);
    if (!user || user.disabled) return { status: 'invalid' };
    db.prepare('UPDATE device_approvals SET status=\'consumed\' WHERE id=? AND status=\'approved\'').run(row.id);
    return {
      status: 'approved',
      user: { username: user.username, role: user.role },
      token: session.issueToken(app, user.username, row.device_hash, true),
    };
  }).immediate();
}

// Egg treats bare function exports in app/service as factories.
module.exports = {
  normalizeDeviceId,
  deviceHash,
  trustInitialDevice,
  requestApproval,
  isTrusted,
  listRequests,
  approve,
  deny,
  poll,
};
