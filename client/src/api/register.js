import service from "./base";
export function generateRegistrationPassword(username) {
  return service.post('/register/password', { username });
}
export function register(username, password, code, registrationToken) {
  return service.post(`/register`, {
    username,
    password,
    code,
    registrationToken,
  });
}
