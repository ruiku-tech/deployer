<template>
  <div
    v-if="visible"
    class="draggable-terminal"
    :style="{
      left: position.x + 'px',
      top: position.y + 'px',
      width: size.width + 'px',
      height: size.height + 'px',
      zIndex: zIndex
    }"
    @mousedown="bringToFront"
  >
    <div class="terminal-header" @mousedown="startDrag">
      <span class="terminal-title">{{ title }}</span>
      <div class="terminal-actions">
        <el-button
          link
          type="primary"
          size="small"
          @click.stop="minimize"
          class="action-btn"
        >
          <span>_</span>
        </el-button>
        <el-button
          link
          type="danger"
          size="small"
          @click.stop="close"
          class="action-btn"
        >
          <span>×</span>
        </el-button>
      </div>
    </div>
    <div class="terminal-body">
      <div ref="terminalContainer" class="terminal-container"></div>
    </div>
    <!-- 调整大小的边框 -->
    <div class="resize-handle resize-right" @mousedown="startResize($event, 'right')"></div>
    <div class="resize-handle resize-bottom" @mousedown="startResize($event, 'bottom')"></div>
    <div class="resize-handle resize-corner" @mousedown="startResize($event, 'corner')"></div>
  </div>
</template>

<script>
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";
import { ElMessage } from "element-plus";
import dataCenter from "../dataCenter";

export default {
  name: "DraggableTerminal",
  props: {
    hostInfo: {
      type: Object,
      required: true
    },
    initialPosition: {
      type: Object,
      default: () => ({ x: 100, y: 100 })
    },
    zIndex: {
      type: Number,
      default: 1000
    }
  },
  emits: ['close', 'bring-to-front'],
  data() {
    return {
      visible: false,
      position: { ...this.initialPosition },
      size: { width: 800, height: 500 },
      dragging: false,
      resizing: false,
      resizeDirection: null,
      dragStart: { x: 0, y: 0 },
      terminal: null,
      websocket: null,
      fitAddon: null,
    };
  },
  computed: {
    title() {
      return `远程终端 - ${this.hostInfo.name} (${this.hostInfo.host})`;
    }
  },
  methods: {
    open() {
      this.visible = true;
      this.$nextTick(() => {
        this.initTerminal();
      });
    },
    close() {
      this.handleClose();
      this.$emit('close');
    },
    minimize() {
      this.visible = false;
    },
    bringToFront() {
      this.$emit('bring-to-front');
    },
    startDrag(e) {
      if (e.target.closest('.terminal-actions')) return;
      
      this.dragging = true;
      this.dragStart = {
        x: e.clientX - this.position.x,
        y: e.clientY - this.position.y
      };
      
      document.addEventListener('mousemove', this.onDrag);
      document.addEventListener('mouseup', this.stopDrag);
      e.preventDefault();
    },
    onDrag(e) {
      if (this.dragging) {
        this.position = {
          x: e.clientX - this.dragStart.x,
          y: e.clientY - this.dragStart.y
        };
      }
    },
    stopDrag() {
      this.dragging = false;
      document.removeEventListener('mousemove', this.onDrag);
      document.removeEventListener('mouseup', this.stopDrag);
    },
    startResize(e, direction) {
      this.resizing = true;
      this.resizeDirection = direction;
      this.dragStart = {
        x: e.clientX,
        y: e.clientY,
        width: this.size.width,
        height: this.size.height
      };
      
      document.addEventListener('mousemove', this.onResize);
      document.addEventListener('mouseup', this.stopResize);
      e.preventDefault();
      e.stopPropagation();
    },
    onResize(e) {
      if (!this.resizing) return;
      
      const dx = e.clientX - this.dragStart.x;
      const dy = e.clientY - this.dragStart.y;
      
      if (this.resizeDirection === 'right' || this.resizeDirection === 'corner') {
        this.size.width = Math.max(400, this.dragStart.width + dx);
      }
      if (this.resizeDirection === 'bottom' || this.resizeDirection === 'corner') {
        this.size.height = Math.max(300, this.dragStart.height + dy);
      }
      
      // 调整终端大小
      if (this.fitAddon && this.terminal) {
        this.$nextTick(() => {
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
        });
      }
    },
    stopResize() {
      this.resizing = false;
      this.resizeDirection = null;
      document.removeEventListener('mousemove', this.onResize);
      document.removeEventListener('mouseup', this.stopResize);
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

      // 连接WebSocket
      this.connectWebSocket();
    },
    connectWebSocket() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
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

          // 发送连接信息
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
    handleClose() {
      // 关闭WebSocket连接
      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }
      
      // 移除事件监听
      document.removeEventListener('mousemove', this.onDrag);
      document.removeEventListener('mouseup', this.stopDrag);
      document.removeEventListener('mousemove', this.onResize);
      document.removeEventListener('mouseup', this.stopResize);
      
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
.draggable-terminal {
  text-align: left;
  position: fixed;
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.terminal-header {
  background: #2d2d2d;
  color: #fff;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
  user-select: none;
  border-bottom: 1px solid #333;
}

.terminal-title {
  font-size: 13px;
  font-weight: 500;
}

.terminal-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  line-height: 1;
}

.terminal-body {
  flex: 1;
  overflow: hidden;
  padding: 10px;
}

.terminal-container {
  width: 100%;
  height: 100%;
  background: #1e1e1e;
  border-radius: 4px;
  overflow: hidden;
}

/* 调整大小的句柄 */
.resize-handle {
  position: absolute;
  background: transparent;
}

.resize-right {
  right: 0;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
}

.resize-bottom {
  left: 0;
  right: 0;
  bottom: 0;
  height: 8px;
  cursor: ns-resize;
}

.resize-corner {
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
}

.resize-handle:hover {
  background: rgba(255, 255, 255, 0.1);
}
</style>
