import service from "./base";
export function register(username, password) {
  return service.post(`/register`, {
    username,
    password,
  });
}
