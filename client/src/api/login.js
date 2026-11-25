import service from "./base";
import dataCenter from "../dataCenter";
export function login(username, password) {
  return service.post(`/login`, {
    username,
    password,
    deviceId: dataCenter.deviceId,
  });
}
export function pollDeviceApproval(approvalToken) {
  return service.post('/device/status', { approvalToken }, { headers: { nofeel: true } });
}
