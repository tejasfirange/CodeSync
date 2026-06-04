import api from './axios.js';

export const getRoomAnalyticsRequest = (roomId) => api.get(`/rooms/${roomId}/analytics`).then((res) => res.data.data);
