<template>
  <Login v-if="!dataCenter.user"></Login>
  <div class="main" v-if="dataCenter.user">
    <Operator />
    <Spliter />
    <Logger />
    <EnvSwitch />
    <Confirm />
  </div>
</template>

<script>
import Logger from "./components/Logger.vue";
import Operator from "./components/Operator.vue";
import Spliter from "./components/Spliter.vue";
import EnvSwitch from "./components/EnvSwitch.vue";
import Confirm from "./components/Confirm.vue";

import Login from "./components/Login.vue";
import dataCenter from "./dataCenter";

export default {
  name: "App",
  data() {
    return {
      dataCenter,
    };
  },
  components: {
    Logger,
    Operator,
    Spliter,
    EnvSwitch,
    Confirm,
    Login,
  },
  mounted() {
    const user = localStorage.getItem("user");
    if (user) {
      dataCenter.user.value = user;
    }
  },
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  height: 100%;
}
html,
body {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
}
.main {
  height: 100%;
  display: flex;
  padding: 10px;
  flex-direction: row;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.panel {
  padding: 10px;
  background: #f0f0f0;
  border-radius: 4px;
}
.panel .title {
  height: 40px;
  font-size: 20px;
  line-height: 40px;
}
.content {
  overflow-y: scroll;
}
.cmd {
  font-size: 12px;
  background: #f0f0f0;
  padding: 0 1px;
  margin: 1px;
  line-height: 1.2;
}
.center {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
