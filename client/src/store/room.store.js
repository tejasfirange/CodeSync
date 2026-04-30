import { create } from 'zustand';
import { createFileRequest, deleteFileRequest, listFilesByProjectRequest, updateFileRequest } from '../api/file.api.js';
import { createProjectRequest, listProjectsByRoomRequest } from '../api/project.api.js';
import { createRoomRequest, deleteRoomRequest, getRoomRequest, joinRoomRequest, listRoomsRequest } from '../api/room.api.js';
import { DEFAULT_CODE } from '../utils/constants.js';

const replaceById = (items, nextItem) => items.map((item) => (item._id === nextItem._id ? nextItem : item));
const getFilePath = (file) => file?.path || file?.filename || '';
const sortFiles = (files) => [...files].sort((a, b) => getFilePath(a).localeCompare(getFilePath(b)));
const mergeFileList = (files, nextFile) => {
  const nextPath = getFilePath(nextFile);
  const filtered = files.filter((file) => file._id !== nextFile._id && (!nextPath || getFilePath(file) !== nextPath));
  return sortFiles([...filtered, nextFile]);
};

export const useRoomStore = create((set, get) => ({
  rooms: [],
  currentRoom: null,
  projects: [],
  activeProject: null,
  files: [],
  activeFile: null,
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
    set((state) => ({
      rooms: state.rooms.filter((room) => room._id !== roomId),
      currentRoom: state.currentRoom?._id === roomId ? null : state.currentRoom,
      projects: state.currentRoom?._id === roomId ? [] : state.projects,
      activeProject: state.currentRoom?._id === roomId ? null : state.activeProject,
      files: state.currentRoom?._id === roomId ? [] : state.files,
      activeFile: state.currentRoom?._id === roomId ? null : state.activeFile
    }));
    return result;
  },

  loadRoom: async (roomId) => {
    const { room } = await getRoomRequest(roomId);
    set({ currentRoom: room });
    return room;
  },

  loadProjects: async (roomId) => {
    const { projects } = await listProjectsByRoomRequest(roomId);
    set({
      projects,
      activeProject: projects[0] || null
    });
    return projects;
  },

  createProject: async (payload) => {
    const { project } = await createProjectRequest(payload);
    set((state) => ({
      projects: [project, ...state.projects],
      activeProject: project
    }));
    return project;
  },

  loadFiles: async (projectId) => {
    const { files } = await listFilesByProjectRequest(projectId);
    set({
      files,
      activeFile: files[0] || null
    });
    return files;
  },

  createFile: async (payload) => {
    const { file } = await createFileRequest(payload);
    set((state) => ({
      files: mergeFileList(state.files, file),
      activeFile: file
    }));
    return file;
  },

  saveFile: async (fileId, payload) => {
    const { file } = await updateFileRequest(fileId, payload);
    set((state) => ({
      files: replaceById(state.files, file),
      activeFile: state.activeFile?._id === file._id ? file : state.activeFile
    }));
    return file;
  },

  deleteFile: async (fileId) => {
    await deleteFileRequest(fileId);
    set((state) => {
      const files = state.files.filter((file) => file._id !== fileId);
      return {
        files,
        activeFile: state.activeFile?._id === fileId ? files[0] || null : state.activeFile
      };
    });
  },

  setActiveFile: (fileId) => {
    const activeFile = get().files.find((file) => file._id === fileId) || null;
    set({ activeFile });
  },

  updateLocalFile: (fileId, patch) => {
    set((state) => {
      const files = state.files.map((file) => (file._id === fileId ? { ...file, ...patch } : file));
      const activeFile = state.activeFile?._id === fileId ? { ...state.activeFile, ...patch } : state.activeFile;
      return { files, activeFile };
    });
  },

  removeLocalFile: (fileId) => {
    set((state) => {
      const files = state.files.filter((file) => file._id !== fileId);
      return {
        files,
        activeFile: state.activeFile?._id === fileId ? files[0] || null : state.activeFile
      };
    });
  },

  loadWorkspace: async (roomId) => {
    set({ loading: true, error: '' });
    try {
      await get().loadRoom(roomId);

      let projects = await get().loadProjects(roomId);
      let activeProject = projects[0];

      if (!activeProject) {
        activeProject = await get().createProject({
          roomId,
          title: 'Main Project',
          description: 'Shared workspace'
        });
        projects = [activeProject];
      }

      let files = await get().loadFiles(activeProject._id);
      if (files.length === 0) {
        const file = await get().createFile({
          projectId: activeProject._id,
          filename: 'index.js',
          language: 'javascript',
          content: DEFAULT_CODE
        });
        files = [file];
      }

      set({
        projects,
        activeProject,
        files,
        activeFile: files[0],
        loading: false
      });
    } catch (error) {
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
      const byPath = new Map(state.files.map((file) => [getFilePath(file), file._id]));
      remoteFiles.forEach((file) => {
        const filePath = getFilePath(file);
        const duplicateId = byPath.get(filePath);
        if (duplicateId && duplicateId !== file._id) {
          byId.delete(duplicateId);
        }
        byId.set(file._id, { ...byId.get(file._id), ...file });
        if (filePath) {
          byPath.set(filePath, file._id);
        }
      });
      const files = sortFiles(Array.from(byId.values()));
      const activeFile = state.activeFile ? files.find((file) => file._id === state.activeFile._id) || files[0] : files[0];

      return { files, activeFile };
    });
  },

  resetWorkspace: () =>
    set({
      currentRoom: null,
      projects: [],
      activeProject: null,
      files: [],
      activeFile: null,
      error: ''
    })
}));
