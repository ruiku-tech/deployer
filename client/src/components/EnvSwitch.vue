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
        <el-button size="small" type="danger" plain @click="delEnv"
          >删除当前环境</el-button
        >
      </el-space>
    </el-popover>
  </div>
</template>

<script>
import { fetchEnvs, saveEnv, deleteEnv, aaa } from "../api";
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
        "请输入新环境名字(只能由英文和数字组成)",
        "克隆环境",
        {
          inputPattern: /^[a-zA-Z0-9]+$/,
          inputErrorMessage: "只能由英文和数字组成",
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
        "请输入新环境名字(只能由英文和数字组成)",
        "创建环境",
        {
          inputPattern: /^[a-zA-Z0-9]+$/,
          inputErrorMessage: "只能由英文和数字组成",
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
