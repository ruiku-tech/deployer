<template>
  <div id="operator">
    <el-tabs v-model="active" @tab-click="onTabChange">
      <el-tab-pane label="文件管理" name="first"
        ><Files ref="first"
      /></el-tab-pane>
      <el-tab-pane label="服务器管理" name="second"
        ><Hosts ref="second"
      /></el-tab-pane>
      <el-tab-pane label="配置管理" name="third"
        ><Configs ref="third"
      /></el-tab-pane>
      <el-tab-pane label="脚本管理" name="fourth"
        ><Scripts ref="fourth"
      /></el-tab-pane>
      <el-tab-pane label="部署" name="fifth"
        ><Deploys ref="fifth"
      /></el-tab-pane>
    </el-tabs>
  </div>
</template>

<script>
import Files from "./Files.vue";
import Hosts from "./Hosts.vue";
import Configs from "./Configs.vue";
import Scripts from "./Scripts.vue";
import Deploys from "./Deploys.vue";

export default {
  name: "operator",
  data() {
    return {
      active: "first",
    };
  },
  components: {
    Files,
    Hosts,
    Configs,
    Scripts,
    Deploys,
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
