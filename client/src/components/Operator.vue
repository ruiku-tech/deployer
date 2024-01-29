<template>
  <div id="operator">
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
      <el-tab-pane label="部署" name="deploys"
        ><Deploys ref="deploys"
      /></el-tab-pane>
      <el-tab-pane label="执行" name="executer"
        ><Executer ref="executer"
      /></el-tab-pane>
    </el-tabs>
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

export default {
  name: "operator",
  data() {
    return {
      active: "files",
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
</style>
