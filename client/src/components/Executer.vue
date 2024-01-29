<template>
  <div class="content">
    <el-form ref="formRef" :model="form" label-width="120px">
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
      <el-form-item label="脚本内容" prop="data">
        <el-input
          v-model="form.data"
          :autosize="{ minRows: 2, maxRows: 20 }"
          type="textarea"
          placeholder="put: [FILE:文件名字],/root/dir \n run: docker run server -config [CONF:配置名字] --host [HOST:服务器名字] [VAR:变量]"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="commit()">执行</el-button>
        <el-button @click="reset()">重置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script>
import { ElMessage } from "element-plus";
import { fetchHosts, run } from "../api";
export default {
  name: "executer",
  data() {
    return {
      hosts: [],
      form: {
        host: "",
        data: "",
      },
    };
  },
  mounted() {
    this.reload();
  },
  methods: {
    reload() {
      fetchHosts().then((data) => {
        this.hosts = Object.keys(data);
      });
    },
    commit() {
      if (!this.form.host) {
        return ElMessage.error("请选择服务器");
      }
      if (!this.form.data) {
        return ElMessage.error("请输入脚本");
      }
      run(this.form.host, this.form.data);
    },
    reset() {
      this.$refs.formRef.resetFields();
    },
  },
};
</script>

<style>
</style>