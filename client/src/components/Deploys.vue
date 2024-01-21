<template>
  <div>
    <el-collapse>
      <el-collapse-item title="点击新增" name="1">
        <div class="panel">
          <el-form ref="formRef" :model="form" label-width="120px">
            <el-form-item label="部署组合" prop="name">
              <el-input v-model="form.name" />
            </el-form-item>
            <el-form-item label="服务器" prop="host">
              <el-select v-model="form.host">
                <el-option
                  v-for="item in hosts"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>
            <el-form-item
              v-for="(cmd, index) in form.cmds"
              :key="index"
              :label="'脚本' + index"
              :prop="'cmd.' + index + '.value'"
              :rules="{
                required: true,
                message: '脚本不可为空',
                trigger: 'blur',
              }"
              style="margin-bottom: 0"
            >
              <el-select v-model="cmd.value" style="flex: 1">
                <el-option
                  v-for="item in scripts"
                  :key="item.name"
                  :label="item.name"
                  :value="item.name"
                />
              </el-select>
              <el-button @click.prevent="removeCmd(cmd)">移除</el-button>
            </el-form-item>
            <el-form-item>
              <el-button
                style="width: 100%"
                type="primary"
                plain
                @click="addCmd()"
                >新增运行脚本</el-button
              >
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="save">保存</el-button>
              <el-button @click="reset">重置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-collapse-item>
    </el-collapse>

    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <el-button @click="deploy">部署</el-button>
          <el-button class="button" @click="fresh">刷新</el-button>
        </div>
      </template>
      <el-table
        :data="list"
        style="width: 100%"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="name" label="脚本名字" width="300" />
        <el-table-column label="操作" width="120">
          <template #default>
            <el-button link type="primary" size="small" @click="edit"
              >修改</el-button
            >
            <el-button link type="primary" size="small" @click="del"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-dialog v-model="deploying" title="部署确认" destroy-on-close center>
      <DeployConfirm :list="selected" v-on:close="deploying = false" />
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage } from "element-plus";
import {
  deleteBat,
  fetchBat,
  fetchBats,
  fetchHosts,
  fetchScripts,
  saveBat,
} from "../api";
import DeployConfirm from "./DeployConfirm.vue";

export default {
  name: "deploys",
  components: { DeployConfirm },
  data() {
    return {
      list: [],
      hosts: [],
      scripts: [],
      form: {
        name: "",
        host: "",
        cmds: [],
      },
      selected: [],
      deploying: false,
    };
  },
  mounted() {
    this.fresh();
  },
  methods: {
    reload() {
      this.initHost();
      this.initScripts();
    },
    initHost() {
      fetchHosts().then((data) => {
        this.hosts = Object.keys(data);
      });
    },
    initScripts() {
      fetchScripts().then((data) => {
        this.scripts = data;
      });
    },
    fresh() {
      fetchBats().then((data) => {
        this.list = data;
      });
    },
    del(item) {
      deleteBat(item.name).then(this.fresh);
    },
    edit(item) {
      fetchBat(item.name).then((data) => {
        this.form.name = item.name;
        const arr = data.split("\n");
        this.form.host = arr[0];
        this.cmds = arr.slice(1).map((value) => ({ value }));
      });
    },
    save() {
      if (!this.form.name) {
        return ElMessage.error("请输入部署组合名字");
      }
      if (!this.form.host) {
        return ElMessage.error("请选择服务器");
      }
      if (!this.form.cmds.length) {
        return ElMessage.error("请添加脚本");
      }
      const arr = this.form.cmds.concat().map((item) => item.value);
      arr.unshift(this.form.host);
      saveBat(this.form.name, arr.join("\n")).then(this.fresh).then(this.reset);
    },
    reset() {
      this.$refs.formRef.resetFields();
    },
    addCmd() {
      this.form.cmds.push({ value: "" });
    },
    removeCmd(cmd) {
      const index = this.form.cmds.indexOf(cmd);
      if (index >= 0) {
        this.form.cmds.splice(index, 1);
      }
    },
    onSelectionChange(selected) {
      this.selected = selected;
    },
    deploy() {
      if (!this.selected.length) {
        return ElMessage.error("请选择要部署的组合");
      }
      this.deploying = true;
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
</style>
