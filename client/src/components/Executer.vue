<template>
  <div class="content">
    <div class="panel">
      <div class="title">执行</div>
      <el-alert
        title="run:执行;put:上传文件;get:下载文件;rquery:查询并存储到寄存器;spush:寄存器存入堆栈;spop:堆栈出栈给寄存器;reval:执行js代码(当前寄存器的值作为入参，变量名为$)并将返回值存储到寄存器;update:更新变量，格式为xxx=$[0];每一个执行语句可通过$[n]获取堆栈的第n个数据，索引从栈顶开始算"
        type="info"
      />
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
            placeholder="put: [FILE:文件名字],/root/dir \n run: docker run server -config [CONF:配置名字] --host [HOST:服务器名字] [VAR:变量] $[0]"
          />
        </el-form-item>
        <el-form-item>

          <el-button type="primary" @click="commit()">执行</el-button>
          <el-button @click="reset()">重置</el-button>
          <el-button @click="showHistoryScript()">历史记录</el-button>
          <el-checkbox v-model="checked" style="margin-left: 20px">保留本次脚本记录</el-checkbox>
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
    <div class="panel" style="margin-top: 10px">
      <div class="title">api接口自动化</div>
      <el-form ref="sslFormRef" :model="apiForm" label-width="120px">
        <el-form-item label="host" prop="host">
          <el-select v-model="apiForm.host">
            <el-option
              v-for="item in list"
              :key="item.name"
              :label="item.name"
              :value="item.host"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="端口" prop="端口">
          <el-input v-model="apiForm.port" placeholder="80" />
        </el-form-item>
        <el-form-item label="prefix" prop="prefix">
          <el-input v-model="apiForm.prefix" placeholder="/api" />
        </el-form-item>
      </el-form>
      <el-button type="primary" @click="api()">开始</el-button>
    </div>
    <div class="panel" style="margin-top: 10px">
      <div class="title">退出登陆</div>
      <el-button type="primary" @click="logOut()">退出</el-button>
    </div>
  </div>
  <el-drawer v-model="drawer" title="历史记录" :with-header="true" direction="rtl">
    <el-table :data="anchorData" style="width: 100%" @cell-click="clickText">
      <el-table-column prop="text" label="脚本内容">
      </el-table-column>
    </el-table>
  </el-drawer>
</template>

<script>
import { ElMessage } from "element-plus";
import {fetchHosts, run, deploySSL, apiAuto, APIGetHistoryScript} from "../api";
import dataCenter from "../dataCenter";
import service from "@/api/base";
export default {
  name: "executer",
  data() {
    return {
      hosts: [],
      list: [],
      form: {
        host: "",
        data: "",
      },
      sslForm: {
        host: "",
        domain: "",
      },
      apiForm: {
        host: "",
        port: "",
        prefix: "",
      },
      checked: false,
      drawer : false,
      anchorData: [],
    };
  },
  mounted() {
    this.reload();
    this.fresh();
    this.anchorData = [];
  },
  methods: {
    clickText(row, column, cell, event){
      this.drawer = false;
      this.form.data = row.text
    },
    showHistoryScript(){
      this.drawer = true
      if(this.anchorData.length > 0) return
      service.post("/script/detail").then(resp =>{
        this.anchorData = [];
        resp.forEach(item => {
          this.anchorData.push({"text":item.text})
        });
      })
    },
    reload() {
      fetchHosts().then((data) => {
        this.hosts = Object.keys(data);
      });
      this.sslForm.domain = this.readDomain();
    },
    fresh() {
      fetchHosts().then((data) => {
        this.list = Object.entries(data)
          .map(([name, value]) => {
            const info = value.split(":");
            return { name, host: info[0], password: info[1] };
          })
          .sort((a, b) => (a.host === b.host ? 0 : a.host > b.host ? 1 : -1));
      });
    },
    commit() {
      if (!this.form.host) {
        return ElMessage.error("请选择服务器");
      }
      if (!this.form.data) {
        return ElMessage.error("请输入脚本");
      }
      run(this.form.host, this.form.data,this.checked);
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
    api() {
      console.log(this.apiForm.host);
      if (!this.apiForm.host) {
        return ElMessage.error("请选择host");
      }
      apiAuto(this.apiForm.host, this.apiForm.port, this.apiForm.prefix);
    },
    logOut() {
      dataCenter.user.value = "";
    },
  },
};
</script>

<style></style>
