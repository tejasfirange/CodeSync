import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/file.api.js', () => ({
  createFileRequest: vi.fn(),
  deleteFileRequest: vi.fn(),
  listFilesByProjectRequest: vi.fn(),
  updateFileRequest: vi.fn()
}));

vi.mock('../api/project.api.js', () => ({
  createProjectRequest: vi.fn(),
  listProjectsByRoomRequest: vi.fn()
}));

vi.mock('../api/room.api.js', () => ({
  createRoomRequest: vi.fn(),
  deleteRoomRequest: vi.fn(),
  getRoomRequest: vi.fn(),
  joinRoomRequest: vi.fn(),
  listRoomsRequest: vi.fn(),
  updateMemberRoleRequest: vi.fn(),
  updateRoomSettingsRequest: vi.fn()
}));

const { createFileRequest, deleteFileRequest, listFilesByProjectRequest, updateFileRequest } = await import('../api/file.api.js');
const { getRoomRequest } = await import('../api/room.api.js');
const { listProjectsByRoomRequest } = await import('../api/project.api.js');
const { useRoomStore } = await import('./room.store.js');

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
};

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const createFile = (overrides = {}) => ({
  _id: 'file-1',
  project: 'project-1',
  filename: 'index.js',
  path: 'index.js',
  language: 'javascript',
  content: 'const value = 1;',
  ...overrides
});

const seedFile = (file = createFile()) => {
  useRoomStore.getState().resetWorkspace();
  useRoomStore.setState({
    files: [file],
    activeFile: file
  });
};

