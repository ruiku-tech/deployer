const fs = require('fs');
const { Transform } = require('stream');
const RESERVE = 32 * 1024 * 1024;

async function usage(dir) {
  const stat = await fs.promises.statfs(dir);
  return { total: stat.blocks * stat.bsize, free: stat.bavail * stat.bsize };
}

async function requireSpace(dir, bytes) {
  const { free } = await usage(dir);
  if (free < bytes + RESERVE) {
    const error = new Error('服务器磁盘空间不足，请清理文件后重试');
    error.code = 'ENOSPC';
    throw error;
  }
}

async function directorySize(dir) {
  let size = 0;
  for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
    const file = require('path').join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error('环境中存在符号链接，请移除后重试');
    if (entry.isDirectory()) size += await directorySize(file);
    else if (entry.isFile()) size += (await fs.promises.stat(file)).size;
  }
  return size;
}

function uploadGuard(dir) {
  let checked = 0;
  return new Transform({
    transform(chunk, encoding, callback) {
      checked += chunk.length;
      if (checked >= 1024 * 1024 || checked === chunk.length) {
        checked = 0;
        requireSpace(dir, chunk.length).then(() => callback(null, chunk), callback);
      } else callback(null, chunk);
    },
  });
}
module.exports = { usage, requireSpace, directorySize, uploadGuard };
