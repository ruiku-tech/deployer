<template>
  <div id="operator" :style="layout.left">
    <template v-if="env.value">
      <el-tabs v-model="active" @tab-click="onTabChange">
        <el-tab-pane label="文件管理" name="files"
          ><Files ref="files"
        /></el-tab-pane>
        <el-tab-pane label="全局变量" name="vars"
          ><Vars ref="vars"
        /></el-tab-pane>
        <el-tab-pane label="服务器管理" name="hosts"
          ><Hosts ref="hosts"
        /></el-tab-pane>
        <el-tab-pane label="配置管理" name="configs"
          ><Configs ref="configs"
        /></el-tab-pane>
        <el-tab-pane label="脚本管理" name="srcipts"
          ><Scripts ref="srcipts"
        /></el-tab-pane>
        <el-tab-pane label="部署编排" name="deploys"
          ><Deploys ref="deploys"
        /></el-tab-pane>
        <el-tab-pane label="其他" name="executer"
          ><Executer ref="executer"
        /></el-tab-pane>
      </el-tabs>
    </template>
    <template v-else>
      <div class="info center">请先选择环境</div>
    </template>
  </div>
</template>

<script>
import Files from "./Files.vue";
import Vars from "./Vars.vue";
import Hosts from "./Hosts.vue";
import Configs from "./Configs.vue";
import Scripts from "./Scripts.vue";
import Deploys from "./Deploys.vue";
import Executer from "./Executer.vue";

import dataCenter from "../dataCenter";

export default {
  name: "operator",
  data() {
    return {
      active: "files",
      layout: dataCenter.layout,
      env: dataCenter.env,
    };
  },
  components: {
    Files,
    Vars,
    Hosts,
    Configs,
    Scripts,
    Deploys,
    Executer,
  },
  methods: {
    onTabChange(tab) {
      this.$nextTick(() => {
        if (this.$refs[tab.paneName].reload) {
          this.$refs[tab.paneName].reload();
        }
      });
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
#operator {
  flex: 1;
}
.info{
  font-size: 20px;
  height: 100%;
}
</style>
