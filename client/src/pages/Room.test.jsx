// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateFileRequest } from '../api/file.api.js';
import { generateAiRequest } from '../api/ai.api.js';
import { useRoomStore } from '../store/room.store.js';
import Room from './Room.jsx';

const { socket } = vi.hoisted(() => ({
  socket: { connected: true, on: vi.fn(), off: vi.fn(), emit: vi.fn() }
}));

vi.mock('../api/file.api.js', () => ({
  createFileRequest: vi.fn(), deleteFileRequest: vi.fn(),
  listFilesByProjectRequest: vi.fn(), updateFileRequest: vi.fn()
}));
vi.mock('../api/ai.api.js', () => ({ generateAiRequest: vi.fn() }));
vi.mock('../api/sandbox.api.js', () => ({
  listSandboxPackagesRequest: vi.fn(async () => []), installSandboxPackageRequest: vi.fn(),
  removeSandboxPackageRequest: vi.fn(), parseSandboxCommandRequest: vi.fn()
}));
vi.mock('../hooks/useAuth.js', () => ({ default: () => ({ user: { _id: 'owner', name: 'Owner' } }) }));
vi.mock('../hooks/useSocket.js', () => ({ default: () => ({ socket, connected: true, pingMs: 1 }) }));
vi.mock('../hooks/useScreenShare.js', () => ({ default: () => ({}) }));
vi.mock('react-resizable-panels', async () => {
  const React = await import('react');
  return {
    Panel: React.forwardRef(({ children }, ref) => <div ref={ref}>{children}</div>),
    PanelGroup: ({ children }) => <div>{children}</div>
  };
});
vi.mock('../components/editor/CodeEditor.jsx', () => ({
  default: ({ value, onChange }) => <textarea aria-label="Code" value={value} onChange={(event) => onChange(event.target.value)} />
}));
vi.mock('../components/editor/FileExplorer.jsx', () => ({
  default: ({ files, onSelect, onRename }) => files.map((file) => (
    <div key={file._id}>
      <button onClick={() => onSelect(file._id)}>Open {file._id}</button>
      <button onClick={() => onRename(file)}>Rename {file._id}</button>
    </div>
  ))
}));
vi.mock('../components/chat/ChatPanel.jsx', () => ({ default: () => null }));
vi.mock('../components/editor/ActiveUsers.jsx', () => ({ default: () => null }));
vi.mock('../components/github/GitHubRepoManager.jsx', () => ({ default: () => null }));
vi.mock('../components/execution/ExecutionPanel.jsx', () => ({ default: () => null }));
vi.mock('../components/screenshare/ScreenShareButton.jsx', () => ({ default: () => null }));
vi.mock('../components/screenshare/ScreenSharePanel.jsx', () => ({ default: () => null }));
vi.mock('../components/layout/ResizeHandle.jsx', () => ({ default: () => null }));

const file = (id) => ({
  _id: id, project: 'project', room: 'room', filename: `${id}.js`, path: `${id}.js`,
  language: 'javascript', content: `${id} initial`, version: 1
});
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const mountRoom = async () => {
  let view;
  await act(async () => {
    view = render(
      <MemoryRouter initialEntries={['/rooms/room']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes><Route path="/rooms/:roomId" element={<Room />} /></Routes>
      </MemoryRouter>
    );
  });
  return view;
};
const codeEvents = () => socket.emit.mock.calls.filter(([event]) => event === 'code:change').map(([, payload]) => payload);
const memoryStorage = () => {
  const items = new Map();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
    clear: () => items.clear()
  };
};

