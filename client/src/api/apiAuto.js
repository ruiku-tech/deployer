import service from "./base";
export function apiAuto(env) {
  return service.get(`/api_auto?env=${env}`, {});
}
