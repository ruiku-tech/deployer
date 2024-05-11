import service from "./base";
export function apiAuto(host, port, prefix) {
  return service.get(
    `/api_auto?host=${host}&port=${port}&prefix=${prefix}`,
    {}
  );
}
