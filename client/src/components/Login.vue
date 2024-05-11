<template>
  <div class="login">
    <div class="content">
      <h1 class="title">部署平台管理系统</h1>
      <el-card class="box-card">
        <el-tabs v-model="loginModel" @tab-click="handleClick">
          <el-tab-pane label="登陆" name="0">登陆</el-tab-pane>
          <el-tab-pane label="注册" name="1">注册</el-tab-pane>
        </el-tabs>
        <el-form ref="registerForm" :model="registerForm" label-width="60px">
          <el-form-item label="用户名:" prop="username">
            <el-input v-model="registerForm.username"></el-input>
          </el-form-item>
          <el-form-item label="密码:" prop="password">
            <el-input
              type="password"
              v-model="registerForm.password"
            ></el-input>
          </el-form-item>
          <el-button style="width: 100%" type="primary" @click="submit">{{
            loginModel == "0" ? "登陆" : "注册"
          }}</el-button>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script>
import { ElMessage } from "element-plus";
import { register, login } from "../api";
import dataCenter from "../dataCenter";
export default {
  name: "operator",
  data() {
    return {
      loginModel: "0",
      registerForm: {
        username: "",
        password: "",
      },
      loginForm: {
        username: "",
        password: "",
      },
    };
  },
  components: {},
  methods: {
    submit() {
      if (this.loginModel == "0") {
        login(this.registerForm.username, this.registerForm.password).then(
          (data) => {
            localStorage.setItem("user", data);
            dataCenter.user.value = data;
          }
        );
      } else {
        register(this.registerForm.username, this.registerForm.password).then(
          (data) => {
            console.log(data, ">?");
            if (data == "sccess") {
              ElMessage.success("注册成功");
              this.loginModel = "0";
            }
          }
        );
      }
    },
  },
};
</script>

<style scoped>
.login {
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}
.content {
  overflow: hidden;
}
.box-card {
  padding: 30px;
}
.title {
  margin-bottom: 50px;
}
:deep(.el-tabs__content) {
  display: none;
}
</style>
