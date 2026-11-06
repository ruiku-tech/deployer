const fs = require('fs');
const config = require('./config');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const archiver = require('archiver');
const database = require('./database');
const execFileAsync = promisify(execFile);

function create(env) {
  const context = config.createContext(env);

  if (!fs.existsSync(context.dir)) {
    fs.mkdirSync(context.dir);
  }

  if (!fs.existsSync(context.varsFile)) {
    fs.writeFileSync(context.varsFile, '', 'utf-8');
  }
  if (!fs.existsSync(context.fileDir)) {
    fs.mkdirSync(context.fileDir);
  }
  if (!fs.existsSync(context.hostsFile)) {
    fs.writeFileSync(context.hostsFile, '', 'utf-8');
  }
  if (!fs.existsSync(context.configDir)) {
    fs.mkdirSync(context.configDir);
  }
  if (!fs.existsSync(context.scriptDir)) {
    fs.mkdirSync(context.scriptDir);
  }
  if (!fs.existsSync(context.batDir)) {
    fs.mkdirSync(context.batDir);
  }
  if (!fs.existsSync(context.tempDir)) {
    fs.mkdirSync(context.tempDir);
  }
  if (!fs.existsSync(context.deployDir)) {
    fs.mkdirSync(context.deployDir);
  }
}

async function copy(env, src) {
  const context = config.createContext(env);
  const srcContext = config.createContext(src);
  if (fs.existsSync(context.dir)) {
    const error = new Error('目标环境已存在');
    error.code = 'EEXIST';
    throw error;
  }
  try {
    await fs.promises.cp(srcContext.dir, context.dir, { recursive: true, errorOnExist: true, force: false });
  } catch (err) {
    await fs.promises.rm(context.dir, { recursive: true, force: true });
    throw err;
  }
}
function destory(env) {
  const context = config.createContext(env);
  return fs.promises.rm(context.dir, { recursive: true, force: true });
}

// 导出环境配置到压缩包，返回 archiver 对象由调用方 pipe
function exportEnv(env) {
  const context = config.createContext(env);

  // 检查环境是否存在
  if (!fs.existsSync(context.dir)) {
    throw new Error(`环境 ${env} 不存在`);
  }

  const archive = archiver('zip', { zlib: { level: 9 } });

  // 添加需要导出的文件和目录（不包括 files 目录）
  if (fs.existsSync(context.varsFile)) {
    archive.file(context.varsFile, { name: 'vars.ini' });
  }
  if (fs.existsSync(context.hostsFile)) {
    archive.file(context.hostsFile, { name: 'hosts.ini' });
  }
  if (fs.existsSync(context.configDir)) {
    archive.directory(context.configDir, 'configs');
  }
  if (fs.existsSync(context.scriptDir)) {
    archive.directory(context.scriptDir, 'scripts');
  }
  if (fs.existsSync(context.batDir)) {
    archive.directory(context.batDir, 'bats');
  }
  archive.append(JSON.stringify(database.getDb().prepare('SELECT type,name,note FROM resource_notes WHERE env=?').all(env)), { name: 'resource-notes.json' });

  return archive;
}

// 从压缩包导入环境配置
function importEnv(env, zipFilePath) {
  return (async () => {
    const context = config.createContext(env);
    const { stdout } = await execFileAsync('unzip', ['-Z1', zipFilePath]);
    for (const entry of stdout.split(/\r?\n/).filter(Boolean)) {
      const normalized = entry.replaceAll('\\', '/');
      if (normalized.startsWith('/') || normalized.split('/').includes('..') || normalized.includes('\0')) throw new Error('压缩包包含无效路径');
    }
    create(env);
    try {
      await execFileAsync('unzip', ['-o', zipFilePath, '-d', context.dir]);
      const walk = async dir => {
        for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
          const target = path.join(dir, entry.name);
          if (entry.isSymbolicLink()) throw new Error('压缩包不允许包含符号链接');
          if (entry.isDirectory()) await walk(target);
        }
      };
      await walk(context.dir);
    } catch (err) {
      await fs.promises.rm(context.dir, { recursive: true, force: true });
      throw err;
    }
  })();
}

module.exports = {
  create,
  copy,
  destory,
  exportEnv,
  importEnv,
};
