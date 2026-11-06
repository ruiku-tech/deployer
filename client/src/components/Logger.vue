<template>
  <div class="logger">
    <div class="servers">
      <span v-if="!servers.length" class="empty">当前没有部署日志</span>
      <div v-for="host in servers" :key="host" class="server" :class="{ selected: selected === host }" @click="selected = host">
        <span>{{ host }}</span><span v-if="deployings.includes(host)" class="running">部署中</span>
        <el-tooltip v-if="deployings.includes(host)" content="取消此服务器的部署"><el-button link type="danger" @click.stop="stop(host)">×</el-button></el-tooltip>
      </div>
      <el-button text @click="clearLog">清空当前日志</el-button>
    </div>
    <pre ref="output" class="log-output">{{ (logs[selected] || []).join('\n') }}</pre>
  </div>
</template>
<script>
import { getDeployings, stopDeploy } from '../api';
import dataCenter from '../dataCenter';
import { confirmDelete } from '../utils';
export default {
  data() { return { dataCenter, deployings: [], logs: {}, selected: '', ws: null, timer: null, heartbeat: null, reconnect: null, closing: false }; },
  computed: {
    servers() { return [...new Set([...this.deployings, ...Object.keys(this.logs)])]; },
    tokenValue() { return dataCenter.token.value; },
    currentEnv() { return dataCenter.env.value; },
  },
  mounted() { if (dataCenter.token.value) this.connect(); this.syncDeploying(); this.timer = setInterval(this.syncDeploying, 5000); },
  watch: {
    tokenValue(token) { if (token && !this.ws) this.connect(); if (!token && this.ws) { this.closing = true; this.ws.close(); this.ws = null; } },
    currentEnv(next, previous) { if (next !== previous) { this.logs = {}; this.deployings = []; this.selected = ''; this.syncDeploying(); } },
  },
  beforeUnmount() { this.closing = true; clearInterval(this.timer); clearInterval(this.heartbeat); clearTimeout(this.reconnect); if (this.ws) this.ws.close(); },
  methods: {
    syncDeploying() { if (dataCenter.env.value) getDeployings().then(list => { this.deployings = list; if (!this.selected && list.length) this.selected = list[0]; }).catch(() => {}); },
    stop(host) { confirmDelete(`确定取消 ${host} 的部署？`).then(() => stopDeploy(host)).then(this.syncDeploying).catch(() => {}); },
    clearLog() { if (this.selected) this.logs[this.selected] = []; },
    connect() {
      const base = process.env.VUE_APP_SERVER || '/deploy';
      const url = new URL(base, window.location.origin);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.searchParams.set('token', dataCenter.token.value);
      const ws = this.ws = new WebSocket(url.toString());
      ws.onmessage = event => {
        const match = /^环境:([^:]+):(\w+):\[([^\]]+)\]\s?([\s\S]*)$/.exec(event.data);
        if (!match || match[1] !== dataCenter.env.value) return;
        const host = match[3];
        if (!this.logs[host]) this.logs[host] = [];
        this.logs[host].push(`[${match[2]}] ${match[4]}`);
        if (this.logs[host].length > 5000) this.logs[host].shift();
        if (!this.selected) this.selected = host;
        this.$nextTick(() => { const output = this.$refs.output; if (output) output.scrollTop = output.scrollHeight; });
      };
      ws.onclose = () => { clearInterval(this.heartbeat); if (!this.closing) this.reconnect = setTimeout(this.connect, 2000); };
      this.heartbeat = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send('0'); }, 5000);
    },
  },
};
</script>
<style scoped>
.logger { height: 60vh; display: flex; flex-direction: column; }
.servers { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding-bottom: 12px; }
.server { display: flex; align-items: center; gap: 8px; padding: 5px 10px; border: 1px solid #dcdfe6; border-radius: 4px; cursor: pointer; }
.server.selected { border-color: #409eff; color: #337ecc; background: #ecf5ff; }
.running { color: #198754; font-size: 12px; }.empty { color: #909399; font-size: 13px; }
.log-output { flex: 1; overflow: auto; margin: 0; padding: 16px; background: #19212b; color: #e0e7ed; text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; font: 13px/1.6 monospace; }
</style>
