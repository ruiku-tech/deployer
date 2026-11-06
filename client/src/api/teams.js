import service from './base';
export const fetchMe = () => service.get('/me');
export const fetchTeams = () => service.get('/teams');
export const fetchUsers = () => service.get('/users');
export const saveTeam = data => service.post('/team', data);
export const setUser = data => service.post('/user', data);
export const setUserRole = (id, role) => service.post('/user/role', { id, role });
