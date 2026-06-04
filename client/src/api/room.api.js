import api from './axios.js';

export const createRoomRequest = (payload) => api.post('/rooms', payload).then((res) => res.data.data);
export const listRoomsRequest = () => api.get('/rooms').then((res) => res.data.data);
export const getRoomRequest = (roomId) => api.get(`/rooms/${roomId}`).then((res) => res.data.data);
export const joinRoomRequest = (roomCode) => api.post('/rooms/join', { roomCode }).then((res) => res.data.data);
export const updateRoomRequest = (roomId, payload) => api.patch(`/rooms/${roomId}`, payload).then((res) => res.data.data);
export const updateRoomSettingsRequest = (roomId, payload) => api.patch(`/rooms/${roomId}/settings`, payload).then((res) => res.data.data);
export const updateMemberRoleRequest = (roomId, userId, role) => api.patch(`/rooms/${roomId}/members/${userId}/role`, { role }).then((res) => res.data.data);
export const deleteRoomRequest = (roomId) => api.delete(`/rooms/${roomId}`).then((res) => res.data.data);
