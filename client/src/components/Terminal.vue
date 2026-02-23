<template>
  <el-dialog
    v-model="visible"
    :title="`远程终端 - ${hostInfo.name} (${hostInfo.host})`"
    width="80%"
    :before-close="handleClose"
    destroy-on-close
    style="text-align: left; font-size: 12px;"
  >
    <div ref="terminalContainer" class="terminal-container"></div>
    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script>
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";
import { ElMessage } from "element-plus";
import dataCenter from "../dataCenter";

export default {
  name: "Terminal",
  data() {
    return {
      visible: false,
      hostInfo: {},
      terminal: null,
      websocket: null,
      fitAddon: null,
    };
  },
  methods: {
    open(hostInfo) {
      this.hostInfo = hostInfo;
      this.visible = true;
      this.$nextTick(() => {
        this.initTerminal();
      });
    },
    initTerminal() {
      // 创建终端实例
      this.terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: "block",
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: "#1e1e1e",
          foreground: "#ffffff",
          cursor: "#ffffff",
          black: "#000000",
          red: "#e06c75",
          green: "#98c379",
          yellow: "#d19a66",
          blue: "#61afef",
          magenta: "#c678dd",
          cyan: "#56b6c2",
          white: "#abb2bf",
          brightBlack: "#5c6370",
          brightRed: "#e06c75",
          brightGreen: "#98c379",
          brightYellow: "#d19a66",
          brightBlue: "#61afef",
          brightMagenta: "#c678dd",
          brightCyan: "#56b6c2",
          brightWhite: "#ffffff",
        },
        rows: 30,
        cols: 100,
      });

      // 添加自适应插件
      this.fitAddon = new FitAddon();
      this.terminal.loadAddon(this.fitAddon);

      // 添加链接插件
      this.terminal.loadAddon(new WebLinksAddon());

      // 将终端挂载到DOM
      this.terminal.open(this.$refs.terminalContainer);
      this.fitAddon.fit();

      // 监听窗口大小变化
      window.addEventListener("resize", this.handleResize);

      // 连接WebSocket
      this.connectWebSocket();
    },
    connectWebSocket() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      // 使用 location.host 包含了主机名和端口
      const env = dataCenter.env.value;
      const wsUrl = `${protocol}//${window.location.host}/terminal/${env}`;

      this.terminal.writeln("正在连接到服务器...");
      console.log('[Terminal] 连接WebSocket:', wsUrl);
      console.log('[Terminal] 主机信息:', {
        name: this.hostInfo.name,
        host: this.hostInfo.host,
        port: this.hostInfo.port,
        env: env
      });

      try {
        this.websocket = new WebSocket(wsUrl);

        // 连接超时检测
        const connectTimeout = setTimeout(() => {
          if (this.websocket && this.websocket.readyState !== WebSocket.OPEN) {
            this.terminal.writeln("\r\n连接超时，请检查网络和服务器状态\r\n");
            ElMessage.error('WebSocket连接超时');
            this.websocket.close();
          }
        }, 10000);

        this.websocket.onopen = () => {
          clearTimeout(connectTimeout);
          this.terminal.writeln("WebSocket连接成功，正在建立SSH连接...\r\n");
          console.log('[Terminal] WebSocket已连接');

          // 发送连接信息（只发送服务器名称，后端自己读取密码）
          const connectData = {
            type: "connect",
            data: {
              name: this.hostInfo.name,
              cols: this.terminal.cols,
              rows: this.terminal.rows,
            },
          };
          console.log('[Terminal] 发送连接请求:', connectData.data);
          this.websocket.send(JSON.stringify(connectData));

          // 监听终端输入
          this.terminal.onData((data) => {
            if (this.websocket.readyState === WebSocket.OPEN) {
              this.websocket.send(
                JSON.stringify({
                  type: "data",
                  data: data,
                })
              );
            }
          });
        };

        this.websocket.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.type === "data") {
            this.terminal.write(message.data);
          } else if (message.type === "error") {
            this.terminal.writeln(`\r\n错误: ${message.data}\r\n`);
            ElMessage.error(message.data);
          } else if (message.type === "connected") {
            this.terminal.writeln("SSH连接建立成功！\r\n");
          }
        };

        this.websocket.onerror = (error) => {
          this.terminal.writeln("\r\nWebSocket连接错误\r\n");
          ElMessage.error("WebSocket连接失败");
          console.error("WebSocket error:", error);
        };

        this.websocket.onclose = () => {
          this.terminal.writeln("\r\n连接已关闭\r\n");
        };
      } catch (error) {
        this.terminal.writeln(`\r\n连接失败: ${error.message}\r\n`);
        ElMessage.error("无法建立连接");
      }
    },
    handleResize() {
      if (this.fitAddon && this.terminal) {
        this.fitAddon.fit();
        // 通知后端终端大小变化
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
          this.websocket.send(
            JSON.stringify({
              type: "resize",
              data: {
                cols: this.terminal.cols,
                rows: this.terminal.rows,
              },
            })
          );
        }
      }
    },
    handleClose() {
      // 关闭WebSocket连接
      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }
      
      // 移除resize监听
      window.removeEventListener("resize", this.handleResize);
      
      // 清理终端实例
      if (this.terminal) {
        try {
          this.terminal.dispose();
        } catch (error) {
          console.warn('[Terminal] dispose error:', error);
        }
        this.terminal = null;
      }
      
      // 清理插件引用
      this.fitAddon = null;
      
      this.visible = false;
    },
  },
  beforeUnmount() {
    this.handleClose();
  },
};
</script>

<style scoped>
.terminal-container {
  height: 500px;
  background: #1e1e1e;
  border-radius: 4px;
  overflow: hidden;
}

:deep(.el-dialog__body) {
  padding: 10px 20px;
  background: #1e1e1e;
}
</style>
