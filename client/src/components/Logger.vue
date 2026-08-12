<template>
  <div class="right">
    <div class="deploying">
      <div class="title">部署中</div>
      <el-popover placement="bottom" trigger="click" :width="300">
        <template #reference>
          <el-button size="small" style="margin-right: 10px">
            监听环境 ({{ envList.length }})
          </el-button>
        </template>
        <el-checkbox-group v-model="envList" style="display: flex; flex-direction: column">
          <el-checkbox
            v-for="env in dataCenter.envList"
            :label="env"
            :key="env.name"
            style="margin: 5px 0"
          >
            {{ env.name }}
          </el-checkbox>
        </el-checkbox-group>
      </el-popover>
      <el-popover placement="bottom" trigger="click" :width="300">
        <template #reference>
          <el-button size="small" type="info">
            活动连接 ({{ deployings.length }})
          </el-button>
        </template>
        <div style="display: flex; flex-direction: column; gap: 5px">
          <el-button
            v-for="deploying in deployings"
            :key="deploying"
            size="small"
            type="danger"
            plain
            @click="stop(deploying)"
          >
            {{ deploying }} (点击停止)
          </el-button>
          <div v-if="deployings.length === 0" style="color: #999; text-align: center; padding: 10px">
            暂无活动连接
          </div>
        </div>
      </el-popover>
    </div>
    <div id="logger" @contextmenu.prevent="showContextMenu"></div>
    <!-- 右键菜单 -->
    <el-dropdown
      ref="contextMenu"
      trigger="contextmenu"
      :style="{ position: 'fixed', left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px', display: contextMenuVisible ? 'block' : 'none' }"
    >
      <span></span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item @click="clearLog">清空日志 (Ctrl+K)</el-dropdown-item>
          <el-dropdown-item @click="updateDialogVisible = true">版本管理 (Ctrl+U)</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <!-- 版本管理弹窗 -->
    <UpdateDialog v-model="updateDialogVisible" />
  </div>
</template>

<script>
import { getDeployings, stopDeploy } from "../api";
import dataCenter from "../dataCenter";
import { confirmDelete } from "../utils";
import dayjs from "dayjs";
import UpdateDialog from "./UpdateDialog.vue";

export default {
  name: "logger",
  components: { UpdateDialog },
  data() {
    return {
      deployings: [],
      dataCenter,
      envList: [{ name: dataCenter.env.value }],
      contextMenuVisible: false,
      contextMenuPosition: { x: 0, y: 0 },
      updateDialogVisible: false,
    };
  },
  mounted() {
    this.logger = document.getElementById("logger");
    this.hearter = 0;
    this.connect();
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("click", this.hideContextMenu);
    this.loopSyncDeploying();
  },
  beforeUnmount() {
    document.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("click", this.hideContextMenu);
    if (this.timer) {
      clearInterval(this.timer);
    }
    if (this.hearter) {
      clearInterval(this.hearter);
    }
  },
  methods: {
    stop(host) {
      confirmDelete(`确定停止${host}的部署？`).then(() => {
        stopDeploy(host).then(() => {
          this.loopSyncDeploying();
        });
      });
    },
    loopSyncDeploying() {
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.timer = setInterval(this.syncDeploying, 10000);
    },
    syncDeploying() {
      if (dataCenter.token.value) {
        getDeployings().then((list) => (this.deployings = list));
      }
    },
    onKeyUp(e) {
      if (e.ctrlKey && e.code === "KeyK") {
        this.clearLog();
      } else if (e.ctrlKey && e.code === "KeyU") {
        this.updateDialogVisible = true;
      }
    },
    connect() {
      const baseUrl = process.env.VUE_APP_SERVER;
      let wsUrl = baseUrl.replace("http", "ws");
      // 兼容测试环境和正式环境
      if (!baseUrl.startsWith("http")) {
        wsUrl = "ws://" + location.host + baseUrl;
      }
      var ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        if (e.data) {
          this.addLog(e.data);
        }
      };
      ws.onclose = () => {
        clearInterval(this.hearter);
        this.hearter = 0;
        this.addLog("ERR:链接端口，2秒后重连");
        setTimeout(this.connect, 2000);
      };
      if (!this.hearter) {
        this.hearter = setInterval(() => {
          if (ws.readyState === 1) {
            ws.send("0");
          }
        }, 5000);
      }
    },
    addLog(info) {
      const log = info.split(":");
      var line = document.createElement("pre");
      line.className = `item ${log[0] == "环境" ? log[2] : log[0]}`;
      if (this.envList.find((obj) => obj.name === log[1]) || log[0] != "环境") {
        if (log[2] === "NORM") {
          line.textContent = `${log.slice(1).join(":")} @${dayjs().format(
            "MM-DD hh:mm:ss"
          )}`;
        } else {
          line.textContent = log.slice(1).join(":");
        }
        this.logger.appendChild(line);
        this.logger.scrollTo(0, this.logger.scrollHeight);
      }
    },
    showContextMenu(e) {
      this.contextMenuPosition = { x: e.pageX, y: e.pageY };
      this.contextMenuVisible = true;
    },
    hideContextMenu() {
      this.contextMenuVisible = false;
    },
    clearLog() {
      this.logger.innerHTML = "";
      this.hideContextMenu();
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style>
.right {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
}

.deploying {
  height: 36px;
  display: flex;
  flex-direction: row;
  border: 1px solid #eee;
}

.deploying .title {
  padding: 0 10px;
  background: #f0f0f0;
  border-right: 1px solid #eee;
  display: flex;
  align-items: center;
  margin-right: 10px;
}

.deploying .list {
  flex: 1;
  overflow-x: scroll;
  display: flex;
  flex-direction: row;
  align-items: center;
}

#logger {
  flex: 1;
  background-color: #000;
  color: #eee;
  overflow: scroll;
  margin-top: 10px;
  padding: 10px;
  box-sizing: border-box;
}

#logger .item {
  padding: 0 2px;
  text-align: left;
  font-size: 12px;
  background: #222;
  border-radius: 2px;
  margin: 1px 0;
}

#logger .ERR {
  color: #ee0000;
}

#logger .NORM {
  color: #0e0;
}

/* 版本确认对话框样式（已迁移到 UpdateDialog.vue，保留注释） */
</style>
