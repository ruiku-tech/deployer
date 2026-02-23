const { Service } = require("egg");
const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");
const util = require("util");
const readFile = util.promisify(fs.readFile);

class TerminalService extends Service {
  constructor(ctx) {
    super(ctx);
    this.sessions = new Map(); // 存储活跃的SSH会话
  }

  /**
   * 从hosts.json读取主机配置
   */
  async getHostConfig(name, env) {
    try {
      const workspaceDir = path.resolve(__dirname, "../../workspace");
      const hostsFile = path.resolve(workspaceDir, env, "hosts.ini");
      
      console.log(`[TerminalService] 读取主机配置: ${hostsFile}`);
      console.log(`[TerminalService] 查找服务器名称: "${name}"`);
      
      const data = await readFile(hostsFile, "utf-8");
      const jsonData = JSON.parse(data);
      
      console.log(`[TerminalService] 可用的服务器列表:`, Object.keys(jsonData));
      
      if (!jsonData[name]) {
        console.error(`[TerminalService] 主机 "${name}" 不存在`);
        console.error(`[TerminalService] 可用的服务器:`, Object.keys(jsonData));
        return null;
      }
      
      // 格式: "host:password:port" 或 "host:password:port:username"
      const parts = jsonData[name].split(":");
      const host = parts[0];
      const password = parts[1];
      const port = parts[2] || "22";
      const username = parts[3] || "root";
      
      return {
        name,
        host,
        username,
        password,
        port: parseInt(port)
      };
    } catch (error) {
      console.error(`[TerminalService] 读取主机配置失败:`, error);
      return null;
    }
  }

  /**
   * 创建SSH连接并返回会话
   */
  async createSession(sessionId, config) {
    const { host, port = 22, username = 'root', password, cols = 80, rows = 30 } = config;

    console.log(`[TerminalService] 创建会话 [${sessionId}]:`, { host, port, username, cols, rows });

    if (!host) {
      throw new Error('主机地址不能为空');
    }
    if (!password) {
      throw new Error('密码或密钥不能为空');
    }

    return new Promise((resolve, reject) => {
      const conn = new Client();

      const connectTimeout = setTimeout(() => {
        console.error(`[TerminalService] SSH连接超时 [${sessionId}]: ${host}:${port}`);
        conn.end();
        reject(new Error(`连接超时: ${host}:${port}`));
      }, 30000); // 30秒超时

      conn.on("ready", () => {
        clearTimeout(connectTimeout);
        console.log(`[TerminalService] SSH连接建立成功 [${sessionId}]: ${host}`);

        // 创建shell会话，支持PTY（伪终端）
        conn.shell(
          {
            term: "xterm-256color",
            cols: cols,
            rows: rows,
          },
          (err, stream) => {
            if (err) {
              console.error(`[TerminalService] 创建shell失败 [${sessionId}]:`, err);
              conn.end();
              return reject(err);
            }

            console.log(`[TerminalService] Shell创建成功 [${sessionId}]`);

            const session = {
              conn,
              stream,
              host,
            };

            this.sessions.set(sessionId, session);

            resolve(session);
          }
        );
      });

      conn.on("error", (err) => {
        clearTimeout(connectTimeout);
        console.error(`[TerminalService] SSH连接错误 [${sessionId}] ${host}:`, err.message);
        reject(err);
      });

      conn.on("end", () => {
        clearTimeout(connectTimeout);
        console.log(`[TerminalService] SSH连接关闭 [${sessionId}]: ${host}`);
        this.sessions.delete(sessionId);
      });

      // 连接配置
      const connectConfig = {
        host,
        port: parseInt(port),
        username: username, // 使用传入的username
        readyTimeout: 30000,
      };

      // 判断是密码还是密钥
      if (password.length > 32) {
        // 密钥方式
        console.log(`[TerminalService] 使用密钥认证 [${sessionId}]`);
        connectConfig.privateKey = password;
      } else {
        // 密码方式
        console.log(`[TerminalService] 使用密码认证 [${sessionId}]`);
        connectConfig.password = password;
      }

      try {
        console.log(`[TerminalService] 开始连接 [${sessionId}]: ${host}:${port}`);
        conn.connect(connectConfig);
      } catch (error) {
        clearTimeout(connectTimeout);
        console.error(`[TerminalService] SSH连接失败 [${sessionId}]:`, error);
        reject(error);
      }
    });
  }

  /**
   * 获取会话
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * 向SSH会话写入数据
   */
  writeToSession(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (session && session.stream) {
      session.stream.write(data);
      return true;
    }
    return false;
  }

  /**
   * 调整终端大小
   */
  resizeSession(sessionId, cols, rows) {
    const session = this.sessions.get(sessionId);
    if (session && session.stream) {
      session.stream.setWindow(rows, cols);
      return true;
    }
    return false;
  }

  /**
   * 关闭会话
   */
  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.stream) {
        session.stream.end();
      }
      if (session.conn) {
        session.conn.end();
      }
      this.sessions.delete(sessionId);
      console.log(`会话关闭: ${sessionId}`);
      return true;
    }
    return false;
  }

  /**
   * 关闭所有会话
   */
  closeAllSessions() {
    this.sessions.forEach((session, sessionId) => {
      this.closeSession(sessionId);
    });
  }
}

module.exports = TerminalService;
