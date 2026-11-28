const Client = require("ssh2").Client;
const broadcast = require("./broadcast");
const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");
const { Service } = require("egg");
const regExp = /\[(VAR|FILE|CONF|HOST|TEXT):\s*([^\]]+?)\]/g;
const VAR_TYPE = "VAR";
const FILE_TYPE = "FILE";
const CFG_TYPE = "CONF";
const HOST_TYPE = "HOST";
const RUN_CMD = "run:";
const PUT_CMD = "put:";
const TEXT_TYPE = "TEXT";
const COMMAND_IDLE_WARNING_MS = 120000;
const MAX_OUTPUT_LINES_PER_COMMAND = 2000;
const MAX_OUTPUT_LINE_LENGTH = 8192;
const MAX_OUTPUT_BYTES_PER_COMMAND = 1024 * 1024;
const INTERACTION_PROMPT = /(?:\[(?:y\s*\/\s*n|y\/n|yes\/no)(?:\s*\])|\(y\/(?:n|N)\)|password\s*:\s*$|passphrase\s*:\s*$|press\s+(?:enter|return)|continue\s*\?\s*(?:\[|\(|$)|\[sudo\]\s+password\s+for|select\s+(?:an?\s+)?option\s*:?\s*$)/im;

const deploying = [];
const batches = new Map();
const cleaner = setInterval(() => {
  const now = Date.now();
  deploying.filter(item => !item.using && now - item.timer > 3 * 60 * 1000).forEach(item => item.close());
}, 1000);
cleaner.unref();

function withSftp(conn, operation) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      let finished = false;
      const finish = (failure) => {
        if (finished) return;
        finished = true;
        try { sftp.end(); } catch (closeError) {
          if (!failure) failure = closeError;
        }
        if (failure) reject(failure);
        else resolve();
      };
      sftp.once('error', finish);
      sftp.once('close', () => finish(new Error('SFTP通道已关闭，文件传输未完成')));
      try { operation(sftp, finish); }
      catch (failure) { finish(failure); }
    });
  });
}

