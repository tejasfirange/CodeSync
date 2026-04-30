import api from './axios.js';

export const createProjectRequest = (payload) => api.post('/projects', payload).then((res) => res.data.data);
export const listProjectsByRoomRequest = (roomId) => api.get(`/projects/room/${roomId}`).then((res) => res.data.data);
export const getProjectRequest = (projectId) => api.get(`/projects/${projectId}`).then((res) => res.data.data);
export const updateProjectRequest = (projectId, payload) => api.patch(`/projects/${projectId}`, payload).then((res) => res.data.data);
export const deleteProjectRequest = (projectId) => api.delete(`/projects/${projectId}`).then((res) => res.data.data);
