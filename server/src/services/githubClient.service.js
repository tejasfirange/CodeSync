import { Octokit } from '@octokit/rest';

export const createGithubClient = (token) =>
  new Octokit({
    auth: token,
    userAgent: 'CodeSync'
  });

export const getGithubErrorMessage = (error) => {
  const status = error.status || error.response?.status;

  if (status === 401) {
    return 'GitHub connection expired. Reconnect your GitHub account.';
  }

  if (status === 403) {
    return 'GitHub permission denied. Check repository access and OAuth scopes.';
  }

  if (status === 404) {
    return 'GitHub repository or branch was not found.';
  }

  return error.response?.data?.message || error.message || 'GitHub request failed';
};

export const mapGithubRepository = (repo) => ({
  repoId: repo.id,
  owner: repo.owner?.login || repo.full_name?.split('/')[0] || '',
  repoName: repo.name,
  fullName: repo.full_name,
  htmlUrl: repo.html_url,
  cloneUrl: repo.clone_url,
  defaultBranch: repo.default_branch || 'main',
  selectedBranch: repo.default_branch || 'main',
  visibility: repo.private ? 'private' : 'public',
  private: Boolean(repo.private),
  permissions: {
    admin: Boolean(repo.permissions?.admin),
    push: Boolean(repo.permissions?.push),
    pull: repo.permissions?.pull !== false,
    maintain: Boolean(repo.permissions?.maintain),
    triage: Boolean(repo.permissions?.triage)
  },
  updatedAt: repo.updated_at,
  description: repo.description || ''
});

export const sanitizeGithubAccount = (account) => {
  if (!account) {
    return null;
  }

  const value = typeof account.toJSON === 'function' ? account.toJSON() : { ...account };
  delete value.accessTokenEncrypted;
  return value;
};
