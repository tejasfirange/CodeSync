import api from './axios.js';

export const executeCodeRequest = (payload) => api.post('/execute', payload).then((res) => res.data.data);
