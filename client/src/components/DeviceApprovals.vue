<template>
  <div>
    <el-badge :value="requests.length" :hidden="!requests.length" class="device-badge">
      <el-button text @click="open = true">设备授权</el-button>
    </el-badge>
    <el-dialog v-model="open" title="设备授权申请" width="min(720px, calc(100vw - 32px))" @open="load">
      <p class="intro">已登录设备可以批准本账号的新设备；超级管理员可以批准任意账号，但必须填写 Google 验证码。</p>
      <el-table :data="requests" v-loading="loading" empty-text="暂无待处理申请">
        <el-table-column prop="username" label="账号" width="130" />
        <el-table-column prop="ip" label="来源地址" width="150" />
        <el-table-column label="浏览器" min-width="180"><template #default="scope">{{ scope.row.user_agent || '未知设备' }}</template></el-table-column>
        <el-table-column label="申请时间" width="170"><template #default="scope">{{ formatTime(scope.row.created_at) }}</template></el-table-column>
        <el-table-column label="操作" width="145" fixed="right">
          <template #default="scope">
            <el-button link type="primary" :loading="working === scope.row.id" @click="approve(scope.row)">批准</el-button>
            <el-button link type="danger" :loading="working === scope.row.id" @click="deny(scope.row)">拒绝</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer><el-button @click="load">刷新</el-button><el-button type="primary" @click="open = false">关闭</el-button></template>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus';
import { approveDevice, denyDevice, fetchDeviceRequests } from '../api/devices';
import dataCenter from '../dataCenter';

export default {
  data() { return { open: false, requests: [], loading: false, working: null, timer: null }; },
  mounted() {
    this.load();
    this.timer = setInterval(this.load, 30000);
  },
  beforeUnmount() { clearInterval(this.timer); },
  methods: {
    load() {
      this.loading = true;
      return fetchDeviceRequests().then(rows => { this.requests = rows || []; }).catch(() => {})
        .finally(() => { this.loading = false; });
    },
    formatTime(value) { return new Date(value).toLocaleString(); },
    async approve(row) {
      if (this.working !== null) return;
      this.working = row.id;
      try {
        let code;
        if (dataCenter.role.value === 'superadmin') {
          const result = await ElMessageBox.prompt('请填写 Google Authenticator 当前的 6 位验证码', '超级管理员验证', {
            confirmButtonText: '验证并批准', cancelButtonText: '取消', inputPattern: /^\d{6}$/, inputErrorMessage: '请输入 6 位验证码',
          });
          code = result.value;
        } else {
          await ElMessageBox.confirm(`允许账号“${row.username}”在 ${row.ip || '未知地址'} 登录新设备吗？`, '批准设备', {
            confirmButtonText: '批准', cancelButtonText: '取消', type: 'warning',
          });
        }
        await approveDevice(row.id, code);
        ElMessage.success('设备已获准');
        await this.load();
      } catch { /* Includes user cancellation and rejected verification. */ }
      finally { this.working = null; }
    },
    async deny(row) {
      try {
        await ElMessageBox.confirm(`拒绝“${row.username}”的设备登录申请？`, '拒绝设备', {
          confirmButtonText: '拒绝', cancelButtonText: '取消', type: 'warning',
        });
        this.working = row.id;
        await denyDevice(row.id);
        ElMessage.success('已拒绝设备申请');
        await this.load();
      } catch { /* Includes user cancellation. */ }
      finally { this.working = null; }
    },
  },
};
</script>

<style scoped>
.device-badge { margin-right: 2px; }
.intro { margin: 0 0 16px; color: #606b78; line-height: 1.6; }
</style>
