import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import CodeFile, { ensureCodeFileIndexes } from './CodeFile.model.js';

describe('ensureCodeFileIndexes', () => {
  let listIndexes;
  let createIndex;
  let dropIndex;

  beforeEach(() => {
    // An empty find is valid even before MongoDB creates the collection.
    mock.method(CodeFile, 'find', () => ({
      select: async () => [],
      sort: async () => []
    }));
    listIndexes = mock.method(CodeFile.collection, 'indexes', async () => []);
    createIndex = mock.method(CodeFile.collection, 'createIndex', async () => 'index-name');
    dropIndex = mock.method(CodeFile.collection, 'dropIndex', async () => {});
  });

  afterEach(() => mock.restoreAll());

  const assertRequiredIndexes = () => {
    assert.deepEqual(createIndex.mock.calls.map(({ arguments: args }) => args), [
      [{ project: 1, path: 1 }, { unique: true, sparse: true }],
      [{ room: 1, updatedAt: -1 }]
    ]);
  };

  it('creates indexes when listing a fresh collection reports code 26', async () => {
    listIndexes.mock.mockImplementation(async () => {
      throw Object.assign(new Error('ns does not exist: codesync.codefiles'), { code: 26 });
    });
    await ensureCodeFileIndexes();
    assertRequiredIndexes();
    assert.equal(dropIndex.mock.callCount(), 0);
  });

  it('also handles the NamespaceNotFound code name', async () => {
    listIndexes.mock.mockImplementation(async () => {
      throw Object.assign(new Error('missing collection'), { codeName: 'NamespaceNotFound' });
    });
    await ensureCodeFileIndexes();
    assertRequiredIndexes();
  });

  it('leaves compatible indexes intact on subsequent startups', async () => {
    listIndexes.mock.mockImplementation(async () => [
      { name: '_id_', key: { _id: 1 } },
      { name: 'project_1_path_1', key: { project: 1, path: 1 }, unique: true, sparse: true }
    ]);
    await ensureCodeFileIndexes();
    assertRequiredIndexes();
    assert.equal(dropIndex.mock.callCount(), 0);
  });

  it('still replaces legacy filename and incompatible path indexes', async () => {
    listIndexes.mock.mockImplementation(async () => [
      { name: '_id_', key: { _id: 1 } },
      { name: 'legacy-filename', key: { project: 1, filename: 1 } },
      { name: 'old-path', key: { project: 1, path: 1 }, unique: false }
    ]);
    await ensureCodeFileIndexes();
    assert.deepEqual(dropIndex.mock.calls.map(({ arguments: args }) => args), [['legacy-filename'], ['old-path']]);
    assertRequiredIndexes();
  });

  for (const [name, error] of [
    ['authorization', Object.assign(new Error('not authorized'), { code: 13, codeName: 'Unauthorized' })],
    ['network', new Error('connection closed')]
  ]) {
    it(`does not swallow ${name} errors from index listing`, async () => {
      listIndexes.mock.mockImplementation(async () => { throw error; });
      await assert.rejects(ensureCodeFileIndexes(), (actual) => actual === error);
      assert.equal(createIndex.mock.callCount(), 0);
      assert.equal(dropIndex.mock.callCount(), 0);
    });
  }

  it('does not hide index-creation errors after a missing namespace', async () => {
    listIndexes.mock.mockImplementation(async () => { throw Object.assign(new Error('missing'), { code: 26 }); });
    const error = Object.assign(new Error('cannot create index'), { code: 13 });
    createIndex.mock.mockImplementation(async () => { throw error; });
    await assert.rejects(ensureCodeFileIndexes(), (actual) => actual === error);
  });
});
