import { Copy, FilePlus2, MessageSquareText, PanelLeft, Play, Save, Settings2, Sparkles, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Panel, PanelGroup } from 'react-resizable-panels';
import AIAssistantPanel from '../components/ai/AIAssistantPanel.jsx';
import ChatPanel from '../components/chat/ChatPanel.jsx';
import ActiveUsers from '../components/editor/ActiveUsers.jsx';
import CodeEditor from '../components/editor/CodeEditor.jsx';
import FileExplorer from '../components/editor/FileExplorer.jsx';
import ExecutionPanel from '../components/execution/ExecutionPanel.jsx';
import RunButton from '../components/execution/RunButton.jsx';
import GitHubRepoManager from '../components/github/GitHubRepoManager.jsx';
import ResizeHandle from '../components/layout/ResizeHandle.jsx';
import ScreenShareButton from '../components/screenshare/ScreenShareButton.jsx';
import ScreenSharePanel from '../components/screenshare/ScreenSharePanel.jsx';
import { executeCodeRequest } from '../api/execute.api.js';
import { installSandboxPackageRequest, listSandboxPackagesRequest, parseSandboxCommandRequest, removeSandboxPackageRequest } from '../api/sandbox.api.js';
import Button from '../components/common/Button.jsx';
import Input from '../components/common/Input.jsx';
import Modal from '../components/common/Modal.jsx';
import Spinner from '../components/common/Spinner.jsx';
import DisbandRoomModal from '../components/rooms/DisbandRoomModal.jsx';
import useAuth from '../hooks/useAuth.js';
import useRoom from '../hooks/useRoom.js';
import useScreenShare from '../hooks/useScreenShare.js';
import useSocket from '../hooks/useSocket.js';
import { SOCKET_EVENTS } from '../socket/socketEvents.js';
import { useRoomStore } from '../store/room.store.js';
import { createCodeChangeQueue } from '../utils/codeChangeQueue.js';
import { LANGUAGES } from '../utils/constants.js';
import { detectLanguageFromPath, getFileTemplate } from '../utils/fileTemplates.js';
import { detectLanguageFromFile, isExecutableLanguage, normalizeExecutableLanguage } from '../utils/language.js';

