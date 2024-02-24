<template>
  <div class="content">
    <el-collapse v-model="collapse">
      <el-collapse-item title="点击新增" name="1">
        <div class="panel">
          <el-form ref="formRef" :model="form">
            <el-form-item>
              <el-col :span="10">
                <el-form-item label="变量名" prop="name">
                  <el-input v-model="form.name" />
                </el-form-item>
              </el-col>
              <el-col :span="2"></el-col>
              <el-col :span="10">
                <el-form-item label="变量值" prop="value">
                  <el-input v-model="form.value" />
                </el-form-item>
              </el-col>
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
          <span>全局变量列表</span>
          <el-button class="button" @click="fresh">刷新</el-button>
        </div>
      </template>
      <el-table :data="list" style="width: 100%">
        <el-table-column prop="name" label="名字" />
        <el-table-column prop="value" label="值" width="200" />
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button link type="primary" size="small" @click="edit(scope.row)"
              >修改</el-button
            >
            <el-button link type="primary" size="small" @click="del(scope.row)"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script>
import { fetchVars, saveVars } from "../api";
import { ElMessage } from "element-plus";
import { confirmDelete } from "../utils";

export default {
  name: "vars",
  data() {
    return {
      list: [],
      form: {
        name: "",
        value: "",
      },
      collapse: [],
    };
  },
  mounted() {
    this.fresh();
  },
  methods: {
    fresh() {
      fetchVars().then((data) => {
        this.list = data
          .split("\n")
          .map((line) => {
            const info = line.split(":");
            return { name: info[0], value: info.slice(1).join(':') };
          })
          .sort((a, b) => (a.name > b.name ? 1 : -1));
      });
    },
    del(item) {
      confirmDelete().then(() => {
        const list = this.list.filter((the) => {
          return the.name !== item.name;
        });
        this.requestSave(list);
      });
    },
    edit(item) {
      this.form.name = item.name;
      this.form.value = item.value;
      this.collapse = ["1"];
    },
    save() {
      if (!this.form.name) {
        return ElMessage.error("请输入名字");
      }
      if (!this.form.value) {
        return ElMessage.error("请输入值");
      }
      const list = this.list.concat();
      list.push(Object.assign({}, this.form));
      this.requestSave(list).then(() => {
        this.reset();
      });
    },
    reset() {
      this.$refs.formRef.resetFields();
    },
    requestSave(list) {
      const merged = list.reduce((ret, item) => {
        ret[item.name] = item.value;
        return ret;
      }, {});
      const data = Object.entries(merged)
        .map(([k, v]) => `${k}:${v}`)
        .join("\n");
      return saveVars(data).then(this.fresh);
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
</style>
