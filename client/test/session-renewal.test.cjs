const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');

const filename = path.join(__dirname, '../src/api/base.js');
const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
  filename, babelrc: false, configFile: false,
  plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
});
const token = exp => `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`;

function setup() {
  const requests = [], responses = [], errors = [];
  const center = { token: { value: token(1000) }, env: { value: 'test' }, setToken(value) { this.token.value = value; } };
  const axios = { create: () => ({ interceptors: {
    request: { use: (...handlers) => requests.push(handlers) },
    response: { use: (...handlers) => responses.push(handlers) },
  } }) };
  const dependencies = {
    axios, '../dataCenter': center,
    'element-plus': { ElMessage: { error: message => errors.push(message) }, ElLoading: { service: () => ({ close() {} }) } },
  };
  vm.runInNewContext(code, { exports: {}, process: { env: {} }, atob,
    require(name) { if (!(name in dependencies)) throw new Error(`Unexpected import ${name}`); return dependencies[name]; },
  }, { filename });
  return { requests, success: responses[0][0], failure: responses[0][1], center, errors };
}
function response(authorization, renewedToken) {
  return { config: { headers: { Authorization: authorization, nofeel: true } },
    headers: renewedToken ? { 'x-access-token': renewedToken } : {}, data: { data: 'ok' } };
}

test('renewal updates the stored token and subsequent request credentials', () => {
  const env = setup();
  assert.equal(env.success(response(env.center.token.value, token(8000))), 'ok');
  assert.equal(env.center.token.value, token(8000));
  const config = { headers: {} };
  env.requests[0][0](config);
  assert.equal(config.headers.Authorization, token(8000));
});
test('late responses cannot roll back a renewed token or restore a logged-out session', () => {
  const env = setup(), old = env.center.token.value;
  env.success(response(old, token(8000)));
  env.success(response(old, token(7000)));
  assert.equal(env.center.token.value, token(8000));
  env.center.setToken('');
  env.success(response(old, token(9000)));
  assert.equal(env.center.token.value, '');
});
test('only a 401 for the current token clears the session', async () => {
  const env = setup(), old = env.center.token.value;
  env.success(response(old, token(8000)));
  await assert.rejects(env.failure({ config: response(old).config, response: { status: 401, data: { message: 'expired' } } }));
  assert.equal(env.center.token.value, token(8000));
  assert.equal(env.errors.length, 0);
  await assert.rejects(env.failure({ config: response(token(8000)).config, response: { status: 401, data: { message: 'disabled' } } }));
  assert.equal(env.center.token.value, '');
  assert.deepEqual(env.errors, ['disabled']);
});
test('network failures without a response preserve the session', async () => {
  const env = setup();
  await assert.rejects(env.failure({ message: 'Network Error' }));
  assert.equal(env.center.token.value, token(1000));
});
