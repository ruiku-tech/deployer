import { reactive, ref } from "vue";

export default {
  layout: {
    left: reactive({}),
  },
  env: reactive({ value: localStorage.getItem("ENV") }),
  envList: ref([]),
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
