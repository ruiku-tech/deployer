'use strict';

const database = require('./database');
const access = require('./access');
const devices = require('./deviceSecurity');

const WINDOW_MS = 3 * 60 * 1000;
const LOCK_MS = 10 * 60 * 1000;
const MAX_FAILURES = 3;

function lockedResult(lockedUntil, now) {
  return { lockedUntil, retryAfter: Math.ceil((lockedUntil - now) / 1000) };
}

function authenticate(username, password, deviceId, requestInfo) {
  // Do not normalize names: existing usernames use SQLite's exact comparison.
  if (typeof username !== 'string' || !username.trim() ||
      typeof password !== 'string' || !password) {
    return { invalid: true };
  }
  devices.normalizeDeviceId(deviceId);

  const db = access.init();
  // Serialize checking, authentication and failure updates across connections.
  return db.transaction(() => {
    const now = Date.now();
    db.prepare('DELETE FROM login_attempts WHERE expires_at <= ?').run(now);
    const previous = db.prepare('SELECT * FROM login_attempts WHERE username=?').get(username);
    if (previous && previous.locked_until > now) return lockedResult(previous.locked_until, now);

    const users = database.findUsers({ username, password });
    if (users.length && !users[0].disabled) {
      db.prepare('DELETE FROM login_attempts WHERE username=?').run(username);
      const { id, role } = users[0];
      const trusted = devices.trustInitialDevice(id, deviceId);
      if (trusted) return { user: { id, username, role, deviceId } };
      return { pending: devices.requestApproval(id, deviceId, requestInfo) };
    }

    // Store only the small rolling window; use the same behavior for unknown
    // and disabled accounts, and expire old entries to avoid permanent growth.
    const failures = previous ? JSON.parse(previous.failed_at).filter(time => time > now - WINDOW_MS) : [];
    failures.push(now);
    const lockedUntil = failures.length >= MAX_FAILURES ? now + LOCK_MS : 0;
    db.prepare(`INSERT INTO login_attempts(username,failed_at,locked_until,expires_at)
      VALUES (?,?,?,?) ON CONFLICT(username) DO UPDATE SET
      failed_at=excluded.failed_at, locked_until=excluded.locked_until, expires_at=excluded.expires_at`)
      .run(username, JSON.stringify(lockedUntil ? [] : failures), lockedUntil, lockedUntil || now + WINDOW_MS);
    return lockedUntil ? lockedResult(lockedUntil, now) : { invalid: true };
  }).immediate();
}

// An object export prevents Egg from invoking this helper as a service factory.
module.exports = { authenticate };
