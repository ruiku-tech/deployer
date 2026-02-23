// app/controller/ws.js
const Controller = require("egg").Controller;
const broadcast = require("../service/broadcast");
const { v4: uuidv4 } = require("uuid");

class WSController extends Controller {
  async connect() {
    const { ctx, app } = this;
    const { websocket } = ctx;
    broadcast.init(websocket);
  }

  async terminal() {
    const { ctx } = this;
    const { websocket } = ctx;
    const sessionId = uuidv4();

    console.log("[Terminal] 新的终端WebSocket连接:", sessionId);
    console.log("[Terminal] 客户端地址:", ctx.request.ip);

    // 监听客户端消息
    websocket.on("message", async (msg) => {
      try {
        const message = JSON.parse(msg);
        const { type, data } = message;

        console.log(`[Terminal] 收到消息 [${sessionId}]:`, type);

        switch (type) {
          case "connect":
            // 建立SSH连接（根据名称读取完整配置）
            console.log(`[Terminal] 建立SSH连接 [${sessionId}]:`, {
              name: data.name
            });
            await this.handleConnect(sessionId, websocket, data, ctx);
            break;

          case "data":
            // 转发用户输入到SSH
            ctx.service.terminal.writeToSession(sessionId, data);
            break;

          case "resize":
            // 调整终端大小
            console.log(`[Terminal] 调整终端大小 [${sessionId}]:`, data.cols, 'x', data.rows);
            ctx.service.terminal.resizeSession(
              sessionId,
              data.cols,
              data.rows
            );
            break;

          default:
            console.log(`[Terminal] 未知消息类型 [${sessionId}]:`, type);
        }
      } catch (error) {
        console.error(`[Terminal] 处理WebSocket消息错误 [${sessionId}]:`, error);
        this.sendError(websocket, error.message);
      }
    });

    // 监听WebSocket关闭
    websocket.on("close", () => {
      console.log(`[Terminal] WebSocket连接关闭 [${sessionId}]`);
      ctx.service.terminal.closeSession(sessionId);
    });

    // 监听WebSocket错误
    websocket.on("error", (error) => {
      console.error(`[Terminal] WebSocket错误 [${sessionId}]:`, error);
      ctx.service.terminal.closeSession(sessionId);
    });
  }

  async handleConnect(sessionId, websocket, data, ctx) {
    console.log(`[Terminal] 开始创建SSH会话 [${sessionId}]`);

    try {
      // 验证配置
      if (!data.name) {
        throw new Error('缺少服务器名称');
      }

      // 从hosts.ini读取完整的主机配置（包括密码）
      // 从路径参数中获取env
      const env = ctx.params.env || 'dsc';
      console.log(`[Terminal] 使用环境: ${env}`);
      const hostConfig = await ctx.service.terminal.getHostConfig(
        data.name,
        env
      );

      if (!hostConfig) {
        throw new Error(`服务器 ${data.name} 不存在`);
      }

      // 合并终端配置
      const config = {
        ...hostConfig,
        cols: data.cols,
        rows: data.rows
      };

      console.log(`[Terminal] 连接配置 [${sessionId}]:`, {
        name: config.name,
        host: config.host,
        port: config.port
      });

      // 创建SSH会话
      const session = await ctx.service.terminal.createSession(
        sessionId,
        config
      );

      console.log(`[Terminal] SSH会话创建成功 [${sessionId}]`);

      // 监听SSH输出并转发到WebSocket
      session.stream.on("data", (data) => {
        if (websocket.readyState === 1) {
          // 1 = OPEN
          this.sendData(websocket, data.toString());
        }
      });

      // 监听SSH流关闭
      session.stream.on("close", () => {
        console.log(`[Terminal] SSH流关闭 [${sessionId}]`);
        if (websocket.readyState === 1) {
          this.sendError(websocket, "SSH连接已关闭");
        }
        ctx.service.terminal.closeSession(sessionId);
      });

      // 发送连接成功消息
      this.sendMessage(websocket, "connected", "SSH连接建立成功");
    } catch (error) {
      console.error(`[Terminal] SSH连接失败 [${sessionId}]:`, error.message);
      this.sendError(websocket, `连接失败: ${error.message}`);
    }
  }

  sendData(websocket, data) {
    if (websocket.readyState === 1) {
      websocket.send(
        JSON.stringify({
          type: "data",
          data: data,
        })
      );
    }
  }

  sendMessage(websocket, type, data) {
    if (websocket.readyState === 1) {
      websocket.send(
        JSON.stringify({
          type: type,
          data: data,
        })
      );
    }
  }

  sendError(websocket, message) {
    if (websocket.readyState === 1) {
      websocket.send(
        JSON.stringify({
          type: "error",
          data: message,
        })
      );
    }
  }
}

module.exports = WSController;

