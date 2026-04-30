import api from './axios.js';

export const createFileRequest = (payload) => api.post('/files', payload).then((res) => res.data.data);
export const listFilesByProjectRequest = (projectId) => api.get(`/files/project/${projectId}`).then((res) => res.data.data);
export const getFileRequest = (fileId) => api.get(`/files/${fileId}`).then((res) => res.data.data);
export const updateFileRequest = (fileId, payload) => api.patch(`/files/${fileId}`, payload).then((res) => res.data.data);
export const deleteFileRequest = (fileId) => api.delete(`/files/${fileId}`).then((res) => res.data.data);
