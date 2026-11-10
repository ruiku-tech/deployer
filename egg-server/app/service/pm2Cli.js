'use strict';

const fs = require('fs');
const path = require('path');

function findPm2Cli(source = process.env) {
  const explicit = source.DEPLOY_PM2_BIN;
  if (explicit) {
    if (!path.isAbsolute(explicit) || explicit.includes(`${path.sep}node_modules${path.sep}`)) {
      throw new Error('DEPLOY_PM2_BIN 必须是全局 PM2 命令的绝对路径，例如 /usr/local/bin/pm2');
    }
    fs.accessSync(explicit, fs.constants.X_OK);
    return explicit;
  }
  const searchPath = source.PATH || '';
  for (const directory of searchPath.split(path.delimiter)) {
    if (!path.isAbsolute(directory)) continue;
    const candidate = path.join(directory, 'pm2');
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (!candidate.includes(`${path.sep}node_modules${path.sep}`)) return candidate;
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'EACCES') throw error;
    }
  }
  throw new Error('未找到全局 PM2，请确认已全局安装 PM2 且 pm2 命令位于服务 PATH 中');
}

// Egg invokes bare function exports in app/service as service factories.
module.exports = { findPm2Cli };
