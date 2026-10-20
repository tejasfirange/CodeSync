import { create } from 'zustand';
import { createFileRequest, deleteFileRequest, listFilesByProjectRequest, updateFileRequest } from '../api/file.api.js';
import { createProjectRequest, listProjectsByRoomRequest } from '../api/project.api.js';
import { createRoomRequest, deleteRoomRequest, getRoomRequest, joinRoomRequest, listRoomsRequest, updateMemberRoleRequest, updateRoomSettingsRequest } from '../api/room.api.js';
import { getFileTemplate } from '../utils/fileTemplates.js';

const replaceById = (items, nextItem) => items.map((item) => (item._id === nextItem._id ? nextItem : item));
const getFilePath = (file) => file?.path || file?.filename || '';
const getFileScopeKey = (file) => `${file?.project || ''}:${getFilePath(file)}`;
const sortFiles = (files) => [...files].sort((a, b) => getFilePath(a).localeCompare(getFilePath(b)));
const editableFileFields = ['content', 'filename', 'path', 'language'];
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const hasRequestedField = (payload, field) => hasOwn(payload, field) && payload[field] !== undefined;
const mergeFileList = (files, nextFile) => {
  const nextPath = getFilePath(nextFile);
  const filtered = files.filter((file) => file._id !== nextFile._id && (!nextPath || getFilePath(file) !== nextPath));
  return sortFiles([...filtered, nextFile]);
};

