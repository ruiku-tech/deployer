<template>
  <el-row justify="center">
    <el-col :span="8">
      <!-- 注册表单 -->
      <el-form
        ref="registerForm"
        :model="registerForm"
        label-width="80px"
        class="demo-register-form"
      >
        <el-form-item label="用户名" prop="username">
          <el-input v-model="registerForm.username"></el-input>
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input type="password" v-model="registerForm.password"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleRegister">注册</el-button>
        </el-form-item>
      </el-form>

      <!-- 登录表单 -->
      <el-form
        ref="loginForm"
        :model="loginForm"
        label-width="80px"
        class="demo-login-form"
      >
        <el-form-item label="用户名" prop="username">
          <el-input v-model="loginForm.username"></el-input>
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input type="password" v-model="loginForm.password"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleLogin">登录</el-button>
        </el-form-item>
      </el-form>
    </el-col>
  </el-row>
</template>

<script>
export default {
  name: "operator",
  data() {
    return {
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
#operator {
  flex: 1;
}
.info {
  font-size: 20px;
  height: 100%;
}
</style>
