<template>
  <div class="right">
    <div class="deploying">
      <div class="title">部署中</div>
      <el-checkbox-group v-model="envList">
        <el-checkbox-button
          v-for="env in dataCenter.envList"
          :label="env"
          :key="env"
          >{{ env.name }}</el-checkbox-button
        >
      </el-checkbox-group>
      <div class="list">
        <el-tag
          v-for="deploying in deployings"
          :key="deploying"
          closable
          @close="stop(deploying)"
        >
          {{ deploying }}
        </el-tag>
      </div>
    </div>
    <div id="logger"></div>
  </div>
</template>

<script>
import { getDeployings, stopDeploy, selfUpdate, getVersionInfo } from "../api";
import dataCenter from "../dataCenter";
import { confirmDelete } from "../utils";
import dayjs from "dayjs";
import { ElMessage, ElMessageBox } from "element-plus";

export default {
  name: "logger",
  data() {
    return {
      deployings: [],
      dataCenter,
      envList: [{ name: dataCenter.env.value }],
    };
  },
  mounted() {
    this.logger = document.getElementById("logger");
    this.hearter = 0;
    this.connect();
    document.addEventListener("keyup", this.onKeyUp);
    this.loopSyncDeploying();
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
      if (e.ctrlKey && e.code === "KeyL") {
        this.logger.innerHTML = "";
      } else if (e.ctrlKey && e.code === "KeyU") {
        // 先获取版本信息
        getVersionInfo()
          .then((response) => {
            const versionInfo = response?.data || {};
            const currentVersion = versionInfo.currentVersion || "未知";
            const latestVersion = versionInfo.latestVersion || "未知";
            const releaseNotes = versionInfo.releaseNotes || "";
            
            // 构建确认消息
            let message = `当前版本: ${currentVersion}\n最新版本: ${latestVersion}\n\n`;
            
            if (currentVersion === latestVersion) {
              message += "已是最新版本，是否仍要重新安装？";
            } else {
              message += "升级过程中服务会短暂重启，是否继续？";
            }
            
            if (releaseNotes && releaseNotes !== "暂无更新说明") {
              // 截取前200个字符作为预览
              const preview = releaseNotes.length > 200 
                ? releaseNotes.substring(0, 200) + "..."
                : releaseNotes;
              message += `\n\n更新说明:\n${preview}`;
            }

            return ElMessageBox.confirm(message, "自动升级确认", {
              confirmButtonText: "确定升级",
              cancelButtonText: "取消",
              type: "warning",
              customClass: "version-confirm-dialog",
            });
          })
          .then(() => {
            // 用户确认升级
            selfUpdate().then((resp) => {
              ElMessage({
                type: "success",
                message: resp?.data || "升级进程已启动，服务将在几分钟内自动重启",
                duration: 5000,
              });
            }).catch((error) => {
              ElMessage({
                type: "error",
                message: error?.response?.data?.err || "升级启动失败",
              });
            });
          })
          .catch((error) => {
            if (error === "cancel") {
              ElMessage({
                type: "info",
                message: "已取消升级",
              });
            } else if (error?.response) {
              // 获取版本信息失败，但仍然提供升级选项
              ElMessageBox.confirm(
                "无法获取版本信息，是否仍要继续升级？\n\n升级过程中服务会短暂重启。",
                "自动升级确认",
                {
                  confirmButtonText: "确定升级",
                  cancelButtonText: "取消",
                  type: "warning",
                }
              ).then(() => {
                selfUpdate().then((resp) => {
                  ElMessage({
                    type: "success",
                    message: resp?.data || "升级进程已启动",
                    duration: 5000,
                  });
                }).catch((error) => {
                  ElMessage({
                    type: "error",
                    message: error?.response?.data?.err || "升级启动失败",
                  });
                });
              }).catch(() => {
                ElMessage({
                  type: "info",
                  message: "已取消升级",
                });
              });
            }
          });
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

/* 版本确认对话框样式 */
:deep(.version-confirm-dialog) {
  width: 500px;
}

:deep(.version-confirm-dialog .el-message-box__message) {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: monospace;
  line-height: 1.6;
}
</style>
