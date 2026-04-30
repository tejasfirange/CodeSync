import { env } from '../config/env.js';
import {
  disconnectAccount,
  getAccountForResponse
} from '../services/githubAccount.service.js';
import { generateOAuthUrl, handleOAuthCallback } from '../services/githubOAuth.service.js';
import {
  connectRepoToProject,
  disconnectRepository,
  getRepositoryForProject,
  listRepoBranches,
  listUserRepos
} from '../services/githubRepo.service.js';
import { getRepositoryChanges, pullRepoFiles, pushProjectFiles } from '../services/githubSync.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const getClientRedirectUrl = (status, message = '') => {
  const clientUrl = env.clientUrls[0] || 'http://localhost:5173';
  const url = new URL('/github/callback', clientUrl);
  url.searchParams.set('status', status);
  if (message) {
    url.searchParams.set('message', message);
  }
  return url.toString();
};

export const oauthStart = asyncHandler(async (req, res) => {
  const url = generateOAuthUrl(req.user._id, { privateAccess: req.query.private === 'true' });
  res.redirect(url);
});

export const oauthCallback = asyncHandler(async (req, res) => {
  try {
    await handleOAuthCallback(req.query);
    res.redirect(getClientRedirectUrl('success'));
  } catch (error) {
    res.redirect(getClientRedirectUrl('error', error.message));
  }
});

export const getAccount = asyncHandler(async (req, res) => {
  const account = await getAccountForResponse(req.user._id);
  res.status(200).json(new ApiResponse(200, { account }, 'GitHub account loaded'));
});

export const deleteAccount = asyncHandler(async (req, res) => {
  const result = await disconnectAccount(req.user._id);
  res.status(200).json(new ApiResponse(200, result, 'GitHub account disconnected'));
});

export const getRepos = asyncHandler(async (req, res) => {
  const result = await listUserRepos(req.user._id, req.query);
  res.status(200).json(new ApiResponse(200, result, 'GitHub repositories loaded'));
});

export const getBranches = asyncHandler(async (req, res) => {
  const branches = await listRepoBranches(req.user._id, req.params.owner, req.params.repo);
  res.status(200).json(new ApiResponse(200, { branches }, 'GitHub branches loaded'));
});

export const connectProjectRepo = asyncHandler(async (req, res) => {
  const repository = await connectRepoToProject({ projectId: req.params.projectId, ...req.body }, req.user._id);
  res.status(201).json(new ApiResponse(201, { repository }, 'GitHub repository connected'));
});

export const getProjectRepository = asyncHandler(async (req, res) => {
  const result = await getRepositoryForProject(req.params.projectId, req.user._id);
  res.status(200).json(new ApiResponse(200, result, 'GitHub repository loaded'));
});

export const deleteRepository = asyncHandler(async (req, res) => {
  const result = await disconnectRepository(req.params.id, req.user._id);
  res.status(200).json(new ApiResponse(200, result, 'GitHub repository disconnected'));
});

export const pullRepository = asyncHandler(async (req, res) => {
  const result = await pullRepoFiles({ repositoryId: req.params.id, ...req.body }, req.user._id, req.app.get('io'));
  res.status(200).json(new ApiResponse(200, result, 'Files synced from GitHub'));
});

export const getRepositoryChangePreview = asyncHandler(async (req, res) => {
  const result = await getRepositoryChanges({ repositoryId: req.params.id }, req.user._id);
  res.status(200).json(new ApiResponse(200, result, 'GitHub changes loaded'));
});

export const pushRepository = asyncHandler(async (req, res) => {
  const result = await pushProjectFiles({ repositoryId: req.params.id, ...req.body }, req.user._id);
  res.status(200).json(new ApiResponse(200, result, 'Files pushed to GitHub'));
});
