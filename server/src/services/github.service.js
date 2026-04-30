import axios from 'axios';
import crypto from 'crypto';
import simpleGit from 'simple-git';
import CodeFile from '../models/CodeFile.model.js';
import GitRepository from '../models/GitRepository.model.js';
import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { assertProjectAccess } from './project.service.js';

const GITHUB_API_URL = 'https://api.github.com';
const MAX_PULL_FILES = 80;
const MAX_FILE_BYTES = 500 * 1024;

const git = simpleGit();
let gitVersionPromise;

const getGitCliAvailable = async () => {
  gitVersionPromise ||= git.version().then(() => true).catch(() => false);
  return gitVersionPromise;
};

const getEncryptionKey = () => crypto.createHash('sha256').update(env.githubTokenEncryptionSecret).digest();

const encryptToken = (token) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ['v1', iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
};

const decryptToken = (encryptedToken) => {
  if (!encryptedToken) {
    return null;
  }

  const [version, iv, tag, encrypted] = encryptedToken.split(':');
  if (version !== 'v1' || !iv || !tag || !encrypted) {
    throw new ApiError(500, 'Stored GitHub token is not decryptable');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
};

const githubClient = (token) =>
  axios.create({
    baseURL: GITHUB_API_URL,
    timeout: 20000,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'CodeSync',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

const normalizeRepoName = (repo) => repo.replace(/\.git$/i, '');

export const parseGithubRepoUrl = (repoUrl) => {
  const value = String(repoUrl || '').trim();

  const httpsMatch = value.match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?\/?$/i);
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: normalizeRepoName(httpsMatch[2]),
      isSsh: false,
      canonicalUrl: `https://github.com/${httpsMatch[1]}/${normalizeRepoName(httpsMatch[2])}.git`
    };
  }

  const sshMatch = value.match(/^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?$/i);
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: normalizeRepoName(sshMatch[2]),
      isSsh: true,
      canonicalUrl: `git@github.com:${sshMatch[1]}/${normalizeRepoName(sshMatch[2])}.git`
    };
  }

  const sshUrlMatch = value.match(/^ssh:\/\/git@github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?$/i);
  if (sshUrlMatch) {
    return {
      owner: sshUrlMatch[1],
      repo: normalizeRepoName(sshUrlMatch[2]),
      isSsh: true,
      canonicalUrl: `git@github.com:${sshUrlMatch[1]}/${normalizeRepoName(sshUrlMatch[2])}.git`
    };
  }

  throw new ApiError(400, 'Enter a valid GitHub HTTPS or SSH repository URL');
};

const getGithubErrorMessage = (error) => {
  const status = error.response?.status;

  if (status === 401) {
    return 'GitHub rejected the token. Check that the PAT is valid and not expired.';
  }

  if (status === 403) {
    return 'GitHub denied access. Check token permissions and rate limits.';
  }

  if (status === 404) {
    return 'Repository was not found or the token does not have access.';
  }

  return error.response?.data?.message || error.message || 'GitHub request failed';
};

const fetchRepositoryMetadata = async ({ owner, repo, token }) => {
  try {
    const response = await githubClient(token).get(`/repos/${owner}/${repo}`);
    return response.data;
  } catch (error) {
    throw new ApiError(error.response?.status || 502, getGithubErrorMessage(error));
  }
};

const fetchBranches = async ({ owner, repo, token }) => {
  try {
    const response = await githubClient(token).get(`/repos/${owner}/${repo}/branches`, {
      params: { per_page: 100 }
    });

    return response.data.map((branch) => ({
      name: branch.name,
      protected: Boolean(branch.protected)
    }));
  } catch (error) {
    throw new ApiError(error.response?.status || 502, getGithubErrorMessage(error));
  }
};

const fetchBranch = async ({ owner, repo, branch, token }) => {
  try {
    const response = await githubClient(token).get(`/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`);
    return response.data;
  } catch (error) {
    throw new ApiError(error.response?.status || 502, `Branch "${branch}" could not be loaded. ${getGithubErrorMessage(error)}`);
  }
};

const validateTokenOwner = async (token) => {
  try {
    await githubClient(token).get('/user');
  } catch (error) {
    throw new ApiError(error.response?.status || 401, getGithubErrorMessage(error));
  }
};

const sanitizeRepository = (repository) => {
  if (!repository) {
    return null;
  }

  const value = typeof repository.toJSON === 'function' ? repository.toJSON() : { ...repository };
  delete value.encryptedToken;
  return value;
};

const getRepositoryWithToken = async (repositoryId, userId) => {
  const repository = await GitRepository.findOne({ _id: repositoryId, user: userId }).select('+encryptedToken');
  if (!repository) {
    throw new ApiError(404, 'GitHub repository connection not found');
  }

  await assertProjectAccess(repository.project, userId);

  return {
    repository,
    parsed: parseGithubRepoUrl(repository.repoUrl),
    token: repository.accessMethod === 'pat' ? decryptToken(repository.encryptedToken) : null
  };
};

