import axios from "axios";
import { ElMessage, ElLoading } from "element-plus";
import dataCenter from "../dataCenter";

const BASE_TIMEOUT = 20 * 1000;
const service = axios.create({
  baseURL: process.env.VUE_APP_SERVER,
  timeout: BASE_TIMEOUT, // 请求超时时间
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
    loadCount = 0;
  }
}

service.interceptors.request.use((config) => {
  config.headers.env = dataCenter.env.value;
  if (!config.headers.nofeel) {
    startLoad();
    if (config.headers.withProgress) {
      config.onUploadProgress = (event) => {
        const progress = Math.round((event.loaded * 100) / event.total);
        if (loading) {
          loading.setText(`进度：${progress}%`);
        }
      };
    }
  }
  return config;
});
service.interceptors.response.use(
    (response) => {
      if (!response.config.headers.nofeel) {
        endLoad();
      }
      const data = response.data;

      if (data.err) {
        if (data.err.code) {
          ElMessage.error(`异常错误:${data.err.code}`);
        } else {
          const jsonErr = JSON.stringify(data.err);
          if (jsonErr) {
            ElMessage.error(`异常错误:${jsonErr}`);
          } else {
            ElMessage.error(`异常错误:${data.err}`);
          }
        }
        return Promise.reject(data.err);
      }
      return data.data;
    },
    (err) => {
      endLoad();
      const errorMessage = err.message || JSON.stringify(err);
      ElMessage.error(errorMessage);

      return Promise.reject(new Error(errorMessage));
    }
);

export default service;
