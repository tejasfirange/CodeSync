import GitHubAccount from '../models/GitHubAccount.model.js';
import GitRepository from '../models/GitRepository.model.js';
import ApiError from '../utils/ApiError.js';
import { decryptToken } from './githubCrypto.service.js';
import { sanitizeGithubAccount } from './githubClient.service.js';

export const getConnectedAccount = async (userId, includeToken = false) => {
  const query = GitHubAccount.findOne({ user: userId }).sort({ connectedAt: -1 });
  if (includeToken) {
    query.select('+accessTokenEncrypted');
  }

  const account = await query;
  if (!account) {
    return null;
  }

  return account;
};

export const requireGithubAccount = async (userId) => {
  const account = await getConnectedAccount(userId, true);
  if (!account) {
    throw new ApiError(401, 'Connect your GitHub account first');
  }

  return {
    account,
    token: decryptToken(account.accessTokenEncrypted)
  };
};

export const getAccountForResponse = async (userId) => sanitizeGithubAccount(await getConnectedAccount(userId));

export const touchGithubAccount = async (account) => {
  account.lastUsedAt = new Date();
  await account.save();
};

export const disconnectAccount = async (userId) => {
  const account = await getConnectedAccount(userId);
  if (!account) {
    return { deleted: true };
  }

  await GitRepository.deleteMany({ user: userId, githubAccount: account._id });
  await account.deleteOne();
  return { deleted: true };
};
