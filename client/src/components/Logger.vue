<template>
  <div id="logger"></div>
</template>

<script>
export default {
  name: "logger",
  mounted() {
    this.logger = document.getElementById("logger");
    this.hearter = 0;
    this.connect();
    document.addEventListener("keyup", this.onKeyUp);
  },
  methods: {
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
        this.addLog(e.data);
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
      var line = document.createElement("div");
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
#logger {
  height: 100%;
  flex: 1;
  background-color: #000;
  color: #eee;
  overflow-y: scroll;
  padding: 10px;
  box-sizing: border-box;
}
#logger .item {
  padding: 0 2px;
  text-align: left;
  font-size: 12px;
  background: #222;
  border-radius: 2px;
  margin-bottom: 2px;
}
#logger .ERR {
  color: #ee0000;
}
#logger .NORM {
  color: #0e0;
}
</style>
