const Client = require('ssh2').Client;
const broadcast = require('./broadcast');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const utils = require('./utils');
const { Service } = require('egg');
const regExp = /\[(VAR|FILE|CONF|HOST):.+?\]/g;
const funMap = {};
const VAR_TYPE = 'VAR';
const FILE_TYPE = 'FILE';
const CFG_TYPE = 'CONF';
const HOST_TYPE = 'HOST';
const RUN_CMD = 'run:';
const PUT_CMD = 'put:';
const GET_CMD = 'get:';
const QUERY_CMD = 'rquery:';
const RPUSH_CMD = 'spush:';
const RPOP_CMD = 'spop:';
const EVAL_CMD = 'reval:';
const UPDATE_CMD = 'update:';

deploying = [];

class ExecuterService extends Service {
  constructor(ctx) {
    super(ctx);
    this.env = '';
    setInterval(() => {
      const now = Date.now();
      const maxTime = 3 * 60 * 1000;
      deploying.forEach(item => {
        if (!item.using && now - item.timer > maxTime) {
          item.close();
        }
      });
    }, 1000);
  }
  getFile(conn, srcFile, distFile) {
    const env = this.env;
    return new Promise((resolve, reject) => {
      conn.sftp(function(err, sftp) {
        if (err) return reject(err);
        let now = Date.now();
        // 下载文件
        sftp.fastGet(
          srcFile,
          distFile,
          {
            step(transferred, chunk, total) {
              if (Date.now() - now > 1000 || transferred >= total) {
                now = Date.now();
                broadcast.cast(
                  `INFO:[${conn.host}] 进度:${(
                    (transferred * 100) /
                    total
                  ).toFixed(2)}%`,
                  env
                );
              }
            },
          },
          function(err) {
            if (err) {
              broadcast.cast(`ERR:[${conn.host}] ${err.message}`, env);
              return reject(err);
            }
            broadcast.cast(`INFO:[${conn.host}] 文件下载成功`, env);
            resolve();
          }
        );
      });
    });
  }
  putFile(conn, srcFile, distFile) {
    const env = this.env;
    return new Promise((resolve, reject) => {
      conn.sftp(function(err, sftp) {
        if (err) return reject(err);
        let now = Date.now();
        // 上传文件
        try {
          sftp.fastPut(
            srcFile,
            distFile,
            {
              step(transferred, chunk, total) {
                if (Date.now() - now > 1000 || transferred >= total) {
                  now = Date.now();
                  console.log(conn.host, '12', '不对行');
                  broadcast.cast(
                    `INFO:[${conn.host}] 进度:${(
                      (transferred * 100) /
                      total
                    ).toFixed(2)}%`,
                    env
                  );
                }
              },
            },
            function(err) {
              if (err) {
                broadcast.cast(`ERR:[${conn.host}] ${err.message}`, env);
                return reject(err);
              }
              broadcast.cast(`INFO:[${conn.host}] 文件上传成功`, env);
              resolve();
            }
          );
        } catch (error) {
          console.log(error);
        }
      });
    });
  }
  execute(conn, cmd) {
    const env = this.env;
    return new Promise((resolve, reject) => {
      let buffer = '';
      conn.exec(cmd, function(err, stream) {
        if (err) return reject(err);
        stream
          .on('close', function(code, signal) {
            if (buffer) {
              broadcast.cast(`INFO:[${conn.host}] ${buffer}`, env);
            }
            if (signal) {
              broadcast.cast(
                `ERR:[${conn.host}] ${cmd} 执行失败 code:${signal}`,
                env
              );
              reject(new Error(`${cmd} 执行失败 code:${signal}`));
            } else {
              broadcast.cast(`NORM:[${conn.host}] ${cmd} 完成`, env);
              resolve();
            }
          })
          .on('data', function(data) {
            buffer += data.toString();
            if (buffer.includes('\n')) {
              const arr = buffer.split('\n');
              arr
                .slice(0, -1)
                .map(l => broadcast.cast(`INFO:[${conn.host}] ${l}`, env));
              buffer = arr[arr.length - 1];
            }
          })
          .stderr.on('data', function(data) {
            broadcast.cast(`ERR:[${conn.host}] ${data}`, env);
          });
      });
    });
  }
  query(conn, cmd) {
    const env = this.env;
    return new Promise((resolve, reject) => {
      const result = [];
      conn.exec(cmd, function(err, stream) {
        if (err) return reject(err);
        stream
          .on('close', function(code, signal) {
            resolve(result.join(''));
          })
          .on('data', function(data) {
            result.push(data);
          })
          .stderr.on('data', function(data) {
            rbroadcast.cast(`ERR:[${conn.host}] ${data}`, env);
          });
      });
    });
  }

