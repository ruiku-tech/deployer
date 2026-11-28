const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const { parse } = require('@vue/compiler-sfc');

test('deployment logs auto-scroll by default and respect the manual-scroll checkbox', () => {
  const filename = path.join(__dirname, '../src/components/Logger.vue');
  const source = parse(fs.readFileSync(filename, 'utf8')).descriptor.script.content;
  const { code } = babel.transformSync(source, {
    filename, babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  const center = { token: { value: 'token' }, deviceId: 'device', env: { value: 'production' } };
  const dependencies = {
    '../api': { getDeploymentStatuses() {}, stopDeploy() {} },
    '../dataCenter': center,
    '../utils': { confirmDelete() {} },
  };
  const exported = {};
  let socket;
  class FakeWebSocket {
    constructor() { socket = this; this.readyState = 1; }
    close() {}
    send() {}
  }
  vm.runInNewContext(code, {
    exports: exported,
    process: { env: { VUE_APP_SERVER: '/deploy' } },
    require(name) { assert.ok(name in dependencies); return dependencies[name]; },
    URL,
    window: { location: { origin: 'http://localhost', protocol: 'http:' } },
    WebSocket: FakeWebSocket,
    setInterval: () => 1,
    clearInterval() {},
    setTimeout: () => 1,
    clearTimeout() {},
  }, { filename });

  const component = exported.default;
  const ctx = { ...component.data(), $nextTick(callback) { callback(); }, $refs: { output: { scrollTop: 0, scrollHeight: 100 } } };
  for (const [name, method] of Object.entries(component.methods)) ctx[name] = method.bind(ctx);
  assert.equal(ctx.autoScroll, true);
  ctx.selected = 'host-a';
  ctx.connect();
  socket.onmessage({ data: '环境:production:INFO:[host-a] first line' });
  assert.equal(ctx.$refs.output.scrollTop, 100);

  ctx.autoScroll = false;
  ctx.$refs.output.scrollTop = 25;
  socket.onmessage({ data: '环境:production:INFO:[host-a] second line' });
  assert.equal(ctx.$refs.output.scrollTop, 25);
  assert.equal(ctx.logs['host-a'].length, 2);

  ctx.autoScroll = true;
  ctx.toggleAutoScroll(true);
  assert.equal(ctx.$refs.output.scrollTop, 100);
});
