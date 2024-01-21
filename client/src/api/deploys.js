import service from "./base";

export function deploy(list, files) {
  return service.post("/deploy", { list, files });
}

// host:pasword
// 脚本
export function run(server, cmd) {
  return service.post("/run", { server, cmd });
}
