import api from './axios.js';

export const listMessagesRequest = (roomId) => api.get(`/chat/room/${roomId}`).then((res) => res.data.data);
export const searchMessagesRequest = (roomId, params) => api.get(`/chat/room/${roomId}/search`, { params }).then((res) => res.data.data);
