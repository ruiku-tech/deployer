<template>
  <div class="login">
    <div class="content">
      <h1 class="title">部署平台管理系统</h1>
      <el-card class="box-card">
        <el-tabs v-model="loginModel">
          <el-tab-pane label="登录" name="0" :disabled="submitting">登录</el-tab-pane>
          <el-tab-pane label="注册" name="1" :disabled="submitting">注册</el-tab-pane>
        </el-tabs>
        <el-alert v-if="pendingApproval" type="warning" :closable="false" show-icon class="device-pending">
          当前设备尚未获准。请在旧设备的“设备授权”中批准，或等待超级管理员完成 Google 验证授权。
          <div>申请有效期 {{ remainingMinutes }} 分钟。<el-button link type="primary" @click="checkApproval">立即检查</el-button><el-button link @click="cancelApproval">取消</el-button></div>
        </el-alert>
        <el-form v-if="!pendingApproval" ref="registerForm" :model="registerForm" label-width="60px">
          <el-form-item label="用户名:" prop="username">
            <el-input v-model="registerForm.username" :disabled="submitting"></el-input>
          </el-form-item>
          <el-form-item v-if="loginModel == '0'" label="密码:" prop="password">
            <el-input
              type="password"
              v-model="registerForm.password"
            ></el-input>
          </el-form-item>
          <el-form-item v-else label="密码:">
            <div class="generated-password">
              <div v-if="generatedPassword" class="password-value">{{ generatedPassword }}</div>
              <el-button v-if="!generatedPassword" :loading="generatingPassword" :disabled="submitting" @click="generatePassword">随机生成密码</el-button>
              <div v-else class="password-actions">
                <el-button type="primary" plain :disabled="submitting || generatingPassword" @click="downloadCredentials">下载账号密码</el-button>
                <el-button link :loading="generatingPassword" :disabled="submitting" @click="generatePassword">重新生成</el-button>
              </div>
              <div class="password-hint">{{ credentialsDownloaded ? '已发起下载，请确认文件已保存，再完成注册。' : '请先生成随机密码并下载保存，生成后 30 分钟内完成注册。' }}</div>
            </div>
          </el-form-item>
          <el-form-item v-if="loginModel == '1'" label="验证码:" prop="code">
            <el-input type="password" v-model="registerForm.code"></el-input>
          </el-form-item>
          <el-button style="width: 100%" type="primary" :loading="submitting" :disabled="loginModel == '1' && (!credentialsDownloaded || generatingPassword)" @click="submit">{{
            loginModel == "0" ? "登录" : "注册"
          }}</el-button>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script>
