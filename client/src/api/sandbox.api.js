import api from './axios.js';

export const listSandboxPackagesRequest = (projectId) => api.get(`/sandbox/packages/${projectId}`).then((res) => res.data.data.dependencies);

export const installSandboxPackageRequest = (payload) => api.post('/sandbox/packages/install', payload).then((res) => res.data.data);

export const removeSandboxPackageRequest = (dependencyId) => api.delete(`/sandbox/packages/${dependencyId}`).then((res) => res.data.data);

export const parseSandboxCommandRequest = (command) => api.post('/sandbox/commands/parse', { command }).then((res) => res.data.data);
