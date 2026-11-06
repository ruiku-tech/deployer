import axios from "axios";
import { ElMessage, ElLoading } from "element-plus";
import dataCenter from "../dataCenter";

const BASE_TIMEOUT = 20 * 1000;
const service = axios.create({
  baseURL: process.env.VUE_APP_SERVER,
  timeout: BASE_TIMEOUT, // 请求超时时间
  headers: {
    "Content-Type": "application/json;charset=UTF-8",
    Authorization: dataCenter.token.value,
  },
});
service.interceptors.request.use(
  (config) => {
    // 每次请求前检查并设置 Authorization
    const token = dataCenter.token.value;
    if (token) {
      config.headers.Authorization = token;
    } else {
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
let loading = null;
let loadCount = 0;

function tokenExpiry(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).exp || 0;
  } catch { return 0; }
}

function renewSession(response) {
  const token = response?.headers?.['x-access-token'];
  const current = dataCenter.token.value;
  // Ignore an old response after logout/login, or a concurrent older renewal.
  if (token && current && response.config.headers.Authorization === current &&
      tokenExpiry(token) > tokenExpiry(current)) dataCenter.setToken(token);
}

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
    renewSession(response);
    if (!response.config.headers.nofeel) {
      endLoad();
    }
    
    // 对于blob类型的响应，直接返回完整的response对象
    if (response.config.responseType === 'blob') {
      return response;
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
    renewSession(err.response);
    if (!err.config?.headers?.nofeel) endLoad();
    const errorMessage = err.response?.data?.message || err.response?.data?.err || err.message || JSON.stringify(err);
    if (err.response?.status === 401) {
      // A late failure from an older request must not clear a renewed session.
      if (err.config?.headers?.Authorization !== dataCenter.token.value) {
        return Promise.reject(new Error(errorMessage));
      }
      dataCenter.setToken('');
      ElMessage.error(errorMessage);
      return Promise.reject(new Error(errorMessage));
    }
    ElMessage.error(errorMessage);
    return Promise.reject(new Error(errorMessage));
  }
);

export default service;