class ExecuterService extends Service {
  constructor(ctx) {
    super(ctx);
    this.env = "";
  }
  putFile(conn, srcFile, distFile) {
    const env = this.env;
    return withSftp(conn, (sftp, finish) => {
        let now = Date.now();
        // 上传文件
        sftp.fastPut(
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
            function (err) {
              if (err) {
                broadcast.cast(`ERR:[${conn.host}] ${err.message}`, env);
                return finish(err);
              }
              broadcast.cast(`INFO:[${conn.host}] 文件上传成功`, env);
              finish();
            }
          );
    });
  }
  execute(conn, cmd) {
    const env = this.env;
    return new Promise((resolve, reject) => {
      let stream;
      let stdoutBuffer = '';
      let stderrBuffer = '';
      let lastStderr = '';
      let idleTimer;
      let settled = false;
      let interactionWarningSent = false;
      let outputLineCount = 0;
      let outputTruncated = false;
      const idleWarningMs = this.commandIdleWarningMs || COMMAND_IDLE_WARNING_MS;
      const outputLineLimit = this.maxOutputLinesPerCommand || MAX_OUTPUT_LINES_PER_COMMAND;
      const outputLineLengthLimit = this.maxOutputLineLength || MAX_OUTPUT_LINE_LENGTH;
      const outputByteLimit = this.maxOutputBytesPerCommand || MAX_OUTPUT_BYTES_PER_COMMAND;
      let outputByteCount = 0;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(idleTimer);
        if (error) reject(error);
        else resolve();
      };
      const output = (channel, data, final = false) => {
        const previous = channel === 'stderr' ? stderrBuffer : stdoutBuffer;
        const normalized = `${previous}${data ? data.toString() : ''}`.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        if (!interactionWarningSent && INTERACTION_PROMPT.test(normalized.slice(-4096))) {
          interactionWarningSent = true;
          broadcast.cast(`WARN:[${conn.host}] 检测到命令可能正在等待交互输入。部署日志不支持输入应答；请使用非交互参数，或取消该服务器的部署。`, env);
        }
        const parts = normalized.split('\n');
        const remaining = final ? '' : parts.pop();
        if (channel === 'stderr') stderrBuffer = '';
        else stdoutBuffer = '';
        const emitLine = line => {
          for (let offset = 0; offset < line.length; offset += outputLineLengthLimit) {
            const fragment = line.slice(offset, offset + outputLineLengthLimit);
            const fragmentBytes = Buffer.byteLength(fragment);
            if (outputTruncated || outputLineCount >= outputLineLimit || outputByteCount + fragmentBytes > outputByteLimit) {
              if (!outputTruncated) {
                outputTruncated = true;
                broadcast.cast(`WARN:[${conn.host}] 单条命令日志已达到上限（${outputLineLimit} 条或 ${Math.round(outputByteLimit / 1024)} KiB），后续输出不再转发。`, env);
              }
              return;
            }
            outputLineCount++;
            outputByteCount += fragmentBytes;
            if (channel === 'stderr') lastStderr = `${lastStderr}${fragment}\n`.slice(-2000);
            broadcast.cast(`INFO:[${conn.host}] ${channel === 'stderr' ? '[stderr] ' : ''}${fragment}`, env);
          }
        };
        for (const line of parts) {
          if (line) emitLine(line);
        }
        if (remaining) {
          let offset = 0;
          while (remaining.length - offset > outputLineLengthLimit && outputLineCount < outputLineLimit && !outputTruncated) {
            emitLine(remaining.slice(offset, offset + outputLineLengthLimit));
            offset += outputLineLengthLimit;
          }
          const hasMoreOutput = remaining.length - offset > 0;
          const buffered = (outputTruncated || outputLineCount >= outputLineLimit) && hasMoreOutput ? '' : remaining.slice(offset);
          if (channel === 'stderr') stderrBuffer = buffered;
          else stdoutBuffer = buffered;
          if (outputLineCount >= outputLineLimit && hasMoreOutput && !outputTruncated) {
            outputTruncated = true;
            broadcast.cast(`WARN:[${conn.host}] 单条命令日志已达到上限（${outputLineLimit} 条或 ${Math.round(outputByteLimit / 1024)} KiB），后续输出不再转发。`, env);
          }
        }
      };
      const resetIdleTimer = () => {
        clearTimeout(idleTimer);
        if (settled) return;
        idleTimer = setTimeout(() => {
          broadcast.cast(`WARN:[${conn.host}] 命令 ${cmd} 已 ${Math.round(idleWarningMs / 1000)} 秒没有输出，仍在运行；如果它正在等待输入，请使用非交互参数或取消此服务器的部署。`, env);
        }, idleWarningMs);
      };
      conn.exec(cmd, function (err, channel) {
        if (err) return finish(err);
        stream = channel;
        resetIdleTimer();
        stream
          .on("close", function (code, signal) {
            output('stdout', null, true);
            output('stderr', null, true);
            if (signal || code !== 0) {
              const reason = `${cmd} 执行失败 code:${code} signal:${signal || ''}${lastStderr ? `\nstderr: ${lastStderr.trim()}` : ''}`;
              broadcast.cast(`ERR:[${conn.host}] ${reason}`, env);
              finish(new Error(reason));
            } else {
              broadcast.cast(`NORM:[${conn.host}] ${cmd} 完成`, env);
              finish();
            }
          })
          .on("data", function (data) {
            resetIdleTimer();
            output('stdout', data);
          })
          .on('error', finish);
        stream.stderr.on("data", function (data) {
          resetIdleTimer();
          output('stderr', data);
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
    const contained = (base, name) => {
      if (typeof name !== 'string' || !name || /[\\/\0]/.test(name) || name === '.' || name === '..') return null;
      const candidate = path.resolve(base, name);
      return candidate.startsWith(`${path.resolve(base)}${path.sep}`) ? candidate : null;
    };
    // 替换文件路径、服务器名字、配置（并更换配置里面的东西）
    const dynamics = [...scriptContent.matchAll(regExp)];
    if (dynamics) {
      const map = dynamics.reduce((ret, item) => {
        const token = item[0];
        const key = item[1];
        const value = item[2].trim();
        if (key === CFG_TYPE) {
          if (from[value]) {
            ret[token] = { err: `配置[${value}]内有循环引用` };
          } else {
            const filePath = contained(configDir, value);
            if (!filePath) { ret[token] = { err: `配置[${value}]名称无效` }; return ret; }
            const configContent = fs.readFileSync(filePath, "utf-8");
            if (configContent) {
              from[value] = 1;
              const the = this.resolveExpress(configContent, from);
              if (the.err) {
                ret[token] = the;
              } else {
                if (configContent === the.data) {
                  ret[token] = { data: filePath };
                } else {
                  const now = dayjs();
                  const time = now.format("YYYYMMDD-HH:mm:ss");
                  const newPath = path.resolve(tempDir, `${time}~${value}`);
                  fs.writeFileSync(newPath, the.data, "utf-8");
                  ret[token] = { data: newPath };
                }
              }
            } else {
              ret[token] = { err: `配置[${value}]不存在` };
            }
          }
        } else if (key === HOST_TYPE) {
          if (hosts[value]) {
            ret[token] = { data: hosts[value].host };
          } else if (value === "$SELF") {
            ret[token] = { data: server.host };
          } else {
            ret[token] = { err: `服务器[${value}]不存在` };
          }
        } else if (key === FILE_TYPE) {
          const filename = files[value];
          const filePath = contained(fileDir, filename);
          if (filePath && fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
            ret[token] = { data: filePath };
          } else {
            ret[token] = { err: `文件[${filename}]找不到` };
          }
        } else if (key === VAR_TYPE) {
          if (vars[value]) {
            ret[token] = { data: vars[value] };
          } else {
            ret[token] = { err: `变量[${value}]找不到` };
          }
        } else if (key === TEXT_TYPE) {
          if (!Object.prototype.hasOwnProperty.call(this.content.texts || {}, value) ||
              typeof this.content.texts[value] !== 'string' ||
              this.content.texts[value].length > 4096 || /[\r\n\0]/.test(this.content.texts[value])) {
            ret[token] = { err: `参数[${value}]未填写` };
          } else {
            ret[token] = { data: this.content.texts[value] };
          }
        } else {
          ret[token] = { err: `变量[${key}]不支持` };
        }
        return ret;
      }, {});
      const errors = Object.values(map).filter((item) => item.err);
      if (errors.length) {
        return { err: errors.map((item) => item.err).join(",") };
      }
      scriptContent = scriptContent.replace(regExp, token => {
        return map[token].data;
      });
    }
    return { data: scriptContent };
  }
  validateCommands(commands) {
    const allowedRoots = [ this.content.fileDir, this.content.configDir, this.content.tempDir ]
      .filter(Boolean).map(root => fs.realpathSync(path.resolve(root)));
    for (const command of commands) {
      const line = command.trim();
      if (!line || line.startsWith('#')) continue;
      const match = /^(put|run):\s*(.*)$/s.exec(line);
      if (!match || !match[2].trim()) return `不支持的部署命令：${line.split(':', 1)[0] || line}`;
      if (match[1] !== 'put') continue;
      const paths = match[2].split(',');
      if (paths.length !== 2 || !paths[0].trim() || !paths[1].trim()) return 'put 命令格式应为 put: [FILE:文件名],远程路径';
      const source = path.resolve(paths[0].trim());
      let resolvedSource;
      try {
        const stat = fs.lstatSync(source);
        if (!stat.isFile() || stat.isSymbolicLink()) return 'put 来源必须是当前环境目录中的普通文件';
        resolvedSource = fs.realpathSync(source);
      } catch { return 'put 来源文件不存在'; }
      if (!allowedRoots.some(root => resolvedSource.startsWith(`${root}${path.sep}`))) return 'put 来源必须位于当前环境 files、configs 或 temp 目录中';
    }
    return null;
  }

  // list:[{name:string,host:string,cmds:string[]}],cmds是文件名字
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
        let scriptContent = fs.readFileSync(filePath, "utf-8");
        this.server = server;
        const ret = this.resolveExpress(scriptContent, {});
        if (ret.err) {
          return ret;
        }
        scriptContent = ret.data;
        cmds.push(
          ...scriptContent
            .split("\n")
            .filter((line) => !line.trim().startsWith("#"))
        );
      }
      const filtered = cmds.filter(cmd => cmd && !cmd.trim().startsWith('#')).map(cmd => cmd.trim());
      const commandError = this.validateCommands(filtered);
      if (commandError) return { err: `第${index + 1}个部署项：${commandError}` };
      return { server, cmds: filtered };
    });
  }
  /** 直接提供给其他那里调用的，直接输入的cmd，而非cmd文件
   * list:[{name:string,host:string,cmds:string[]}]
   * cmds是具体命令字符串
   */
  parseSingleCmds(env, content, list) {
    this.env = env;
    this.content = content;
    // 总的变量配置
    const vars = this.content.vars;
    // 总的服务器配置
    const hosts = this.content.hosts;
    return list.map((item, index) => {
      const server = hosts[item.host];
      if (!server) {
        return { err: `第${index + 1}个配置,找不到服务器[${item.host}]配置` };
      }
      const cmds = [];
      for (let i = 0; i < item.cmds.length; i++) {
        let scriptContent = item.cmds[i];
        this.server = server;
        const ret = this.resolveExpress(scriptContent, {});
        if (ret.err) {
          return ret;
        }
        scriptContent = ret.data;
        cmds.push(
          ...scriptContent
            .split("\n")
            .filter((line) => !line.trim().startsWith("#"))
        );
      }
      const filtered = cmds.filter(cmd => cmd && !cmd.trim().startsWith('#')).map(cmd => cmd.trim());
      const commandError = this.validateCommands(filtered);
      if (commandError) return { err: `第${index + 1}个配置：${commandError}` };
      return { server, cmds: filtered };
    });
  }
  
  genConn(host, password, port) {
    let item = deploying.find((item) => item.host === host && item.env === this.env);
    if (item?.using) throw new Error('此服务器正在部署，请等待完成或取消后重试');
    if (!item) {
      let readyResolve, readyReject;
      const waitReady = new Promise((resolve, reject) => {
        readyResolve = resolve;
        readyReject = reject;
      });
      let cancel;
      const cancelled = new Promise((resolve, reject) => { cancel = reject; });
      cancelled.catch(() => {});
      const conn = new Client();
      conn.host = host;
      broadcast.cast(`NORM:[${conn.host}] 开始连接`, this.env);
      const connCfg = {
        host,
        port,
        username: "root",
        keepaliveInterval: 15000,
        keepaliveCountMax: 3,
      };
      if (password.length > 32) {
        connCfg.privateKey = password;
      } else {
        connCfg.password = password;
      }
      try {
        conn
          .connect(connCfg)
          .on("ready", readyResolve)
          .on("close", () => {
          broadcast.cast(`NORM:[${host}] 断开连接`, this.env);
          readyReject();
          cancel(new Error('服务器连接关闭或部署已取消'));
          const index = item ? deploying.indexOf(item) : -1;
          if (index >= 0) {
            deploying.splice(index, 1);
          }
          }).on("error",(e)=>{
            broadcast.cast(`ERR:[${host}] 连接异常:${e.message}`, this.env);
            readyReject(e);
            cancel(e);
            const index = item ? deploying.indexOf(item) : -1;
            if (index >= 0) deploying.splice(index, 1);
          });
      } catch (err) {
        readyReject(err);
        cancel(err);
        throw err;
      }
      item = {
        conn,
        host,
        env: this.env,
        waitReady,
        cancelled,
        close() {
          const index = deploying.indexOf(this);
          if (index >= 0) deploying.splice(index, 1);
          cancel(new Error('部署已取消'));
          conn.destroy();
          readyReject(new Error('部署已取消'));
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
    const commandError = this.validateCommands(item.cmds || []);
    if (commandError) throw new Error(commandError);
    const host = item.server.host;
    const password = item.server.password;
    const port = item.server.port || 22
    const connect = this.genConn(host, password, port);
    const conn = connect.conn;
    try {
      await Promise.race([connect.waitReady, connect.cancelled]);
      for (let i = 0; i < item.cmds.length; ++i) {
        const cmd = item.cmds[i];
        broadcast.cast(`NORM:[${conn.host}] ${cmd}`, this.env);
        if (cmd.startsWith(PUT_CMD)) {
          const paths = cmd.slice(PUT_CMD.length).trim().split(",");
          await Promise.race([this.putFile(conn, paths[0], paths[1]), connect.cancelled]);
        } else if (cmd.startsWith(RUN_CMD)) {
          await Promise.race([this.execute(conn, cmd.slice(RUN_CMD.length).trim()), connect.cancelled]);
        }
        connect.record();
      }
    } catch (err) {
      // A failed channel must not poison subsequent deployments for the entire
      // cache lifetime. Never retry commands here: they may have side effects.
      connect.close();
      throw err;
    } finally {
      connect.using = false;
    }
  }

  async deployList(list) {
    const groups = new Map();
    for (const item of list) {
      const host = item.server.host;
      if (!groups.has(host)) groups.set(host, []);
      groups.get(host).push(item);
    }
    const key = host => `${this.env}:${host}`;
    for (const host of groups.keys()) {
      if (batches.has(key(host)) || deploying.some(x => x.env === this.env && x.host === host && x.using)) throw new Error(`${host} 正在部署，请稍后重试`);
    }
    for (const [ host, items ] of groups) {
      batches.set(key(host), {
        host,
        env: this.env,
        items,
        currentIndex: -1,
        cancelled: false,
      });
    }
    const failures = [];
    await Promise.all([...groups].map(async ([host, items]) => {
      const batch = batches.get(key(host));
      try {
        for (let index = 0; index < items.length; index++) {
          if (batch.cancelled) throw new Error('部署已取消');
          batch.currentIndex = index;
          await this.deply(items[index]);
        }
      } catch (err) {
        failures.push(`${host}: ${err?.message || '连接中断'}`);
        broadcast.cast(`ERR:[${host}] ${err?.message || '连接中断'}`, this.env);
      } finally { batches.delete(key(host)); }
    }));
    if (failures.length) throw new Error(failures.join('; '));
  }

  run(server, cmd) {
    return this.deply({ server, cmds: [cmd] });
  }

  getDeployings(env) {
    return [...new Set([...deploying.filter(item => item.env === env && item.using), ...[...batches.values()].filter(item => item.env === env)].map(item => item.host))];
  }
  getDeploymentStatuses(env) {
    return [...batches.values()]
      .filter(batch => batch.env === env)
      .map(batch => {
        const queuedItems = batch.currentIndex < 0
          ? batch.items
          : batch.items.slice(batch.currentIndex + 1);
        const currentItem = batch.currentIndex < 0 ? null : batch.items[batch.currentIndex];
        return {
          host: batch.host,
          status: currentItem ? 'deploying' : 'queued',
          currentItem: currentItem?.name || null,
          queuedItems: queuedItems.length,
          queuedNames: queuedItems.map(item => item.name || item.host),
        };
      });
  }
  stopDeploy(host, env) {
    const batch = batches.get(`${env}:${host}`);
    if (batch) batch.cancelled = true;
    const item = deploying.find((item) => item.host === host && item.env === env);
    if (item) {
      item.close();
    }
  }
}

module.exports = ExecuterService;