const extensionLanguageMap = new Map([
  ['js', 'javascript'],
  ['jsx', 'javascript'],
  ['mjs', 'javascript'],
  ['cjs', 'javascript'],
  ['ts', 'typescript'],
  ['tsx', 'typescript'],
  ['py', 'python'],
  ['java', 'java'],
  ['cpp', 'cpp'],
  ['cc', 'cpp'],
  ['cxx', 'cpp'],
  ['c', 'c'],
  ['cs', 'csharp'],
  ['go', 'go'],
  ['rs', 'rust'],
  ['html', 'html'],
  ['css', 'css'],
  ['json', 'json'],
  ['md', 'markdown'],
  ['yml', 'yaml'],
  ['yaml', 'yaml'],
  ['sh', 'shell'],
  ['env', 'plaintext'],
  ['txt', 'plaintext']
]);

const inferLanguage = (filename) => {
  const extension = filename.split('.').pop()?.toLowerCase();
  return extensionLanguageMap.get(extension) || 'plaintext';
};

const isSafeRepoPath = (path) =>
  /^[A-Za-z0-9._\-/ ]+$/.test(path) &&
  !path.startsWith('/') &&
  !path.includes('\\') &&
  !path.split('/').includes('..') &&
  path.length <= 180;

const decodeBlob = (blob) => {
  if (blob.encoding !== 'base64') {
    return null;
  }

  const buffer = Buffer.from(blob.content, 'base64');
  if (buffer.includes(0)) {
    return null;
  }

  return buffer.toString('utf8');
};

export const connectRepository = async (payload, userId) => {
  const { project, room } = await assertProjectAccess(payload.projectId, userId);
  const parsed = parseGithubRepoUrl(payload.repoUrl);

  if (parsed.isSsh) {
    throw new ApiError(400, 'SSH URLs are manual setup only. Use an HTTPS URL for CodeSync GitHub sync.');
  }

  if (payload.accessMethod === 'pat' && !payload.token) {
    throw new ApiError(400, 'A personal access token is required for private repositories');
  }

  if (payload.accessMethod === 'public' && payload.visibility === 'private') {
    throw new ApiError(400, 'Private repositories require a personal access token');
  }

  const token = payload.accessMethod === 'pat' ? payload.token : null;

  if (token) {
    await validateTokenOwner(token);
  }

  const metadata = await fetchRepositoryMetadata({ ...parsed, token });
  if (metadata.private && !token) {
    throw new ApiError(403, 'This repository is private. Connect with a GitHub personal access token.');
  }

  const branch = payload.branch || metadata.default_branch || 'main';
  await fetchBranch({ ...parsed, branch, token });
  const branches = await fetchBranches({ ...parsed, token });

  let repository = await GitRepository.findOne({ user: userId, project: project._id }).select('+encryptedToken');
  if (!repository) {
    repository = new GitRepository({
      user: userId,
      project: project._id,
      room: room._id
    });
  }

  repository.repoUrl = parsed.canonicalUrl;
  repository.provider = 'github';
  repository.visibility = metadata.private ? 'private' : 'public';
  repository.branch = branch;
  repository.accessMethod = token ? 'pat' : 'public';
  repository.encryptedToken = token ? encryptToken(token) : undefined;
  repository.connectedAt = repository.connectedAt || new Date();
  await repository.save();

  return {
    repository: sanitizeRepository(repository),
    metadata: {
      fullName: metadata.full_name,
      defaultBranch: metadata.default_branch,
      private: metadata.private,
      htmlUrl: metadata.html_url,
      description: metadata.description,
      gitCliAvailable: await getGitCliAvailable()
    },
    branches
  };
};

export const getRepositoryForProject = async (projectId, userId) => {
  await assertProjectAccess(projectId, userId);

  const repository = await GitRepository.findOne({ user: userId, project: projectId }).select('+encryptedToken');
  if (!repository) {
    return { repository: null, branches: [], metadata: null };
  }

  const parsed = parseGithubRepoUrl(repository.repoUrl);
  const token = repository.accessMethod === 'pat' ? decryptToken(repository.encryptedToken) : null;

  try {
    const [metadata, branches] = await Promise.all([
      fetchRepositoryMetadata({ ...parsed, token }),
      fetchBranches({ ...parsed, token })
    ]);

    return {
      repository: sanitizeRepository(repository),
      metadata: {
        fullName: metadata.full_name,
        defaultBranch: metadata.default_branch,
        private: metadata.private,
        htmlUrl: metadata.html_url,
        description: metadata.description,
        gitCliAvailable: await getGitCliAvailable()
      },
      branches
    };
  } catch (error) {
    return {
      repository: sanitizeRepository(repository),
      metadata: null,
      branches: [],
      warning: error.message
    };
  }
};

