'use strict';

const path = require('path');
const http = require('http');
const egg = require('egg');

// PM2 owns this single process. Egg's cluster launcher is intentionally not used.
const baseDir = path.resolve(__dirname, '..');
let app;
egg.start({ baseDir }).then(async application => {
  app = application;
  const server = http.createServer(app.callback());
  app.emit('server', server);
  const port = Number(process.env.PORT) || app.config.cluster.listen.port;
  const hostname = app.config.cluster.listen.hostname || undefined;

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, hostname, resolve);
  });
  if (process.send) process.send('ready');

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const forceExit = setTimeout(() => process.exit(0), 8000);
    try {
      await new Promise(resolve => {
        if (!server.listening) return resolve();
        server.close(resolve);
      });
      await app.close();
    } finally {
      clearTimeout(forceExit);
      process.exit(0);
    }
  };
  process.once('SIGINT', () => shutdown().catch(err => console.error('[deployer] shutdown failed:', err)));
  process.once('SIGTERM', () => shutdown().catch(err => console.error('[deployer] shutdown failed:', err)));
}).catch(err => {
  console.error('[deployer] failed to start:', err);
  Promise.resolve(app && app.close()).catch(closeErr => {
    console.error('[deployer] failed to close after startup error:', closeErr);
  }).finally(() => {
    process.exitCode = 1;
  });
});
