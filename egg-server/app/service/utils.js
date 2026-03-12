const fs = require("fs");
const { spawn } = require("child_process");
const path = require("path");

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

function selfUpdate() {
  console.log("开始自动升级，项目路径:", path.resolve(__dirname, "..", ".."));
  // 运行 npm 命令，仓库现在是公开的，无需token
  // 使用 detached: true 和 unref() 确保子进程完全独立，不会因父进程终止而终止
  const npmProcess = spawn("npm", ["run", "upgrade"], {
    cwd: path.resolve(__dirname, "..", ".."),
    env: process.env,
    detached: true, // 使子进程与父进程分离，即使父进程终止，子进程也会继续运行
    stdio: "ignore", // 完全忽略输入输出，断开与父进程的所有连接
  });

  // 使子进程脱离父进程的引用，父进程不会等待子进程
  npmProcess.unref();
  console.log("升级进程已启动，子进程 PID:", npmProcess.pid);
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
