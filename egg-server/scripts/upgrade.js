const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios').default;
const { promisify } = require('util');

/**
 * 自动升级脚本
 *
 * 升级流程：查询版本 -> 下载 -> 停止服务 -> 解压 -> 安装依赖 -> 启动服务
 *
 * 支持通过 UPGRADE_VERSION 环境变量指定版本，不设则升级到最新版。
 * 示例：UPGRADE_VERSION=v1.2.3 node scripts/upgrade.js
 */

const execAsync = promisify(exec);

const projectDir = path.resolve(__dirname, '..');
const localPath = '/tmp/deployer-release.zip';
const targetVersion = process.env.UPGRADE_VERSION || '';

// 用 process.execPath 拿到 node/npm 绝对路径，不依赖 PATH
// daemon 环境 PATH 通常不含 nvm/npm，必须用绝对路径
const nodeBin = process.execPath; // /xxx/bin/node
const npmBin = path.join(path.dirname(nodeBin), 'npm'); // /xxx/bin/npm
const eggScripts = path.join(projectDir, 'node_modules', '.bin', 'egg-scripts');

const apiUrl = targetVersion
  ? `https://api.github.com/repos/ruiku-tech/deployer/releases/tags/${targetVersion}`
  : 'https://api.github.com/repos/ruiku-tech/deployer/releases/latest';

async function run() {
  console.log('开始自动升级流程...');
  console.log('目标版本:', targetVersion || '最新版本');
  console.log('项目目录:', projectDir);
  console.log('node:', nodeBin);
  console.log('npm:', npmBin);

  // 1. 查询 GitHub 版本信息
  const { data: release } = await axios.get(apiUrl, {
    headers: { 'User-Agent': 'deployer-app' },
  });

  const downloadUrl = release.assets?.[0]?.browser_download_url;
  if (!downloadUrl) {
    throw new Error(`版本 ${release.tag_name} 没有可下载的发布包`);
  }
  console.log('目标版本:', release.tag_name);
  console.log('下载地址:', downloadUrl);

  // 2. 下载发布包
  console.log('正在下载...');
  await execAsync(`wget -O "${localPath}" "${downloadUrl}"`);
  console.log('下载完成');

  // 3. 停止服务（失败不中断，可能服务本来就没运行）
  console.log('停止服务...');
  try {
    await execAsync(`"${nodeBin}" "${eggScripts}" stop --title=egg-server-server`);
  } catch (e) {
    console.log('停止服务警告（可忽略）:', e.message);
  }

  // 4. 解压（覆盖现有文件）
  console.log('解压更新文件...');
  await execAsync(`unzip -o "${localPath}" -d "${projectDir}"`);
  console.log('解压完成');

  // 5. 安装依赖（失败不中断，用旧依赖尝试启动）
  console.log('安装依赖...');
  try {
    await execAsync(`"${npmBin}" install --production`, { cwd: projectDir });
  } catch (e) {
    console.log('安装依赖警告（尝试继续启动）:', e.message);
  }

  // 6. 启动服务
  console.log('启动服务...');
  await execAsync(
    `"${nodeBin}" "${eggScripts}" start --daemon --title=egg-server-server --workers=1`,
    { cwd: projectDir }
  );
  console.log('升级完成，当前版本:', release.tag_name);

  // 7. 清理临时文件
  await fs.promises.unlink(localPath).catch(err => {
    console.log('清理临时文件失败:', err.message);
  });
}

run().catch(err => {
  console.error('升级失败:', err.message);
  if (err.response) {
    console.error('HTTP 状态:', err.response.status);
    console.error('响应数据:', JSON.stringify(err.response.data));
  }
  process.exit(1);
});
