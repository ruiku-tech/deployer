var Client = require("ssh2").Client;
const broadcast = require("./broadcast");
const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");
const config = require("./config");

function putFile(conn, localFile, remoteFile) {
  return new Promise((resolve, reject) => {
    conn.sftp(function (err, sftp) {
      if (err) return reject(err);
      let now = Date.now();
      // 上传文件
      sftp.fastPut(
        localFile,
        remoteFile,
        {
          step: function (transferred, chunk, total) {
            if (Date.now() - now > 1000 || transferred >= total) {
              now = Date.now();
              broadcast.cast(
                `INFO:进度:${((transferred * 100) / total).toFixed(2)}%`
              );
            }
          },
        },
        function (err) {
          if (err) {
            broadcast.cast(`ERR:${err.message}`);
            return reject(err);
          }
          broadcast.cast(`INFO:文件上传成功`);
          resolve();
        }
      );
    });
  });
}
function execute(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, function (err, stream) {
      if (err) return reject(err);
      stream
        .on("close", function (code, signal) {
          if (signal) {
            broadcast.cast(`ERR:${cmd} 执行失败 code:${signal}`);
            reject(new Error(`${cmd} 执行失败 code:${signal}`));
          } else {
            broadcast.cast(`INFO:${cmd} 完成 code:${signal}`);
            resolve();
          }
        })
        .on("data", function (data) {
          broadcast.cast(`INFO:${data}`);
        })
        .stderr.on("data", function (data) {
          broadcast.cast(`ERR:${data}`);
        });
    });
  });
}
function query(conn, cmd) {
  return new Promise((resolve, reject) => {
    const result = [];
    conn.exec(cmd, function (err, stream) {
      if (err) return reject(err);
      stream
        .on("close", function (code, signal) {
          resolve(result.join(""));
        })
        .on("data", function (data) {
          result.push(data);
        })
        .stderr.on("data", function (data) {
          result.push(data);
        });
    });
  });
}

const { varsFile, fileDir, hostsFile, configDir, scriptDir, batDir } = config;

const regExp = /\[.+?:.+?\]/g;

const VAR_TYPE = "VAR";
const FILE_TYPE = "FILE";
const CFG_TYPE = "CONF";
const HOST_TYPE = "HOST";

function resolveExpress(scriptContent, from) {
  const files = this.files;
  const vars = this.vars;
  const hosts = this.hosts;
  // 替换文件路径、服务器名字、配置（并更换配置里面的东西）
  const dynamics = scriptContent.match(regExp);
  if (dynamics) {
    const map = dynamics.reduce((ret, item) => {
      const arr = item.split(":");
      const key = arr[0].slice(1);
      const value = arr[1].slice(0, -1);
      if (key === CFG_TYPE) {
        if (from[value]) {
          ret[item] = { err: `配置[${value}]内有循环引用` };
        } else {
          const filePath = path.resolve(configDir, value);
          const configContent = fs.readFileSync(filePath, "utf-8");
          if (configContent) {
            from[value] = 1;
            const the = resolveExpress.call(this, configContent, from);
            if (the.err) {
              ret[item] = the;
            } else {
              if (configContent === the.data) {
                ret[item] = { data: filePath };
              } else {
                const now = dayjs();
                const time = now.format("YYYYMMDD-HH:mm:ss");
                const newPath = path.resolve(
                  __dirname,
                  "temp",
                  `${time}~${value}`
                );
                fs.writeFileSync(newPath, the.data, "utf-8");
                ret[item] = { data: newPath };
              }
            }
          } else {
            ret[item] = { err: `配置[${value}]不存在` };
          }
        }
      } else if (key === HOST_TYPE) {
        if (hosts[value]) {
          ret[item] = { data: hosts[value].host };
        } else {
          ret[item] = { err: `服务器[${value}]不存在` };
        }
      } else if (key === FILE_TYPE) {
        const filename = files[value];
        const filePath = path.resolve(fileDir, filename);
        if (fs.existsSync(filePath)) {
          ret[item] = { data: filePath };
        } else {
          ret[item] = { err: `文件[${filename}]找不到` };
        }
      } else if (key === VAR_TYPE) {
        if (vars[value]) {
          ret[item] = { data: vars[value] };
        } else {
          ret[item] = { err: `变量[${value}]找不到` };
        }
      } else {
        ret[item] = { err: `变量[${key}]不支持` };
      }
      return ret;
    }, {});
    const errors = Object.values(map).filter((item) => item.err);
    if (errors.length) {
      return { err: errors.map((item) => item.err).join(",") };
    }
    scriptContent = scriptContent.replace(regExp, ($1) => {
      return map[$1].data;
    });
  }
  return { data: scriptContent };
}

function parse(list) {
  const vars = this.vars;
  const hosts = this.hosts;
  return list.map((item, index) => {
    const lines = item.data.split("\n");
    const server = hosts[lines[0]];
    if (!server) {
      return { err: `第${index + 1}个配置,找不到服务器[${lines[0]}]配置` };
    }
    const cmds = [];
    for (let i = 1; i < lines.length; i++) {
      const script = lines[i];
      const filePath = path.resolve(scriptDir, script);
      let scriptContent = fs.readFileSync(filePath, "utf-8");
      const ret = resolveExpress.call(this, scriptContent, {});
      if (ret.err) {
        return ret;
      }
      scriptContent = ret.data;
      cmds.push(...scriptContent.split("\n"));
    }
    return { server, cmds: cmds.filter((cmd) => cmd) };
  });
}
const RUN_CMD = "run:";
const PUT_CMD = "put:";

const deploying = [];

async function deply(item) {
  let resolve, reject;
  const promise = new Promise((rs, rj) => {
    resolve = rs;
    reject = rj;
  });
  const errors = [];
  const conn = new Client();
  const host = item.server.host;
  const password = item.server.password;
  deploying.push({ conn, host });
  conn
    .connect({
      host,
      port: 22,
      username: "root",
      password,
    })
    .on("ready", async function () {
      for (let i = 0; i < item.cmds.length; ++i) {
        const cmd = item.cmds[i];
        broadcast.cast(`NORM:${cmd}`);
        if (cmd.startsWith(PUT_CMD)) {
          const desc = cmd.slice(PUT_CMD.length).trim();
          const paths = desc.split(",");
          await putFile(conn, paths[0], paths[1]);
        } else if (cmd.startsWith(RUN_CMD)) {
          const desc = cmd.slice(RUN_CMD.length).trim();
          await execute(conn, desc);
        }
      }
    })
    .on("error", (err) => {
      reject(err);
    })
    .on("close", () => {
      if (errors.length) {
        reject(new Error(errors.join(",")));
      } else {
        resolve();
      }
      const index = deploying.findIndex((item) => item.host === host);
      if (index >= 0) {
        deploying.splice(index, 1);
      }
    });
}

async function deployList(list) {
  for (let i = 0; i < list.length; ++i) {
    const item = list[i];
    await deply(item);
  }
}

function run(server, cmd) {
  return deply({ server, cmds: [cmd] });
}

function getDeployings() {
  return deploying.map((item) => item.host);
}
function stopDeploy(host) {
  const item = deploying.find((item) => item.host === host);
  if (item) {
    item.conn.end();
  }
}

module.exports = {
  parse,
  deployList,
  run,
  getDeployings,
  stopDeploy,
};