describe('Room editor integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Isolate browser preferences, including on Node versions exposing Web Storage.
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('sessionStorage', memoryStorage());
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    socket.connected = true;
    socket.emit.mockImplementation((event, payload, ack) => {
      if (event === 'room:join') ack?.({ success: true });
    });
    useRoomStore.getState().resetWorkspace();
    const files = [file('A'), file('B')];
    useRoomStore.setState({
      files, activeFile: files[0], loading: false,
      activeProject: { _id: 'project', title: 'Project' },
      currentRoom: { _id: 'room', name: 'Room', owner: 'owner', members: [] },
      loadWorkspace: vi.fn(async () => {})
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('sends A edits as A even when B becomes active before the debounce expires', async () => {
    await mountRoom();
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'A edited' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open B' }));
    act(() => { vi.advanceTimersByTime(120); });
    expect(codeEvents()).toEqual([expect.objectContaining({ fileId: 'A', content: 'A edited' })]);
    expect(screen.getByLabelText('Code').value).toBe('B initial');
  });

  it('preserves newer typing and the visible unsaved state when an older save finishes', async () => {
    const request = deferred();
    updateFileRequest.mockReturnValueOnce(request.promise);
    await mountRoom();
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'saved snapshot' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'newer unsaved typing' } });
    await act(async () => { request.resolve({ file: { ...file('A'), content: 'saved snapshot', version: 2 } }); });
    expect(screen.getByLabelText('Code').value).toBe('newer unsaved typing');
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    expect(screen.queryAllByText('Saved')).toHaveLength(0);
  });

  it('does not restore an old local edit when renaming after a remote change', async () => {
    await mountRoom();
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'old local edit' } });
    act(() => { vi.advanceTimersByTime(120); });
    act(() => { useRoomStore.getState().applyRemoteFiles([{ ...file('A'), content: 'new remote text' }]); });
    updateFileRequest.mockResolvedValueOnce({ file: { ...file('A'), path: 'renamed.js', filename: 'renamed.js', content: 'database text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename A' }));
    fireEvent.change(screen.getByLabelText('Path'), { target: { value: 'renamed.js' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Rename', exact: true })); });
    expect(screen.getByLabelText('Code').value).toBe('new remote text');
    expect(codeEvents().at(-1)).toMatchObject({ fileId: 'A', path: 'renamed.js', content: 'new remote text' });
    expect(updateFileRequest.mock.calls[0][1]).not.toHaveProperty('content');
  });

  it('keeps the editor available after a failed save so the user can retry', async () => {
    updateFileRequest.mockRejectedValueOnce(new Error('Network unavailable'));
    await mountRoom();
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'keep my work' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true })); });
    expect(screen.getByLabelText('Code').value).toBe('keep my work');
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    expect(screen.getByText(/Save failed: Network unavailable/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save', exact: true }).disabled).toBe(false);
  });

  it('cancels pending broadcasts when the room unmounts', async () => {
    const view = await mountRoom();
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'pending' } });
    view.unmount();
    act(() => { vi.advanceTimersByTime(120); });
    expect(codeEvents()).toHaveLength(0);
  });

  it('sends only content when saving during a rename, so old paths cannot undo the rename', async () => {
    const rename = deferred();
    const renamedFile = { ...file('A'), path: 'renamed.js', filename: 'renamed.js' };
    updateFileRequest.mockReturnValueOnce(rename.promise).mockResolvedValueOnce({ file: { ...renamedFile, content: 'latest' } });
    await mountRoom();
    fireEvent.click(screen.getByRole('button', { name: 'Rename A' }));
    fireEvent.change(screen.getByLabelText('Path'), { target: { value: 'renamed.js' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename', exact: true }));
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'latest' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
    await act(async () => { rename.resolve({ file: renamedFile }); });
    expect(updateFileRequest.mock.calls[1]).toEqual(['A', { content: 'latest' }]);
    expect(useRoomStore.getState().activeFile.path).toBe('renamed.js');
    expect(screen.getByLabelText('Code').value).toBe('latest');
    expect(screen.queryByText('Unsaved changes')).toBeNull();
  });

  it('applies AI code to the current file locally and marks it dirty without saving', async () => {
    generateAiRequest.mockResolvedValueOnce({
      assistant: {
        summary: 'Updated the active file.',
        explanation: 'The generated change is ready to review.',
        code: 'const A = "AI applied";',
        language: 'javascript',
        filePath: 'A.js',
        warnings: []
      },
      context: { fileCount: 2, includedFiles: ['A.js'], targetFile: 'A.js' }
    });

    await mountRoom();
    fireEvent.click(screen.getByRole('button', { name: 'Open CodeSync AI' }));
    fireEvent.change(screen.getByLabelText('AI prompt'), { target: { value: 'Update the active file' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Generate with CodeSync AI' }));
    });
     fireEvent.click(screen.getByRole('button', { name: 'Apply generated file to editor' }));

    expect(useRoomStore.getState().activeFile.content).toBe('const A = "AI applied";');
    expect(useRoomStore.getState().dirtyFileIds.has('A')).toBe(true);
    expect(updateFileRequest).not.toHaveBeenCalled();
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });

});
