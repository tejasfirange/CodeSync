import api from './axios.js';
import { API_URL } from '../utils/constants.js';

export const getGithubOAuthStartUrl = (privateAccess = true) => `${API_URL}/github/oauth/start?private=${privateAccess ? 'true' : 'false'}`;

export const getGithubAccountRequest = () => api.get('/github/account').then((res) => res.data.data);
export const disconnectGithubAccountRequest = () => api.delete('/github/account/disconnect').then((res) => res.data.data);

export const listGithubReposRequest = (params = {}) => api.get('/github/repos', { params }).then((res) => res.data.data);
export const listGithubBranchesRequest = (owner, repo) => api.get(`/github/repos/${owner}/${repo}/branches`).then((res) => res.data.data);

export const connectGithubProjectRepoRequest = (projectId, payload) =>
  api.post(`/github/projects/${projectId}/connect-repo`, payload).then((res) => res.data.data);

export const getGithubRepositoryRequest = (projectId) => api.get(`/github/project/${projectId}`).then((res) => res.data.data);
export const disconnectGithubRepositoryRequest = (id) => api.delete(`/github/repositories/${id}/disconnect`).then((res) => res.data.data);

export const pullGithubRepositoryRequest = (id, payload = {}) => api.post(`/github/repositories/${id}/pull`, payload).then((res) => res.data.data);
export const getGithubRepositoryChangesRequest = (id) => api.get(`/github/repositories/${id}/changes`).then((res) => res.data.data);
export const pushGithubRepositoryRequest = (id, payload = {}) => api.post(`/github/repositories/${id}/push`, payload).then((res) => res.data.data);
