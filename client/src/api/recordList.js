import service from "./base";
export function recordList(username) {
  return service.get(`/recordList?username=${username}`, {});
}
export function recordDelete(item) {
  return service.post(`/recordDelete`, {
    item,
  });
}
