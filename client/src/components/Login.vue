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
          <el-form-item v-if="loginModel == '1'" label="code:" prop="code">
            <el-input type="password" v-model="registerForm.code"></el-input>
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
        code: "",
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
            localStorage.setItem("token", data.token);
            dataCenter.token.value = data.token;
          }
        );
      } else {
        const err = checkPasswordComplexity(this.registerForm.password);
        if (err) {
          return ElMessage.success(err);
        }
        register(
          this.registerForm.username,
          this.registerForm.password,
          this.registerForm.code
        ).then((data) => {
          if (data == "sccess") {
            ElMessage.success("注册成功");
            this.loginModel = "0";
          }
        });
      }
    },
  },
};
function checkPasswordComplexity(password) {
  const minLength = 6;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[\W_]/.test(password);

  let count = 0;
  // 检查长度
  if (password.length < minLength) {
    return "密码太短了";
  }
  // 检查是否包含大写字母
  if (hasUpperCase) {
    count++;
  }
  // 检查是否包含小写字母
  if (hasLowerCase) {
    count++;
  }
  // 检查是否包含数字
  if (hasNumbers) {
    count++;
  }
  // 检查是否包含特殊字符
  if (hasSpecialChars) {
    count++;
  }
  if (count < 2) {
    return "数字/大写/小写/特殊字符至少要2种";
  }
  return undefined;
}
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
