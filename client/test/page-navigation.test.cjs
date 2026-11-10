const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const { parse, compileTemplate } = require('@vue/compiler-sfc');
const vue = require('vue');

test('navigation mounts pages lazily, preserves drafts and connections, and clears inaccessible pages', async () => {
  const filename = path.join(__dirname, '../src/components/Operator.vue');
  const { descriptor } = parse(fs.readFileSync(filename, 'utf8'));
  const compiled = compileTemplate({ source: descriptor.template.content, filename, id: 'navigation-test' });
  assert.deepEqual(compiled.errors, []);
  const center = { env: vue.ref('testing'), user: vue.ref('admin'), role: vue.ref('admin') };
  const instances = {};
  const counts = {};
  const names = ['Files', 'Vars', 'Hosts', 'Configs', 'Scripts', 'Deploys', 'Record', 'Schedules', 'Teams'];
  const dependencies = { vue, '../dataCenter': center };
  for (const name of names) {
    counts[name] = { mounted: 0, closed: 0 };
    dependencies[`./${name}.vue`] = {
      data() { return { draft: '', connected: false }; },
      mounted() { counts[name].mounted++; instances[name] = this; this.connected = true; },
      beforeUnmount() { counts[name].closed++; this.connected = false; },
      render() { return vue.h('section', this.draft); },
    };
  }
  const run = source => {
    const { code } = babel.transformSync(source, {
      filename, babelrc: false, configFile: false,
      plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
    });
    const exports = {};
    vm.runInNewContext(code, { exports, require(name) { assert.ok(name in dependencies, name); return dependencies[name]; } }, { filename });
    return exports;
  };
  const component = run(descriptor.script.content).default;
  component.render = run(compiled.code).render;
  const element = type => ({ type, children: [], style: {}, parent: null });
  const renderer = vue.createRenderer({
    createElement: element,
    createText: text => ({ ...element('text'), text }),
    createComment: text => ({ ...element('comment'), text }),
    setText(node, text) { node.text = text; },
    setElementText(node, text) { node.text = text; },
    patchProp(node, name, previous, value) { node[name] = value; },
    parentNode: node => node.parent,
    nextSibling(node) { return node.parent?.children[node.parent.children.indexOf(node) + 1] || null; },
    insert(node, parent, anchor = null) {
      if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1);
      node.parent = parent;
      const index = anchor ? parent.children.indexOf(anchor) : -1;
      if (index < 0) parent.children.push(node); else parent.children.splice(index, 0, node);
    },
    remove(node) { node.parent.children.splice(node.parent.children.indexOf(node), 1); node.parent = null; },
  });
  const root = element('root');
  const app = renderer.createApp(component);
  app.component('el-empty', { render: () => vue.h('span') });
  const page = app.mount(root);
  const views = () => root.children[0].children.find(node => node.type === 'main').children.filter(node => node.class === 'page-view');
  try {
    assert.equal(counts.Files.mounted, 1);
    assert.equal(counts.Hosts.mounted, 0);
    page.selectPage('configs');
    await vue.nextTick();
    const config = instances.Configs;
    config.draft = 'unsaved configuration';
    page.selectPage('hosts');
    await vue.nextTick();
    const host = instances.Hosts;
    page.selectPage('vars');
    await vue.nextTick();
    assert.equal(host.connected, true);
    assert.equal(counts.Hosts.closed, 0);
    page.selectPage('configs');
    await vue.nextTick();
    assert.equal(instances.Configs, config);
    assert.equal(config.draft, 'unsaved configuration');
    assert.equal(counts.Configs.mounted, 1);
    assert.equal(counts.Scripts.mounted, 0);
    assert.equal(views().filter(node => node.style.display !== 'none').length, 1);

    page.selectPage('teams');
    await vue.nextTick();
    center.role.value = 'member';
    await vue.nextTick();
    assert.equal(counts.Teams.closed, 1);
    assert.equal(page.visited.includes('teams'), false);
    assert.equal(page.active, 'files');

    center.env.value = 'production';
    await vue.nextTick();
    assert.equal(host.connected, false);
    assert.equal(counts.Hosts.closed, 1);
    assert.equal(page.visited.join(','), 'files');
    page.selectPage('configs');
    await vue.nextTick();
    assert.notEqual(instances.Configs, config);
    assert.equal(instances.Configs.draft, '');
  } finally { app.unmount(); }
});
