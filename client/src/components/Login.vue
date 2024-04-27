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
          <el-button
            style="width: 100%"
            type="primary"
            @click="handleRegister"
            >{{ loginModel == "0" ? "登陆" : "注册" }}</el-button
          >
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script>
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
    // 处理注册
    handleRegister() {
      // 在这里执行注册逻辑，可以向后端发送注册请求
      console.log("注册信息:", this.registerForm);
      // 这里仅做示例，清空注册表单
      this.$refs.registerForm.resetFields();
    },
    // 处理登录
    handleLogin() {
      // 在这里执行登录逻辑，可以向后端发送登录请求
      console.log("登录信息:", this.loginForm);
      // 这里仅做示例，清空登录表单
      this.$refs.loginForm.resetFields();
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
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
