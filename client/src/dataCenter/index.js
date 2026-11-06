import { reactive, ref } from "vue";

export default {
  layout: {
    left: reactive({}),
  },
  env: reactive({ value: localStorage.getItem("ENV") }),
  envList: ref([]),
  user: ref(""),
  role: ref("member"),
  token: ref(""),
  setToken(value) {
    if (value) localStorage.setItem('token', value);
    else localStorage.removeItem('token');
    this.token.value = value;
  },
  setEnv(value) {
    if (value) {
      localStorage.setItem("ENV", value);
    } else {
      localStorage.removeItem("ENV");
    }
    this.env.value = value;
  },
  selectedCompose: "",
};
