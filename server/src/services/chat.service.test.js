import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chronologicalRecentMessages } from './chat.service.js';

describe('chat history ordering', () => {
  it('converts newest-first database results into chronological display order', () => {
    const newestFirst = [{ id: 'newest' }, { id: 'middle' }, { id: 'oldest' }];
    assert.deepEqual(chronologicalRecentMessages(newestFirst), [
      { id: 'oldest' },
      { id: 'middle' },
      { id: 'newest' }
    ]);
    assert.deepEqual(newestFirst, [{ id: 'newest' }, { id: 'middle' }, { id: 'oldest' }]);
  });
});
