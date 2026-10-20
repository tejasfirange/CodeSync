import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import GitHubAccount from '../models/GitHubAccount.model.js';
import ApiError from '../utils/ApiError.js';
import { encryptToken } from './githubCrypto.service.js';
import { createGithubClient, getGithubErrorMessage, sanitizeGithubAccount } from './githubClient.service.js';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

const assertOAuthConfigured = () => {
  if (!env.githubClientId || !env.githubClientSecret) {
    throw new ApiError(
      503,
      'GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in server/.env, then restart the server.'
    );
  }
};

export const generateOAuthUrl = (userId, options = {}) => {
  assertOAuthConfigured();

  const scope = options.privateAccess ? 'repo' : 'public_repo';
  const state = jwt.sign(
    {
      userId: userId.toString(),
      nonce: crypto.randomBytes(16).toString('hex'),
      scope
    },
    env.jwtSecret,
    { expiresIn: '10m' }
  );

  const params = new URLSearchParams({
    client_id: env.githubClientId,
    redirect_uri: env.githubRedirectUri,
    scope,
    state,
    allow_signup: 'true'
  });

  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
};

const exchangeCodeForToken = async (code) => {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: env.githubClientId,
      client_secret: env.githubClientSecret,
      redirect_uri: env.githubRedirectUri,
      code
    })
  });

  const payload = await response.json();
  if (!response.ok || payload.error || !payload.access_token) {
    throw new ApiError(401, payload.error_description || 'GitHub OAuth token exchange failed');
  }

  return payload;
};

export const handleOAuthCallback = async ({ code, state }) => {
  assertOAuthConfigured();

  if (!code || !state) {
    throw new ApiError(400, 'GitHub OAuth callback is missing required parameters');
  }

  let decoded;
  try {
    decoded = jwt.verify(state, env.jwtSecret);
  } catch (error) {
    throw new ApiError(400, 'GitHub OAuth state expired or invalid');
  }

  const tokenPayload = await exchangeCodeForToken(code);
  const octokit = createGithubClient(tokenPayload.access_token);

  let githubUser;
  try {
    const response = await octokit.rest.users.getAuthenticated();
    githubUser = response.data;
  } catch (error) {
    throw new ApiError(error.status || 502, getGithubErrorMessage(error));
  }

  const account = await GitHubAccount.findOneAndUpdate(
    { user: decoded.userId, githubId: String(githubUser.id) },
    {
      user: decoded.userId,
      githubId: String(githubUser.id),
      username: githubUser.login,
      displayName: githubUser.name || '',
      avatarUrl: githubUser.avatar_url || '',
      profileUrl: githubUser.html_url || '',
      accessTokenEncrypted: encryptToken(tokenPayload.access_token),
      scope: tokenPayload.scope || decoded.scope || '',
      connectedAt: new Date(),
      lastUsedAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return sanitizeGithubAccount(account);
};
