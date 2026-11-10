'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const packageJson = require('../package.json');
const findPm2Cli = require('../app/service/pm2Cli');
const pm2Environment = require('../app/service/pm2Environment');

test('PM2 resolution skips project binaries and selects a global symlink', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deployer-pm2-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const localBin = path.join(root, 'project/node_modules/.bin');
  const globalBin = path.join(root, 'bin');
  const globalPackage = path.join(root, 'lib/node_modules/pm2/bin');
  for (const dir of [ localBin, globalBin, globalPackage ]) fs.mkdirSync(dir, { recursive: true });
  for (const dir of [ localBin, globalPackage ]) fs.writeFileSync(path.join(dir, 'pm2'), '#!/usr/bin/env node\n', { mode: 0o755 });
  fs.symlinkSync(path.join(globalPackage, 'pm2'), path.join(globalBin, 'pm2'));
  const cli = path.join(globalBin, 'pm2');
  assert.equal(findPm2Cli({ PATH: [ localBin, globalBin ].join(path.delimiter) }), cli);
  assert.throws(() => findPm2Cli({ PATH: localBin }), /未找到全局 PM2/);
  assert.equal(findPm2Cli({ PATH: localBin, DEPLOY_PM2_BIN: cli }), cli);
  assert.throws(() => findPm2Cli({ DEPLOY_PM2_BIN: path.join(localBin, 'pm2') }), /全局 PM2/);
});

test('PM2 environment cleanup preserves daemon identity and removes app configuration', () => {
  const env = pm2Environment({
    name: 'deployer', script: 'old.js', exec_mode: 'fork', wait_ready: 'true',
    pm_id: '0', pm_exec_path: '/old/start.js', NODE_APP_INSTANCE: '0',
    PM2_HOME: '/server/.pm2', PATH: '/usr/local/bin', DEPLOY_PM2_BIN: '/usr/local/bin/pm2',
    DEPLOY_DB_PATH: '/data/deployer.db', UPGRADE_VERSION: 'v2',
  });
  assert.deepEqual(env, {
    PM2_HOME: '/server/.pm2', PATH: '/usr/local/bin', DEPLOY_PM2_BIN: '/usr/local/bin/pm2',
    DEPLOY_DB_PATH: '/data/deployer.db', UPGRADE_VERSION: 'v2',
  });
});

test('production controller dependencies are declared without bundling PM2', () => {
  assert.equal(packageJson.dependencies['mz-modules'], '^2.1.0');
  assert.equal(packageJson.dependencies.pm2, undefined);
  assert.doesNotThrow(() => require('mz-modules/pump'));
});
