import service from "./base";
export function register(username, password, code) {
  return service.post(`/register`, {
    username,
    password,
    code,
  });
}
