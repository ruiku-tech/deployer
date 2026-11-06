'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter, Readable, PassThrough } = require('node:stream');
const { createHash } = require('node:crypto');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deployer-transfer-test-'));
process.env.DEPLOY_DB_PATH = path.join(root, 'deployer.db');
process.env.DEPLOY_WORKSPACE = path.join(root, 'workspace');
fs.mkdirSync(process.env.DEPLOY_WORKSPACE, { recursive: true });
global.isTest = true;

const database = require('../app/service/database');
const Executer = require('../app/service/executer');
const DeployController = require('../app/controller/deploy');
const config = require('../app/service/config');
const multipartContext = require('../node_modules/egg-multipart/app/extend/context');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const context = config.createContext('testing');
fs.mkdirSync(context.fileDir, { recursive: true });

function fakeConnection(fail) {
  const sftp = new EventEmitter();
  sftp.closed = 0;
  sftp.end = () => { sftp.closed++; };
  sftp.fastPut = (src, dest, options, callback) => setImmediate(() => callback(fail));
  sftp.fastGet = (src, dest, options, callback) => setImmediate(() => callback(fail));
  return { host: 'test-host', sftp: callback => callback(null, sftp), sftpChannel: sftp };
}

function uploadController(stream, size) {
  const ctx = {
    request: { length: 0, headers: { memo: '', ...(size === undefined ? {} : { 'x-file-size': String(size) }) }, context },
    status: 200,
    getFileStream: async () => stream,
    assert(condition, status, message) {
      if (!condition) { const err = new Error(message); err.status = status; throw err; }
    },
  };
  return { ctx, run: () => DeployController.prototype.uploadFile.call({ ctx }, ctx) };
}

function multipartUpload(requestStream, size) {
  const upload = uploadController(null, size);
  const { ctx } = upload;
  ctx.req = requestStream;
  Object.assign(ctx.request.headers, requestStream.headers);
  ctx.request.length = Number(requestStream.headers['content-length']) || 0;
  ctx.app = { config: { multipart: {
    autoFields: false, defaultCharset: 'utf8', defaultParamCharset: 'utf8',
    fieldNameSize: 100, fieldSize: 100 * 1024, fields: 10, fileSize: 500 * 1024 * 1024, files: 10,
  } } };
  ctx.coreLogger = { debug() {}, warn() {}, error() {} };
  ctx.is = type => type === 'multipart';
  ctx.throw = (status, message) => { const err = new Error(message); err.status = status; throw err; };
  ctx.multipart = multipartContext.multipart;
  ctx.getFileStream = multipartContext.getFileStream;
  return upload;
}

test.after(() => {
  database.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test('SFTP channels close after successful and failed uploads and downloads', async () => {
  const service = Object.create(Executer.prototype);
  service.env = 'testing';
  for (const operation of ['putFile', 'getFile']) {
    const success = fakeConnection(null);
    await service[operation](success, '/source', '/target');
    assert.equal(success.sftpChannel.closed, 1);

    const failure = fakeConnection(new Error('transfer failed'));
    await assert.rejects(service[operation](failure, '/source', '/target'), /transfer failed/);
    assert.equal(failure.sftpChannel.closed, 1);
  }
});

test('reused SSH connections release limited channels and failures force a fresh connection', async () => {
  const instances = [];
  class Client extends EventEmitter {
    constructor() { super(); this.active = 0; instances.push(this); }
    connect() { setImmediate(() => this.emit('ready')); return this; }
    destroy() { this.destroyed = true; setImmediate(() => this.emit('close')); }
    sftp(callback) {
      if (this.fail || this.active >= 2) return callback(new Error('(SSH) Channel open failure: open failed'));
      this.active++;
      const channel = new EventEmitter();
      channel.end = () => { this.active--; };
      channel.fastPut = (src, dest, options, done) => setImmediate(done);
      callback(null, channel);
    }
  }
  const filename = path.join(__dirname, '../app/service/executer.js');
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, setInterval, Date,
    require(name) {
      if (name === 'ssh2') return { Client };
      if (name === './broadcast') return { cast() {} };
      return localRequire(name);
    },
  }, { filename });
  const service = Object.create(module.exports.prototype);
  service.env = 'testing';
  const item = { server: { host: 'test-host', password: 'password' }, cmds: ['put:/source,/target'] };
  try {
    for (let i = 0; i < 15; i++) await service.deply(item);
    assert.equal(instances.length, 1);
    assert.equal(instances[0].active, 0);
    instances[0].fail = true;
    await assert.rejects(service.deply(item), /Channel open failure/);
    assert.equal(instances[0].destroyed, true);
    await service.deply(item);
    assert.equal(instances.length, 2);
    assert.equal(instances[1].active, 0);
  } finally { service.stopDeploy('test-host', 'testing'); }
});

test('completed uploads appear under a unique final name and unfinished uploads leave no file', async () => {
  const stream = Readable.from(['complete package']);
  stream.filename = 'release.zip';
  const completed = uploadController(stream);
  await completed.run();
  assert.equal(completed.ctx.status, 200);
  const files = await fs.promises.readdir(context.fileDir);
  assert.equal(files.length, 1);
  assert.match(files[0], /^\d{8}-\d{2}:\d{2}:\d{2}\.\d{3}~release\.zip$/);
  assert.equal(await fs.promises.readFile(path.join(context.fileDir, files[0]), 'utf8'), 'complete package');

  const interrupted = new Readable({
    read() {
      this.push('partial package');
      this.destroy(new Error('upload connection lost'));
    },
  });
  interrupted.filename = 'broken.zip';
  const failed = uploadController(interrupted);
  await failed.run();
  assert.equal(failed.ctx.status, 500);
  assert.deepEqual(await fs.promises.readdir(context.fileDir), files);
});

