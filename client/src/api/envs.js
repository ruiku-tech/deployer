import service from "./base";
// envs
export function fetchEnvs() {
  return service.get("/env/list");
}

export function saveEnv(name, src) {
  return service.post("/env/one", { name, src });
}
export function deleteEnv(name) {
  return service.delete(`/env/one?name=${encodeURIComponent(name)}`);
}

// 导出环境配置
export function exportEnv(name) {
  return service.get(`/env/export?name=${encodeURIComponent(name)}`, {
    responseType: 'blob'
  });
}

// 导入环境配置
export function importEnv(name, file) {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('file', file);
  return service.post('/env/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
}