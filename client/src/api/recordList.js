import service from "./base";
export function recordList(username, page, pageSize, env) {
  const envParam = env ? `&env=${encodeURIComponent(env)}` : '';
  return service.get(
    `/recordList?username=${username}&page=${page}&pageSize=${pageSize}${envParam}`,
    {}
  );
}
export function recordDelete(item) {
  return service.post(`/recordDelete`, {
    item,
  });
}
