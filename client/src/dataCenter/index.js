import { reactive, ref } from "vue";

export default {
  layout: {
    left: reactive({}),
  },
  env: reactive({ value: localStorage.getItem("ENV") }),
  user: ref(""),
  setEnv(value) {
    if (value) {
      localStorage.setItem("ENV", value);
    } else {
      localStorage.removeItem("ENV");
    }
    this.env.value = value;
  },
};
