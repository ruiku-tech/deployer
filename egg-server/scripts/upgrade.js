const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios').default;
const { promisify } = require('util');
const pm2Environment = require('../app/service/pm2Environment');

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
const submitLock = '/tmp/deployer-updater-submit.lock';
const logFile = '/tmp/deployer-upgrade.log';
const targetVersion = process.env.UPGRADE_VERSION || '';
const commandEnv = pm2Environment();
delete commandEnv.UPGRADE_VERSION;

const nodeBin = process.execPath;
const npmBin = path.join(path.dirname(nodeBin), 'npm');
const pm2Bin = path.join(projectDir, 'node_modules', '.bin', 'pm2');
const pm2Config = path.join(projectDir, 'ecosystem.config.js');
const pm2AppName = 'deployer';

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
    const { stdout, stderr } = await execAsync(cmd, { env: commandEnv, ...opts, maxBuffer: 10 * 1024 * 1024 });
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
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await fs.promises.open(lockFile, 'wx');
      await handle.writeFile(String(process.pid));
      await handle.close();
      return true;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const existing = await fs.promises.readFile(lockFile, 'utf8').catch(() => '');
      const pid = parseInt(existing, 10);
      if (pid) {
        try {
          process.kill(pid, 0);
          log(`另一个升级进程正在运行 (PID: ${pid})，本次退出`);
          return false;
        } catch (probeError) {
          if (probeError.code !== 'ESRCH') return false;
        }
      }
      await fs.promises.unlink(lockFile).catch(() => {});
      log('旧锁文件已失效，重试获取');
    }
  }
  return false;
}

/** 通过固定的 PM2 应用名停止服务，避免误杀升级进程或其他 Node 服务。 */
async function stopService() {
  log('--- 停止服务 ---');
  try {
    await execLog(`"${pm2Bin}" delete "${pm2AppName}"`, { cwd: projectDir });
  } catch (err) {
    const output = `${err.stdout || ''}\n${err.stderr || ''}\n${err.message || ''}`;
    if (/process or namespace .* not found|not found/i.test(output)) {
      log('PM2 中没有正在运行的服务，继续检查旧版 Egg 服务');
    } else {
      throw err;
    }
  }

  await stopLegacyEgg();

  log('等待端口释放 (3s)...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  log('服务已交由 PM2 停止');
}

/**
 * 仅用于从旧版本切换：停止通过 egg-scripts 启动的该项目进程。
 * 新版本的日常停止与重启只使用 PM2。
 */
async function stopLegacyEgg() {
  let stdout;
  try {
    ({ stdout } = await execAsync('ps -eo pid=,args=', { cwd: projectDir, env: commandEnv }));
  } catch (err) {
    log(`检查旧版 Egg 进程失败，继续升级: ${err.message}`);
    return;
  }

  const legacyProcesses = stdout.split('\n').map(line => {
    const match = line.trim().match(/^(\d+)\s+(.*)$/);
    if (!match) return null;
    const pid = Number(match[1]);
    const command = match[2];
    const isLegacy = command.includes(projectDir) && command.includes('egg-server-server') &&
      (command.includes('egg-scripts/lib/start-cluster') ||
        command.includes('egg-cluster/lib/app_worker') ||
        command.includes('egg-cluster/lib/agent_worker'));
    return isLegacy && pid !== process.pid ? { pid, command } : null;
  }).filter(Boolean);

  if (!legacyProcesses.length) {
    log('没有发现旧版 Egg 守护进程');
    return;
  }

  log(`停止旧版 Egg 进程: ${legacyProcesses.map(item => item.pid).join(', ')}`);
  for (const { pid } of legacyProcesses) {
    try { process.kill(pid, 'SIGTERM'); } catch (err) {
      if (err.code !== 'ESRCH') log(`向旧版 Egg 进程 ${pid} 发送 SIGTERM 失败: ${err.message}`);
    }
  }

  await new Promise(resolve => setTimeout(resolve, 3000));
  for (const { pid } of legacyProcesses) {
    try {
      process.kill(pid, 0);
      process.kill(pid, 'SIGKILL');
      log(`旧版 Egg 进程 ${pid} 未及时退出，已强制停止`);
    } catch (err) {
      if (err.code !== 'ESRCH') log(`确认旧版 Egg 进程 ${pid} 状态失败: ${err.message}`);
    }
  }
}

async function run() {
  log('========================================');
  log(`升级脚本启动 PID=${process.pid}`);
  log(`目标版本: ${targetVersion || '最新版本'}`);
  log(`项目目录: ${projectDir}`);
  log(`node: ${nodeBin}`);
  log(`npm:  ${npmBin}`);

  try { await fs.promises.unlink(submitLock); } catch (e) { /* no submission marker */ }
  if (!await acquireLock()) return;
  log('锁已获取，开始升级流程');
  let serviceStopped = false;
  let serviceStarted = false;
  const startCmd = `"${pm2Bin}" startOrRestart "${pm2Config}" --only "${pm2AppName}"`;

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
    await stopService();
    serviceStopped = true;

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
    try {
      await execLog(startCmd, { cwd: projectDir });
      serviceStarted = true;
      log('服务启动成功');
    } catch (startErr) {
      log('首次启动失败，等待 5s 后重试...');
      await new Promise(r => setTimeout(r, 5000));
      await execLog(startCmd, { cwd: projectDir });
      serviceStarted = true;
      log('服务启动成功（重试）');
    }

    log(`========== 升级完成！版本: ${release.tag_name} ==========`);
    await fs.promises.unlink(localPath).catch(e => log(`清理 zip 失败: ${e.message}`));

  } finally {
    if (serviceStopped && !serviceStarted) {
      log('升级未能完成，尝试重新启动服务');
      try {
        await execLog(startCmd, { cwd: projectDir });
      } catch (restartErr) {
        log(`恢复启动失败: ${restartErr.message}`);
      }
    }
    await fs.promises.unlink(lockFile).catch(() => {});
    log('锁已释放');
  }
}

run().catch(err => {
  log(`升级失败: ${err.message}`);
  if (err.response) log(`HTTP: ${err.response.status} ${JSON.stringify(err.response.data)}`);
  process.exit(1);
});