test('formal upload files remain visible with their actual byte size', async () => {
  const filename = '20261106-18:23:07.123~visible.zip';
  await fs.promises.writeFile(path.join(context.fileDir, filename), '12345');
  const ctx = { request: { context } };
  await DeployController.prototype.getFilesStat.call({ queryFileStat: DeployController.prototype.queryFileStat }, ctx);
  const visible = ctx.body.data.find(item => item.file === filename);
  assert.ok(visible);
  assert.equal(visible.size, '0.000M(5)');
});

test('one real 226 MB multipart request creates one visible file with matching bytes', async () => {
  const boundary = 'deployer-large-upload-boundary';
  const size = 226386281;
  const chunk = Buffer.alloc(64 * 1024, 0x5a);
  const hash = createHash('sha256');
  for (let written = 0; written < size;) {
    const part = chunk.subarray(0, Math.min(chunk.length, size - written));
    hash.update(part);
    written += part.length;
  }
  const expectedHash = hash.digest('hex');
  const prefix = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="ai-server-server.jar"\r\nContent-Type: application/java-archive\r\n\r\n`);
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  const requestStream = Readable.from((async function* () {
    yield prefix;
    for (let written = 0; written < size;) {
      const part = chunk.subarray(0, Math.min(chunk.length, size - written));
      yield part;
      written += part.length;
    }
    yield suffix;
  })());
  requestStream.headers = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'content-length': String(size + prefix.length + suffix.length),
  };
  const upload = multipartUpload(requestStream, size);
  const { ctx } = upload;
  const before = new Set(await fs.promises.readdir(context.fileDir));

  await upload.run();

  assert.equal(ctx.status || 200, 200);
  const created = (await fs.promises.readdir(context.fileDir)).filter(file => !before.has(file));
  assert.equal(created.length, 1);
  assert.match(created[0], /~ai-server-server\.jar$/);
  const savedPath = path.join(context.fileDir, created[0]);
  assert.equal((await fs.promises.stat(savedPath)).size, size);
  const savedHash = createHash('sha256');
  for await (const part of fs.createReadStream(savedPath)) savedHash.update(part);
  assert.equal(savedHash.digest('hex'), expectedHash);
});

test('an active multipart upload is visible and aborting the request removes its partial file', { timeout: 5000 }, async () => {
  const requestStream = new PassThrough();
  requestStream.headers = { 'content-type': 'multipart/form-data; boundary=paused-upload' };
  const upload = multipartUpload(requestStream, 1024 * 1024);
  let started;
  const writing = new Promise(resolve => { started = resolve; });
  const logs = [];
  upload.ctx.logger = { info(format, entry) { logs.push(entry); if (entry.event === 'writing') started(entry.fileName); } };
  const run = upload.run();
  requestStream.write('--paused-upload\r\nContent-Disposition: form-data; name="file"; filename="paused.jar"\r\nContent-Type: application/octet-stream\r\n\r\n');
  requestStream.write(Buffer.alloc(4096, 1));
  const name = await writing;
  const listContext = { request: { context } };
  await DeployController.prototype.getFilesStat.call({ queryFileStat: DeployController.prototype.queryFileStat }, listContext);
  assert.ok(listContext.body.data.find(item => item.file === name));
  assert.equal(name.startsWith('.'), false);
  requestStream.aborted = true;
  requestStream.emit('aborted');
  await run;
  requestStream.destroy();
  assert.equal(upload.ctx.status, 500);
  assert.equal(fs.existsSync(path.join(context.fileDir, name)), false);
  assert.deepEqual(logs.map(entry => entry.event), ['received', 'writing', 'failed']);
  assert.equal(new Set(logs.map(entry => entry.requestId)).size, 1);
});

test('concurrent same-name uploads cannot overwrite each other', async () => {
  const content = Array.from({ length: 16 }, (_, i) => `package-${i}`);
  await Promise.all(content.map(async text => {
    const stream = Readable.from([text]);
    stream.filename = 'concurrent.zip';
    const request = uploadController(stream, Buffer.byteLength(text));
    await request.run();
    assert.equal(request.ctx.status, 200);
  }));
  const files = (await fs.promises.readdir(context.fileDir)).filter(file => file.endsWith('~concurrent.zip'));
  assert.equal(files.length, content.length);
  const saved = await Promise.all(files.map(file => fs.promises.readFile(path.join(context.fileDir, file), 'utf8')));
  assert.deepEqual(saved.sort(), content.sort());
});

test('size mismatches and truncated multipart streams cannot publish packages or memos', async () => {
  const before = await fs.promises.readdir(context.fileDir);
  for (const truncated of [true, false]) {
    const stream = Readable.from(['partial']);
    stream.filename = 'mismatch.zip';
    stream.truncated = truncated;
    const upload = uploadController(stream, 100);
    await upload.run();
    assert.equal(upload.ctx.status, 400);
    assert.match(upload.ctx.body.message, /不完整/);
  }
  assert.deepEqual(await fs.promises.readdir(context.fileDir), before);
  assert.equal(database.getDb().prepare("SELECT count(*) AS total FROM file_memos WHERE fileName LIKE '%mismatch.zip'").get().total, 0);
});
