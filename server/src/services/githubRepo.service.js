import GitRepository from '../models/GitRepository.model.js';
import ApiError from '../utils/ApiError.js';
import idsEqual from '../utils/idsEqual.js';
import { assertProjectAccess } from './project.service.js';
import { createGithubClient, getGithubErrorMessage, mapGithubRepository } from './githubClient.service.js';
import { requireGithubAccount, touchGithubAccount } from './githubAccount.service.js';

const assertGithubRoomHost = (room, userId) => {
  if (!idsEqual(room.owner, userId)) {
    throw new ApiError(403, 'Only the room host can use GitHub integration');
  }
};

export const listUserRepos = async (userId, options = {}) => {
  const { account, token } = await requireGithubAccount(userId);
  const octokit = createGithubClient(token);
  const page = Math.max(Number(options.page) || 1, 1);
  const perPage = Math.min(Math.max(Number(options.perPage) || 30, 1), 100);
  const visibility = ['public', 'private'].includes(options.visibility) ? options.visibility : 'all';
  const search = String(options.search || '').trim().toLowerCase();

  try {
    const response = await octokit.rest.repos.listForAuthenticatedUser({
      affiliation: 'owner,collaborator,organization_member',
      sort: 'updated',
      direction: 'desc',
      visibility,
      page,
      per_page: perPage
    });

    await touchGithubAccount(account);

    const repos = response.data
      .map(mapGithubRepository)
      .filter((repo) => !search || repo.fullName.toLowerCase().includes(search) || repo.repoName.toLowerCase().includes(search));

    return {
      repositories: repos,
      pagination: {
        page,
        perPage,
        hasNextPage: response.data.length === perPage
      }
    };
  } catch (error) {
    throw new ApiError(error.status || 502, getGithubErrorMessage(error));
  }
};

export const listRepoBranches = async (userId, owner, repo) => {
  const { account, token } = await requireGithubAccount(userId);
  const octokit = createGithubClient(token);

  try {
    const branches = await octokit.paginate(octokit.rest.repos.listBranches, {
      owner,
      repo,
      per_page: 100
    });

    await touchGithubAccount(account);
    return branches.map((branch) => ({
      name: branch.name,
      protected: Boolean(branch.protected)
    }));
  } catch (error) {
    throw new ApiError(error.status || 502, getGithubErrorMessage(error));
  }
};

export const connectRepoToProject = async ({ projectId, owner, repo, branch }, userId) => {
  const { project, room } = await assertProjectAccess(projectId, userId);
  assertGithubRoomHost(room, userId);
  const { account, token } = await requireGithubAccount(userId);
  const octokit = createGithubClient(token);

  try {
    const [repoResponse, branchResponse] = await Promise.all([
      octokit.rest.repos.get({ owner, repo }),
      octokit.rest.repos.getBranch({ owner, repo, branch })
    ]);

    const mappedRepo = mapGithubRepository(repoResponse.data);

    const repository = await GitRepository.findOneAndUpdate(
      { user: userId, project: project._id },
      {
        user: userId,
        githubAccount: account._id,
        project: project._id,
        room: room._id,
        repoId: mappedRepo.repoId,
        owner: mappedRepo.owner,
        repoName: mappedRepo.repoName,
        fullName: mappedRepo.fullName,
        htmlUrl: mappedRepo.htmlUrl,
        cloneUrl: mappedRepo.cloneUrl,
        defaultBranch: mappedRepo.defaultBranch,
        selectedBranch: branchResponse.data.name,
        visibility: mappedRepo.visibility,
        permissions: mappedRepo.permissions,
        connectedAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await touchGithubAccount(account);
    return repository;
  } catch (error) {
    throw new ApiError(error.status || 502, getGithubErrorMessage(error));
  }
};

export const getRepositoryForProject = async (projectId, userId) => {
  const { room } = await assertProjectAccess(projectId, userId);
  assertGithubRoomHost(room, userId);

  const repository = await GitRepository.findOne({ user: userId, project: projectId }).populate('githubAccount');
  return { repository };
};

export const disconnectRepository = async (repositoryId, userId) => {
  const repository = await GitRepository.findOne({ _id: repositoryId, user: userId });
  if (!repository) {
    throw new ApiError(404, 'GitHub repository connection not found');
  }

  const { room } = await assertProjectAccess(repository.project, userId);
  assertGithubRoomHost(room, userId);
  await repository.deleteOne();
  return { deleted: true };
};

export const requireConnectedRepository = async (repositoryId, userId) => {
  const repository = await GitRepository.findOne({ _id: repositoryId, user: userId });
  if (!repository) {
    throw new ApiError(404, 'GitHub repository connection not found');
  }

  const { room } = await assertProjectAccess(repository.project, userId);
  assertGithubRoomHost(room, userId);
  const { account, token } = await requireGithubAccount(userId);

  if (!repository.githubAccount.equals(account._id)) {
    throw new ApiError(403, 'Reconnect this project repository with your active GitHub account');
  }

  return { repository, account, token };
};
