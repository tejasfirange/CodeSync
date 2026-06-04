import CodeFile from '../models/CodeFile.model.js';
import ApiError from '../utils/ApiError.js';
import { createGithubClient, getGithubErrorMessage } from './githubClient.service.js';
import { requireConnectedRepository } from './githubRepo.service.js';
import { touchGithubAccount } from './githubAccount.service.js';

const MAX_PULL_FILES = 80;
const MAX_FILE_BYTES = 500 * 1024;

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

const emitPulledFiles = (io, roomId, files, userId) => {
  if (!io || !roomId || files.length === 0) {
    return;
  }

  files.forEach((file) => {
    io.to(roomId.toString()).emit('code:sync', {
      type: 'change',
      roomId: roomId.toString(),
      _id: file._id,
      fileId: file._id,
      project: file.project,
      filename: file.filename,
      language: file.language,
      content: file.content,
      version: file.version,
      lastEditedBy: file.lastEditedBy || userId,
      updatedAt: file.updatedAt
    });
  });
};

const fetchRepositoryTree = async (octokit, repository) => {
  const branchData = await octokit.rest.repos.getBranch({
    owner: repository.owner,
    repo: repository.repoName,
    branch: repository.selectedBranch
  });

  const treeSha = branchData.data.commit?.commit?.tree?.sha || branchData.data.commit?.sha;
  const treeResponse = await octokit.rest.git.getTree({
    owner: repository.owner,
    repo: repository.repoName,
    tree_sha: treeSha,
    recursive: '1'
  });

  return treeResponse.data.tree || [];
};

export const pullRepoFiles = async ({ repositoryId, selectedPaths = [] }, userId, io) => {
  const { repository, account, token } = await requireConnectedRepository(repositoryId, userId);
  const octokit = createGithubClient(token);
  const selected = new Set(selectedPaths.map((path) => path.trim()).filter(Boolean));

  try {
    const tree = await fetchRepositoryTree(octokit, repository);
    const blobEntries = tree
      .filter((entry) => entry.type === 'blob' && isSafeRepoPath(entry.path))
      .filter((entry) => selected.size === 0 || selected.has(entry.path))
      .filter((entry) => Number(entry.size || 0) <= MAX_FILE_BYTES)
      .slice(0, MAX_PULL_FILES);

    if (selected.size > 0 && blobEntries.length === 0) {
      throw new ApiError(404, 'None of the selected file paths were found in the repository');
    }

    const syncedFiles = [];
    let skippedCount = 0;

    for (const entry of blobEntries) {
      const response = await octokit.rest.git.getBlob({
        owner: repository.owner,
        repo: repository.repoName,
        file_sha: entry.sha
      });
      const content = decodeBlob(response.data);

      if (content === null) {
        skippedCount += 1;
        continue;
      }

      const language = inferLanguage(entry.path);
      const filename = entry.path.split('/').filter(Boolean).pop() || entry.path;
      let file = await CodeFile.findOne({
        project: repository.project,
        $or: [{ path: entry.path }, { filename: entry.path }]
      });
      if (file) {
        const changed = file.content !== content || file.language !== language;
        file.content = content;
        file.language = language;
        file.path = entry.path;
        file.filename = filename;
        file.lastEditedBy = userId;
        if (changed) {
          file.version += 1;
          file.editCount = (file.editCount || 0) + 1;
          file.lastEditedAt = new Date();
        }
        await file.save();
      } else {
        file = await CodeFile.create({
          project: repository.project,
          room: repository.room,
          filename,
          path: entry.path,
          language,
          content,
          lastEditedBy: userId
        });
      }

      syncedFiles.push(file);
    }

    repository.lastSyncAt = new Date();
    repository.lastPullAt = repository.lastSyncAt;
    await repository.save();
    await touchGithubAccount(account);
    emitPulledFiles(io, repository.room, syncedFiles, userId);

    return {
      repository,
      files: syncedFiles,
      syncedCount: syncedFiles.length,
      skippedCount,
      eligibleCount: blobEntries.length,
      limitApplied: tree.length > MAX_PULL_FILES
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.status || 502, getGithubErrorMessage(error));
  }
};

const getContentSha = async (octokit, repository, path) => {
  try {
    const response = await octokit.rest.repos.getContent({
      owner: repository.owner,
      repo: repository.repoName,
      path,
      ref: repository.selectedBranch
    });

    return Array.isArray(response.data) ? null : response.data.sha || null;
  } catch (error) {
    if (error.status === 404) {
      return null;
    }

    throw error;
  }
};

