import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCodeMutationIntent } from './code.socket.js';

describe('code socket mutation normalization', () => {
  it('uses canonical file content when a metadata event omits content', () => {
    const intent = getCodeMutationIntent(
      { path: 'src/renamed.js', filename: 'renamed.js', language: 'javascript' },
      { path: 'src/index.js', filename: 'index.js', language: 'javascript', content: 'const value = 1;' }
    );

    assert.equal(intent.metadataChanged, true);
    assert.equal(intent.content, 'const value = 1;');
    assert.equal(intent.deleted, false);
  });

  it('does not treat identical canonical metadata as a file-management mutation', () => {
    const intent = getCodeMutationIntent(
      { path: 'src/index.js', filename: 'index.js', language: 'javascript', content: 'const value = 2;' },
      { path: 'src/index.js', filename: 'index.js', language: 'javascript', content: 'const value = 1;' }
    );

    assert.equal(intent.metadataChanged, false);
    assert.equal(intent.content, 'const value = 2;');
  });
});
