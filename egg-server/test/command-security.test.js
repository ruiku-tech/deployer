'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deployer-command-security-'));
const Executer = require('../app/service/executer');
const fileDir = path.join(root, 'workspace', 'test', 'files');
const configDir = path.join(root, 'workspace', 'test', 'configs');
const tempDir = path.join(root, 'workspace', 'test', 'temp');
fs.mkdirSync(fileDir, { recursive: true });
fs.mkdirSync(configDir, { recursive: true });
fs.mkdirSync(tempDir, { recursive: true });
const allowedFile = path.join(fileDir, 'release.jar');
const configFile = path.join(configDir, 'app.conf');
const resolvedConfigFile = path.join(tempDir, 'resolved.conf');
fs.writeFileSync(allowedFile, 'package');
fs.writeFileSync(configFile, 'config');
fs.writeFileSync(resolvedConfigFile, 'resolved config');
const outsideFile = path.join(root, 'secret');
fs.writeFileSync(outsideFile, 'platform secret');

function parse(command, files = {}, texts = {}) {
  const service = Object.create(Executer.prototype);
  return service.parseSingleCmds('test', {
    fileDir,
    configDir,
    tempDir,
    files,
    texts,
    vars: {},
    hosts: { server: { host: '10.0.0.2', password: 'secret', port: 22 } },
  }, [{ host: 'server', cmds: [ command ] }])[0];
}

test.after(() => fs.rmSync(root, { recursive: true, force: true }));

test('deployment DSL permits only put and run commands', () => {
  assert.equal(parse('run: echo deploy').cmds[0], 'run: echo deploy');
  assert.equal(parse(`put: ${allowedFile},/opt/app/release.jar`).cmds.length, 1);
  assert.equal(parse(`put: ${configFile},/opt/app/app.conf`).cmds.length, 1);
  assert.equal(parse(`put: ${resolvedConfigFile},/opt/app/app.conf`).cmds.length, 1);
  for (const command of [
    'get: /etc/passwd,/tmp/passwd', 'spush:', 'spop:', 'reval: process.env',
    'rquery: cat /etc/passwd', 'update: key=value', 'echo unprefixed',
  ]) {
    assert.match(parse(command).err, /不支持的部署命令/);
  }
});

test('put cannot read arbitrary deployment-platform paths or symlinked files', () => {
  assert.match(parse(`put: ${outsideFile},/tmp/secret`).err, /当前环境 files、configs 或 temp 目录/);
  const symlink = path.join(fileDir, 'linked.jar');
  fs.symlinkSync(outsideFile, symlink);
  assert.match(parse(`put: ${symlink},/tmp/secret`).err, /普通文件/);
  assert.match(parse('put: /missing/file,/tmp/file').err, /来源文件不存在/);
  assert.match(parse(`put: ${allowedFile},`).err, /格式应为/);
});

test('TEXT markers require input and resolve in scripts before command validation', () => {
  assert.match(parse('run: deploy --minutes [TEXT:演示分钟数]').err, /参数\[演示分钟数\]未填写/);
  assert.equal(parse('run: deploy --minutes [TEXT:演示分钟数]', {}, { 演示分钟数: '15' }).cmds[0], 'run: deploy --minutes 15');
  assert.match(parse('run: deploy --minutes [TEXT:演示分钟数]', {}, { 演示分钟数: '15\nrun: id' }).err, /参数\[演示分钟数\]未填写/);
});
