<template>
  <div>
    <el-collapse>
      <el-collapse-item title="点击新增" name="1">
        <div class="panel">
          <el-form ref="formRef" :model="form" label-width="120px">
            <el-form-item label="服务器名字" prop="name">
              <el-input v-model="form.name" />
            </el-form-item>
            <el-form-item label="服务器ip" prop="host">
              <el-input v-model="form.host" />
            </el-form-item>
            <el-form-item label="服务器密码" prop="password">
              <el-input v-model="form.password" />
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
          <span>服务器列表</span>
          <el-button class="button" @click="fresh">刷新</el-button>
        </div>
      </template>
      <el-table :data="list" style="width: 100%">
        <el-table-column prop="name" label="名字" width="120" />
        <el-table-column prop="host" label="IP" width="120" />
        <el-table-column prop="password" label="密码" width="120" />
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button link type="primary" size="small" @click="edit(scope.row)"
              >修改</el-button
            >
            <el-button link type="primary" size="small" @click="del"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script>
import { fetchHosts, saveHosts } from "../api";
import { ElMessage } from "element-plus";

export default {
  name: "host",
  data() {
    return {
      list: [],
      form: {
        name: "",
        host: "",
        password: "",
      },
    };
  },
  mounted() {
    this.fresh();
  },
  methods: {
    fresh() {
      fetchHosts().then((data) => {
        this.list = Object.entries(data).map(([name, value]) => {
          const info = value.split(":");
          return { name, host: info[0], password: info[1] };
        });
      });
    },
    del(item) {
      const list = this.list.filter((the) => {
        return the.name !== item.name;
      });
      this.requestSave(list);
    },
    edit(item) {
      this.form.name = item.name;
      this.form.host = item.host;
      this.form.password = item.password;
    },
    save() {
      if (!this.form.name) {
        return ElMessage.error("请输入服务器名字");
      }
      if (!this.form.host) {
        return ElMessage.error("请输入服务器ip");
      }
      if (!this.form.password) {
        return ElMessage.error("请输入服务器密码");
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
      const data = list.reduce((ret, item) => {
        ret[item.name] = `${item.host}:${item.password}`;
        return ret;
      }, {});
      return saveHosts(data).then(this.fresh);
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
</style>