import { ElMessage } from "element-plus";
import { register, login, generateRegistrationPassword } from "../api";
import { pollDeviceApproval } from "../api/login";
import dataCenter from "../dataCenter";
export default {
  name: "operator",
  data() {
    return {
      loginModel: "0",
      registerForm: {
        username: "",
        password: "",
        code: "",
      },
      loginForm: {
        username: "",
        password: "",
      },
      pendingApproval: false,
      approvalToken: "",
      approvalExpiresAt: 0,
      approvalTimer: null,
      approvalClock: null,
      now: Date.now(),
      generatedPassword: '',
      registrationToken: '',
      credentialsDownloaded: false,
      generatingPassword: false,
      submitting: false,
      generationRevision: 0,
    };
  },
  components: {},
  methods: {
    resetRegistrationPassword() {
      this.generationRevision++;
      this.generatedPassword = '';
      this.registrationToken = '';
      this.credentialsDownloaded = false;
    },
    async generatePassword() {
      if (this.generatingPassword || this.submitting) return;
      if (!this.registerForm.username.trim()) return ElMessage.error('请先填写用户名');
      const username = this.registerForm.username;
      const revision = ++this.generationRevision;
      this.generatingPassword = true;
      try {
        const result = await generateRegistrationPassword(username);
        if (revision !== this.generationRevision || this.loginModel !== '1' || username !== this.registerForm.username) return;
        this.generatedPassword = result.password;
        this.registrationToken = result.registrationToken;
        this.credentialsDownloaded = false;
      } catch { /* The API displays request errors. */ }
      finally { this.generatingPassword = false; }
    },
    downloadCredentials() {
      if (!this.generatedPassword || this.submitting || this.generatingPassword) return;
      const hostname = window.location.hostname.replace(/[\\/:*?"<>|]/g, '_');
      const text = `部署平台\r\n地址：${window.location.origin}\r\n账号：${this.registerForm.username}\r\n密码：${this.generatedPassword}\r\n`;
      const url = URL.createObjectURL(new Blob(['\uFEFF', text], { type: 'text/plain;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${hostname}.部署平台.txt`;
      document.body.appendChild(anchor);
      try {
        anchor.click();
        this.credentialsDownloaded = true;
      } finally {
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    },
    async submit() {
      if (this.submitting || this.generatingPassword) return;
      if (this.loginModel === '1' && (!this.generatedPassword || !this.credentialsDownloaded)) {
        return ElMessage.error('请先生成密码并下载账号密码文件');
      }
      this.submitting = true;
      try {
        if (this.loginModel == "0") {
          const data = await login(this.registerForm.username, this.registerForm.password);
          if (data.pendingApproval) {
            this.pendingApproval = true;
            this.approvalToken = data.approvalToken;
            this.approvalExpiresAt = data.expiresAt;
            this.approvalTimer = setInterval(this.checkApproval, 5000);
            this.approvalClock = setInterval(() => { this.now = Date.now(); }, 1000);
            ElMessage.warning(data.message);
            return;
          }
          this.finishLogin(data);
        } else {
          const data = await register(
            this.registerForm.username,
            this.generatedPassword,
            this.registerForm.code,
            this.registrationToken
          );
          if (data == "sccess") {
            ElMessage.success("注册成功");
            this.registerForm.password = '';
            this.registerForm.code = '';
            this.loginModel = "0";
          }
        }
      } catch { /* The API displays request errors. */ }
      finally { this.submitting = false; }
    },
    finishLogin(data) {
      dataCenter.setToken(data.token);
      dataCenter.user.value = data.username;
      dataCenter.role.value = data.role || 'member';
      this.cancelApproval();
    },
    checkApproval() {
      if (!this.approvalToken) return;
      if (Date.now() >= this.approvalExpiresAt) {
        this.cancelApproval();
        ElMessage.error('设备授权申请已过期，请重新登录申请');
        return;
      }
      pollDeviceApproval(this.approvalToken).then(result => {
        if (result.status === 'approved') this.finishLogin(result);
        else if (result.status === 'denied' || result.status === 'expired' || result.status === 'invalid') {
          this.cancelApproval();
          ElMessage.error(result.status === 'denied' ? '设备授权已被拒绝' : '设备授权申请已失效，请重新登录');
        }
      }).catch(() => {});
    },
    cancelApproval() {
      clearInterval(this.approvalTimer);
      clearInterval(this.approvalClock);
      this.approvalTimer = null;
      this.approvalClock = null;
      this.approvalToken = '';
      this.pendingApproval = false;
    },
  },
  computed: {
    remainingMinutes() { return Math.max(0, Math.ceil((this.approvalExpiresAt - this.now) / 60000)); },
  },
  watch: {
    'registerForm.username'() { this.resetRegistrationPassword(); },
    loginModel() {
      this.resetRegistrationPassword();
      this.registerForm.password = '';
    },
  },
  beforeUnmount() { clearInterval(this.approvalTimer); clearInterval(this.approvalClock); },
};
</script>

<style scoped>
.login {
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}
.content {
  overflow: hidden;
}
.box-card {
  padding: 30px;
}
.content { width: min(560px, calc(100vw - 32px)); }
.generated-password { width: 100%; }
.password-value { padding: 10px 12px; margin-bottom: 10px; border: 1px solid #dcdfe6; border-radius: 4px; background: #f5f7fa; font-family: monospace; line-height: 1.6; overflow-wrap: anywhere; user-select: all; }
.password-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.password-hint { margin-top: 8px; color: #909399; line-height: 1.6; font-size: 12px; }
.title {
  margin-bottom: 50px;
}
:deep(.el-tabs__content) {
  display: none;
}
</style>
