import service from "./base";
// envs
export function fetchEnvs() {
  return service.get("/env/list");
}

export function setEnvTeam(name, teamId) {
  return service.put('/env/team', { name, teamId });
}

export function saveEnv(name, src, teamId) {
  return service.post("/env/one", { name, src, teamId });
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
export function importEnv(name, file, teamId) {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('teamId', teamId);
  formData.append('file', file);
  return service.post('/env/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
}
