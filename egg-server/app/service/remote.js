const { Service } = require("egg");
const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");
const util = require("util");
const readFile = util.promisify(fs.readFile);
const { PassThrough } = require("stream");

class RemoteService extends Service {
  /**
   * 获取主机配置
   */
  async getHostConfig(serverName, env) {
    try {
      const workspaceDir = path.resolve(__dirname, "../../workspace");
      const hostsFile = path.resolve(workspaceDir, env, "hosts.ini");

      console.log(`[RemoteService] 读取主机配置: ${hostsFile}`);
      console.log(`[RemoteService] 查找服务器名称: "${serverName}"`);

      const data = await readFile(hostsFile, "utf-8");
      const jsonData = JSON.parse(data);
      
      console.log(`[RemoteService] 可用的服务器列表:`, Object.keys(jsonData));

      if (!jsonData[serverName]) {
        console.error(`[RemoteService] 服务器 "${serverName}" 不存在`);
        console.error(`[RemoteService] 可用的服务器:`, Object.keys(jsonData));
        throw new Error(`服务器 ${serverName} 不存在`);
      }

      // 格式: "host:password:port" 或 "host:password:port:username"
      const parts = jsonData[serverName].split(":");
      const host = parts[0];
      const password = parts[1];
      const port = parts[2] || "22";
      const username = parts[3] || "root";

      return {
        host,
        port: parseInt(port),
        username,
        password,
      };
    } catch (error) {
      console.error(`[RemoteService] 获取主机配置失败:`, error);
      throw error;
    }
  }

  /**
   * 创建SSH连接
   */
  async createSSHConnection(config) {
    return new Promise((resolve, reject) => {
      const conn = new Client();

      const timeout = setTimeout(() => {
        conn.end();
        reject(new Error("SSH连接超时"));
      }, 15000);

      conn.on("ready", () => {
        clearTimeout(timeout);
        resolve(conn);
      });

      conn.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      const connectConfig = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: 15000,
      };

      // 判断是密码还是密钥
      if (config.password.length > 32) {
        connectConfig.privateKey = config.password;
      } else {
        connectConfig.password = config.password;
      }

      conn.connect(connectConfig);
    });
  }

  /**
   * 执行SSH命令
   */
  async executeCommand(conn, command) {
    return new Promise((resolve, reject) => {
      conn.exec(command, (err, stream) => {
        if (err) return reject(err);

        let stdout = "";
        let stderr = "";

        stream
          .on("close", (code, signal) => {
            // ls命令即使出错也可能返回部分结果，所以优先返回stdout
            if (stdout) {
              resolve(stdout);
            } else if (code !== 0) {
              reject(new Error(stderr || `命令执行失败，退出码: ${code}`));
            } else {
              resolve(stdout);
            }
          })
          .on("data", (data) => {
            stdout += data.toString();
          })
          .stderr.on("data", (data) => {
            stderr += data.toString();
          });
      });
    });
  }

  /**
   * 列出远程目录文件
   */
  async listFiles(serverName, remotePath, env) {
    let conn;
    try {
      const config = await this.getHostConfig(serverName, env);
      conn = await this.createSSHConnection(config);

      // 使用 ls -lA 命令获取文件列表（不显示隐藏文件的. 和 ..）
      // -l: 长格式 -A: 所有文件(除了.和..) -h: 人类可读的大小
      const command = `ls -lAh "${remotePath}" 2>&1`;
      console.log(`[RemoteService] 执行命令: ${command}`);
      const output = await this.executeCommand(conn, command);
      console.log(`[RemoteService] ls输出:\n${output}`);

      // 解析ls输出
      const lines = output.trim().split("\n");
      const files = [];

      // 添加上级目录项
      if (remotePath !== "/") {
        files.push({
          name: "..",
          isDirectory: true,
          size: "-",
          permissions: "drwxr-xr-x",
        });
      }

      for (const line of lines) {
        // 跳过总计行和错误行
        if (line.startsWith("total") || line.startsWith("ls:") || !line.trim()) {
          continue;
        }

        // 使用正则表达式解析ls -lAh输出
        // 匹配: 权限 链接数 所有者 组 大小 月 日 时间/年 文件名
        // 例如: drwxr-xr-x 2 root root 4.0K Jan 15 12:34 dirname
        // 符号链接: lrwxrwxrwx. 1 root root 7 Dec 25  2021 bin -> usr/bin
        const match = line.match(/^([\w-]+\.?)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+\s+\S+\s+[\d:]+)\s+(.+)$/);
        
        if (!match) {
          console.log(`[RemoteService] 无法解析行: ${line}`);
          continue;
        }

        const permissions = match[1];
        const size = match[5];
        let fullFileName = match[7];
        
        // 如果是符号链接，分离出真实文件名
        let fileName = fullFileName;
        if (permissions.startsWith("l")) {
          const arrowIndex = fullFileName.indexOf(" -> ");
          if (arrowIndex > -1) {
            fileName = fullFileName.substring(0, arrowIndex);
          }
        }

        // 跳过 . 和 ..
        if (fileName === "." || fileName === "..") continue;

        // 判断是否为目录：d开头的是目录，l开头的符号链接也当作目录处理（可能指向目录）
        const isDirectory = permissions.startsWith("d") || permissions.startsWith("l");

        console.log(`[RemoteService] 解析文件: name="${fileName}", isDir=${isDirectory}, permissions=${permissions}`);

        files.push({
          name: fileName,
          isDirectory,
          size: isDirectory ? "-" : size,
          permissions,
        });
      }

      return files;
    } catch (error) {
      console.error(`[RemoteService] 列出文件失败:`, error);
      throw error;
    } finally {
      if (conn) {
        conn.end();
      }
    }
  }

  /**
   * 下载远程文件
   */
  async downloadFile(serverName, filePath, env) {
    let conn;
    try {
      const config = await this.getHostConfig(serverName, env);
      conn = await this.createSSHConnection(config);

      return new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
          if (err) {
            conn.end();
            return reject(err);
          }

          // 创建一个PassThrough流
          const passThrough = new PassThrough();

          // 创建读取流
          const readStream = sftp.createReadStream(filePath);

          readStream.on("error", (err) => {
            console.error(`[RemoteService] 读取文件失败:`, err);
            conn.end();
            reject(new Error(`读取文件失败: ${err.message}`));
          });

          passThrough.on("end", () => {
            conn.end();
          });

          // 将远程文件流通过PassThrough流传递
          readStream.pipe(passThrough);

          resolve(passThrough);
        });
      });
    } catch (error) {
      if (conn) {
        conn.end();
      }
      console.error(`[RemoteService] 下载文件失败:`, error);
      throw error;
    }
  }
}

module.exports = RemoteService;
