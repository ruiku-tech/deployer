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
    ret[item[0]] = { host: info[0], password: info[1] };
    return ret;
  }, {});
}

function selfUpdate(token) {
  console.log("path", path.resolve(__dirname, "..", ".."));
  // 运行 npm 命令
  const npmProcess = spawn("npm", ["run", "upgrade"], {
    cwd: path.resolve(__dirname, "..", ".."),
    env: { GHTOKEN: token, ...process.env },
    detached: true, // 使子进程与父进程分离
    stdio: "ignore", // 不需要与父进程交互
  });

  // 使子进程脱离父进程
  npmProcess.unref();
}

module.exports = {
  parseVars,
  saveVars,
  parseHosts,
  selfUpdate,
};
