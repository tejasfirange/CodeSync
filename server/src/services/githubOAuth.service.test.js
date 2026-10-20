import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateOAuthUrl } from './githubOAuth.service.js';

describe('GitHub OAuth configuration', () => {
  it('reports missing OAuth credentials as a service configuration error', () => {
    assert.throws(
      () => generateOAuthUrl('synthetic-user-id'),
      (error) => error.statusCode === 503 && /GITHUB_CLIENT_ID/.test(error.message) && /GITHUB_CLIENT_SECRET/.test(error.message)
    );
  });
});