export const disconnectRepository = async (repositoryId, userId) => {
  const repository = await GitRepository.findOne({ _id: repositoryId, user: userId });
  if (!repository) {
    throw new ApiError(404, 'GitHub repository connection not found');
  }

  await assertProjectAccess(repository.project, userId);
  await repository.deleteOne();
  return { deleted: true };
};

const fetchRepositoryTree = async ({ owner, repo, branch, token }) => {
  const branchData = await fetchBranch({ owner, repo, branch, token });
  const treeSha = branchData.commit?.commit?.tree?.sha || branchData.commit?.sha;

  try {
    const response = await githubClient(token).get(`/repos/${owner}/${repo}/git/trees/${treeSha}`, {
      params: { recursive: '1' }
    });

    return response.data.tree || [];
  } catch (error) {
    throw new ApiError(error.response?.status || 502, getGithubErrorMessage(error));
  }
};

const pullFiles = async ({ repositoryId, selectedPaths = [] }, userId) => {
  const { repository, parsed, token } = await getRepositoryWithToken(repositoryId, userId);
  const tree = await fetchRepositoryTree({ ...parsed, branch: repository.branch, token });
  const selected = new Set(selectedPaths.map((path) => path.trim()).filter(Boolean));

  const blobEntries = tree
    .filter((entry) => entry.type === 'blob' && isSafeRepoPath(entry.path))
    .filter((entry) => selected.size === 0 || selected.has(entry.path))
    .filter((entry) => Number(entry.size || 0) <= MAX_FILE_BYTES)
    .slice(0, MAX_PULL_FILES);

  if (selected.size > 0 && blobEntries.length === 0) {
    throw new ApiError(404, 'None of the selected file paths were found in the repository');
  }

  const syncedFiles = [];
  const client = githubClient(token);

  for (const entry of blobEntries) {
    const response = await client.get(`/repos/${parsed.owner}/${parsed.repo}/git/blobs/${entry.sha}`);
    const content = decodeBlob(response.data);

    if (content === null) {
      continue;
    }

    let file = await CodeFile.findOne({ project: repository.project, filename: entry.path });
    if (file) {
      const changed = file.content !== content || file.language !== inferLanguage(entry.path);
      file.content = content;
      file.language = inferLanguage(entry.path);
      file.lastEditedBy = userId;
      if (changed) {
        file.version += 1;
      }
      await file.save();
    } else {
      file = await CodeFile.create({
        project: repository.project,
        room: repository.room,
        filename: entry.path,
        language: inferLanguage(entry.path),
        content,
        lastEditedBy: userId
      });
    }

    syncedFiles.push(file);
  }

  repository.lastSyncAt = new Date();
  await repository.save();

  return {
    repository: sanitizeRepository(repository),
    files: syncedFiles,
    syncedCount: syncedFiles.length,
    skippedCount: blobEntries.length - syncedFiles.length,
    limitApplied: tree.length > MAX_PULL_FILES
  };
};

const getContentSha = async ({ owner, repo, path, branch, token }) => {
  try {
    const response = await githubClient(token).get(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`, {
      params: { ref: branch }
    });

    return response.data?.sha || null;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }

    throw new ApiError(error.response?.status || 502, getGithubErrorMessage(error));
  }
};

const pushFiles = async ({ repositoryId, fileIds = [], commitMessage }, userId) => {
  const { repository, parsed, token } = await getRepositoryWithToken(repositoryId, userId);
  if (repository.accessMethod !== 'pat' || !token) {
    throw new ApiError(403, 'Pushing to GitHub requires a connected personal access token');
  }

  const filter = { project: repository.project };
  if (fileIds.length > 0) {
    filter._id = { $in: fileIds };
  }

  const files = await CodeFile.find(filter).sort({ filename: 1 });
  if (files.length === 0) {
    throw new ApiError(404, 'No CodeSync files were found to push');
  }

  const client = githubClient(token);
  const pushedFiles = [];

  for (const file of files) {
    if (!isSafeRepoPath(file.filename)) {
      continue;
    }

    const sha = await getContentSha({
      owner: parsed.owner,
      repo: parsed.repo,
      path: file.filename,
      branch: repository.branch,
      token
    });

    await client.put(`/repos/${parsed.owner}/${parsed.repo}/contents/${encodeURIComponent(file.filename).replace(/%2F/g, '/')}`, {
      message: commitMessage || `Update ${file.filename} from CodeSync`,
      content: Buffer.from(file.content || '', 'utf8').toString('base64'),
      branch: repository.branch,
      ...(sha ? { sha } : {})
    });

    pushedFiles.push({
      _id: file._id,
      filename: file.filename
    });
  }

  repository.lastSyncAt = new Date();
  await repository.save();

  return {
    repository: sanitizeRepository(repository),
    pushedFiles,
    pushedCount: pushedFiles.length
  };
};

export const syncRepository = async (payload, userId) => {
  if (payload.direction === 'push') {
    return pushFiles(payload, userId);
  }

  return pullFiles(payload, userId);
};
