import service from "./base";
// configs
export function fetchConfigs() {
  return service.get("/configs");
}

export function fetchConfig(name) {
  return service.get(`/config?name=${encodeURIComponent(name)}`);
}
export function saveConfig(name, data, note) {
  return service.post("/config", { name, data, note });
}
export function deleteConfig(name) {
  return service.delete(`/config?name=${encodeURIComponent(name)}`);
}

export const fetchResourceNames = (type, targetEnv) => service.get(`/resource/names?type=${encodeURIComponent(type)}&targetEnv=${encodeURIComponent(targetEnv)}`);
export const cloneResource = (type, name, targetEnv) => service.post('/resource/clone', { type, name, targetEnv });
