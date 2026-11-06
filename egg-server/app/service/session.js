'use strict';

const crypto = require('crypto');
const database = require('./database');

function signingSecret() {
  if (process.env.DEPLOY_JWT) return process.env.DEPLOY_JWT;
  // Kept in the existing database, which release updates do not overwrite.
  let secret = database.getMeta('jwt_signing_secret');
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    database.setMeta('jwt_signing_secret', secret);
  }
  return secret;
}

function issueToken(app, username) {
  return app.jwt.sign({ username }, app.config.jwt.secret, {
    expiresIn: app.config.jwt.expiresIn,
  });
}

module.exports = { signingSecret, issueToken };
