const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const net = require('node:net');
const Koa = require('koa');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deployer-static-'));
process.env.DEPLOY_DB_PATH = path.join(root, 'deployer.db');
process.env.DEPLOY_WORKSPACE = path.join(root, 'workspace');
const config = require('../config/config.default')({ name: 'test', baseDir: root }).static;

test.after(() => {
  require('../app/service/database').close();
  fs.rmSync(root, { recursive: true, force: true });
});

test('HTML revalidates and reflects rebuilds while hashed assets retain long caching', async () => {
  fs.mkdirSync(path.join(config.dir, 'js'), { recursive: true });
  fs.mkdirSync(path.join(config.dir, 'css'), { recursive: true });
  const index = path.join(config.dir, 'index.html');
  fs.writeFileSync(index, '<script src="/js/app.old.js"></script>');
  fs.writeFileSync(path.join(config.dir, 'js/app.old.js'), 'old bundle');
  fs.writeFileSync(path.join(config.dir, 'css/app.old.css'), 'body {}');
  fs.writeFileSync(path.join(config.dir, 'favicon.ico'), 'icon');
  const app = new Koa();
  const bootApp = { config: { coreMiddleware: [ 'static', 'bodyParser' ] } };
  new (require('../app'))(bootApp);
  assert.equal(bootApp.config.coreMiddleware[0], 'indexCache');
  const serve = require('egg-static/app/middleware/static')({ ...config, maxFiles: 100 }, {
    loggers: { coreLogger: { info() {} } },
  });
  const cacheIndex = require('../app/middleware/indexCache')();
  const request = async (url, headers = {}) => {
    const req = new http.IncomingMessage(new net.Socket());
    req.method = 'GET';
    req.url = url;
    req.headers = headers;
    const res = new http.ServerResponse(req);
    const ctx = app.createContext(req, res);
    await cacheIndex(ctx, () => serve(ctx, async () => {}));
    let body = '';
    if (ctx.status !== 304 && ctx.body) {
      for await (const chunk of ctx.body) body += chunk.toString();
    }
    return { status: ctx.status, body, headers: ctx.response.headers };
  };

  const first = await request('/index.html');
  assert.equal(first.status, 200);
  assert.equal(first.headers['cache-control'], 'no-cache');
  const unchanged = await request('/index.html', { 'if-none-match': first.headers.etag });
  assert.equal(unchanged.status, 304);
  assert.equal(unchanged.headers['cache-control'], 'no-cache');

  fs.writeFileSync(index, '<script src="/js/app.new.js"></script>');
  // Ensure a distinct timestamp even on filesystems with coarse mtime resolution.
  const later = new Date(Date.now() + 2000);
  fs.utimesSync(index, later, later);
  const rebuilt = await request('/index.html', { 'if-none-match': first.headers.etag });
  assert.equal(rebuilt.status, 200);
  assert.match(rebuilt.body, /app.new.js/);
  assert.equal(rebuilt.headers['cache-control'], 'no-cache');

  for (const url of [ '/js/app.old.js', '/css/app.old.css' ]) {
    const asset = await request(url);
    assert.equal(asset.status, 200);
    assert.equal(asset.headers['cache-control'], 'public, max-age=31536000');
    assert.ok(asset.body);
  }
  const icon = await request('/favicon.ico');
  assert.equal(icon.status, 200);
  assert.equal(icon.headers['cache-control'], 'public, max-age=31536000');
});
