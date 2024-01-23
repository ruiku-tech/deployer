import service from "./base";
// vars
//name:value
export function fetchVars() {
  return service.get("/vars");
}

export function saveVars(data) {
  return service.post("/vars", { data });
}
