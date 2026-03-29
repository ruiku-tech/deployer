const fs = require('fs');
const config = require('./config');
const path = require('path');
const { exec } = require('child_process');
const archiver = require('archiver');

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

function copy(env, src) {
  const context = config.createContext(env);
  const srcContext = config.createContext(src);

  return new Promise((resolve, reject) => {
    exec(
      `cp -rf "${srcContext.dir}" "${context.dir}"`,
      (error, stdout, stderr) => {
        if (error) {
          reject({ err: error.message });
          return;
        }
        if (stderr) {
          reject({ err: stderr });
          return;
        }
        resolve();
      }
    );
  });
}
function destory(env) {
  const context = config.createContext(env);
  return new Promise((resolve, reject) => {
    exec(
      `rm -rf "${context.dir}"`,
      (error, stdout, stderr) => {
        if (error) {
          reject({ err: error.message });
          return;
        }
        if (stderr) {
          reject({ err: stderr });
          return;
        }
        resolve();
      }
    );
  });
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

  return archive;
}

// 从压缩包导入环境配置
function importEnv(env, zipFilePath) {
  return new Promise((resolve, reject) => {
    const context = config.createContext(env);

    // 先创建基本环境结构
    create(env);

    // 使用系统 unzip 命令解压文件
    exec(
      `unzip -o "${zipFilePath}" -d "${context.dir}"`,
      (error, stdout, stderr) => {
        // 清理上传的临时文件
        try {
          fs.unlinkSync(zipFilePath);
        } catch (e) {
          // 忽略删除错误
        }

        if (error) {
          reject({ err: error.message });
          return;
        }
        
        resolve();
      }
    );
  });
}

module.exports = {
  create,
  copy,
  destory,
  exportEnv,
  importEnv,
};
