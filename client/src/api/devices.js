import service from './base';

export const fetchDeviceRequests = () => service.get('/device/requests', { headers: { nofeel: true } });
export const approveDevice = (id, code) => service.post('/device/approve', { id, code });
export const denyDevice = id => service.post('/device/deny', { id });
