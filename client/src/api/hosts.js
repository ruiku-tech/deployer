import service from "./base";
// hosts
//{name:'host:password}
export function fetchHosts() {
  return service.get("/hosts");
}

export function saveHosts(data) {
  return service.post("/hosts", { data });
}
