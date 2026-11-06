<template>
  <div id="env-switch">
    <el-popover placement="bottom-end" trigger="click" :width="300" @show="fresh">
      <template #reference>
        <el-button size="small" style="margin-right: 16px"
          >环境:{{ env }}</el-button
        >
      </template>
      <el-space direction="vertical" fill :size="1" style="width: 100%">
        <el-button
          size="small"
          v-for="item in list"
          :key="item.name"
          @click="changeEnv(item.name)"
          ><span class="env-option"><span>{{ item.name }}</span><span class="env-team">{{ item.teamName || '未设置分组' }}</span></span></el-button
        >
        <hr />
        <div v-if="currentEnvironment" class="current-group">当前环境所属分组：{{ currentEnvironment.teamName || '未设置' }}</div>
        <el-button v-if="isAdmin && currentEnvironment" size="small" @click="openGroupDialog">设置当前环境所属分组</el-button>
        <div class="new-group-label">新建、克隆或导入环境的所属分组</div>
        <el-select v-model="teamId" placeholder="新环境所属分组"><el-option v-for="team in teams" :key="team.id" :label="team.name" :value="team.id" /></el-select>
        <el-button size="small" type="primary" :disabled="!env || env === '未选择'" @click="cloneEnv"
          >克隆当前环境</el-button
        >
        <el-button size="small" type="success" plain @click="createEnv"
          >创建空环境</el-button
        >
        <el-button size="small" type="info" plain :disabled="!env || env === '未选择'" @click="exportCurrentEnv"
          >导出当前环境</el-button
        >
        <el-button size="small" type="warning" plain @click="importEnvDialog"
          >导入环境配置</el-button
        >
        <el-button size="small" type="danger" plain :disabled="!env || env === '未选择'" @click="delEnv"
          >删除当前环境</el-button
        >
      </el-space>
    </el-popover>
    <EnvGroupDialog v-model="groupVisible" :environment="groupEnvironment" :teams="teams" @saved="fresh" />
  </div>
</template>

<script>
import { fetchEnvs, saveEnv, deleteEnv, exportEnv, importEnv, fetchTeams } from "../api";
import dataCenter from "../dataCenter";
import { ElMessage, ElMessageBox } from "element-plus";
import { confirmDelete } from "../utils";
import EnvGroupDialog from './EnvGroupDialog.vue';

export default {
  name: "env-switch",
  components: { EnvGroupDialog },
  data() {
    return {
      env: dataCenter.env.value || "未选择",
      list: [],
      teams: [],
      teamId: null,
      groupVisible: false,
      groupEnvironment: null,
    };
  },
  created() {
    this.fresh();
  },
  computed: {
    isAdmin() { return ['superadmin', 'admin'].includes(dataCenter.role.value); },
    currentEnvironment() { return this.list.find(item => item.name === this.env); },
  },
  methods: {
    fresh() {
      return Promise.all([fetchEnvs(), fetchTeams()]).then(([resp, teams]) => {
        this.list = resp;
        this.teams = teams || [];
        if (!this.teams.some(team => team.id === this.teamId)) this.teamId = this.teams.length === 1 ? this.teams[0].id : null;
        dataCenter.envList.value = resp;
        if (!resp.some(item => item.name === dataCenter.env.value)) {
          const next = resp[0]?.name || null;
          if (dataCenter.env.value) this.changeEnv(next);
          else {
            dataCenter.setEnv(next);
            this.env = next || '未选择';
          }
        }
      }).catch(() => {});
    },
    openGroupDialog() { this.groupEnvironment = this.currentEnvironment; this.groupVisible = true; },
    changeEnv(env) {
      if (this.env === env) return;
      this.env = env;
      dataCenter.setEnv(env);
      window.location.reload();
    },
    cloneEnv() {
      if (!this.teamId) return ElMessage.error('请选择新环境所属分组');
      ElMessageBox.prompt(
        "请输入新环境名字(只能由英文、数字、下划线和中划线组成)",
        "克隆环境",
        {
          inputPattern: /^[a-zA-Z0-9_-]+$/,
          inputErrorMessage: "只能由英文、数字、下划线和中划线组成",
        }
      ).then(({ value }) => {
        if (this.list.find((item) => item.name === value)) {
          ElMessage.error(`[${value}]环境已存在`);
          return;
        }
        saveEnv(value, this.env, this.teamId).then(() => this.changeEnv(value));
      });
    },
    createEnv() {
      if (!this.teamId) return ElMessage.error('请选择新环境所属分组');
      ElMessageBox.prompt(
        "请输入新环境名字(只能由英文、数字、下划线和中划线组成)",
        "创建环境",
        {
          inputPattern: /^[a-zA-Z0-9_-]+$/,
          inputErrorMessage: "只能由英文、数字、下划线和中划线组成",
        }
      ).then(({ value }) => {
        if (this.list.find((item) => item.name === value)) {
          ElMessage.error(`[${value}]环境已存在`);
          return;
        }
        saveEnv(value, undefined, this.teamId).then(() => this.changeEnv(value));
      });
    },
    delEnv() {
      confirmDelete()
        .then(() => deleteEnv(this.env))
        .then(() => {
          const item = this.list.find((item) => item.name !== this.env);
          if (item) {
            this.changeEnv(item.name);
          } else {
            this.changeEnv(null);
          }
        });
    },
    exportCurrentEnv() {
      exportEnv(this.env).then((response) => {
        // 拦截器对 blob 类型返回完整 axios response 对象，需取 response.data
        const blob = new Blob([response.data], { type: 'application/zip' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.env}_config.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        ElMessage.success('环境配置导出成功');
      }).catch(() => {
        ElMessage.error('环境配置导出失败');
      });
    },
    importEnvDialog() {
      if (!this.teamId) return ElMessage.error('请选择新环境所属分组');
      ElMessageBox.prompt(
        "请输入新环境名字(只能由英文、数字、下划线和中划线组成)",
        "导入环境配置",
        {
          inputPattern: /^[a-zA-Z0-9_-]+$/,
          inputErrorMessage: "只能由英文、数字、下划线和中划线组成",
        }
      ).then(({ value }) => {
        if (this.list.find((item) => item.name === value)) {
          ElMessage.error(`[${value}]环境已存在`);
          return;
        }
        // 创建文件选择器
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.zip';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          
          if (!file.name.endsWith('.zip')) {
            ElMessage.error('请选择zip格式的压缩包');
            return;
          }
          
          importEnv(value, file, this.teamId).then(() => {
            ElMessage.success('环境配置导入成功');
            this.changeEnv(value);
          }).catch((error) => {
            ElMessage.error(error?.response?.data?.err || '环境配置导入失败');
          });
        };
        input.click();
      }).catch(() => {
        // 用户取消
      });
    },
  },
};
</script>

<style>
#env-switch { display: inline-flex; }
.env-option { display: flex; justify-content: space-between; gap: 12px; width: 100%; min-width: 0; }
.env-option > span { overflow: hidden; text-overflow: ellipsis; }
.env-team { font-size: 12px; color: #909399; }
.current-group, .new-group-label { padding: 8px 0; font-size: 12px; color: #606b78; line-height: 1.5; }
</style>
