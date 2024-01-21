import service from "./base";
// configs
export function fetchConfigs() {
  return service.get("/configs");
}

export function fetchConfig(name) {
  return service.get(`/config?name=${name}`);
}
export function saveConfig(name, data) {
  return service.post("/config", { name, data });
}
export function deleteConfig(name) {
  return service.delete(`/config?name=${name}`);
}