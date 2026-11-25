'use strict';

const crypto = require('crypto');

function validUsername(username) {
  return typeof username === 'string' && username.trim().length > 0 &&
    // eslint-disable-next-line no-control-regex -- Reject control characters in account export lines.
    username.length <= 128 && !/[\x00-\x1f\x7f]/.test(username);
}

function passwordHash(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generate(app, username) {
  if (!validUsername(username)) throw new Error('请输入有效用户名（最多 128 个字符，不含换行）');
  const password = crypto.randomBytes(32).toString('base64url');
  const registrationToken = app.jwt.sign({
    purpose: 'registration-password', username, passwordHash: passwordHash(password),
  }, app.config.jwt.secret, { expiresIn: '30m' });
  return { password, registrationToken };
}

function verify(app, username, password, token) {
  if (!validUsername(username) || typeof password !== 'string' ||
      password.length !== 43 || typeof token !== 'string' || token.length > 2048) return false;
  try {
    const payload = app.jwt.verify(token, app.config.jwt.secret);
    return payload.purpose === 'registration-password' && payload.username === username &&
      typeof payload.passwordHash === 'string' && payload.passwordHash.length === 64 &&
      crypto.timingSafeEqual(Buffer.from(payload.passwordHash), Buffer.from(passwordHash(password)));
  } catch { return false; }
}

module.exports = { generate, verify };
