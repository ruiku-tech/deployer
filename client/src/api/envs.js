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