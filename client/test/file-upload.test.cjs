const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const { parse } = require('@vue/compiler-sfc');

test('upload ignores duplicate clicks, clears selection only on success, and unlocks after failure', async () => {
  const filename = path.join(__dirname, '../src/components/Files.vue');
  const source = parse(fs.readFileSync(filename, 'utf8')).descriptor.script.content;
  const { code } = babel.transformSync(source, {
    filename, babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  let resolveUpload, rejectUpload, calls = 0;
  const dependencies = {
    '../api': { uploadFile() {
      calls++;
      return new Promise((resolve, reject) => { resolveUpload = resolve; rejectUpload = reject; });
    } },
    '../utils': {}, '@/dataCenter': {}, vue: {},
    'element-plus': { ElMessage: { error() {} } },
  };
  const exported = {};
  vm.runInNewContext(code, {
    exports: exported, setTimeout() {},
    require: name => { assert.ok(name in dependencies); return dependencies[name]; },
  }, { filename });
  const component = exported.default;
  const input = { files: [{ name: 'large.jar' }], value: 'large.jar' };
  const ctx = { ...component.data(), $refs: { file: input }, inputs: 'release note' };
  component.methods.upload.call(ctx);
  component.methods.upload.call(ctx);
  assert.equal(calls, 1);
  assert.equal(ctx.uploading, true);
  resolveUpload();
  await new Promise(setImmediate);
  assert.equal(ctx.uploading, false);
  assert.equal(input.value, '');
  assert.equal(ctx.inputs, '');

  input.value = 'retry.jar';
  ctx.inputs = 'keep this note';
  component.methods.upload.call(ctx);
  rejectUpload(new Error('network failure'));
  await new Promise(setImmediate);
  assert.equal(ctx.uploading, false);
  assert.equal(input.value, 'retry.jar');
  assert.equal(ctx.inputs, 'keep this note');
});
