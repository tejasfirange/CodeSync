import api from './axios.js';

export const generateAiRequest = (payload) => api.post('/ai/generate', payload).then((res) => res.data.data);
