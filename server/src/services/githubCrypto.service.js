import crypto from 'crypto';
import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';

const getEncryptionKey = () => crypto.createHash('sha256').update(env.githubTokenEncryptionSecret).digest();

export const encryptToken = (token) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ['v1', iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
};

export const decryptToken = (encryptedToken) => {
  if (!encryptedToken) {
    throw new ApiError(401, 'GitHub account needs to be reconnected');
  }

  const [version, iv, tag, encrypted] = encryptedToken.split(':');
  if (version !== 'v1' || !iv || !tag || !encrypted) {
    throw new ApiError(500, 'Stored GitHub token is not decryptable');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
};
