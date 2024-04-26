import { createApp } from "vue";
import App from "./App.vue";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import router from "./route/index.js";
createApp(App).use(router).use(ElementPlus).mount("#app");
