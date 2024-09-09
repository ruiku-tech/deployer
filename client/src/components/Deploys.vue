<template>
  <div class="content">
    <div class="compose-box">
      <span>
        编排组合
        <el-tooltip content="一般分为：初始化、部署、重启" placement="bottom">
          <el-icon><QuestionFilled /></el-icon>
        </el-tooltip>
        <el-select v-model="compose" placeholder="请选择" style="width: 240px">
          <el-option
            v-for="item in composes"
            :key="item.name"
            :label="item.name"
            :value="item.name"
          />
        </el-select>
      </span>
      <el-button @click="addCompose">新增组合</el-button>
    </div>
    <el-collapse v-model="collapse">
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
          <span>
            <el-button @click="deploy">部署</el-button>
            <el-button class="button" @click="fresh">刷新</el-button>
          </span>
          <el-button class="button" @click="delCompose">删除此组合</el-button>
        </div>
      </template>
      <el-table
        :data="finalList"
        style="width: 100%"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="40" />
        <el-table-column prop="name" label="脚本名字">
          <template #header>
            <div class="header-with-filter">
              <span>脚本名字</span>
              <el-input
                class="filter-input"
                v-model="filterKey"
                size="small"
                placeholder="过滤"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="host"
          label="服务器"
          width="180"
          style="font-size: 12px"
        />
        <el-table-column label="执行脚本" width="200">
          <template #default="scope">
            <div class="cmd" v-for="(item, i) in scope.row.cmds" :key="i">
              {{ item }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="scope">
            <el-button link type="primary" size="small" @click="edit(scope.row)"
              >修改</el-button
            >
            <el-button link type="primary" size="small" @click="del(scope.row)"
              >删除</el-button
            >
<!--            <el-button link type="primary" size="small" @click="runTo(scope.row)"-->
<!--            >运行到</el-button-->
<!--            >-->
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-dialog v-model="deploying" title="部署确认" destroy-on-close center>
      <DeployConfirm :list="selected" v-on:close="deploying = false" />
    </el-dialog>
  </div>


  <el-dialog v-model="dialogFormVisible" title="服务器列表" width="500">
    <el-form :model="form">
      <el-form-item label="服务器列表" :label-width="formLabelWidth">
        <el-select v-model="select" placeholder="选择服务器">
          <el-option
              v-for="(label, value) in serverOptions"
              :key="value"
              :label="label"
              :value="value"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="dialogFormVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmRunScript()">
          确认
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script>
import { ElMessage, ElMessageBox } from "element-plus";
import {
  deleteBat,
  fetchBat,
  fetchBats,
  fetchHosts,
  fetchScripts,
  saveBat,
  saveBatItem,
  deleteBatItem, APIGetHostSelect, APIRunScript,
} from "../api";
import DeployConfirm from "./DeployConfirm.vue";
import { confirmDelete } from "../utils";

export default {
  name: "deploys",
  components: { DeployConfirm },
  data() {
    return {
      list: [],
      hosts: [],
      scripts: [],
      compose: "",
      composes: [],
      form: {
        name: "",
        host: "",
        cmds: [],
      },
      selected: [],
      deploying: false,
      collapse: [],
      filterKey: "",
      dialogFormVisible:false,
      serverOptions: {},
      select:"",
    };
  },
  computed: {
    finalList() {
      if (this.filterKey) {
        return this.list.filter((item) => item.name.includes(this.filterKey));
      }
      return this.list;
    },
  },
  watch: {
    compose(value) {
      if (value) {
        this.fresh();
      }
    },
  },
  mounted() {
    this.fresh();
  },
  methods: {
    confirmRunScript(){
      this.dialogFormVisible = false
      console.log("select", this.select)
      // APIRunScript()
    },
    runTo(row){
      console.log("ssssss",row.cmds)
      this.dialogFormVisible = true
      APIGetHostSelect()
          .then((resp) => {
            this.serverOptions = resp;
          })
          .catch((error) => {
            console.error('Failed to get host select:', error);
            ElMessage.error('获取服务器选项失败');
          });
    },
    reload() {
      this.initHost();
      this.initScripts();
      this.freshComposes();
    },
    initHost() {
      fetchHosts()
          .then((data) => {
            this.hosts = Object.keys(data);
          })
          .catch((error) => {
            console.error('Failed to fetch hosts:', error);
            ElMessage.error('获取主机信息失败');
          });
    },
    initScripts() {
      fetchScripts()
          .then((data) => {
            this.scripts = data;
          })
          .catch((error) => {
            console.error('Failed to fetch scripts:', error);
            ElMessage.error('获取脚本信息失败');
          });
    },
    freshComposes() {
      fetchBats()
          .then((data) => {
            this.composes = data;
            if (!this.composes.includes(this.compose)) {
              this.compose = this.composes[0].name;
            }
          })
          .catch((error) => {
            console.error('Failed to fetch bat composes:', error);
            ElMessage.error('获取编排组合失败');
          });
    },
    fresh() {
      if (!this.compose) return;
      fetchBat(this.compose)
          .then((data) => {
            this.list = Object.entries(data).map(([name, value]) => ({
              ...value,
              name,
            }));
          })
          .catch((error) => {
            console.error('Failed to fetch bat:', error);
            ElMessage.error('获取编排组合详情失败');
          });
    },
    del(item) {
      confirmDelete()
          .then(() => {
            deleteBatItem(this.compose, item.name)
                .then(this.fresh)
                .catch((error) => {
                  console.error('Failed to delete bat item:', error);
                  ElMessage.error('删除编排组合项失败');
                });
          })
          .catch((error) => {
            console.error('Failed to confirm delete:', error);
            ElMessage.error('确认删除失败');
          });
    },
    edit(item) {
      const data = JSON.parse(JSON.stringify(item));
      const { cmds, ...rest } = data;
      this.form = { ...rest, cmds: cmds.map((value) => ({ value })) };
      this.collapse = ["1"];
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
      const cmds = this.form.cmds.concat().map((item) => item.value);
      const body = { cmds, name: this.form.name, host: this.form.host };
      saveBatItem(this.compose, body)
          .then(this.fresh)
          .then(this.reset)
          .catch((error) => {
            console.error('Failed to save bat item:', error);
            ElMessage.error('保存编排组合项失败');
          });
    },
    reset() {
      this.form.cmds = [];
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
    addCompose() {
      ElMessageBox.prompt("输入组合名字", "新增编排组合")
          .then(({ value }) => {
            if (value) {
              saveBat(value)
                  .then(this.freshComposes)
                  .catch((error) => {
                    console.error('Failed to save bat:', error);
                    ElMessage.error('保存编排组合失败');
                  });
            }
          })
          .catch((error) => {
            console.error('Failed to prompt for new compose name:', error);
            ElMessage.error('获取新编排组合名字失败');
          });
    },
    delCompose() {
      confirmDelete()
          .then(() => {
            deleteBat(this.compose)
                .then(this.freshComposes)
                .catch((error) => {
                  console.error('Failed to delete compose:', error);
                  ElMessage.error('删除编排组合失败');
                });
          })
          .catch((error) => {
            console.error('Failed to confirm delete:', error);
            ElMessage.error('确认删除失败');
          });
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.header-with-filter {
  display: flex;
  flex-direction: row;
}
.filter-input {
  flex: 1;
  margin-left: 10px;
}
.compose-box {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: #f0f0f0;
  border-radius: 2px;
}
</style>