const getGithubFileContent = async (octokit, repository, path) => {
  try {
    const response = await octokit.rest.repos.getContent({
      owner: repository.owner,
      repo: repository.repoName,
      path,
      ref: repository.selectedBranch
    });

    if (Array.isArray(response.data) || response.data.type !== 'file') {
      return { exists: false, sha: null, content: null };
    }

    if (Number(response.data.size || 0) > MAX_FILE_BYTES) {
      return { exists: true, sha: response.data.sha || null, content: null, skipped: true };
    }

    const content = response.data.encoding === 'base64' ? Buffer.from(response.data.content || '', 'base64').toString('utf8') : null;
    return { exists: true, sha: response.data.sha || null, content };
  } catch (error) {
    if (error.status === 404) {
      return { exists: false, sha: null, content: null };
    }

    throw error;
  }
};

export const getRepositoryChanges = async ({ repositoryId }, userId) => {
  const { repository, account, token } = await requireConnectedRepository(repositoryId, userId);
  const octokit = createGithubClient(token);
  const files = await CodeFile.find({ project: repository.project }).sort({ path: 1, filename: 1 });
  const changes = [];
  const counts = {
    added: 0,
    modified: 0,
    unchanged: 0
  };

  try {
    for (const file of files) {
      const filePath = file.path || file.filename;
      const size = Buffer.byteLength(file.content || '', 'utf8');

      if (!isSafeRepoPath(filePath) || size > MAX_FILE_BYTES) {
        continue;
      }

      const remote = await getGithubFileContent(octokit, repository, filePath);
      const status = !remote.exists ? 'added' : remote.content !== null && remote.content !== (file.content || '') ? 'modified' : 'unchanged';

      counts[status] += 1;
      changes.push({
        fileId: file._id,
        path: filePath,
        filename: file.filename,
        status,
        size,
        language: file.language
      });
    }

    await touchGithubAccount(account);

    return {
      repo: {
        id: repository._id,
        fullName: repository.fullName,
        htmlUrl: repository.htmlUrl
      },
      branch: repository.selectedBranch,
      files: changes,
      counts
    };
  } catch (error) {
    throw new ApiError(error.status || 502, getGithubErrorMessage(error));
  }
};

export const pushProjectFiles = async ({ repositoryId, fileIds = [], files: selectedFiles = [], commitMessage }, userId) => {
  if (!commitMessage?.trim()) {
    throw new ApiError(400, 'Commit message is required');
  }

  const { repository, account, token } = await requireConnectedRepository(repositoryId, userId);
  if (!repository.permissions?.push) {
    throw new ApiError(403, 'Your GitHub account does not have write access to this repository');
  }

  const filter = { project: repository.project };
  const selectedFileIds = selectedFiles.map((file) => file.fileId).filter(Boolean);
  const selectedPaths = selectedFiles.map((file) => file.path).filter(Boolean);

  if (selectedFileIds.length > 0) {
    filter._id = { $in: selectedFileIds };
  } else if (fileIds.length > 0) {
    filter._id = { $in: fileIds };
  } else if (selectedPaths.length > 0) {
    filter.path = { $in: selectedPaths };
  } else {
    throw new ApiError(400, 'Select at least one file to push');
  }

  const files = await CodeFile.find(filter).sort({ filename: 1 });
  if (files.length === 0) {
    throw new ApiError(404, 'No CodeSync files were found to push');
  }

  const octokit = createGithubClient(token);
  const pushedFiles = [];
  const failedFiles = [];

  for (const file of files) {
    const filePath = file.path || file.filename;
    if (!isSafeRepoPath(filePath)) {
      failedFiles.push({ _id: file._id, filename: file.filename, path: filePath, error: 'Unsafe file path' });
      continue;
    }

    try {
      const sha = await getContentSha(octokit, repository, filePath);
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: repository.owner,
        repo: repository.repoName,
        path: filePath,
        message: commitMessage.trim(),
        content: Buffer.from(file.content || '', 'utf8').toString('base64'),
        branch: repository.selectedBranch,
        ...(sha ? { sha } : {})
      });

      pushedFiles.push({ _id: file._id, filename: file.filename, path: filePath });
    } catch (error) {
      failedFiles.push({ _id: file._id, filename: file.filename, path: filePath, error: getGithubErrorMessage(error) });
    }
  }

  repository.lastSyncAt = new Date();
  repository.lastPushAt = repository.lastSyncAt;
  await repository.save();
  await touchGithubAccount(account);

  return {
    repository,
    pushedFiles,
    failedFiles,
    pushedCount: pushedFiles.length,
    failedCount: failedFiles.length
  };
};
