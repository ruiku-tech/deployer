const fs = require("fs");
const { spawn, spawnSync } = require("child_process");
const path = require("path");
const { pm2Environment } = require("./pm2Environment");
const { findPm2Cli } = require("./pm2Cli");

const varSpliter = ">>";

function parseVars() {
  const varStr = fs.readFileSync(this.varsFile, "utf-8");
  const lines = varStr.split("\n");
  return lines.reduce((ret, item) => {
    const arr = item.split(varSpliter);
    if (arr[0]) {
      ret[arr[0]] = arr[1].trim();
    }
    return ret;
  }, {});
}
function saveVars(varObj) {
  const varStr = Object.entries(varObj)
    .map(([k, v]) => `${k}${varSpliter}${v}`)
    .join("\n");
  fs.writeFileSync(this.varsFile, varStr, "utf-8");
}
function parseHosts() {
  const ret = JSON.parse(fs.readFileSync(this.hostsFile, "utf-8") || "{}");
  return Object.entries(ret).reduce((ret, item) => {
    const info = item[1].split(":");
    ret[item[0]] = { host: info[0], password: info[1], port: info[2] };
    return ret;
  }, {});
}

function selfUpdate(version) {
  const versionLabel = version || "最新版本";
  console.log("开始自动升级，目标版本:", versionLabel, "项目路径:", path.resolve(__dirname, "..", ".."));

  // 由 PM2 单独托管更新进程，宿主服务退出后更新仍可继续执行。
  const projectDir = path.resolve(__dirname, "..", "..");
  const pm2Bin = findPm2Cli();
  const pm2Config = path.join(projectDir, "ecosystem.config.js");
  const submitLock = "/tmp/deployer-updater-submit.lock";
  const env = Object.assign(pm2Environment(), { UPGRADE_VERSION: version || "" });
  const updaterIsActive = () => {
    const result = spawnSync(pm2Bin, ["jlist"], {
      cwd: projectDir,
      env,
      encoding: "utf8",
      timeout: 3000,
    });
    if (result.error || result.status !== 0) return false;
    try {
      const processes = JSON.parse(result.stdout);
      return processes.some(item => item.name === "deployer-updater" &&
        ["online", "launching", "waiting restart", "stopping"].includes(item.pm2_env?.status));
    } catch (error) {
      return false;
    }
  };
  if (updaterIsActive()) {
    return Promise.reject(new Error("升级任务正在执行，请稍后再试"));
  }
  let lockFd;
  try {
    // The request handler can be hit twice before PM2 reports the updater online.
    lockFd = fs.openSync(submitLock, "wx");
  } catch (error) {
    if (error.code === "EEXIST") {
      return Promise.reject(new Error("升级任务正在提交，请勿重复操作"));
    }
    return Promise.reject(error);
  }
  if (updaterIsActive()) {
    try { fs.closeSync(lockFd); } catch (e) { /* already closed */ }
    try { fs.unlinkSync(submitLock); } catch (e) { /* best effort */ }
    return Promise.reject(new Error("升级任务正在执行，请稍后再试"));
  }

  return new Promise((resolve, reject) => {
    const npmProcess = spawn(pm2Bin, [
      "start",
      pm2Config,
      "--only",
      "deployer-updater",
      "--update-env",
    ], {
      cwd: projectDir,
      env,
      detached: true,
      stdio: "ignore",
    });

    npmProcess.once("error", reject);
    npmProcess.once("close", (code, signal) => {
      try { fs.closeSync(lockFd); } catch (e) { /* already closed */ }
      // The updater removes this marker when it has acquired its process lock.
      // A failed PM2 submission must release it here so the next request works.
      if (code !== 0) {
        try { fs.unlinkSync(submitLock); } catch (e) { /* best effort */ }
      }
      if (code === 0) {
        console.log("PM2 更新进程启动请求已发送，子进程 PID:", npmProcess.pid);
        resolve();
      } else {
        reject(new Error(`PM2 更新进程启动失败${signal ? `（信号 ${signal}）` : `（退出码 ${code}）`}`));
      }
    });
    npmProcess.unref();
  });
}

// 获取当前版本
function getCurrentVersion() {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "..", "..", "package.json"), "utf-8")
    );
    return packageJson.version || "未知版本";
  } catch (error) {
    console.error("读取版本号失败:", error);
    return "未知版本";
  }
}

module.exports = {
  parseVars,
  saveVars,
  parseHosts,
  selfUpdate,
  getCurrentVersion,
};
