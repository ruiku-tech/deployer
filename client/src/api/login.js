import service from "./base";
export function login(username, password) {
  return service.post(`/login`, {
    username,
    password,
  });
}
