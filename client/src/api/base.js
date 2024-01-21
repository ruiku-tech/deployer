import axios from "axios";
import { ElMessage, ElLoading } from "element-plus";

const service = axios.create({
  baseURL: process.env.VUE_APP_SERVER,
  timeout: 10 * 1000, // 请求超时时间
  headers: { "Content-Type": "application/json;charset=UTF-8" },
});
let loading = null;
let loadCount = 0;

function startLoad() {
  loadCount++;
  if (loading) {
    return;
  }
  loading = ElLoading.service({ fullscreen: true });
}
function endLoad() {
  loadCount--;
  if (loadCount <= 0 && loading) {
    loading.close();
    loading = null;
  }
}

service.interceptors.request.use((config) => {
  startLoad();
  return config;
});
service.interceptors.response.use(
  (response) => {
    endLoad();
    const data = response.data;

    if (data.err) {
      ElMessage.error(data.err);
      return undefined;
    }
    return data.data;
  },
  (err) => {
    endLoad();
    ElMessage.error(err.message);
  }
);

export default service;
