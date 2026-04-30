import { Copy, FilePlus2, MessageSquareText, PanelLeft, Save, Settings2, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChatPanel from '../components/chat/ChatPanel.jsx';
import ActiveUsers from '../components/editor/ActiveUsers.jsx';
import CodeEditor from '../components/editor/CodeEditor.jsx';
import FileExplorer from '../components/editor/FileExplorer.jsx';
import GitHubRepoManager from '../components/github/GitHubRepoManager.jsx';
import Button from '../components/common/Button.jsx';
import Input from '../components/common/Input.jsx';
import Modal from '../components/common/Modal.jsx';
import Spinner from '../components/common/Spinner.jsx';
import DisbandRoomModal from '../components/rooms/DisbandRoomModal.jsx';
import useAuth from '../hooks/useAuth.js';
import useRoom from '../hooks/useRoom.js';
import useSocket from '../hooks/useSocket.js';
import { SOCKET_EVENTS } from '../socket/socketEvents.js';
import { DEFAULT_CODE, LANGUAGES } from '../utils/constants.js';

const getFilePath = (file) => file?.path || file?.filename || '';
const getBasename = (path) => path.split('/').filter(Boolean).pop() || path;
const getEntityId = (value) => (typeof value === 'object' && value !== null ? value._id : value);
const languageByExtension = new Map(LANGUAGES.map((item) => [item.extension, item.value]));
const inferLanguageFromPath = (path) => languageByExtension.get(path.split('.').pop()?.toLowerCase()) || 'plaintext';
const readWorkspaceSettings = () => {
  try {
    return {
      chatEnabled: localStorage.getItem('codesync.chatEnabled') !== 'false',
      remoteCursorsEnabled: localStorage.getItem('codesync.remoteCursorsEnabled') !== 'false'
    };
  } catch {
    return {
      chatEnabled: true,
      remoteCursorsEnabled: true
    };
  }
};

const Room = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    currentRoom,
    activeProject,
    files,
    activeFile,
    loading,
    error,
    loadWorkspace,
    resetWorkspace,
    disbandRoom,
    setActiveFile,
    updateLocalFile,
    removeLocalFile,
    applyRemoteFiles,
    saveFile,
    createFile,
    deleteFile
  } = useRoom();
  const { socket, connected, pingMs } = useSocket();

  const [users, setUsers] = useState([]);
  const [fileModalOpen, setFileModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [disbandOpen, setDisbandOpen] = useState(false);
  const [disbanding, setDisbanding] = useState(false);
  const [disbandError, setDisbandError] = useState('');
  const [newFile, setNewFile] = useState({ path: 'utils.js', language: 'javascript' });
  const [renameFile, setRenameFile] = useState(null);
  const [renamePath, setRenamePath] = useState('');
  const [creatingFile, setCreatingFile] = useState(false);
  const [dirtyFiles, setDirtyFiles] = useState(() => new Set());
  const [workspaceSettings, setWorkspaceSettings] = useState(readWorkspaceSettings);
  const [roomJoined, setRoomJoined] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(() => !window.matchMedia('(max-width: 800px)').matches);
  const [rightPanelOpen, setRightPanelOpen] = useState(() => !window.matchMedia('(max-width: 1100px)').matches);
  const [openedFileIds, setOpenedFileIds] = useState([]);
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });
  const [userCursorTarget, setUserCursorTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [pageError, setPageError] = useState('');

  const activeFileRef = useRef(activeFile);
  const disbandingRef = useRef(false);
  const pendingPatchRef = useRef({});
  const codeTimerRef = useRef(null);
  const cursorTimerRef = useRef(null);

  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);

  useEffect(() => {
    if (!activeFile?._id) {
      return;
    }

    setOpenedFileIds((current) => (current.includes(activeFile._id) ? current : [...current, activeFile._id]));
  }, [activeFile?._id]);

  useEffect(() => {
    setOpenedFileIds((current) => current.filter((fileId) => files.some((file) => file._id === fileId)));
  }, [files]);

  useEffect(() => {
    localStorage.setItem('codesync.chatEnabled', workspaceSettings.chatEnabled ? 'true' : 'false');
    localStorage.setItem('codesync.remoteCursorsEnabled', workspaceSettings.remoteCursorsEnabled ? 'true' : 'false');
  }, [workspaceSettings]);

  useEffect(() => {
    loadWorkspace(roomId).catch((loadError) => setPageError(loadError.message));

    return () => {
      window.clearTimeout(codeTimerRef.current);
      window.clearTimeout(cursorTimerRef.current);
      resetWorkspace();
    };
  }, [loadWorkspace, resetWorkspace, roomId]);

  useEffect(() => {
    if (!connected || !roomId) {
      return;
    }

    setRoomJoined(false);

    const handleUsers = ({ roomId: incomingRoomId, users: nextUsers }) => {
      if (incomingRoomId === roomId) {
        setUsers(nextUsers);
      }
    };

    const handlePresenceUsers = ({ roomId: incomingRoomId, users: nextUsers }) => {
      if (incomingRoomId === roomId) {
        setUsers(nextUsers);
      }
    };

    const handleCodeSync = (payload) => {
      if (payload.roomId !== roomId) {
        return;
      }

      if (payload.type === 'initial') {
        applyRemoteFiles(payload.files);
        return;
      }

      if (payload.deleted) {
        removeLocalFile(payload.fileId);
        return;
      }

      applyRemoteFiles([
        {
          _id: payload.fileId,
          project: payload.project,
          filename: payload.filename,
          path: payload.path,
          language: payload.language,
          content: payload.content,
          version: payload.version,
          lastEditedBy: payload.lastEditedBy,
          updatedAt: payload.updatedAt
        }
      ]);
    };

    const handleSocketError = ({ message }) => setPageError(message);
    const handleRoomDisbanded = () => {
      if (disbandingRef.current) {
        return;
      }

      sessionStorage.setItem('codesync.roomDisbandedMessage', 'This room was disbanded by the owner.');
      navigate('/dashboard', { replace: true });
    };

    socket.on(SOCKET_EVENTS.ROOM_USERS, handleUsers);
    socket.on(SOCKET_EVENTS.PRESENCE_USERS_UPDATE, handlePresenceUsers);
    socket.on(SOCKET_EVENTS.CODE_SYNC, handleCodeSync);
    socket.on(SOCKET_EVENTS.SOCKET_ERROR, handleSocketError);
    socket.on(SOCKET_EVENTS.ROOM_DISBANDED, handleRoomDisbanded);

    socket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId }, (ack) => {
      if (!ack?.success) {
        setPageError(ack?.message || 'Could not join room');
        return;
      }

      setRoomJoined(true);
    });

    return () => {
      socket.emit(SOCKET_EVENTS.ROOM_LEAVE, { roomId });
      socket.off(SOCKET_EVENTS.ROOM_USERS, handleUsers);
      socket.off(SOCKET_EVENTS.PRESENCE_USERS_UPDATE, handlePresenceUsers);
      socket.off(SOCKET_EVENTS.CODE_SYNC, handleCodeSync);
      socket.off(SOCKET_EVENTS.SOCKET_ERROR, handleSocketError);
      socket.off(SOCKET_EVENTS.ROOM_DISBANDED, handleRoomDisbanded);
      setUsers([]);
      setRoomJoined(false);
    };
  }, [applyRemoteFiles, connected, navigate, removeLocalFile, roomId, socket, user?._id]);

  useEffect(() => {
    if (!connected || !roomJoined || !roomId) {
      return;
    }

    socket.emit(SOCKET_EVENTS.PRESENCE_FILE_CHANGE, {
      roomId,
      userId: user?._id,
      fileId: activeFile?._id || null,
      filePath: activeFile ? getFilePath(activeFile) : null,
      fileName: activeFile?.filename || null
    });
  }, [activeFile?._id, activeFile?.filename, activeFile?.path, connected, roomJoined, roomId, socket, user?._id]);

  const queueCodeChange = (patch) => {
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
    window.clearTimeout(codeTimerRef.current);

    codeTimerRef.current = window.setTimeout(() => {
      const file = activeFileRef.current;
      const pendingPatch = pendingPatchRef.current;
      pendingPatchRef.current = {};

      if (!file || !connected) {
        return;
      }

      socket.emit(SOCKET_EVENTS.CODE_CHANGE, {
        roomId,
        fileId: file._id,
        project: file.project,
        filename: file.filename,
        path: getFilePath(file),
        language: pendingPatch.language || file.language,
        content: Object.prototype.hasOwnProperty.call(pendingPatch, 'content') ? pendingPatch.content : file.content,
        version: Date.now()
      });
    }, 120);
  };

  const handleEditorChange = (content) => {
    if (!activeFile) {
      return;
    }

    updateLocalFile(activeFile._id, { content, version: Date.now() });
    setDirtyFiles((current) => new Set(current).add(activeFile._id));
    queueCodeChange({ content });
  };

  const handleCursorChange = ({ position, selection }) => {
    if (!activeFile || !connected) {
      return;
    }

    if (position) {
      setCursorPosition(position);
    }

    window.clearTimeout(cursorTimerRef.current);
    cursorTimerRef.current = window.setTimeout(() => {
      socket.emit(SOCKET_EVENTS.CURSOR_MOVE, {
        roomId,
        fileId: activeFile._id,
        userId: user?._id,
        position,
        selection
      });
    }, 75);
  };

  const handleSave = async () => {
    if (!activeFile) {
      return;
    }

    setSaving(true);
    setNotice('');
    try {
      await saveFile(activeFile._id, {
        filename: activeFile.filename,
        path: getFilePath(activeFile),
        language: activeFile.language,
        content: activeFile.content
      });
      setDirtyFiles((current) => {
        const next = new Set(current);
        next.delete(activeFile._id);
        return next;
      });
      setNotice('Saved');
    } catch (saveError) {
      setPageError(saveError.message);
    } finally {
      setSaving(false);
      window.setTimeout(() => setNotice(''), 1600);
    }
  };

  const handleCreateFile = async (event) => {
    event.preventDefault();
    if (creatingFile) {
      return;
    }

    setPageError('');
    const path = newFile.path.trim().replace(/\\/g, '/').replace(/^\/+/, '');

    setCreatingFile(true);
    try {
      const file = await createFile({
        projectId: activeProject._id,
        filename: getBasename(path),
        path,
        language: newFile.language || inferLanguageFromPath(path),
        content: DEFAULT_CODE
      });

      socket.emit(SOCKET_EVENTS.CODE_CHANGE, {
        roomId,
        fileId: file._id,
        project: file.project,
        filename: file.filename,
        path: getFilePath(file),
        language: file.language,
        content: file.content,
        version: file.version
      });

      setFileModalOpen(false);
      setNewFile({ path: 'utils.js', language: 'javascript' });
    } catch (createError) {
      setPageError(createError.message);
    } finally {
      setCreatingFile(false);
    }
  };

  const openRenameModal = (file) => {
    setRenameFile(file);
    setRenamePath(getFilePath(file));
    setRenameModalOpen(true);
  };

  const handleRenameFile = async (event) => {
    event.preventDefault();
    if (!renameFile) {
      return;
    }

    const path = renamePath.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    setPageError('');

    try {
      const updated = await saveFile(renameFile._id, {
        filename: getBasename(path),
        path,
        language: inferLanguageFromPath(path),
        content: renameFile.content
      });
      socket.emit(SOCKET_EVENTS.CODE_CHANGE, {
        roomId,
        fileId: updated._id,
        project: updated.project,
        filename: updated.filename,
        path: getFilePath(updated),
        language: updated.language,
        content: updated.content,
        version: updated.version
      });
      setRenameModalOpen(false);
      setRenameFile(null);
    } catch (renameError) {
      setPageError(renameError.message);
    }
  };

  const handleDeleteFile = async (file) => {
    if (files.length <= 1) {
      setPageError('A workspace needs at least one file');
      return;
    }

    const confirmed = window.confirm(`Delete ${file.filename}?`);
    if (!confirmed) {
      return;
    }

    await deleteFile(file._id);
    socket.emit(SOCKET_EVENTS.CODE_CHANGE, {
      roomId,
      fileId: file._id,
      filename: file.filename,
      path: getFilePath(file),
      project: file.project,
      deleted: true
    });
  };

  const handleGitHubPullFiles = (pulledFiles) => {
    if (!Array.isArray(pulledFiles) || pulledFiles.length === 0) {
      return;
    }

    applyRemoteFiles(pulledFiles);
  };

  const copyRoomCode = async () => {
    if (!currentRoom?.roomCode) {
      return;
    }

    await navigator.clipboard.writeText(currentRoom.roomCode);
    setNotice('Copied');
    window.setTimeout(() => setNotice(''), 1400);
  };

  const handleSelectFile = (fileId) => {
    setActiveFile(fileId);
    setOpenedFileIds((current) => (current.includes(fileId) ? current : [...current, fileId]));
  };

  const handleOpenUserFile = (entry) => {
    const targetFile =
      files.find((file) => file._id === entry.activeFileId) ||
      files.find((file) => getFilePath(file) === entry.activeFilePath || file.filename === entry.activeFileName);

    if (!targetFile?._id) {
      setNotice('That file is not in this workspace');
      window.setTimeout(() => setNotice(''), 1600);
      return;
    }

    handleSelectFile(targetFile._id);

    if (entry.cursor?.position) {
      setUserCursorTarget({
        fileId: targetFile._id,
        position: entry.cursor.position,
        nonce: Date.now()
      });
    }
  };

  const handleDisbandRoom = async () => {
    if (!currentRoom?._id) {
      return;
    }

    setDisbanding(true);
    disbandingRef.current = true;
    setDisbandError('');
    try {
      await disbandRoom(currentRoom._id);
      sessionStorage.setItem('codesync.roomDisbandedMessage', 'Room disbanded successfully');
      navigate('/dashboard', { replace: true });
    } catch (disbandFailure) {
      disbandingRef.current = false;
      setDisbandError(disbandFailure.message || 'Could not disband room');
    } finally {
      setDisbanding(false);
    }
  };

  const closeTab = (fileId) => {
    setOpenedFileIds((current) => current.filter((id) => id !== fileId));
    if (activeFile?._id === fileId) {
      const remaining = openedFileIds.filter((id) => id !== fileId);
      setActiveFile(remaining[remaining.length - 1] || null);
    }
  };

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [activeFile?._id, activeFile?.content, activeFile?.language]);

  if (loading && !activeFile) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Spinner label="Loading room" />
      </div>
    );
  }

  if (error || pageError) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 dark:border-rose-900/60 dark:bg-rose-950/40">
        <p className="mb-4 text-sm font-bold text-rose-700 dark:text-rose-100">{error || pageError}</p>
        <Button variant="secondary" onClick={() => navigate('/dashboard')}>
          Dashboard
        </Button>
      </div>
    );
  }

  const activeFilePath = getFilePath(activeFile);
  const activeFileDirty = activeFile ? dirtyFiles.has(activeFile._id) : false;
  const isRoomHost = getEntityId(currentRoom?.owner) === user?._id;
  const openedFiles = openedFileIds.map((fileId) => files.find((file) => file._id === fileId)).filter(Boolean);
  const saveState = saving ? 'Saving...' : activeFileDirty ? 'Unsaved changes' : activeFile ? 'Saved' : 'Idle';

  return (
    <div className="room-page">
      <div className="room-toolbar">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            className="room-toolbar-icon room-explorer-toggle"
            onClick={() => setExplorerOpen((value) => !value)}
            aria-label={explorerOpen ? 'Collapse explorer' : 'Expand explorer'}
            aria-pressed={explorerOpen}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-black text-white">{currentRoom?.name}</h1>
              <button
                type="button"
                onClick={copyRoomCode}
                className="inline-flex h-8 shrink-0 items-center gap-2 rounded bg-white/10 px-2 text-xs font-black text-neutral-200 transition hover:bg-white/15"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                {currentRoom?.roomCode}
              </button>
              {notice ? <span className="truncate text-xs font-bold text-teal-300">{notice}</span> : null}
            </div>
            <p className="truncate text-sm font-medium text-neutral-400">{activeProject?.title}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <GitHubRepoManager project={activeProject} files={files} onPullFiles={handleGitHubPullFiles} canManage={isRoomHost} />
          <button
            type="button"
            className="room-toolbar-icon"
            onClick={() => setSettingsOpen(true)}
            aria-label="Workspace settings"
            title="Workspace settings"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <Button variant="secondary" icon={FilePlus2} onClick={() => setFileModalOpen(true)}>
            File
          </Button>
          <Button icon={Save} onClick={handleSave} disabled={saving || !activeFile}>
            {saving ? 'Saving' : 'Save'}
          </Button>
          <button
            type="button"
            className="room-toolbar-icon room-right-toggle"
            onClick={() => setRightPanelOpen((value) => !value)}
            aria-label={rightPanelOpen ? 'Collapse collaboration panel' : 'Expand collaboration panel'}
            aria-pressed={rightPanelOpen}
          >
            <MessageSquareText className="h-4 w-4" />
          </button>
        </div>
      </div>

      <section className={`room-main ${explorerOpen ? 'explorer-open' : ''} ${rightPanelOpen ? 'right-open' : ''}`}>
        <div className="explorer-panel">
          <div className="panel-shell">
            <FileExplorer
              files={files}
              activeFile={activeFile}
              onSelect={handleSelectFile}
              onCreate={() => setFileModalOpen(true)}
              onRename={openRenameModal}
              onDelete={handleDeleteFile}
            />
          </div>
        </div>

        <div className="editor-panel">
          <div className="editor-tabs">
            {openedFiles.length ? (
              openedFiles.map((file) => {
                const path = getFilePath(file);
                const isActive = activeFile?._id === file._id;
                const isDirty = dirtyFiles.has(file._id);

                return (
                  <button
                    key={file._id}
                    type="button"
                    className={`editor-tab ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelectFile(file._id)}
                    title={path}
                  >
                    <span className="truncate">{file.filename || getBasename(path)}</span>
                    {isDirty ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" /> : null}
                    <span
                      role="button"
                      tabIndex={0}
                      className="editor-tab-close"
                      onClick={(event) => {
                        event.stopPropagation();
                        closeTab(file._id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          closeTab(file._id);
                        }
                      }}
                      aria-label={`Close ${file.filename}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </span>
                  </button>
                );
              })
            ) : (
              <span className="px-3 text-xs font-semibold text-neutral-500">No open files</span>
            )}
          </div>

          <div className="editor-header">
            {activeFile ? (
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-black text-white" title={activeFilePath}>
                    {activeFile.filename || getBasename(activeFilePath)}
                  </span>
                  {activeFileDirty ? <span className="h-2 w-2 shrink-0 rounded-full bg-amber-300" title="Unsaved changes" /> : null}
                </div>
                <p className="truncate text-xs font-semibold text-neutral-500" title={activeFilePath}>
                  {activeFilePath}
                </p>
              </div>
            ) : (
              <p className="text-sm font-semibold text-neutral-500">No file selected</p>
            )}
            <button
              type="button"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-neutral-500 hover:bg-white/10 hover:text-white"
              onClick={() => activeFile && setActiveFile(null)}
              aria-label="Close active file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="editor-body">
            {activeFile ? (
              <CodeEditor
                file={activeFile}
                value={activeFile.content}
                onChange={handleEditorChange}
                onCursorChange={handleCursorChange}
                socket={socket}
                roomId={roomId}
                currentUserId={user?._id}
                presenceUsers={users}
                showRemoteCursors={workspaceSettings.remoteCursorsEnabled}
                focusPosition={userCursorTarget?.fileId === activeFile._id ? userCursorTarget : null}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-neutral-500">
                Select a file from Explorer
              </div>
            )}
          </div>

          <div className="editor-statusbar">
            <span>{connected ? 'Connected' : 'Offline'}</span>
            <span>{activeFile?.language || 'No language'}</span>
            <span>
              Ln {cursorPosition.lineNumber || 1}, Col {cursorPosition.column || 1}
            </span>
            <span>{saveState}</span>
            <span>{users.length} active</span>
          </div>
        </div>

        <div className="right-panel">
          <div className="users-region">
            <ActiveUsers
              users={users}
              connected={connected}
              activeFileId={activeFile?._id}
              currentUserId={user?._id}
              pingMs={pingMs}
              onOpenUserFile={handleOpenUserFile}
            />
          </div>
          <div className="chat-region">
            {workspaceSettings.chatEnabled ? (
              <ChatPanel roomId={roomId} socket={socket} currentUser={user} />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm font-semibold text-neutral-500">
                Chat is turned off in your workspace settings.
              </div>
            )}
          </div>
        </div>
      </section>

      <Modal title="Workspace settings" open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/20 p-3">
            <span>
              <span className="block text-sm font-bold text-white">Chat</span>
              <span className="block text-xs font-medium text-neutral-500">Show the room chat panel in this workspace.</span>
            </span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-teal-300"
              checked={workspaceSettings.chatEnabled}
              onChange={(event) => setWorkspaceSettings((current) => ({ ...current, chatEnabled: event.target.checked }))}
            />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/20 p-3">
            <span>
              <span className="block text-sm font-bold text-white">Other cursors</span>
              <span className="block text-xs font-medium text-neutral-500">Show collaborators' live cursors when they are on your file.</span>
            </span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-teal-300"
              checked={workspaceSettings.remoteCursorsEnabled}
              onChange={(event) => setWorkspaceSettings((current) => ({ ...current, remoteCursorsEnabled: event.target.checked }))}
            />
          </label>
          {isRoomHost ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-rose-100">Danger zone</p>
                  <p className="mt-1 text-xs font-medium text-rose-100/75">Permanently delete this room and its linked workspace data.</p>
                </div>
                <Button
                  variant="danger"
                  icon={Trash2}
                  onClick={() => {
                    setSettingsOpen(false);
                    setDisbandOpen(true);
                  }}
                >
                  Disband Room
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <DisbandRoomModal
        open={disbandOpen}
        room={currentRoom}
        filesCount={files.length}
        loading={disbanding}
        error={disbandError}
        onClose={() => {
          setDisbandOpen(false);
          setDisbandError('');
        }}
        onConfirm={handleDisbandRoom}
      />

      <Modal title="New file" open={fileModalOpen} onClose={() => setFileModalOpen(false)}>
        <form className="space-y-4" onSubmit={handleCreateFile}>
          <Input
            label="Path"
            value={newFile.path}
            onChange={(event) =>
              setNewFile((current) => ({
                ...current,
                path: event.target.value,
                language: inferLanguageFromPath(event.target.value)
              }))
            }
            placeholder="client/src/utils/helpers.js"
            required
          />
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-neutral-800 dark:text-neutral-200">Language</span>
            <select
              className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-white/10 dark:bg-[#0f1413] dark:text-white dark:focus:border-teal-300 dark:focus:ring-teal-300/20"
              value={newFile.language}
              onChange={(event) => setNewFile((current) => ({ ...current, language: event.target.value }))}
            >
              {LANGUAGES.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="w-full" disabled={creatingFile}>
            {creatingFile ? 'Creating' : 'Create file'}
          </Button>
        </form>
      </Modal>

      <Modal title="Rename file" open={renameModalOpen} onClose={() => setRenameModalOpen(false)}>
        <form className="space-y-4" onSubmit={handleRenameFile}>
          <Input label="Path" value={renamePath} onChange={(event) => setRenamePath(event.target.value)} required />
          <Button type="submit" className="w-full">
            Rename
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default Room;
