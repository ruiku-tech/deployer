<template>
  <Login v-if="!dataCenter.token"></Login>
  <div class="main" v-if="dataCenter.token">
    <header class="topbar"><strong>部署管理平台</strong><div class="top-actions"><span v-if="disk">磁盘已用 {{ formatSize(disk.total - disk.free) }} / {{ formatSize(disk.total) }}（可用 {{ formatSize(disk.free) }}）</span><EnvSwitch /><el-button v-if="canManageVersions" text title="版本管理（Ctrl + U，Mac 也支持 Command + U）" @click="updateDialogVisible = true">版本管理</el-button><el-button text @click="logout">退出</el-button></div></header>
    <Operator />
    <el-button class="log-button" type="primary" @click="logVisible = true">部署日志</el-button>
    <div v-show="logVisible" class="log-panel" :class="{ fullscreen: logFullscreen }">
      <div class="log-header"><span>部署日志</span><div><el-button text @click="logFullscreen = !logFullscreen">{{ logFullscreen ? '还原' : '全屏' }}</el-button><el-button text @click="logVisible = false">关闭</el-button></div></div>
      <Logger />
    </div>
    <Confirm />
    <UpdateDialog v-if="canManageVersions" v-model="updateDialogVisible" />
  </div>
</template>

<script>
import Logger from "./components/Logger.vue";
import Operator from "./components/Operator.vue";
import service from "./api/base";
import EnvSwitch from "./components/EnvSwitch.vue";
import Confirm from "./components/Confirm.vue";
import UpdateDialog from "./components/UpdateDialog.vue";

import Login from "./components/Login.vue";
import dataCenter from "./dataCenter";

export default {
  name: "App",
  data() {
    return {
      dataCenter,
      onLogin: true,
      disk: null,
      logVisible: false,
      logFullscreen: false,
      diskTimer: null,
      identityRevision: 0,
      updateDialogVisible: false,
    };
  },
  components: {
    Logger,
    Operator,
    EnvSwitch,
    Confirm,
    Login,
    UpdateDialog,
  },
  mounted() {
    window.addEventListener('keydown', this.onVersionShortcut);
    const token = localStorage.getItem("token");
    if (token) {
      dataCenter.setToken(token);
    }
  },
  watch: {
    canManageVersions(value) { if (!value) this.updateDialogVisible = false; },
    authenticated: { immediate: true, handler(token) {
      clearInterval(this.diskTimer);
      this.identityRevision++;
      if (token) {
        this.loadDisk();
        this.loadIdentity();
        this.diskTimer = setInterval(() => { this.loadDisk(); this.loadIdentity(); }, 30000);
      } else {
        dataCenter.role.value = 'member';
        dataCenter.user.value = '';
      }
    } },
  },
  computed: {
    authenticated() { return !!dataCenter.token.value; },
    canManageVersions() { return this.authenticated && ['superadmin', 'admin'].includes(dataCenter.role.value); },
  },
  beforeUnmount() {
    clearInterval(this.diskTimer);
    window.removeEventListener('keydown', this.onVersionShortcut);
  },
  methods: {
    onVersionShortcut(event) {
      if (!this.canManageVersions || event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey) || event.code !== 'KeyU') return;
      if (event.target?.closest?.('input, textarea, select, [contenteditable], .xterm')) return;
      event.preventDefault();
      this.updateDialogVisible = true;
    },
    loadIdentity() {
      const revision = this.identityRevision;
      return service.get('/me', { headers: { nofeel: true } }).then(user => {
        if (!this.authenticated || revision !== this.identityRevision) return;
        dataCenter.role.value = user.role;
        dataCenter.user.value = user.username;
      }).catch(() => {});
    },
    loadDisk() { service.get('/disk', { headers: { nofeel: true } }).then(data => { this.disk = data; }).catch(() => {}); },
    formatSize(value) { return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`; },
    logout() { dataCenter.setToken(''); },
  },
};
</script>

<style>
#app {
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: left;
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
  flex-direction: column;
  background: #f5f7fa;
}
.topbar { height: 60px; flex: none; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; background: #fff; border-bottom: 1px solid #e4e7ed; }
.topbar strong { font-size: 18px; color: #263341; }
.top-actions { display: flex; align-items: center; gap: 24px; color: #606b78; font-size: 13px; }
.log-button { position: fixed; right: 24px; bottom: 24px; z-index: 1000; box-shadow: 0 4px 16px #0002; }
.log-header { display: flex; justify-content: space-between; align-items: center; padding-right: 36px; }
.log-panel { position: fixed; z-index: 999; right: 24px; bottom: 78px; width: min(900px, calc(100vw - 48px)); height: min(620px, calc(100vh - 140px)); background: #fff; border: 1px solid #dcdfe6; box-shadow: 0 8px 28px #0003; padding: 14px; box-sizing: border-box; }
.log-panel.fullscreen { inset: 0; width: 100vw; height: 100vh; right: auto; bottom: auto; }
.log-panel .logger { height: calc(100% - 38px); }

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.panel {
  padding: 10px;
  background: #fff;
  border: 1px solid #e8edf3;
  border-radius: 8px;
}
.panel .title {
  height: 40px;
  font-size: 20px;
  line-height: 40px;
}
.content {
  overflow-y: auto;
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

<style>
.note-icon { display:inline-flex; align-items:center; justify-content:center; width:15px; height:15px; border:1px solid #a8abb2; border-radius:50%; color:#909399; font-size:11px; cursor:help; }
.el-card { border-radius:8px; box-shadow: none !important; }
.el-collapse { margin-bottom:20px; border:0; background:#fff; border-radius:8px; padding:0 18px; }
.el-table th.el-table__cell { background:#f6f8fb; color:#4b586b; }
@media(max-width:900px){ .topbar{padding:0 12px}.top-actions{gap:8px}.top-actions>span{max-width:210px;font-size:11px} #operator .el-tabs__header{width:125px} #operator .el-tabs__content{padding:12px} }
</style>
