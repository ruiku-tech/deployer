<template>
  <div class="content">
    <el-collapse v-model="collapse">
      <el-collapse-item title="点击新增" name="1">
        <div class="panel">
          <el-form ref="formRef" :model="form" label-width="120px">
            <el-form-item label="脚本名字" prop="name">
              <el-input v-model="form.name" placeholder="可以长一点" />
            </el-form-item>
            <el-form-item label="脚本内容" prop="data">
              <el-input
                v-model="form.data"
                :autosize="{ minRows: 2, maxRows: 20 }"
                type="textarea"
                placeholder="put: [FILE:文件名字],/root/dir \n run: docker run server -config [CONF:配置名字] --host [HOST:服务器名字] [VAR:变量]"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="save()">保存</el-button>
              <el-button @click="reset()">重置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-collapse-item>
    </el-collapse>

    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>脚本列表</span>
          <el-button class="button" @click="fresh">刷新</el-button>
        </div>
      </template>
      <el-table :data="list" style="width: 100%">
        <el-table-column prop="name" label="脚本名字" />
        <el-table-column label="操作" width="240">
          <template #default="scope">
            <el-button link type="primary" size="small" @click="edit(scope.row)">修改</el-button>
            <el-button link type="primary" size="small" @click="del(scope.row)">删除</el-button>
            <el-button link type="primary" size="small" @click="runTo(scope.row)">运行到</el-button>
            <el-button link type="warning" size="small" @click="checkUsage(scope.row)">检测使用</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>

  <!-- 第一步：选择服务器 -->
  <el-dialog v-model="serverDialogVisible" title="选择运行服务器" width="500" destroy-on-close>
    <el-form :model="form">
      <el-form-item label="服务器列表" :label-width="formLabelWidth">
        <el-select v-model="select" placeholder="选择服务器">
          <el-option
            v-for="label in serverOptions"
            :key="label"
            :label="label"
            :value="label"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="serverDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!select" @click="openDeployConfirm()">
          下一步
        </el-button>
      </div>
    </template>
  </el-dialog>

  <!-- 第二步：DeployConfirm 部署弹窗（与部署编排流程一致，支持文件选择） -->
  <el-dialog v-model="deployConfirmVisible" title="部署确认" destroy-on-close center>
    <DeployConfirm :list="deployList" v-on:close="deployConfirmVisible = false" />
  </el-dialog>

  <!-- 检测使用 结果弹窗 -->
  <el-dialog v-model="usageDialogVisible" :title="`脚本使用情况 - ${currentScript}`" width="500">
    <div v-if="usageList.length === 0" style="color: #999; text-align: center; padding: 20px">
      此脚本未在任何部署编排中使用
    </div>
    <el-table v-else :data="usageList" style="width: 100%">
      <el-table-column prop="compose" label="编排组合" />
      <el-table-column prop="item" label="部署项" />
    </el-table>
    <template #footer>
      <el-button @click="usageDialogVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script>
import { ElMessage } from "element-plus";
import {
  APIGetHostSelect,
  deleteScript,
  fetchScript,
  fetchScripts,
  saveScript,
  fetchScriptUsage,
} from "../api";
import { confirmDelete } from "../utils";
import DeployConfirm from "./DeployConfirm.vue";

export default {
  name: "scripts",
  components: { DeployConfirm },
  data() {
    return {
      list: [],
      form: {
        name: "",
        data: "",
      },
      collapse: [],
      formLabelWidth: "90px",
      // 运行到 - 第一步：选服务器
      serverDialogVisible: false,
      serverOptions: [],
      select: "",
      currentScript: "",
      // 运行到 - 第二步：DeployConfirm
      deployConfirmVisible: false,
      deployList: [],
      // 检测使用
      usageDialogVisible: false,
      usageList: [],
    };
  },
  mounted() {
    this.fresh();
  },
  methods: {
    fresh() {
      fetchScripts().then((data) => {
        this.list = data;
      });
    },
    del(item) {
      confirmDelete().then(() => {
        deleteScript(item.name).then(this.fresh);
      });
    },
    edit(item) {
      fetchScript(item.name).then((data) => {
        this.form.name = item.name;
        this.form.data = data;
      });
      this.collapse = ["1"];
    },
    save() {
      if (!this.form.name) {
        return ElMessage.error("请输入脚本名字");
      }
      if (!this.form.data) {
        return ElMessage.error("请输入脚本内容");
      }
      saveScript(this.form.name, this.form.data)
        .then(this.fresh)
        .then(this.reset);
    },
    reset() {
      this.$refs.formRef.resetFields();
    },
    // 运行到：第一步打开服务器选择弹窗
    runTo(row) {
      this.currentScript = row.name;
      this.select = "";
      this.serverDialogVisible = true;
      APIGetHostSelect()
        .then((resp) => {
          this.serverOptions = Object.keys(resp);
        })
        .catch((error) => {
          console.error("Failed to get host select:", error);
          ElMessage.error("获取服务器选项失败");
        });
    },
    // 运行到：第二步打开 DeployConfirm（与部署编排流程一致）
    openDeployConfirm() {
      this.serverDialogVisible = false;
      this.deployList = [
        {
          name: this.currentScript,
          host: this.select,
          cmds: [this.currentScript],
        },
      ];
      this.deployConfirmVisible = true;
    },
    // 检测使用
    checkUsage(row) {
      this.currentScript = row.name;
      this.usageList = [];
      fetchScriptUsage(row.name)
        .then((data) => {
          this.usageList = data || [];
          this.usageDialogVisible = true;
        })
        .catch((error) => {
          console.error("Failed to check script usage:", error);
          ElMessage.error("检测失败，稍后再试");
        });
    },
  },
};
</script>

<style scoped>
</style>
