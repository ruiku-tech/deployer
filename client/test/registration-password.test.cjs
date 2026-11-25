const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const { parse } = require('@vue/compiler-sfc');

function setup() {
  const filename = path.join(__dirname, '../src/components/Login.vue');
  const source = parse(fs.readFileSync(filename, 'utf8')).descriptor.script.content;
  const { code } = babel.transformSync(source, {
    filename, babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  const calls = [], messages = [], anchors = [], blobs = [], revoked = [];
  const api = {
    generateRegistrationPassword: async username => {
      calls.push(['generate', username]);
      return { password: 'random-password', registrationToken: 'signed-proof' };
    },
    register: async (...args) => { calls.push(['register', ...args]); return 'sccess'; },
  };
  const dependencies = {
    '../api': api, '../api/login': {}, '../dataCenter': {},
    'element-plus': { ElMessage: Object.fromEntries(['error', 'warning', 'success'].map(key => [key, text => messages.push(text)])) },
  };
  const exported = {};
  vm.runInNewContext(code, {
    exports: exported, Blob,
    window: { location: { hostname: '47.86.110.66', origin: 'https://47.86.110.66:7001' } },
    URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:credentials'; }, revokeObjectURL(url) { revoked.push(url); } },
    document: {
      body: { appendChild(anchor) { anchors.push(anchor); } },
      createElement() { return { click() { this.clicked = true; }, remove() { this.removed = true; } }; },
    },
    setTimeout(callback) { callback(); },
    require(name) { assert.ok(name in dependencies, name); return dependencies[name]; },
  }, { filename });
  const component = exported.default;
  const ctx = component.data();
  Object.assign(ctx, Object.fromEntries(Object.entries(component.methods).map(([key, method]) => [key, method.bind(ctx)])));
  ctx.loginModel = '1';
  ctx.registerForm.username = '开发人员';
  return { ctx, component, calls, messages, anchors, blobs, revoked, api };
}

test('registration generates a read-only password and downloads the exact account credentials', async () => {
  const env = setup();
  await env.ctx.submit();
  assert.equal(env.calls.length, 0, 'registration waits for a password download');
  await env.ctx.generatePassword();
  assert.equal(env.ctx.generatedPassword, 'random-password');
  assert.equal(env.ctx.credentialsDownloaded, false);
  env.ctx.downloadCredentials();
  assert.equal(env.anchors[0].download, '47.86.110.66.部署平台.txt');
  assert.equal(env.anchors[0].clicked, true);
  assert.equal(env.anchors[0].removed, true);
  assert.equal(env.ctx.credentialsDownloaded, true);
  assert.deepEqual(env.revoked, ['blob:credentials']);
  const text = await env.blobs[0].text();
  assert.match(text, /地址：https:\/\/47\.86\.110\.66:7001\r\n/);
  assert.match(text, /账号：开发人员\r\n密码：random-password\r\n/);
  env.ctx.registerForm.password = 'manually injected password';
  env.ctx.registerForm.code = '123456';
  await env.ctx.submit();
  assert.deepEqual(env.calls[1], ['register', '开发人员', 'random-password', '123456', 'signed-proof']);
  assert.equal(env.ctx.loginModel, '0');
  assert.equal(env.ctx.submitting, false);
});

test('changing the username clears generated credentials and stale generation responses are ignored', async () => {
  const env = setup();
  await env.ctx.generatePassword();
  env.ctx.downloadCredentials();
  env.ctx.registerForm.username = 'second-user';
  env.component.watch['registerForm.username'].call(env.ctx);
  assert.equal(env.ctx.generatedPassword, '');
  assert.equal(env.ctx.registrationToken, '');
  assert.equal(env.ctx.credentialsDownloaded, false);

  let resolve;
  env.api.generateRegistrationPassword = () => new Promise(done => { resolve = done; });
  const pending = env.ctx.generatePassword();
  env.ctx.registerForm.username = 'third-user';
  env.component.watch['registerForm.username'].call(env.ctx);
  resolve({ password: 'stale', registrationToken: 'stale' });
  await pending;
  assert.equal(env.ctx.generatedPassword, '');
  assert.equal(env.ctx.generatingPassword, false);
});

test('regenerating requires another download, and registration failures preserve downloaded credentials', async () => {
  const env = setup();
  await env.ctx.generatePassword();
  env.ctx.downloadCredentials();
  await env.ctx.generatePassword();
  assert.equal(env.ctx.credentialsDownloaded, false);
  await env.ctx.submit();
  assert.equal(env.calls.filter(call => call[0] === 'register').length, 0);
  env.ctx.downloadCredentials();
  let reject;
  env.api.register = () => new Promise((resolve, fail) => { reject = fail; });
  const pending = env.ctx.submit();
  assert.equal(env.ctx.submitting, true);
  reject(new Error('invalid TOTP'));
  await pending;
  assert.equal(env.ctx.submitting, false);
  assert.equal(env.ctx.generatedPassword, 'random-password');
  assert.equal(env.ctx.credentialsDownloaded, true);
});
