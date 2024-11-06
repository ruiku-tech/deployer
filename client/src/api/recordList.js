import service from "./base";
export function recordList(username, page, pageSize) {
  return service.get(
    `/recordList?username=${username}&page=${page}&pageSize=${pageSize}`,
    {}
  );
}
export function recordDelete(item) {
  return service.post(`/recordDelete`, {
    item,
  });
}