export const useRoomStore = create((set, get) => {
  const saveQueues = new Map();
  const dirtyFieldsByFileId = new Map();
  const invalidatedFileIds = new Set();
  let workspaceGeneration = 0;

  const getDirtyFileIds = (files) => {
    const fileIds = new Set(files.map((file) => file._id));
    const dirtyFileIds = new Set();

    dirtyFieldsByFileId.forEach((fields, fileId) => {
      if (!fileIds.has(fileId) || fields.size === 0) {
        dirtyFieldsByFileId.delete(fileId);
        return;
      }
      dirtyFileIds.add(fileId);
    });

    return dirtyFileIds;
  };

  const clearDirtyTracking = () => {
    dirtyFieldsByFileId.clear();
  };

  const beginWorkspaceLifecycle = () => {
    workspaceGeneration += 1;
    invalidatedFileIds.clear();
    return workspaceGeneration;
  };

  const reconcileSave = ({ fileId, payload, requestSnapshot, requestGeneration, requestWasInvalidated, serverFile }) => {
    const responseFile = serverFile && typeof serverFile === 'object' ? serverFile : {};
    const responseWithId = { ...responseFile, _id: fileId };
    const state = get();
    const currentFile = state.files.find((file) => file._id === fileId);

    if (
      requestGeneration !== workspaceGeneration ||
      requestWasInvalidated ||
      invalidatedFileIds.has(fileId) ||
      !currentFile
    ) {
      return responseWithId;
    }

    const mergedFile = { ...currentFile, ...responseWithId };
    const dirtyFields = new Set(dirtyFieldsByFileId.get(fileId) || []);

    editableFileFields.forEach((field) => {
      const requested = hasRequestedField(payload, field);
      const changedDuringRequest = !Object.is(currentFile[field], requestSnapshot[field]);

      if (
        changedDuringRequest ||
        (!requested && (field === 'content' || dirtyFields.has(field)))
      ) {
        mergedFile[field] = currentFile[field];
        return;
      }

      if (!hasOwn(responseFile, field)) {
        if (requested) {
          mergedFile[field] = payload[field];
        }
        return;
      }

      if (requested) {
        dirtyFields.delete(field);
      }
    });

    if (dirtyFields.size > 0) {
      dirtyFieldsByFileId.set(fileId, dirtyFields);
    } else {
      dirtyFieldsByFileId.delete(fileId);
    }

    const files = replaceById(state.files, mergedFile);
    set({
      files,
      activeFile: state.activeFile?._id === fileId ? mergedFile : state.activeFile,
      dirtyFileIds: getDirtyFileIds(files)
    });

    return mergedFile;
  };

  const executeSave = async ({ fileId, payload, requestSnapshot, requestGeneration, requestWasInvalidated }) => {
    const currentFile = get().files.find((file) => file._id === fileId);
    if (
      !currentFile ||
      requestGeneration !== workspaceGeneration ||
      requestWasInvalidated ||
      invalidatedFileIds.has(fileId)
    ) {
      return requestSnapshot ? { ...requestSnapshot } : { _id: fileId, ...payload };
    }

    const result = await updateFileRequest(fileId, payload);
    const serverFile = result?.file || result;
    return reconcileSave({
      fileId,
      payload,
      requestSnapshot,
      requestGeneration,
      requestWasInvalidated,
      serverFile
    });
  };

  const enqueueSave = ({ fileId, payload, requestSnapshot, requestGeneration, requestWasInvalidated }) => {
    const previousSave = saveQueues.get(fileId);
    const savePromise = previousSave
      ? previousSave
        .catch(() => undefined)
        .then(() => executeSave({ fileId, payload, requestSnapshot, requestGeneration, requestWasInvalidated }))
      : executeSave({ fileId, payload, requestSnapshot, requestGeneration, requestWasInvalidated });
    const trackedSave = savePromise.finally(() => {
      if (saveQueues.get(fileId) === trackedSave) {
        saveQueues.delete(fileId);
      }
    });

    saveQueues.set(fileId, trackedSave);
    return trackedSave;
  };

  return {
  rooms: [],
  currentRoom: null,
  projects: [],
  activeProject: null,
  files: [],
  activeFile: null,
  dirtyFileIds: new Set(),
  loading: false,
  error: '',

  loadRooms: async () => {
    set({ loading: true, error: '' });
    try {
      const { rooms } = await listRoomsRequest();
      set({ rooms, loading: false });
      return rooms;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  createRoom: async (payload) => {
    const { room } = await createRoomRequest(payload);
    set((state) => ({ rooms: [room, ...state.rooms] }));
    return room;
  },

  joinRoom: async (roomCode) => {
    const { room } = await joinRoomRequest(roomCode);
    set((state) => {
      const exists = state.rooms.some((item) => item._id === room._id);
      return { rooms: exists ? replaceById(state.rooms, room) : [room, ...state.rooms] };
    });
    return room;
  },

  disbandRoom: async (roomId) => {
    const result = await deleteRoomRequest(roomId);
    let clearedCurrentRoom = false;
    set((state) => {
      const isCurrentRoom = state.currentRoom?._id === roomId;
      clearedCurrentRoom = isCurrentRoom;
      return {
        rooms: state.rooms.filter((room) => room._id !== roomId),
        currentRoom: isCurrentRoom ? null : state.currentRoom,
        projects: isCurrentRoom ? [] : state.projects,
        activeProject: isCurrentRoom ? null : state.activeProject,
        files: isCurrentRoom ? [] : state.files,
        activeFile: isCurrentRoom ? null : state.activeFile,
        dirtyFileIds: isCurrentRoom ? new Set() : state.dirtyFileIds
      };
    });
    if (clearedCurrentRoom) {
      beginWorkspaceLifecycle();
      clearDirtyTracking();
    }
    return result;
  },

  loadRoom: async (roomId, { generation = workspaceGeneration } = {}) => {
    const { room } = await getRoomRequest(roomId);
    if (generation === workspaceGeneration) set({ currentRoom: room });
    return room;
  },

  updateRoomSettings: async (roomId, payload) => {
    const { room } = await updateRoomSettingsRequest(roomId, payload);
    set((state) => ({
      currentRoom: state.currentRoom?._id === room._id ? room : state.currentRoom,
      rooms: replaceById(state.rooms, room)
    }));
    return room;
  },

  updateMemberRole: async (roomId, userId, role) => {
    const { room } = await updateMemberRoleRequest(roomId, userId, role);
    set((state) => ({
      currentRoom: state.currentRoom?._id === room._id ? room : state.currentRoom,
      rooms: replaceById(state.rooms, room)
    }));
    return room;
  },

  loadProjects: async (roomId, { generation = workspaceGeneration } = {}) => {
    const { projects } = await listProjectsByRoomRequest(roomId);
    if (generation !== workspaceGeneration) return projects;
    set({
      projects,
      activeProject: projects[0] || null
    });
    return projects;
  },

  createProject: async (payload, { generation = workspaceGeneration } = {}) => {
    const { project } = await createProjectRequest(payload);
    if (generation !== workspaceGeneration) return project;
    set((state) => ({
      projects: [project, ...state.projects],
      activeProject: project
    }));
    return project;
  },

  loadFiles: async (projectId, { generation } = {}) => {
    const requestGeneration = generation ?? beginWorkspaceLifecycle();
    const { files } = await listFilesByProjectRequest(projectId);
    if (requestGeneration !== workspaceGeneration) {
      return files;
    }

    clearDirtyTracking();
    set({
      files,
      activeFile: files[0] || null,
      dirtyFileIds: new Set()
    });
    return files;
  },

  createFile: async (payload, { generation = workspaceGeneration } = {}) => {
    const { file } = await createFileRequest(payload);
    if (generation !== workspaceGeneration) {
      return file;
    }
    set((state) => {
      const files = mergeFileList(state.files, file);
      return {
        files,
        activeFile: file,
        dirtyFileIds: getDirtyFileIds(files)
      };
    });
    return file;
  },

  saveFile: async (fileId, payload) => {
    const requestFile = get().files.find((file) => file._id === fileId);
    const requestSnapshot = requestFile ? { ...requestFile } : { _id: fileId, ...payload };
    const requestGeneration = workspaceGeneration;
    const requestPayload = { ...payload };
    const hasMetadataPayload = ['filename', 'path', 'language'].some((field) => hasRequestedField(requestPayload, field));

    // Rename callers may carry stale content. Capture this decision at enqueue
    // time so a preceding same-file save cannot make the queued rename unsafe.
    if (
      dirtyFieldsByFileId.get(fileId)?.has('content') &&
      hasRequestedField(requestPayload, 'content') &&
      !Object.is(requestPayload.content, requestSnapshot.content)
    ) {
      if (hasMetadataPayload) {
        delete requestPayload.content;
      } else {
        requestPayload.content = requestSnapshot.content;
      }
    }

    // Same-file saves are serialized so the server receives them in caller order.
    // saveFile resolves with the reconciled local/server file when applied. An
    // ignored stale acknowledgment resolves with its server-shaped file without
    // changing store state (or the request snapshot if no REST call was started).
    return enqueueSave({
      fileId,
      payload: requestPayload,
      requestSnapshot,
      requestGeneration,
      requestWasInvalidated: invalidatedFileIds.has(fileId)
    });
  },

  deleteFile: async (fileId) => {
    const requestGeneration = workspaceGeneration;
    invalidatedFileIds.add(fileId);
    const pendingSave = saveQueues.get(fileId);
    if (pendingSave) {
      await pendingSave.catch(() => undefined);
    }
    try {
      await deleteFileRequest(fileId);
      if (requestGeneration !== workspaceGeneration) return;
      set((state) => {
        const files = state.files.filter((file) => file._id !== fileId);
        dirtyFieldsByFileId.delete(fileId);
        return {
          files,
          activeFile: state.activeFile?._id === fileId ? files[0] || null : state.activeFile,
          dirtyFileIds: getDirtyFileIds(files)
        };
      });
    } catch (error) {
      if (requestGeneration === workspaceGeneration) invalidatedFileIds.delete(fileId);
      throw error;
    }
  },

  setActiveFile: (fileId) => {
    const activeFile = get().files.find((file) => file._id === fileId) || null;
    set({ activeFile });
  },

  updateLocalFile: (fileId, patch) => {
    set((state) => {
      const currentFile = state.files.find((file) => file._id === fileId);
      if (!currentFile) {
        return state;
      }

      const changedFields = editableFileFields.filter(
        (field) => hasOwn(patch, field) && !Object.is(currentFile[field], patch[field])
      );
      const dirtyFields = new Set(dirtyFieldsByFileId.get(fileId) || []);
      changedFields.forEach((field) => dirtyFields.add(field));
      if (dirtyFields.size > 0) {
        dirtyFieldsByFileId.set(fileId, dirtyFields);
      }

      const files = state.files.map((file) => (file._id === fileId ? { ...file, ...patch } : file));
      const activeFile = state.activeFile?._id === fileId ? { ...state.activeFile, ...patch } : state.activeFile;
      return { files, activeFile, dirtyFileIds: getDirtyFileIds(files) };
    });
  },

  removeLocalFile: (fileId) => {
    invalidatedFileIds.add(fileId);
    set((state) => {
      const files = state.files.filter((file) => file._id !== fileId);
      dirtyFieldsByFileId.delete(fileId);
      return {
        files,
        activeFile: state.activeFile?._id === fileId ? files[0] || null : state.activeFile,
        dirtyFileIds: getDirtyFileIds(files)
      };
    });
  },

  loadWorkspace: async (roomId) => {
    const requestGeneration = beginWorkspaceLifecycle();
    set({ loading: true, error: '' });
    try {
      await get().loadRoom(roomId, { generation: requestGeneration });
      if (requestGeneration !== workspaceGeneration) {
        return;
      }

      let projects = await get().loadProjects(roomId, { generation: requestGeneration });
      if (requestGeneration !== workspaceGeneration) {
        return;
      }
      let activeProject = projects[0];

      if (!activeProject) {
        if (requestGeneration !== workspaceGeneration) {
          return;
        }
        activeProject = await get().createProject({
          roomId,
          title: 'Main Project',
          description: 'Shared workspace'
        }, { generation: requestGeneration });
        if (requestGeneration !== workspaceGeneration) {
          return;
        }
        projects = [activeProject];
      }

      let files = await get().loadFiles(activeProject._id, { generation: requestGeneration });
      if (requestGeneration !== workspaceGeneration) {
        return;
      }
      if (files.length === 0) {
        try {
          if (requestGeneration !== workspaceGeneration) {
            return;
          }
          const file = await get().createFile(
            {
              projectId: activeProject._id,
              filename: 'index.js',
              language: 'javascript',
              content: getFileTemplate('index.js', 'javascript')
            },
            { generation: requestGeneration }
          );
          if (requestGeneration !== workspaceGeneration) {
            return;
          }
          files = [file];
        } catch (createDefaultError) {
          if (createDefaultError.status !== 403) {
            throw createDefaultError;
          }
          files = [];
        }
      }

      if (requestGeneration !== workspaceGeneration) {
        return;
      }

      clearDirtyTracking();
      set({
        projects,
        activeProject,
        files,
        activeFile: files[0] || null,
        dirtyFileIds: new Set(),
        loading: false
      });
    } catch (error) {
      if (requestGeneration !== workspaceGeneration) {
        return;
      }
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  applyRemoteFiles: (remoteFiles) => {
    if (!Array.isArray(remoteFiles) || remoteFiles.length === 0) {
      return;
    }

    set((state) => {
      const byId = new Map(state.files.map((file) => [file._id, file]));
       const byScope = new Map(state.files.map((file) => [getFileScopeKey(file), file._id]));
       remoteFiles.forEach((file) => {
         const filePath = getFilePath(file);
         const duplicateId = byScope.get(getFileScopeKey(file));
         if (duplicateId && duplicateId !== file._id) {
           byId.delete(duplicateId);
         }
         byId.set(file._id, { ...byId.get(file._id), ...file });
         if (filePath) {
           byScope.set(getFileScopeKey(file), file._id);
         }
       });
      const files = sortFiles(Array.from(byId.values()));
      const activeFile = state.activeFile ? files.find((file) => file._id === state.activeFile._id) || files[0] : files[0];

      return { files, activeFile, dirtyFileIds: getDirtyFileIds(files) };
    });
  },

  resetWorkspace: () => {
    beginWorkspaceLifecycle();
    clearDirtyTracking();
    set({
      currentRoom: null,
      projects: [],
      activeProject: null,
      files: [],
      activeFile: null,
      dirtyFileIds: new Set(),
      loading: false,
      error: ''
    });
  }
  };
});
