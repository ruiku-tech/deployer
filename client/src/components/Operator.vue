<template>
  <div id="operator">
    <aside class="sidebar">
      <div class="nav-title">工作空间</div>
      <button v-for="item in menus" :key="item.name" :class="{ active: active === item.name }" @click="selectPage(item.name)"><span class="nav-dot"></span>{{ item.label }}</button>
      <div class="sidebar-footer">{{ username }}<span>{{ userRole === 'superadmin' ? '超级管理员' : userRole === 'admin' ? '管理员' : '团队成员' }}</span></div>
    </aside>
    <main class="workspace">
      <div class="page-heading"><h2>{{ currentLabel }}</h2><span>{{ currentEnv || '请在右上角创建或选择环境' }}</span></div>
      <div v-for="name in visited" :key="JSON.stringify([currentEnv, name])" v-show="active === name" class="page-view">
        <component :is="componentFor(name)" />
      </div>
      <el-empty v-if="!visited.length" :description="isAdmin ? '请先创建分组与环境' : '请联系管理员分配分组，或在右上角选择环境'" />
    </main>
  </div>
</template>
<script>
import Files from './Files.vue';
import Vars from './Vars.vue';
import Hosts from './Hosts.vue';
import Configs from './Configs.vue';
import Scripts from './Scripts.vue';
import Deploys from './Deploys.vue';
import Record from './Record.vue';
import Schedules from './Schedules.vue';
import Teams from './Teams.vue';
import dataCenter from '../dataCenter';
const pages = { files: Files, vars: Vars, hosts: Hosts, configs: Configs, scripts: Scripts, deploys: Deploys, record: Record, schedules: Schedules, teams: Teams };
export default {
  data() { return { active: 'files', visited: [] }; },
  computed: {
    currentEnv() { return dataCenter.env.value; },
    username() { return dataCenter.user.value; },
    userRole() { return dataCenter.role.value; },
    isAdmin() { return ['superadmin', 'admin'].includes(this.userRole); },
    menus() {
      const items = this.currentEnv ? [ { name: 'files', label: '文件管理' }, { name: 'vars', label: '全局变量' }, { name: 'hosts', label: '服务器管理' }, { name: 'configs', label: '配置管理' }, { name: 'scripts', label: '脚本管理' }, { name: 'deploys', label: '部署编排' }, { name: 'record', label: '发布记录' } ] : [];
      items.push({ name: 'schedules', label: '定时发布' });
      if (this.isAdmin) items.push({ name: 'teams', label: '成员与分组' });
      return items;
    },
    currentLabel() { return this.menus.find(x => x.name === this.active)?.label || '工作空间'; },
  },
  watch: {
    currentEnv() {
      this.visited = this.menus.some(item => item.name === this.active) ? [this.active] : [];
    },
    active: { immediate: true, handler(name) {
      if (this.menus.some(item => item.name === name) && !this.visited.includes(name)) this.visited.push(name);
    } },
    menus: { immediate: true, handler(items) {
      this.visited = this.visited.filter(name => items.some(item => item.name === name));
      if (!items.some(item => item.name === this.active)) this.active = items.find(item => item.name === 'teams')?.name || items[0]?.name || '';
    } },
  },
  methods: {
    componentFor(name) { return pages[name]; },
    selectPage(name) { if (this.menus.some(item => item.name === name)) this.active = name; },
  },
};
</script>
<style scoped>
#operator { flex: 1; min-height: 0; display: flex; }
.sidebar { width: 208px; flex: none; position: relative; padding: 22px 12px; background: #fff; border-right: 1px solid #e8edf3; box-sizing: border-box; }
.nav-title { font-size: 12px; color: #929daf; padding: 0 16px 16px; }
.sidebar button { width: 100%; display: flex; align-items: center; gap: 12px; height: 44px; padding: 0 16px; margin-bottom: 6px; border: 0; border-radius: 7px; background: transparent; color: #536075; font: inherit; font-size: 14px; cursor: pointer; text-align: left; }
.sidebar button:hover { background: #f5f7fb; }.sidebar button.active { background: #eaf2ff; color: #2563d3; font-weight: 600; }
.nav-dot { width: 6px; height: 6px; border-radius: 2px; background: currentColor; opacity: .6; }
.sidebar-footer { position: absolute; bottom: 22px; left: 28px; font-size: 13px; color: #36465f; }.sidebar-footer span { display: block; margin-top: 5px; font-size: 11px; color: #99a2b2; }
.workspace { flex: 1; min-width: 0; padding: 26px 30px 80px; overflow: auto; }.page-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }.page-heading h2 { margin: 0; font-size: 21px; font-weight: 600; }.page-heading span { color: #919bad; font-size: 13px; }
.page-view { min-width: 0; }
@media(max-width:900px) { .sidebar { width: 140px; padding: 16px 8px; }.sidebar button{padding:0 10px;gap:8px}.workspace{padding:18px 14px 80px}.page-heading span{display:none} }
</style>
