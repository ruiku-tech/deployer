import service from "./base";
// configs
export function fetchBats() {
  return service.get("/bats");
}

export function fetchBat(name) {
  return service.get(`/bat?name=${encodeURIComponent(name)}`);
}
/**新增编排组合 */
export function saveBat(name, data) {
  return service.post("/bat", { name, data });
}
/**删除编排组合 */
export function deleteBat(name) {
  return service.delete(`/bat?name=${encodeURIComponent(name)}`);
}
/**新增编排-内容 */
export function saveBatItem(name, data) {
  return service.post("/bat-item", { name, data });
}
/**删除编排-内容 */
export function deleteBatItem(name, item) {
  return service.delete(
    `/bat-item?name=${encodeURIComponent(name)}&item=${encodeURIComponent(
      item
    )}`
  );
}
