import service from "./base";
// scripts
export function fetchScripts() {
  return service.get("/scripts");
}

export function fetchScript(name) {
  return service.get(`/script?name=${encodeURIComponent(name)}`);
}
export function saveScript(name, data) {
  return service.post("/script", { name, data });
}
export function APIGetHostSelect() {
  return service.get("/hosts");
}
export function deleteScript(name) {
  return service.delete(`/script?name=${encodeURIComponent(name)}`);
}