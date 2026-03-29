<template>
  <div id="env-switch">
    <el-popover placement="right" trigger="click">
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
          >{{ item.name }}</el-button
        >
        <hr />
        <el-button size="small" type="primary" @click="cloneEnv"
          >克隆当前环境</el-button
        >
        <el-button size="small" type="success" plain @click="createEnv"
          >创建空环境</el-button
        >
        <el-button size="small" type="info" plain @click="exportCurrentEnv"
          >导出当前环境</el-button
        >
        <el-button size="small" type="warning" plain @click="importEnvDialog"
          >导入环境配置</el-button
        >
        <el-button size="small" type="danger" plain @click="delEnv"
          >删除当前环境</el-button
        >
      </el-space>
    </el-popover>
  </div>
</template>

<script>
import { fetchEnvs, saveEnv, deleteEnv, exportEnv, importEnv } from "../api";
import dataCenter from "../dataCenter";
import { ElMessage, ElMessageBox } from "element-plus";
import { confirmDelete } from "../utils";

export default {
  name: "env-switch",
  data() {
    return {
      env: dataCenter.env.value || "未选择",
      list: [],
    };
  },
  created() {
    this.fresh();
  },
  methods: {
    fresh() {
      fetchEnvs().then((resp) => {
        this.list = resp;
        dataCenter.envList.value = resp;
      });
    },
    changeEnv(env) {
      if (this.env === env) return;
      this.env = env;
      dataCenter.setEnv(env);
      window.location.reload();
    },
    cloneEnv() {
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
        saveEnv(value, this.env).then(() => this.changeEnv(value));
      });
    },
    createEnv() {
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
        saveEnv(value).then(() => this.changeEnv(value));
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
          
          importEnv(value, file).then(() => {
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
#env-switch {
  position: fixed;
  left: 0;
  bottom: 0;
  z-index: 999;
}
</style>
