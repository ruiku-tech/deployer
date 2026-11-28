const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const { parse } = require('@vue/compiler-sfc');

function loadComponent(relativePath, dependencies) {
  const filename = path.join(__dirname, relativePath);
  const source = parse(fs.readFileSync(filename, 'utf8')).descriptor.script.content;
  const { code } = babel.transformSync(source, {
    filename, babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  const exported = {};
  vm.runInNewContext(code, { exports: exported, require(name) {
    assert.ok(name in dependencies, `${relativePath}: ${name}`);
    return dependencies[name];
  } }, { filename });
  return exported.default;
}

test('deploy confirmation collects TEXT and FILE fields from scripts and nested configs', async () => {
  const errors = [], calls = [];
  const component = loadComponent('../src/components/DeployConfirm.vue', {
    'element-plus': { ElMessage: { error: message => errors.push(message) } },
    '../api': {
      deploy: async (...args) => { calls.push(args); },
      fetchFilesStat: async () => [{ file: 'release.jar' }],
      fetchScript: async () => 'run: start [CONF:app.conf]\nput: [FILE:bundle],/opt/app/release.jar',
      fetchConfig: async name => name === 'app.conf' ? 'run: show [TEXT:演示分钟数] [CONF:extra.conf]' : 'run: tag [TEXT:发布标签]',
    },
    '../utils': { prodConfirm: async () => {} },
    '../dataCenter': { env: { value: 'production' } },
  });
  const ctx = {
    ...component.data(), list: [{ name: '发布', host: 'server', cmds: ['deploy.sh'] }],
    $emit(event) { this.emitted = event; },
  };
  for (const [name, method] of Object.entries(component.methods)) ctx[name] = method.bind(ctx);
  await ctx.init();
  assert.deepEqual(Array.from(ctx.form.files, item => item.name), ['bundle']);
  assert.deepEqual(Array.from(ctx.form.texts, item => item.name).sort(), ['发布标签', '演示分钟数']);

  ctx.form.files[0].value = 'release.jar';
  ctx.form.texts.find(item => item.name === '演示分钟数').value = ' ';
  ctx.form.texts.find(item => item.name === '发布标签').value = '15';
  await ctx.run();
  assert.match(errors[0], /请填写运行时参数/);
  assert.equal(calls.length, 0);

  ctx.form.texts.find(item => item.name === '演示分钟数').value = 'nightly';
  await ctx.run();
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][3])), { '发布标签': '15', '演示分钟数': 'nightly' });
  assert.equal(ctx.emitted, 'close');
});

test('resource clone preview disables collisions and submits only after a clean check', async () => {
  let targetResources = [{ name: 'app.conf' }];
  const cloneCalls = [], confirms = [];
  const component = loadComponent('../src/components/ResourceCloneDialog.vue', {
    'element-plus': {
      ElMessage: { success() {} },
      ElMessageBox: { confirm: async message => { confirms.push(message); } },
    },
    '../api/envs': { fetchEnvs: async () => [{ name: 'source' }, { name: 'target' }] },
    '../api/configs': {
      fetchResourceNames: async () => targetResources,
      cloneResource: async (...args) => cloneCalls.push(args),
    },
    '../dataCenter': { env: { value: 'source' } },
  });
  const ctx = { ...component.data(), resourceName: 'app.conf', resourceType: 'config', $emit() {} };
  for (const [name, method] of Object.entries(component.methods)) ctx[name] = method.bind(ctx);
  Object.defineProperty(ctx, 'conflict', { get: () => component.computed.conflict.call(ctx) });
  await ctx.loadEnvironments();
  assert.deepEqual(Array.from(ctx.targets, item => item.name), ['target']);
  await ctx.inspectTarget(ctx.targets[0]);
  await ctx.clone();
  assert.equal(cloneCalls.length, 0);
  assert.equal(confirms.length, 0);

  targetResources = [{ name: 'other.conf' }];
  await ctx.inspectTarget(ctx.targets[0]);
  await ctx.clone();
  assert.deepEqual(cloneCalls, [['config', 'app.conf', 'target']]);
  assert.equal(confirms.length, 1);
});
