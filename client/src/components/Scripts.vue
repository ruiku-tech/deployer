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
        <el-table-column label="操作" width="160">
          <template #default="scope">
            <el-button link type="primary" size="small" @click="edit(scope.row)"
              >修改</el-button
            >
            <el-button link type="primary" size="small" @click="del(scope.row)"
              >删除</el-button
            >
            <el-button link type="primary" size="small" @click="runTo(scope.row)"
            >运行到</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </el-card>
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
import { ElMessage } from "element-plus";
import {APIGetHostSelect, APIRunScript, deleteScript, fetchScript, fetchScripts, saveScript} from "../api";
import { confirmDelete } from "../utils";

export default {
  name: "scripts",
  data() {
    return {
      list: [],
      form: {
        name: "",
        data: "",
      },
      collapse:[],
      dialogFormVisible:false,
      serverOptions: {},
      select:"",
      currentScript:"",
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
      this.collapse=['1']
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
    runTo(row){
      console.log("ssssss",row.name)
      this.currentScript = row.name
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
    confirmRunScript(){
      this.dialogFormVisible = false
      console.log("select", this.select)
      APIRunScript(this.select, this.currentScript).then(resp =>{

      }).catch((error) => {
        console.error('Failed to get host select:', error);
        ElMessage.error('执行失败，稍后再试');
      })
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
</style>
