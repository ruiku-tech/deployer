<template>
  <div class="content">
    <el-collapse v-model="collapse">
      <el-collapse-item title="点击新增" name="1">
        <div class="panel">
          <el-form ref="formRef" :model="form" label-width="120px">
            <el-form-item label="服务器名字" prop="name">
              <el-input v-model="form.name" />
            </el-form-item>
            <el-form-item label="服务器ip" prop="host">
              <el-input v-model="form.host" />
            </el-form-item>
            <el-form-item label="端口" prop="port">
              <el-input v-model="form.port" placeholder="默认为22" />
            </el-form-item>
            <el-form-item label="服务器密码/密钥" prop="password">
              <el-input
                type="textarea"
                :rows="2"
                autosize
                v-model="form.password"
                placeholder="如果长度大于32位则自动识别为密钥"
              />
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
        <el-table-column prop="name" label="名字" />
        <el-table-column prop="host" label="IP" width="200" />
        <el-table-column prop="password" label="密码/密钥" width="200" />
        <el-table-column prop="port" label="端口" width="80" />
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
import { fetchHosts, saveHosts, deleteHosts } from "../api";
import { ElMessage } from "element-plus";
import { confirmDelete } from "../utils";

export default {
  name: "host",
  data() {
    return {
      list: [],
      form: {
        name: "",
        host: "",
        port: "",
        password: "",
      },
      collapse: [],
    };
  },
  mounted() {
    this.fresh();
  },
  methods: {
    fresh() {
      fetchHosts().then((data) => {
        this.list = Object.entries(data)
          .map(([name, value]) => {
            const info = value.split(":");
            return {
              name,
              host: info[0],
              password: info[1],
              port: info[2] || 22,
            };
          })
          .sort((a, b) => (a.host === b.host ? 0 : a.host > b.host ? 1 : -1));
      });
    },
    del(item) {
      confirmDelete().then(() => {
        deleteHosts(item.name).then(this.fresh);
      });
    },
    edit(item) {
      this.form.name = item.name;
      this.form.host = item.host;
      this.form.port = item.port;
      this.form.password = "";
      this.collapse = ["1"];
    },
    save() {
      if (!this.form.name) {
        return ElMessage.error("请输入服务器名字");
      }
      if (!this.form.host) {
        return ElMessage.error("请输入服务器ip");
      }
      if (!this.form.password) {
        return ElMessage.error("请输入服务器密码或密钥");
      }
      if (this.form.password.length < 4) {
        return ElMessage.error("密码或密钥太短");
      }
      this.requestSave([Object.assign({}, this.form)]).then(() => {
        this.reset();
      });
    },
    reset() {
      this.$refs.formRef.resetFields();
    },
    requestSave(list) {
      const data = list.reduce((ret, item) => {
        ret[item.name] = `${item.host}:${item.password}:${item.port.trim()}`;
        return ret;
      }, {});
      console.log(data);

      return saveHosts(data).then(this.fresh);
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>