const getFilePath = (file) => file?.path || file?.filename || '';
const getBasename = (path) => path.split('/').filter(Boolean).pop() || path;
const getEntityId = (value) => (typeof value === 'object' && value !== null ? value._id : value);
const defaultRoomSettings = {
  allowEditorsToRunCode: false,
  allowViewersToRunCode: false,
  allowEditorsToManageFiles: true,
  allowViewersToChat: true,
  allowScreenShare: true,
  allowViewersToScreenShare: false
};
const getRoomSettings = (room) => ({ ...defaultRoomSettings, ...(room?.settings || {}) });
const getMemberRole = (room, userId) => {
  if (!room || !userId) return 'viewer';
  if (getEntityId(room.owner) === userId) return 'owner';
  const member = room.members?.find((entry) => getEntityId(entry.user || entry) === userId || entry._id === userId);
  return member?.role || 'editor';
};
const getRoomPermissions = (room, userId) => {
  const role = getMemberRole(room, userId);
  const settings = getRoomSettings(room);
  return {
    role,
    canEdit: role === 'owner' || role === 'editor',
    canManageRoom: role === 'owner',
    canManageFiles: role === 'owner' || (role === 'editor' && settings.allowEditorsToManageFiles),
    canRunCode: role === 'owner' || (role === 'editor' && settings.allowEditorsToRunCode) || (role === 'viewer' && settings.allowViewersToRunCode),
    canChat: role === 'owner' || role === 'editor' || (role === 'viewer' && settings.allowViewersToChat),
    canScreenShare: role === 'owner' || (role === 'editor' && settings.allowScreenShare) || (role === 'viewer' && settings.allowViewersToScreenShare)
  };
};
const languageByExtension = new Map(LANGUAGES.map((item) => [item.extension, item.value]));
const inferLanguageFromPath = (path) => languageByExtension.get(path.split('.').pop()?.toLowerCase()) || detectLanguageFromPath(path) || 'plaintext';
const readTerminalHeight = () => {
  try {
    return Number(localStorage.getItem('codesync.terminalHeight')) || 280;
  } catch {
    return 280;
  }
};
const getExecutionHistoryKey = (roomId, fileId) => `codesync.executionHistory.${roomId}.${fileId || 'workspace'}`;
const readExecutionHistory = (roomId, fileId) => {
  try {
    return JSON.parse(localStorage.getItem(getExecutionHistoryKey(roomId, fileId)) || '[]');
  } catch {
    return [];
  }
};
const writeExecutionHistory = (roomId, fileId, history) => {
  try {
    localStorage.setItem(getExecutionHistoryKey(roomId, fileId), JSON.stringify(history.slice(0, 5)));
  } catch {
    // Local history is optional and should never break execution.
  }
};
const isEditableShortcutTarget = (target) =>
  Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"], .chat-region, .execution-panel'));
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const {
    currentRoom,
    activeProject,
    files,
    activeFile,
    dirtyFileIds: dirtyFiles,
    loading,
    error,
    loadWorkspace,
    resetWorkspace,
    disbandRoom,
    updateRoomSettings,
    updateMemberRole,
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
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [disbandOpen, setDisbandOpen] = useState(false);
  const [disbanding, setDisbanding] = useState(false);
  const [disbandError, setDisbandError] = useState('');
  const [newFile, setNewFile] = useState({ path: 'utils.js', language: 'javascript' });
  const [renameFile, setRenameFile] = useState(null);
  const [renamePath, setRenamePath] = useState('');
  const [creatingFile, setCreatingFile] = useState(false);
  const [workspaceSettings, setWorkspaceSettings] = useState(readWorkspaceSettings);
  const [roomJoined, setRoomJoined] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(() => !window.matchMedia('(max-width: 800px)').matches);
  const [rightPanelOpen, setRightPanelOpen] = useState(() => !window.matchMedia('(max-width: 1100px)').matches);
  const [rightPanelTab, setRightPanelTab] = useState('chat');
  const [openedFileIds, setOpenedFileIds] = useState([]);
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });
  const [userCursorTarget, setUserCursorTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [executionRunning, setExecutionRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [executionError, setExecutionError] = useState('');
  const [executionStdin, setExecutionStdin] = useState('');
  const [executionHistory, setExecutionHistory] = useState([]);
  const [sandboxPackages, setSandboxPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packageInstalling, setPackageInstalling] = useState(false);
  const [packageMessage, setPackageMessage] = useState('');
  const [terminalHeight, setTerminalHeight] = useState(readTerminalHeight);
  const [terminalRestoreHeight, setTerminalRestoreHeight] = useState(readTerminalHeight);
  const [terminalMinimized, setTerminalMinimized] = useState(false);
  const [terminalMaximized, setTerminalMaximized] = useState(false);
  const terminalPanelRef = useRef(null);
  const [notice, setNotice] = useState('');
  const [pageError, setPageError] = useState('');

  const activeFileRef = useRef(activeFile);
  const previousRoomIdRef = useRef(roomId);
  const connectionRef = useRef(null);
  const codeQueueRef = useRef(null);
  const workspaceEpochRef = useRef(0);
  const disbandingRef = useRef(false);
  const savingRef = useRef(false);
  const cursorTimerRef = useRef(null);
  const roomSettings = getRoomSettings(currentRoom);
  const permissions = getRoomPermissions(currentRoom, user?._id);
  const isRoomHost = permissions.canManageRoom;

  connectionRef.current = { connected, roomJoined, roomId, socket, canEdit: permissions.canEdit };
  if (!codeQueueRef.current) {
    codeQueueRef.current = createCodeChangeQueue({
      isConnected: () => {
        const connection = connectionRef.current;
        return Boolean(connection?.connected && connection.roomJoined && connection.socket?.connected && connection.canEdit);
      },
      send: (payload) => {
        const connection = connectionRef.current;
        if (
          !connection?.connected ||
          !connection.roomJoined ||
          !connection.canEdit ||
          !connection.socket?.connected ||
          connection.roomId !== payload.roomId
        ) {
          return;
        }
        connection.socket.emit(SOCKET_EVENTS.CODE_CHANGE, payload);
      }
    });
  }

  const emitCodeChange = (payload) => {
    const connection = connectionRef.current;
    if (
      !connection?.connected ||
      !connection.roomJoined ||
      !connection.canEdit ||
      !connection.socket?.connected ||
      connection.roomId !== payload.roomId
    ) {
      return false;
    }
    connection.socket.emit(SOCKET_EVENTS.CODE_CHANGE, payload);
    return true;
  };

  // Read the synchronous store, not a render-time ref or a second content cache.
  const getLatestLocalFile = (fileId) => useRoomStore.getState().files.find((file) => file._id === fileId);

  const showNotice = useCallback((message, timeout = 2200) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), timeout);
  }, []);
  const screenShare = useScreenShare({
    socket,
    roomId,
    currentUser: user,
    permissions,
    roomSettings,
    onNotice: showNotice
  });

  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);

  useEffect(() => {
    setExecutionHistory(readExecutionHistory(roomId, activeFile?._id));
  }, [activeFile?._id, roomId]);

  useEffect(() => {
    if (searchParams.get('settings') === '1') {
      setSettingsOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const updateTerminalHeight = useCallback((height) => {
    const nextHeight = Math.min(Math.floor(window.innerHeight * 0.6), Math.max(160, Math.round(height)));
    setTerminalHeight(nextHeight);
    localStorage.setItem('codesync.terminalHeight', String(nextHeight));
  }, []);

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
    const epoch = ++workspaceEpochRef.current;
    setSaving(false);
    setCreatingFile(false);
    setRenameModalOpen(false);
    setRenameFile(null);
    setNotice('');
    setPageError('');
    loadWorkspace(roomId).catch((loadError) => {
      if (epoch === workspaceEpochRef.current) setPageError(loadError.message);
    });

    return () => {
      workspaceEpochRef.current += 1;
      savingRef.current = false;
      codeQueueRef.current?.cancelAll();
      window.clearTimeout(cursorTimerRef.current);
      resetWorkspace();
    };
  }, [loadWorkspace, resetWorkspace, roomId]);

  useEffect(() => {
    if (previousRoomIdRef.current === roomId) {
      return;
    }

    previousRoomIdRef.current = roomId;
    // A room change must never leave an AI result from the previous workspace visible.
    setRightPanelTab('chat');
  }, [roomId]);

  useEffect(() => {
    if (!activeProject?._id || !permissions.canRunCode) {
      setSandboxPackages([]);
      return;
    }

    let cancelled = false;
    setPackagesLoading(true);
    listSandboxPackagesRequest(activeProject._id)
      .then((dependencies) => {
        if (!cancelled) {
          setSandboxPackages(dependencies || []);
        }
      })
      .catch((packagesError) => {
        if (!cancelled) {
          console.error('Unable to load sandbox packages:', packagesError);
          setPackageMessage(packagesError.message || 'Unable to load sandbox packages.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPackagesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeProject?._id, permissions.canRunCode]);

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
        const activeProjectId = useRoomStore.getState().activeProject?._id;
        if (activeProjectId) {
          applyRemoteFiles(payload.files.filter((file) => file.project === activeProjectId));
        }
        return;
      }

      const activeProjectId = useRoomStore.getState().activeProject?._id;
      if (activeProjectId && payload.project !== activeProjectId) {
        return;
      }

      if (payload.deleted) {
        codeQueueRef.current?.cancelFile(payload.fileId);
        removeLocalFile(payload.fileId);
        return;
      }

      codeQueueRef.current?.updateMetadata(payload.fileId, {
        filename: payload.filename,
        path: payload.path,
        language: payload.language
      });

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
    const handlePermissionError = ({ message }) => {
      setNotice(message || 'You do not have permission for that action.');
      window.setTimeout(() => setNotice(''), 2200);
    };
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
    socket.on(SOCKET_EVENTS.PERMISSION_ERROR, handlePermissionError);
    socket.on(SOCKET_EVENTS.ROOM_DISBANDED, handleRoomDisbanded);

    socket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId }, (ack) => {
      if (!ack?.success) {
        setPageError(ack?.message || 'Could not join room');
        return;
      }

      setRoomJoined(true);
    });

    return () => {
      codeQueueRef.current?.cancelAll();
      socket.emit(SOCKET_EVENTS.ROOM_LEAVE, { roomId });
      socket.off(SOCKET_EVENTS.ROOM_USERS, handleUsers);
      socket.off(SOCKET_EVENTS.PRESENCE_USERS_UPDATE, handlePresenceUsers);
      socket.off(SOCKET_EVENTS.CODE_SYNC, handleCodeSync);
      socket.off(SOCKET_EVENTS.SOCKET_ERROR, handleSocketError);
      socket.off(SOCKET_EVENTS.PERMISSION_ERROR, handlePermissionError);
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

  const queueCodeChange = (file, patch = {}) => {
    if (!permissions.canEdit || !file?._id) {
      return false;
    }

    const version = Object.prototype.hasOwnProperty.call(patch, 'version') ? patch.version : Date.now();
    const payload = {
      roomId,
      fileId: file._id,
      project: file.project,
      filename: file.filename,
      path: getFilePath(file),
      language: patch.language || file.language,
      content: Object.prototype.hasOwnProperty.call(patch, 'content') ? patch.content : file.content,
      version
    };
    return codeQueueRef.current.enqueue(payload);
  };

  const handleEditorChange = (content) => {
    if (!activeFile || !permissions.canEdit) {
      if (!permissions.canEdit) {
        setNotice('You have view-only access.');
        window.setTimeout(() => setNotice(''), 1600);
      }
      return;
    }

    const version = Date.now();
    setNotice('');
    updateLocalFile(activeFile._id, { content, version });
    queueCodeChange(activeFile, { content, version });
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

  const handleSave = useCallback(async () => {
    const fileToSave = useRoomStore.getState().activeFile;
    if (!fileToSave?._id || savingRef.current || !permissions.canEdit) {
      if (!permissions.canEdit) {
        setNotice('You have view-only access.');
        window.setTimeout(() => setNotice(''), 1600);
      }
      return;
    }

    const epoch = workspaceEpochRef.current;
    savingRef.current = true;
    setSaving(true);
    setNotice('');
    try {
      await saveFile(fileToSave._id, {
        content: fileToSave.content
      });
      if (epoch !== workspaceEpochRef.current) return;
      const state = useRoomStore.getState();
      if (state.files.some((file) => file._id === fileToSave._id)) {
        setNotice(state.dirtyFileIds.has(fileToSave._id) ? 'Snapshot saved; newer changes are unsaved' : 'Saved');
      }
    } catch (saveError) {
      if (epoch === workspaceEpochRef.current) setNotice(`Save failed: ${saveError.message}. Your changes are still unsaved.`);
    } finally {
      if (epoch === workspaceEpochRef.current) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }, [permissions.canEdit, saveFile]);

  const handleCreateFile = async (event) => {
    event.preventDefault();
    if (creatingFile || !permissions.canManageFiles) {
      if (!permissions.canManageFiles) {
        setNotice('You have view-only access.');
        window.setTimeout(() => setNotice(''), 1600);
      }
      return;
    }

    setPageError('');
    const path = newFile.path.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    const language = inferLanguageFromPath(path);

    const epoch = workspaceEpochRef.current;
    setCreatingFile(true);
    try {
      const file = await createFile({
        projectId: activeProject._id,
        filename: getBasename(path),
        path,
        language,
        content: getFileTemplate(path, language)
      });
      if (epoch !== workspaceEpochRef.current) return;

      emitCodeChange({
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
      if (epoch === workspaceEpochRef.current) setPageError(createError.message);
    } finally {
      if (epoch === workspaceEpochRef.current) setCreatingFile(false);
    }
  };

  const openRenameModal = (file) => {
    if (!permissions.canManageFiles) {
      setNotice('You have view-only access.');
      window.setTimeout(() => setNotice(''), 1600);
      return;
    }
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
    const fileId = renameFile._id;
    const epoch = workspaceEpochRef.current;
    if (!getLatestLocalFile(fileId)) return;
    codeQueueRef.current.cancelFile(fileId);

    try {
      // Keep content out of the REST rename so a stale modal snapshot cannot
      // overwrite edits made after the modal opened.
      await saveFile(fileId, {
        filename: getBasename(path),
        path,
        language: inferLanguageFromPath(path)
      });

      if (epoch !== workspaceEpochRef.current) return;
      const broadcastFile = getLatestLocalFile(fileId);
      if (!broadcastFile) return;
      // A rename is a lifecycle operation, so publish its final metadata
      // immediately after dropping any text queued while the REST request ran.
      codeQueueRef.current.cancelFile(fileId);
      emitCodeChange({
        roomId,
        fileId: broadcastFile._id,
        project: broadcastFile.project,
        filename: broadcastFile.filename,
        path: getFilePath(broadcastFile),
        language: broadcastFile.language,
        content: broadcastFile.content,
        version: broadcastFile.version
      });
      setRenameModalOpen(false);
      setRenameFile(null);
    } catch (renameError) {
      if (epoch !== workspaceEpochRef.current) return;
      const currentFile = getLatestLocalFile(fileId);
      if (currentFile) {
        queueCodeChange(currentFile, {
          content: currentFile.content,
          version: currentFile.version
        });
      }
      setNotice(`Rename failed: ${renameError.message}`);
    }
  };

  const handleDeleteFile = async (file) => {
    if (!permissions.canManageFiles) {
      setNotice('You have view-only access.');
      window.setTimeout(() => setNotice(''), 1600);
      return;
    }
    if (files.length <= 1) {
      setPageError('A workspace needs at least one file');
      return;
    }

    const confirmed = window.confirm(`Delete ${file.filename}?`);
    if (!confirmed) {
      return;
    }

    const epoch = workspaceEpochRef.current;
    codeQueueRef.current.cancelFile(file._id);
    try {
      await deleteFile(file._id);
      if (epoch !== workspaceEpochRef.current) return;
      codeQueueRef.current.cancelFile(file._id);
      emitCodeChange({
        roomId,
        fileId: file._id,
        filename: file.filename,
        path: getFilePath(file),
        project: file.project,
        deleted: true
      });
    } catch (deleteError) {
      if (epoch !== workspaceEpochRef.current) return;
      const currentFile = getLatestLocalFile(file._id);
      if (currentFile) {
        queueCodeChange(currentFile, {
          content: currentFile.content,
          version: currentFile.version
        });
      }
      setNotice(`Delete failed: ${deleteError.message}`);
    }
  };

  const handleGitHubPullFiles = (pulledFiles) => {
    if (!Array.isArray(pulledFiles) || pulledFiles.length === 0) {
      return;
    }

    applyRemoteFiles(pulledFiles);
  };

  const handleApplyAiCode = (code) => {
    const currentFile = useRoomStore.getState().activeFile;
    if (!currentFile?._id || typeof code !== 'string' || !code.trim()) {
      setNotice('Open a file before applying AI code.');
      window.setTimeout(() => setNotice(''), 1800);
      return;
    }

    // Applying is intentionally local-only. The existing store marks the file dirty;
    // the user can review it and use the normal Save action when ready.
    updateLocalFile(currentFile._id, { content: code, version: Date.now() });
    setNotice('AI code applied to the active file');
    window.setTimeout(() => setNotice(''), 1800);
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

  const handlePermissionSettingChange = async (key, value) => {
    if (!currentRoom?._id) return;
    setSettingsSaving(true);
    try {
      await updateRoomSettings(currentRoom._id, { [key]: value });
      setNotice('Settings updated');
      window.setTimeout(() => setNotice(''), 1600);
    } catch (settingError) {
      setPageError(settingError.message);
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleMemberRoleChange = async (member, role) => {
    if (!currentRoom?._id) return;
    const memberId = getEntityId(member.user || member);
    if (memberId === user?._id && role !== 'owner') {
      const confirmed = window.confirm('Demote yourself from owner? You may lose access to room settings.');
      if (!confirmed) return;
    }
    setSettingsSaving(true);
    try {
      await updateMemberRole(currentRoom._id, memberId, role);
    } catch (roleError) {
      setPageError(roleError.message);
    } finally {
      setSettingsSaving(false);
    }
  };

  const getExecutionLanguage = (file = activeFile) => {
    const path = getFilePath(file);
    return detectLanguageFromFile(path) || normalizeExecutableLanguage(file?.language);
  };

  const pushExecutionHistory = useCallback(
    (file, language, result) => {
      if (!file?._id || !result) {
        return;
      }

      const item = {
        id: `${Date.now()}-${file._id}`,
        ranAt: new Date().toISOString(),
        language,
        fileId: file._id,
        fileName: file.filename || getFilePath(file),
        result
      };
      const nextHistory = [item, ...readExecutionHistory(roomId, file._id).filter((entry) => entry.id !== item.id)].slice(0, 5);
      setExecutionHistory(nextHistory);
      writeExecutionHistory(roomId, file._id, nextHistory);
    },
    [roomId]
  );

  const handleRunCode = useCallback(async () => {
    const fileToRun = activeFileRef.current;
    if (!fileToRun || !activeProject?._id) {
      return;
    }

    const filePath = getFilePath(fileToRun);
    const language = getExecutionLanguage(fileToRun);
    if (!isExecutableLanguage(fileToRun.language, filePath)) {
      setNotice('Execution is only supported for JavaScript, Python, C++, and C.');
      window.setTimeout(() => setNotice(''), 2400);
      return;
    }

    setExecutionOpen(true);
    setTerminalMinimized(false);
    if (!permissions.canRunCode) {
      setExecutionError('Terminal access is disabled by the room owner.');
      return;
    }
    setExecutionRunning(true);
    setExecutionError('');
    setExecutionResult({
      status: 'running',
      stdout: '',
      stderr: '',
      language
    });

    try {
      const result = await executeCodeRequest({
        roomId,
        projectId: activeProject._id,
        fileId: fileToRun._id,
        language,
        code: fileToRun.content,
        stdin: executionStdin
      });
      setExecutionResult(result);
      pushExecutionHistory(fileToRun, language, result);
      return result;
    } catch (runError) {
      setExecutionError(runError.message || 'Code execution failed');
      const errorResult = {
        status: 'error',
        stdout: '',
        stderr: runError.message || 'Code execution failed',
        language
      };
      setExecutionResult(errorResult);
      pushExecutionHistory(fileToRun, language, errorResult);
      return errorResult;
    } finally {
      setExecutionRunning(false);
    }
  }, [activeProject?._id, executionStdin, getExecutionLanguage, permissions.canRunCode, pushExecutionHistory, roomId]);

  const handleInstallSandboxPackage = useCallback(
    async (packageName, language = 'python') => {
      if (!activeProject?._id) {
        return;
      }
      if (!permissions.canRunCode) {
        setPackageMessage('Terminal access is disabled by the room owner.');
        return;
      }

      setPackageInstalling(true);
      setPackageMessage('');
      try {
        const installResult = await installSandboxPackageRequest({
          roomId,
          projectId: activeProject._id,
          language,
          packageName
        });

        if (installResult.dependency) {
          setSandboxPackages((current) => {
            const withoutDuplicate = current.filter((dependency) => dependency._id !== installResult.dependency._id);
            return [...withoutDuplicate, installResult.dependency].sort((a, b) => a.packageName.localeCompare(b.packageName));
          });
        }

        const status = installResult.result?.status || 'success';
        setPackageMessage(status === 'success' ? `${packageName} installed in the project sandbox.` : installResult.result?.stderr || 'Package installation failed.');
        const historyItem = {
          id: `${Date.now()}-install-${packageName}`,
          ranAt: new Date().toISOString(),
          language,
          fileId: activeFileRef.current?._id || 'packages',
          fileName: `install python ${packageName}`,
          result: {
            status,
            stdout: installResult.result?.stdout || '',
            stderr: installResult.result?.stderr || '',
            language
          }
        };
        setExecutionHistory((current) => [historyItem, ...current].slice(0, 5));
        return installResult;
      } catch (installError) {
        console.error('Sandbox package install failed:', installError);
        setPackageMessage(installError.message || 'Package installation failed.');
        throw installError;
      } finally {
        setPackageInstalling(false);
      }
    },
    [activeProject?._id, permissions.canRunCode, roomId]
  );

  const handleRemoveSandboxPackage = useCallback(async (dependencyId) => {
    try {
      await removeSandboxPackageRequest(dependencyId);
      setSandboxPackages((current) => current.filter((dependency) => dependency._id !== dependencyId));
      setPackageMessage('Package removed from project sandbox.');
    } catch (removeError) {
      console.error('Sandbox package remove failed:', removeError);
      setPackageMessage(removeError.message || 'Unable to remove package.');
    }
  }, []);

  const handleSandboxCommand = useCallback(
    async (command) => {
      const parsed = await parseSandboxCommandRequest(command);
      if (parsed.action === 'help') {
        return {
          status: 'success',
          stdout: [
            'Allowed commands:',
            'run                        Run current file',
            'clear                      Clear output',
            'help                       Show this help',
            'python <file.py>           Run a Python file',
            'py <file.py>               Run a Python file',
            'node <file.js>             Run a JavaScript file',
            'gcc <file.c>               Compile & run a C file',
            'gcc <file.c> -o <out>      Compile C with output name',
            'g++ <file.cpp>             Compile & run a C++ file',
            'g++ <file.cpp> -o <out>    Compile C++ with output name',
            './main                     Run last compiled binary',
            'pip install <package>      Install Python package',
            'npm install <package>      Install Node package',
            'install python <package>   Install Python package',
            'install node <package>     Install Node package'
          ].join('\n'),
          stderr: ''
        };
      }
      if (parsed.action === 'clear') {
        setExecutionResult(null);
        setExecutionError('');
        return { status: 'success', stdout: 'Output cleared.', stderr: '' };
      }
      if (parsed.action === 'install-package') {
        const result = await handleInstallSandboxPackage(parsed.packageName, parsed.language);
        return result?.result || { status: 'success', stdout: `Installed ${parsed.packageName}.`, stderr: '' };
      }
      if (parsed.action === 'run' || parsed.action === 'run-current-file') {
        return handleRunCode();
      }
      if (parsed.action === 'run-file') {
        const targetPath = parsed.path.replace(/\\/g, '/');
        const targetFile = files.find((file) => getFilePath(file) === targetPath || file.filename === targetPath);
        if (!targetFile) {
          throw new Error('File not found in this project.');
        }
        setActiveFile(targetFile._id);
        activeFileRef.current = targetFile;
        return handleRunCode();
      }
      if (parsed.action === 'run-binary') {
        // Run the currently active C/C++ file (compile + run)
        const currentFile = activeFileRef.current;
        if (!currentFile) {
          throw new Error('No file is active. Open a C or C++ file first.');
        }
        const ext = getFilePath(currentFile).split('.').pop()?.toLowerCase();
        if (!['c', 'cpp', 'cc', 'cxx'].includes(ext)) {
          throw new Error('./main can only be used after compiling a C/C++ file. Open a .c or .cpp file.');
        }
        return handleRunCode();
      }
      throw new Error('Unsupported sandbox command. Type help to see allowed commands.');
    },
    [files, handleInstallSandboxPackage, handleRunCode, setActiveFile]
  );

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
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === '`') {
        event.preventDefault();
        setExecutionOpen((value) => !value);
        setTerminalMinimized(false);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        const editorFocused = Boolean(event.target?.closest?.('.monaco-editor'));
        if (editorFocused) {
          event.preventDefault();
          handleRunCode();
        }
        return;
      }

      if (event.key === 'Escape' && executionOpen && !event.target?.closest?.('.monaco-editor') && !isEditableShortcutTarget(event.target)) {
        setExecutionOpen(false);
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [executionOpen, handleRunCode, handleSave]);

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
  const activeExecutionLanguage = getExecutionLanguage(activeFile);
  const activeFileExecutable = activeFile ? isExecutableLanguage(activeFile.language, activeFilePath) : false;
  const openedFiles = openedFileIds.map((fileId) => files.find((file) => file._id === fileId)).filter(Boolean);
  const usersWithRoles = users.map((entry) => ({ ...entry, role: getMemberRole(currentRoom, entry.userId || entry._id) }));
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
          <div className="room-toolbar-identity min-w-0">
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
              <span className={`workspace-status ${connected ? '' : 'is-offline'}`} data-state={connected ? 'online' : 'offline'}>
                <span aria-hidden="true">●</span> {connected ? 'Live' : 'Offline'}
              </span>
              <span className={`workspace-status workspace-save-status ${activeFileDirty ? 'is-dirty' : ''}`}>
                {saving ? 'Saving' : activeFileDirty ? 'Unsaved' : 'Saved'}
              </span>
              {notice ? <span className="workspace-notice truncate text-xs font-bold text-teal-300">{notice}</span> : null}
              {!permissions.canEdit ? <span className="rounded border border-[var(--border-main)] px-2 py-1 text-xs font-black uppercase text-[var(--accent)]">View only</span> : null}
            </div>
            <p className="truncate text-sm font-medium text-neutral-400">{activeProject?.title}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <GitHubRepoManager project={activeProject} files={files} onPullFiles={handleGitHubPullFiles} canManage={isRoomHost} />
          <ScreenShareButton
            activeShare={screenShare.activeShare}
            isSharing={screenShare.isSharing}
            canShare={screenShare.canShare}
            status={screenShare.status}
            currentUserId={user?._id}
            onStart={screenShare.startSharing}
            onStop={screenShare.stopSharing}
            onOpen={() => setRightPanelOpen(true)}
          />
          <button
            type="button"
            className="room-toolbar-icon"
            onClick={() => {
              if (rightPanelOpen && rightPanelTab === 'ai') {
                setRightPanelOpen(false);
                return;
              }
              setRightPanelOpen(true);
              setRightPanelTab('ai');
            }}
            aria-label={rightPanelOpen && rightPanelTab === 'ai' ? 'Close CodeSync AI' : 'Open CodeSync AI'}
            aria-pressed={rightPanelOpen && rightPanelTab === 'ai'}
            title="CodeSync AI"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </button>
           <RunButton
             disabled={false}
             unsupported={Boolean(activeFile && !activeFileExecutable)}
             open={executionOpen}
             onRun={() => {
               setExecutionOpen((value) => !value);
               setTerminalMinimized(false);
               setTerminalMaximized(false);
               if (!permissions.canRunCode) {
                setExecutionError('Terminal access is disabled by the room owner.');
              }
            }}
          />
          <button
            type="button"
            className="room-toolbar-icon"
            onClick={() => setSettingsOpen(true)}
            aria-label="Workspace settings"
            title="Workspace settings"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <Button variant="secondary" icon={FilePlus2} onClick={() => setFileModalOpen(true)} disabled={!permissions.canManageFiles}>
            File
          </Button>
          <Button icon={Save} onClick={handleSave} disabled={saving || !activeFile || !permissions.canEdit}>
            {saving ? 'Saving' : 'Save'}
          </Button>
          <button
            type="button"
            className="room-toolbar-icon room-right-toggle"
            onClick={() => {
              if (!rightPanelOpen) {
                setRightPanelOpen(true);
                setRightPanelTab('chat');
              } else if (rightPanelTab === 'chat') {
                setRightPanelOpen(false);
              } else {
                setRightPanelTab('chat');
              }
            }}
            aria-label={rightPanelOpen && rightPanelTab === 'chat' ? 'Collapse collaboration panel' : 'Open chat panel'}
            aria-pressed={rightPanelOpen && rightPanelTab === 'chat'}
          >
            <MessageSquareText className="h-4 w-4" />
          </button>
        </div>
      </div>

      <section className="room-main">
        <PanelGroup direction="horizontal" autoSaveId="codesync.mainLayout">
          {explorerOpen ? (
            <>
              <Panel
                id="explorer"
                order={1}
                defaultSize={18}
                minSize={10}
                maxSize={30}
                className="explorer-panel explorer-panel-visible"
              >
                <div className="panel-shell">
                  <FileExplorer
                    files={files}
                    activeFile={activeFile}
                    onSelect={handleSelectFile}
                    onCreate={() => setFileModalOpen(true)}
                    onRename={permissions.canManageFiles ? openRenameModal : undefined}
                    onDelete={permissions.canManageFiles ? handleDeleteFile : undefined}
                  />
                </div>
              </Panel>
              <ResizeHandle id="explorer-resize" />
            </>
          ) : null}

          <Panel id="editor-area" order={2} defaultSize={explorerOpen && rightPanelOpen ? 60 : explorerOpen || rightPanelOpen ? 78 : 100} minSize={30}>
            <div className="flex h-full flex-col">
              <PanelGroup direction="vertical" autoSaveId="codesync.editorLayout">
                <Panel id="editor-main" order={1} defaultSize={executionOpen ? 70 : 100} minSize={20} className="editor-panel">
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
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className="flex h-8 items-center gap-1.5 rounded border border-white/10 bg-white/5 px-2 text-xs font-bold text-neutral-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={handleRunCode}
                        disabled={!activeFile || !activeFileExecutable || executionRunning || !permissions.canRunCode}
                        title={activeFileExecutable ? 'Run current file' : 'Execution is only supported for JavaScript, Python, C++, and C.'}
                      >
                        <Play className="h-3.5 w-3.5" aria-hidden="true" />
                        {executionRunning ? 'Running' : 'Run'}
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded text-neutral-500 hover:bg-white/10 hover:text-white"
                        onClick={() => activeFile && setActiveFile(null)}
                        aria-label="Close active file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
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
                        readOnly={!permissions.canEdit}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm font-semibold text-neutral-500">
                        Select a file from Explorer
                      </div>
                    )}
                  </div>
                </Panel>

                 {executionOpen ? (
                   <>
                     <ResizeHandle id="terminal-resize" />
                     <Panel
                       ref={terminalPanelRef}
                       id="terminal"
                       order={2}
                        defaultSize={30}
                        minSize={terminalMinimized ? 3 : 12}
                        maxSize={60}
                        collapsible
                        collapsedSize={3}
                        onResize={(size) => {
                          if (size <= 4) {
                            setTerminalMinimized(true);
                            setTerminalMaximized(false);
                          } else {
                            setTerminalMinimized(false);
                            setTerminalMaximized(size >= 50);
                          }
                        }}
                        className="terminal-panel-wrapper"
                     >
                      <ExecutionPanel
                        open={executionOpen}
                        activeFile={activeFile}
                        language={activeExecutionLanguage}
                        stdin={executionStdin}
                        result={executionResult}
                        running={executionRunning}
                        error={executionError}
                        canRun={permissions.canRunCode}
                        maximized={terminalMaximized}
                        packages={sandboxPackages}
                        packagesLoading={packagesLoading}
                        packageInstalling={packageInstalling}
                        packageMessage={packageMessage}
                        height={terminalHeight}
                        minimized={terminalMinimized}
                        history={executionHistory}
                        onHeightChange={(height) => {
                          setTerminalMinimized(false);
                          updateTerminalHeight(height);
                        }}
                        onStdinChange={setExecutionStdin}
                        onRunAgain={handleRunCode}
                        onClear={() => {
                          setExecutionResult(null);
                          setExecutionError('');
                        }}
                         onMinimize={() => {
                           setTerminalMinimized(true);
                           terminalPanelRef.current?.collapse?.();
                         }}
                          onMaximize={() => {
                            setTerminalMinimized(false);
                            setTerminalMaximized(true);
                            setTerminalRestoreHeight(terminalHeight);
                           terminalPanelRef.current?.resize?.(60);
                           updateTerminalHeight(Math.floor(window.innerHeight * 0.6));
                         }}
                          onRestore={() => {
                            setTerminalMinimized(false);
                            setTerminalMaximized(false);
                           terminalPanelRef.current?.expand?.();
                           terminalPanelRef.current?.resize?.(30);
                           updateTerminalHeight(terminalRestoreHeight);
                         }}
                         onClose={() => {
                           setExecutionOpen(false);
                           setTerminalMinimized(false);
                           setTerminalMaximized(false);
                         }}
                        onSelectHistory={(item) => {
                          setExecutionResult(item.result);
                          setExecutionError('');
                          setTerminalMinimized(false);
                        }}
                        onInstallPackage={handleInstallSandboxPackage}
                        onRemovePackage={handleRemoveSandboxPackage}
                        onCommand={handleSandboxCommand}
                        onManageAccess={permissions.canManageRoom ? () => setSettingsOpen(true) : null}
                      />
                    </Panel>
                  </>
                ) : null}
              </PanelGroup>

              <div className="editor-statusbar">
                <div className="flex items-center gap-4">
                  <span className={connected ? 'text-[#39ff88]' : 'text-red-400'}>{connected ? '● Connected' : '○ Offline'}</span>
                  <span className="opacity-60">|</span>
                  <span className="text-[#39ff88]">{activeFile?.language || 'plain text'}</span>
                  <span className="opacity-60">|</span>
                  <span>
                    Ln {cursorPosition.lineNumber || 1}, Col {cursorPosition.column || 1}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="opacity-80 uppercase tracking-widest">{saveState}</span>
                  <span className="opacity-60">|</span>
                  <span className="text-[#00e5ff]">{users.length} active</span>
                </div>
              </div>
            </div>
          </Panel>

          {rightPanelOpen ? (
            <>
              <ResizeHandle id="right-resize" />
              <Panel
                id="right"
                order={3}
                defaultSize={22}
                minSize={15}
                maxSize={35}
                className="right-panel right-panel-visible"
              >
                <PanelGroup direction="vertical" autoSaveId="codesync.rightLayout">
                  <Panel id="users" order={1} defaultSize={25} minSize={18} className="users-region">
                    <ActiveUsers
                      users={usersWithRoles}
                      connected={connected}
                      activeFileId={activeFile?._id}
                      currentUserId={user?._id}
                      pingMs={pingMs}
                      onOpenUserFile={handleOpenUserFile}
                    />
                  </Panel>
                  <ResizeHandle id="users-chat-resize" />
                  <Panel id="chat" order={2} defaultSize={65} minSize={25} className="chat-region">
                    <div className="flex h-full min-h-0 flex-col bg-[#0f1413]">
                      <ScreenSharePanel
                        activeShare={screenShare.activeShare}
                        status={screenShare.status}
                        error={screenShare.error}
                        isSharing={screenShare.isSharing}
                        localStreamRef={screenShare.localStreamRef}
                        remoteStreamRef={screenShare.remoteStreamRef}
                        localStreamVersion={screenShare.localStreamVersion}
                        remoteStreamVersion={screenShare.remoteStreamVersion}
                        onStop={screenShare.stopSharing}
                      />
                      <div className="flex min-h-0 flex-1 flex-col">
                        <div className="flex shrink-0 items-center gap-1 border-b border-white/10 bg-black/20 px-2 py-1.5" role="tablist" aria-label="Collaboration tools">
                          <button
                            type="button"
                            role="tab"
                            aria-selected={rightPanelTab === 'chat'}
                            className={`rounded-md px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] transition ${rightPanelTab === 'chat' ? 'bg-teal-300/10 text-teal-200' : 'text-neutral-500 hover:bg-white/5 hover:text-neutral-200'}`}
                            onClick={() => setRightPanelTab('chat')}
                          >
                            Chat
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected={rightPanelTab === 'ai'}
                            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] transition ${rightPanelTab === 'ai' ? 'bg-teal-300/10 text-teal-200' : 'text-neutral-500 hover:bg-white/5 hover:text-neutral-200'}`}
                            onClick={() => setRightPanelTab('ai')}
                          >
                            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                            CodeSync AI
                          </button>
                        </div>
                        <div className="min-h-0 flex-1">
                          {rightPanelTab === 'ai' ? (
                            <AIAssistantPanel
                              key={roomId}
                              roomId={roomId}
                              projectId={activeProject?._id}
                              activeFile={activeFile}
                              canEdit={permissions.canEdit}
                              onApplyCode={handleApplyAiCode}
                              onClose={() => setRightPanelTab('chat')}
                            />
                          ) : workspaceSettings.chatEnabled && permissions.canChat ? (
                            <ChatPanel roomId={roomId} socket={socket} currentUser={user} />
                          ) : (
                            <div className="flex h-full items-center justify-center px-4 text-center text-sm font-semibold text-neutral-500">
                              Chat is turned off for your role.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Panel>
                </PanelGroup>
              </Panel>
            </>
          ) : null}
        </PanelGroup>
      </section>

      <Modal title="Room settings" open={settingsOpen} onClose={() => setSettingsOpen(false)} size="xl">
        <div className="space-y-3">
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="text-sm font-black text-white">{currentRoom?.name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
              <span>Code: {currentRoom?.roomCode}</span>
              <Button variant="ghost" size="sm" icon={Copy} onClick={copyRoomCode}>Copy invite code</Button>
            </div>
          </div>
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
          {permissions.canManageRoom ? (
            <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-sm font-black text-white">Permissions</p>
              {[
                ['allowEditorsToRunCode', 'Allow editors to run code'],
                ['allowViewersToRunCode', 'Allow viewers to run code'],
                ['allowEditorsToManageFiles', 'Allow editors to manage files'],
                ['allowViewersToChat', 'Allow viewers to chat'],
                ['allowScreenShare', 'Allow editors to share screen'],
                ['allowViewersToScreenShare', 'Allow viewers to share screen']
              ].map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-4 rounded border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-sm font-semibold text-neutral-200">{label}</span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-teal-300"
                    checked={Boolean(roomSettings[key])}
                    disabled={settingsSaving}
                    onChange={(event) => handlePermissionSettingChange(key, event.target.checked)}
                  />
                </label>
              ))}
            </div>
          ) : null}
          <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="text-sm font-black text-white">Members</p>
            {(currentRoom?.members || []).map((member) => {
              const memberId = getEntityId(member.user || member);
              return (
                <div key={memberId} className="flex items-center justify-between gap-3 rounded border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{member.name || member.user?.name || 'Member'}</p>
                    <p className="truncate text-xs text-neutral-500">{member.email || member.user?.email}</p>
                  </div>
                  {permissions.canManageRoom ? (
                    <select
                      className="h-9 rounded border border-white/10 bg-black/40 px-2 text-sm font-bold text-white"
                      value={member.role || 'editor'}
                      disabled={settingsSaving}
                      onChange={(event) => handleMemberRoleChange(member, event.target.value)}
                    >
                      <option value="owner">Owner</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span className="rounded border border-white/10 px-2 py-1 text-xs font-black uppercase text-neutral-300">{member.role || 'editor'}</span>
                  )}
                </div>
              );
            })}
          </div>
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
