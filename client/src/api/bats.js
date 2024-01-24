import service from "./base";
// configs
export function fetchBats() {
  return service.get("/bats");
}

export function fetchBat(name) {
  return service.get(`/bat?name=${encodeURIComponent(name)}`);
}
export function saveBat(name, data) {
  return service.post("/bat", { name, data });
}
export function deleteBat(name) {
  return service.delete(`/bat?name=${encodeURIComponent(name)}`);
}