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
import { getDeployings, stopDeploy, selfUpdate } from "../api";
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
        ElMessageBox.prompt("输入更新token", "提示", {
          confirmButtonText: "OK",
          cancelButtonText: "Cancel",
        })
          .then(({ value }) => {
            selfUpdate(value).then((resp) => {
              ElMessage({
                type: "success",
                message: `命令已启动`,
              });
            });
          })
          .catch(() => {});
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
</style>
