<template>
  <div class="right">
    <div class="deploying">
      <div class="title">部署中</div>
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
import { getDeployings, stopDeploy } from "../api";
import { confirmDelete } from "../utils";

export default {
  name: "logger",
  data() {
    return {
      deployings: []
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
      getDeployings().then((list) => (this.deployings = list));
    },
    onKeyUp(e) {
      if (e.ctrlKey && e.code === "KeyL") {
        this.logger.innerHTML = "";
      }
    },
    connect() {
      const baseUrl = process.env.VUE_APP_SERVER;
      let wsUrl = baseUrl.replace("http", "ws");
      // 兼容测试环境和正式环境
      if (!baseUrl.startsWith("http")) {
        wsUrl = "ws://" + location.host;
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
      line.className = `item ${log[0]}`;
      line.textContent = log.slice(1).join(":");
      this.logger.appendChild(line);
      this.logger.scrollTo(0, this.logger.scrollHeight);
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