describe('room store save reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves text typed while a save request is pending', async () => {
    const deferred = createDeferred();
    const initialFile = createFile();
    const serverFile = createFile({ content: 'const value = 1;' });
    updateFileRequest.mockReturnValueOnce(deferred.promise);
    seedFile(initialFile);

    const savePromise = useRoomStore.getState().saveFile(initialFile._id, {
      filename: initialFile.filename,
      path: initialFile.path,
      language: initialFile.language,
      content: initialFile.content
    });
    useRoomStore.getState().updateLocalFile(initialFile._id, { content: 'const value = 2;' });

    deferred.resolve({ file: serverFile });
    await savePromise;

    expect(useRoomStore.getState().files[0].content).toBe('const value = 2;');
    expect(useRoomStore.getState().dirtyFileIds).toEqual(new Set(['file-1']));
  });

  it('clears dirty state after an ordinary save acknowledges current content', async () => {
    const initialFile = createFile();
    const editedFile = createFile({ content: 'const value = 2;' });
    updateFileRequest.mockResolvedValueOnce({ file: editedFile });
    seedFile(initialFile);
    useRoomStore.getState().updateLocalFile(initialFile._id, { content: editedFile.content });

    const result = await useRoomStore.getState().saveFile(initialFile._id, {
      filename: editedFile.filename,
      path: editedFile.path,
      language: editedFile.language,
      content: editedFile.content
    });

    expect(result).toEqual(editedFile);
    expect(useRoomStore.getState().files[0]).toEqual(editedFile);
    expect(useRoomStore.getState().dirtyFileIds).toEqual(new Set());
  });

  it('marks only changed editable fields dirty', () => {
    const initialFile = createFile();
    seedFile(initialFile);

    useRoomStore.getState().updateLocalFile(initialFile._id, {
      content: initialFile.content,
      version: Date.now()
    });
    expect(useRoomStore.getState().dirtyFileIds).toEqual(new Set());

    useRoomStore.getState().updateLocalFile(initialFile._id, { filename: 'renamed.js' });
    expect(useRoomStore.getState().dirtyFileIds).toEqual(new Set([initialFile._id]));
  });

  it('preserves dirty state and local content when saving fails', async () => {
    const error = new Error('save failed');
    const initialFile = createFile();
    updateFileRequest.mockRejectedValueOnce(error);
    seedFile(initialFile);
    useRoomStore.getState().updateLocalFile(initialFile._id, { content: 'const value = 2;' });

    await expect(useRoomStore.getState().saveFile(initialFile._id, {
      content: 'const value = 2;'
    })).rejects.toBe(error);

    expect(useRoomStore.getState().files[0].content).toBe('const value = 2;');
    expect(useRoomStore.getState().dirtyFileIds).toEqual(new Set(['file-1']));
  });

  it('does not change another active file when a background save resolves', async () => {
    const deferred = createDeferred();
    const fileA = createFile({ _id: 'file-a', content: 'a = 1;' });
    const fileB = createFile({ _id: 'file-b', filename: 'other.js', path: 'other.js', content: 'b = 1;' });
    updateFileRequest.mockReturnValueOnce(deferred.promise);
    useRoomStore.getState().resetWorkspace();
    useRoomStore.setState({ files: [fileA, fileB], activeFile: fileA });

    const savePromise = useRoomStore.getState().saveFile(fileA._id, { content: fileA.content });
    useRoomStore.getState().setActiveFile(fileB._id);
    deferred.resolve({ file: { ...fileA, content: 'a = 2;' } });
    await savePromise;

    expect(useRoomStore.getState().activeFile).toEqual(fileB);
    expect(useRoomStore.getState().files.find((file) => file._id === fileA._id).content).toBe('a = 2;');
  });

  it('keeps unsaved text dirty when a metadata rename carries stale text', async () => {
    const initialFile = createFile();
    const localContent = 'const value = 2;';
    updateFileRequest.mockResolvedValueOnce({
      file: createFile({ filename: 'renamed.js', path: 'renamed.js', content: initialFile.content })
    });
    seedFile(initialFile);
    useRoomStore.getState().updateLocalFile(initialFile._id, { content: localContent });

    const result = await useRoomStore.getState().saveFile(initialFile._id, {
      filename: 'renamed.js',
      path: 'renamed.js',
      language: 'javascript',
      content: initialFile.content
    });

    expect(updateFileRequest).toHaveBeenCalledWith(initialFile._id, {
      filename: 'renamed.js',
      path: 'renamed.js',
      language: 'javascript'
    });
    expect(result.content).toBe(localContent);
    expect(result.path).toBe('renamed.js');
    expect(useRoomStore.getState().dirtyFileIds).toEqual(new Set([initialFile._id]));
  });

  it('ignores an in-flight save after reset or local deletion', async () => {
    const resetDeferred = createDeferred();
    const resetFile = createFile({ _id: 'reset-file' });
    updateFileRequest.mockReturnValueOnce(resetDeferred.promise);
    seedFile(resetFile);
    const resetSave = useRoomStore.getState().saveFile(resetFile._id, { content: resetFile.content });
    await flushPromises();
    expect(updateFileRequest).toHaveBeenCalledTimes(1);
    useRoomStore.getState().resetWorkspace();
    resetDeferred.resolve({ file: { ...resetFile, content: 'stale response' } });
    await resetSave;
    expect(useRoomStore.getState().files).toEqual([]);
    expect(useRoomStore.getState().dirtyFileIds).toEqual(new Set());

    const deleteDeferred = createDeferred();
    const deletedFile = createFile({ _id: 'deleted-file' });
    updateFileRequest.mockReturnValueOnce(deleteDeferred.promise);
    seedFile(deletedFile);
    const deleteSave = useRoomStore.getState().saveFile(deletedFile._id, { content: deletedFile.content });
    await flushPromises();
    expect(updateFileRequest).toHaveBeenCalledTimes(2);
    useRoomStore.getState().removeLocalFile(deletedFile._id);
    deleteDeferred.resolve({ file: { ...deletedFile, content: 'resurrected' } });
    await deleteSave;
    expect(useRoomStore.getState().files).toEqual([]);
  });

  it('does not apply a save response to a reloaded workspace', async () => {
    const saveDeferred = createDeferred();
    const oldFile = createFile({ _id: 'reloaded-file', content: 'old workspace' });
    const newFile = createFile({ _id: 'reloaded-file', content: 'new workspace' });
    updateFileRequest.mockReturnValueOnce(saveDeferred.promise);
    listFilesByProjectRequest.mockResolvedValueOnce({ files: [newFile] });
    seedFile(oldFile);

    const savePromise = useRoomStore.getState().saveFile(oldFile._id, { content: oldFile.content });
    await useRoomStore.getState().loadFiles('project-2');
    saveDeferred.resolve({ file: { ...oldFile, content: 'stale save response' } });
    await savePromise;

    expect(useRoomStore.getState().files).toEqual([newFile]);
    expect(useRoomStore.getState().dirtyFileIds).toEqual(new Set());
  });

  it('serializes overlapping saves for the same file in request order', async () => {
    const firstDeferred = createDeferred();
    const secondDeferred = createDeferred();
    const initialFile = createFile();
    const firstContent = 'const value = 2;';
    const secondContent = 'const value = 3;';
    updateFileRequest
      .mockReturnValueOnce(firstDeferred.promise)
      .mockReturnValueOnce(secondDeferred.promise);
    seedFile(initialFile);
    useRoomStore.getState().updateLocalFile(initialFile._id, { content: firstContent });
    const firstSave = useRoomStore.getState().saveFile(initialFile._id, { content: firstContent });
    useRoomStore.getState().updateLocalFile(initialFile._id, { content: secondContent });
    const secondSave = useRoomStore.getState().saveFile(initialFile._id, { content: secondContent });

    await flushPromises();
    expect(updateFileRequest).toHaveBeenCalledTimes(1);
    expect(updateFileRequest).toHaveBeenNthCalledWith(1, initialFile._id, { content: firstContent });

    firstDeferred.resolve({ file: { ...initialFile, content: firstContent } });
    await flushPromises();
    expect(updateFileRequest).toHaveBeenCalledTimes(2);
    expect(updateFileRequest).toHaveBeenNthCalledWith(2, initialFile._id, { content: secondContent });

    secondDeferred.resolve({ file: { ...initialFile, content: secondContent } });
    await Promise.all([firstSave, secondSave]);
    expect(useRoomStore.getState().files[0].content).toBe(secondContent);
    expect(useRoomStore.getState().dirtyFileIds).toEqual(new Set());
  });

  it('does not replace the new room when an earlier room load finishes late', async () => {
    const oldRequest = createDeferred();
    seedFile();
    getRoomRequest.mockReturnValueOnce(oldRequest.promise).mockResolvedValueOnce({ room: { _id: 'new-room' } });
    listProjectsByRoomRequest.mockResolvedValueOnce({ projects: [{ _id: 'new-project' }] });
    listFilesByProjectRequest.mockResolvedValueOnce({ files: [createFile({ _id: 'new-file' })] });
    const oldLoad = useRoomStore.getState().loadWorkspace('old-room');
    useRoomStore.getState().resetWorkspace();
    await useRoomStore.getState().loadWorkspace('new-room');
    oldRequest.resolve({ room: { _id: 'old-room' } });
    await oldLoad;
    expect(useRoomStore.getState().currentRoom._id).toBe('new-room');
    expect(useRoomStore.getState().activeProject._id).toBe('new-project');
    expect(useRoomStore.getState().files[0]._id).toBe('new-file');
  });

  it('does not insert an old create response after leaving the workspace', async () => {
    const request = createDeferred();
    seedFile();
    createFileRequest.mockReturnValueOnce(request.promise);
    const creation = useRoomStore.getState().createFile({ projectId: 'project-1', filename: 'new.js' });
    useRoomStore.getState().resetWorkspace();
    request.resolve({ file: createFile({ _id: 'created-late' }) });
    await creation;
    expect(useRoomStore.getState().files).toEqual([]);
    expect(useRoomStore.getState().activeFile).toBeNull();
  });

  it('does not evict same-path files that belong to different projects', () => {
    const projectOneFile = createFile({ _id: 'project-one-file', project: 'project-1', path: 'src/index.js' });
    const projectTwoFile = createFile({ _id: 'project-two-file', project: 'project-2', path: 'src/index.js' });
    useRoomStore.getState().resetWorkspace();
    useRoomStore.setState({ files: [projectOneFile], activeFile: projectOneFile });

    useRoomStore.getState().applyRemoteFiles([projectTwoFile]);

    expect(useRoomStore.getState().files.map((file) => file._id)).toEqual(['project-one-file', 'project-two-file']);
  });

  it('waits for an in-flight save before deleting and does not resurrect the file', async () => {
    const request = createDeferred();
    seedFile();
    updateFileRequest.mockReturnValueOnce(request.promise);
    deleteFileRequest.mockResolvedValueOnce({ deleted: true });
    const save = useRoomStore.getState().saveFile('file-1', { content: 'saved' });
    const deletion = useRoomStore.getState().deleteFile('file-1');
    expect(deleteFileRequest).not.toHaveBeenCalled();
    request.resolve({ file: createFile({ content: 'saved' }) });
    await Promise.all([save, deletion]);
    expect(deleteFileRequest).toHaveBeenCalledWith('file-1');
    expect(useRoomStore.getState().files).toEqual([]);
    expect(useRoomStore.getState().dirtyFileIds.size).toBe(0);
  });

  it('continues the save queue after a failed request', async () => {
    const request = createDeferred();
    seedFile();
    useRoomStore.getState().updateLocalFile('file-1', { content: 'first' });
    updateFileRequest.mockReturnValueOnce(request.promise).mockResolvedValueOnce({ file: createFile({ content: 'second' }) });
    const first = useRoomStore.getState().saveFile('file-1', { content: 'first' });
    const failed = expect(first).rejects.toThrow('network failed');
    useRoomStore.getState().updateLocalFile('file-1', { content: 'second' });
    const second = useRoomStore.getState().saveFile('file-1', { content: 'second' });
    request.reject(new Error('network failed'));
    await failed;
    await second;
    expect(useRoomStore.getState().activeFile.content).toBe('second');
    expect(useRoomStore.getState().dirtyFileIds.size).toBe(0);
  });
});