  resolveExpress(scriptContent, from) {
    const files = this.content.files;
    const vars = this.content.vars;
    const hosts = this.content.hosts;
    const fileDir = this.content.fileDir;
    const configDir = this.content.configDir;
    const tempDir = this.content.tempDir;
    const server = this.server;
    // 替换文件路径、服务器名字、配置（并更换配置里面的东西）
    const dynamics = scriptContent.match(regExp);
    if (dynamics) {
      const map = dynamics.reduce((ret, item) => {
        const arr = item.split(':');
        const key = arr[0].slice(1);
        const value = arr[1].slice(0, -1).trim();
        if (key === CFG_TYPE) {
          if (from[value]) {
            ret[item] = { err: `配置[${value}]内有循环引用` };
          } else {
            const filePath = path.resolve(configDir, value);
            const configContent = fs.readFileSync(filePath, 'utf-8');
            if (configContent) {
              from[value] = 1;
              const the = this.resolveExpress(configContent, from);
              if (the.err) {
                ret[item] = the;
              } else {
                if (configContent === the.data) {
                  ret[item] = { data: filePath };
                } else {
                  const now = dayjs();
                  const time = now.format('YYYYMMDD-HH:mm:ss');
                  const newPath = path.resolve(tempDir, `${time}~${value}`);
                  fs.writeFileSync(newPath, the.data, 'utf-8');
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
          } else if (value === '$SELF') {
            ret[item] = { data: server.host };
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
      const errors = Object.values(map).filter(item => item.err);
      if (errors.length) {
        return { err: errors.map(item => item.err).join(',') };
      }
      scriptContent = scriptContent.replace(regExp, $1 => {
        return map[$1].data;
      });
    }
    return { data: scriptContent };
  }
  cmdEval(script, register) {
    let fun = funMap[script];
    if (!fun) {
      fun = funMap[script] = new Function('$', `return ${script}`);
    }
    return fun(register);
  }

  // "AAAA$[0],$[1]"
  resolveStack(cmd, stack) {
    return cmd.replace(/\$\[(\d+?)\]/g, ($0, $1) => {
      return stack[stack.length - 1 - $1] || '';
    });
  }
  updateVars(item) {
    const vars = utils.parseVars();
    const arr = item.split('=');
    vars[arr[0]] = arr[1];
    utils.saveVars(vars);
  }

  // [{name:string,host:string,cmds:string[]}]
  parse(env, content, list) {
    this.env = env;
    this.content = content;
    // 总的变量配置
    const vars = this.content.vars;
    // 总的服务器配置
    const hosts = this.content.hosts;
    const scriptDir = this.content.scriptDir;
    return list.map((item, index) => {
      const server = hosts[item.host];
      if (!server) {
        return { err: `第${index + 1}个配置,找不到服务器[${item.host}]配置` };
      }
      const cmds = [];
      for (let i = 0; i < item.cmds.length; i++) {
        const script = item.cmds[i];
        const filePath = path.resolve(scriptDir, script);
        let scriptContent = fs.readFileSync(filePath, 'utf-8');
        this.server = server;
        const ret = this.resolveExpress(scriptContent, {});
        if (ret.err) {
          return ret;
        }
        scriptContent = ret.data;
        cmds.push(
          ...scriptContent
            .split('\n')
            .filter(line => !line.trim().startsWith('#'))
        );
      }
      return { server, cmds: cmds.filter(cmd => cmd) };
    });
  }
  genConn(host, password) {
    let item = deploying.find(item => item.host === host);
    if (!item) {
      let readyResolve,
        readyReject;
      const waitReady = new Promise((resolve, reject) => {
        readyResolve = resolve;
        readyReject = reject;
      });
      const conn = new Client();
      conn.host = host;
      broadcast.cast(`NORM:[${conn.host}] 开始连接`, this.env);
      conn
        .connect({
          host,
          port: 22,
          username: 'root',
          password,
        })
        .on('ready', readyResolve)
        .on('close', () => {
          broadcast.cast(`NORM:[${item.host}] 断开连接`, this.env);
          readyReject();
          const index = deploying.findIndex(item => item.host === host);
          if (index >= 0) {
            deploying.splice(index, 1);
          }
        });
      item = {
        conn,
        host,
        waitReady,
        close() {
          conn.end();
          readyReject();
        },
        using: true,
        timer: Date.now(),
        record() {
          this.timer = Date.now();
        },
      };
      deploying.push(item);
    } else {
      item.using = true;
      item.record();
      broadcast.cast(`NORM:[${item.host}] 缓存连接`, this.env);
    }
    return item;
  }

  async deply(item) {
    const errors = [];
    const host = item.server.host;
    const password = item.server.password;
    const connect = this.genConn(host, password);
    const conn = connect.conn;
    try {
      await connect.waitReady;
      const stack = [];
      let register;
      for (let i = 0; i < item.cmds.length; ++i) {
        const cmd = item.cmds[i];
        broadcast.cast(`NORM:[${conn.host}] ${cmd}`, this.env);
        if (cmd.startsWith(PUT_CMD)) {
          const desc = this.resolveStack(
            cmd.slice(PUT_CMD.length).trim(),
            stack,
            host
          );
          const paths = desc.split(',');
          await this.putFile(conn, paths[0], paths[1]);
        } else if (cmd.startsWith(GET_CMD)) {
          const desc = this.resolveStack(
            cmd.slice(GET_CMD.length).trim(),
            stack,
            host
          );
          const paths = desc.split(',');
          await this.getFile(conn, paths[0], paths[1]);
        } else if (cmd.startsWith(RUN_CMD)) {
          const desc = this.resolveStack(
            cmd.slice(RUN_CMD.length).trim(),
            stack,
            host
          );
          await this.execute(conn, desc);
        } else if (cmd.startsWith(QUERY_CMD)) {
          const desc = this.resolveStack(
            cmd.slice(QUERY_CMD.length).trim(),
            stack,
            host
          );
          register = await this.query(conn, desc);
        } else if (cmd.startsWith(RPUSH_CMD)) {
          stack.push(register);
        } else if (cmd.startsWith(RPOP_CMD)) {
          register = stack.pop();
        } else if (cmd.startsWith(EVAL_CMD)) {
          const desc = this.resolveStack(
            cmd.slice(EVAL_CMD.length).trim(),
            stack,
            host
          );
          register = this.cmdEval(desc, register);
        } else if (cmd.startsWith(UPDATE_CMD)) {
          const desc = this.resolveStack(
            cmd.slice(UPDATE_CMD.length).trim(),
            stack,
            host
          );
          this.updateVars(desc);
        }
        connect.record();
      }
    } finally {
      connect.using = false;
    }
  }

  async deployList(list) {
    console.log(list, '真美');
    for (let i = 0; i < list.length; ++i) {
      const item = list[i];
      await this.deply(item);
    }
  }

  run(server, cmd) {
    return this.deply({ server, cmds: [ cmd ] });
  }

  getDeployings() {
    return deploying.map(item => item.host);
  }
  stopDeploy(host) {
    const item = deploying.find(item => item.host === host);
    if (item) {
      item.close();
    }
  }
}

module.exports = ExecuterService;
