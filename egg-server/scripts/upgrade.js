const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios').default;
const { promisify } = require('util');

/**
 * 自动升级脚本
 * 升级流程：查询版本 -> 下载 -> 停止服务 -> 解压 -> 安装依赖 -> 启动服务
 * 支持通过 UPGRADE_VERSION 环境变量指定版本，不设则升级到最新版。
 * 追踪日志：/tmp/deployer-upgrade.log
 */

const execAsync = promisify(exec);

const projectDir = path.resolve(__dirname, '..');
const localPath = '/tmp/deployer-release.zip';
const lockFile = '/tmp/deployer-upgrade.lock';
const logFile = '/tmp/deployer-upgrade.log';
const targetVersion = process.env.UPGRADE_VERSION || '';

const nodeBin = process.execPath;
const npmBin = path.join(path.dirname(nodeBin), 'npm');
const eggScripts = path.join(projectDir, 'node_modules', '.bin', 'egg-scripts');

const apiUrl = targetVersion
  ? `https://api.github.com/repos/ruiku-tech/deployer/releases/tags/${targetVersion}`
  : 'https://api.github.com/repos/ruiku-tech/deployer/releases/latest';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(logFile, line); } catch (e) { /* 忽略写文件错误 */ }
}

/** 执行命令并把 stdout/stderr 完整写入日志，出错也记录后再抛出
 * @param {string} cmd shell 命令
 * @param {object} [opts] execAsync 选项
 */
async function execLog(cmd, opts) {
  log(`> ${cmd}`);
  try {
    const { stdout, stderr } = await execAsync(cmd, { ...opts, maxBuffer: 10 * 1024 * 1024 });
    if (stdout && stdout.trim()) log(`  stdout: ${stdout.trim()}`);
    if (stderr && stderr.trim()) log(`  stderr: ${stderr.trim()}`);
    return { stdout, stderr };
  } catch (err) {
    log(`  FAILED (code=${err.code}): ${err.message}`);
    if (err.stdout && err.stdout.trim()) log(`  stdout: ${err.stdout.trim()}`);
    if (err.stderr && err.stderr.trim()) log(`  stderr: ${err.stderr.trim()}`);
    throw err;
  }
}

/** 防并发锁：确保同一时刻只有一个升级进程在运行 */
async function acquireLock() {
  try {
    const existing = (await fs.promises.readFile(lockFile, 'utf8')).trim();
    const pid = parseInt(existing);
    try {
      process.kill(pid, 0);
      log(`另一个升级进程正在运行 (PID: ${pid})，本次退出`);
      process.exit(1);
    } catch (e) { log('旧锁文件已失效，继续'); }
  } catch (e) { /* 锁文件不存在，正常 */ }
  await fs.promises.writeFile(lockFile, String(process.pid));
}

/** 停止并彻底清理所有与本项目相关的 egg 进程 */
async function stopEgg() {
  log('--- 停止服务 ---');

  // 不调用 egg-scripts stop：它内部有 sleep(5s) + ps 查询，在某些 Linux 环境下会永久卡住
  // 直接用 ps 找出所有属于本项目的 node 进程，SIGKILL 强制清理，效果更可靠
  const selfPid = process.pid;
  let pids = [];
  try {
    const { stdout } = await execAsync(
      `ps aux | grep node | grep "${projectDir}" | grep -v "upgrade.js" | grep -v grep | awk '{print $2}'`
    );
    log(`ps 匹配结果:\n${stdout}`);
    pids = stdout.trim().split('\n')
      .map(p => parseInt(p.trim()))
      .filter(p => p > 0 && p !== selfPid);
  } catch (e) { log('ps 无匹配'); }

  if (pids.length > 0) {
    log(`强制 kill -9: ${pids.join(' ')}`);
    await execAsync(`kill -9 ${pids.join(' ')} 2>/dev/null; true`);
  } else {
    log('无相关进程需要清理');
  }

  log('等待端口释放 (3s)...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 验证进程是否都已退出
  try {
    const { stdout } = await execAsync(
      `ps aux | grep node | grep "${projectDir}" | grep -v "upgrade.js" | grep -v grep`
    );
    if (stdout.trim()) log(`警告：仍有相关进程存活:\n${stdout.trim()}`);
    else log('确认：所有相关进程已退出');
  } catch (e) { log('确认：所有相关进程已退出'); }
}

async function run() {
  log('========================================');
  log(`升级脚本启动 PID=${process.pid}`);
  log(`目标版本: ${targetVersion || '最新版本'}`);
  log(`项目目录: ${projectDir}`);
  log(`node: ${nodeBin}`);
  log(`npm:  ${npmBin}`);

  await acquireLock();
  log('锁已获取，开始升级流程');

  try {
    // 1. 查询版本
    log('--- 1. 查询版本信息 ---');
    const { data: release } = await axios.get(apiUrl, { headers: { 'User-Agent': 'deployer-app' } });
    const downloadUrl = release.assets?.[0]?.browser_download_url;
    if (!downloadUrl) throw new Error(`版本 ${release.tag_name} 无可下载资产`);
    log(`目标版本: ${release.tag_name}`);
    log(`下载地址: ${downloadUrl}`);

    // 2. 下载
    log('--- 2. 下载发布包 ---');
    await execLog(`wget -O "${localPath}" "${downloadUrl}"`);

    // 3. 停止清理
    await stopEgg();

    // 4. 解压
    log('--- 4. 解压 ---');
    await execLog(`unzip -o "${localPath}" -d "${projectDir}"`);

    // 5. 安装依赖
    log('--- 5. 安装依赖 ---');
    try {
      await execLog(`"${npmBin}" install --production`, { cwd: projectDir });
    } catch (e) {
      log('依赖安装失败，继续尝试启动');
    }

    // 6. 启动
    log('--- 6. 启动服务 ---');
    const startCmd = `"${nodeBin}" "${eggScripts}" start --daemon --node="${nodeBin}" --title=egg-server-server --workers=1`;
    try {
      await execLog(startCmd, { cwd: projectDir });
      log('服务启动成功');
    } catch (startErr) {
      log('首次启动失败，等待 5s 后重试...');
      await new Promise(r => setTimeout(r, 5000));
      await execLog(startCmd, { cwd: projectDir });
      log('服务启动成功（重试）');
    }

    log(`========== 升级完成！版本: ${release.tag_name} ==========`);
    await fs.promises.unlink(localPath).catch(e => log(`清理 zip 失败: ${e.message}`));

  } finally {
    await fs.promises.unlink(lockFile).catch(() => {});
    log('锁已释放');
  }
}

run().catch(err => {
  log(`升级失败: ${err.message}`);
  if (err.response) log(`HTTP: ${err.response.status} ${JSON.stringify(err.response.data)}`);
  process.exit(1);
});
