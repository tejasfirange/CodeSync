import api from './axios.js';

export const registerRequest = (payload) => api.post('/auth/register', payload).then((res) => res.data.data);
export const loginRequest = (payload) => api.post('/auth/login', payload).then((res) => res.data.data);
export const logoutRequest = () => api.post('/auth/logout').then((res) => res.data);
export const meRequest = () => api.get('/auth/me').then((res) => res.data.data);
