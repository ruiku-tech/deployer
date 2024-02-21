<template>
  <div class="content">
    <div class="panel">
      <div class="title">执行</div>
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
    <div class="panel" style="margin-top: 10px">
      <div class="title">SSL证书自动生成</div>
      <el-form ref="sslFormRef" :model="sslForm" label-width="120px">
        <el-form-item label="服务器" prop="host">
          <el-select v-model="sslForm.host">
            <el-option
              v-for="item in hosts"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="域名" prop="domain">
          <el-input v-model="sslForm.domain" placeholder="www.xx.com" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="deploySSL()">部署</el-button>
          <el-button @click="resetSSL()">重置</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script>
import { ElMessage } from "element-plus";
import { fetchHosts, run, deploySSL } from "../api";
import dataCenter from "../dataCenter";
export default {
  name: "executer",
  data() {
    return {
      hosts: [],
      form: {
        host: "",
        data: "",
      },
      sslForm: {
        host: "",
        domain: "",
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
      this.sslForm.domain = this.readDomain();
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
    deploySSL() {
      if (!this.sslForm.host) {
        return ElMessage.error("请选择服务器");
      }
      if (!this.sslForm.domain) {
        return ElMessage.error("请输入域名");
      }
      this.saveDomain(this.sslForm.domain);
      deploySSL(this.sslForm.host, this.sslForm.domain);
    },
    resetSSL() {
      this.$refs.sslFormRef.resetFields();
    },
    saveDomain(domain) {
      const env = dataCenter.env.value;
      localStorage.setItem(`${env}-domain`, domain);
    },
    readDomain() {
      const env = dataCenter.env.value;
      return localStorage.getItem(`${env}-domain`) || "";
    },
  },
};
</script>

<style>
</style>