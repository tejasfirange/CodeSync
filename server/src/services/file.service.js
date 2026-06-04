import CodeFile from '../models/CodeFile.model.js';
import Project from '../models/Project.model.js';
import ApiError from '../utils/ApiError.js';
import { assertProjectAccess } from './project.service.js';
import { assertRoomMember, canEditRoom, canManageFiles } from './room.service.js';

const filePopulate = [{ path: 'lastEditedBy', select: 'name email avatarColor role' }];

const normalizePath = (value) => String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
const getBasename = (value) => normalizePath(value).split('/').filter(Boolean).pop() || normalizePath(value);
const getFilePath = (payload) => normalizePath(payload.path || payload.filename);
const duplicatePathError = () => new ApiError(409, 'A file with this path already exists in this project.');
const isMongoDuplicateError = (error) => error?.code === 11000;
const inferLanguageFromPath = (filePath = '') => {
  const extension = String(filePath).split('.').pop()?.toLowerCase();
  if (extension === 'js') return 'javascript';
  if (extension === 'py') return 'python';
  if (extension === 'c') return 'c';
  if (['cpp', 'cc', 'cxx'].includes(extension)) return 'cpp';
  if (extension === 'md') return 'markdown';
  if (extension === 'txt') return 'plaintext';
  return 'javascript';
};
const starterTemplate = (filePath = '', language) => {
  const resolvedLanguage = language || inferLanguageFromPath(filePath);
  if (resolvedLanguage === 'python') return 'def greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("CodeSync"))\n';
  if (resolvedLanguage === 'c') return '#include <stdio.h>\n\nint main() {\n    printf("Hello, CodeSync!\\\\n");\n    return 0;\n}\n';
  if (resolvedLanguage === 'cpp') return '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, CodeSync!" << endl;\n    return 0;\n}\n';
  if (resolvedLanguage === 'markdown') return '# New File\n';
  if (resolvedLanguage === 'plaintext') return '';
  return "function greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet('CodeSync'));\n";
};

export const createFile = async ({ projectId, filename, path, language, content = '' }, userId) => {
  const { project } = await assertProjectAccess(projectId, userId);
  const room = await assertRoomMember(project.room, userId);
  if (!canManageFiles(userId, room)) {
    throw new ApiError(403, 'You have view-only access in this room.');
  }
  const filePath = getFilePath({ filename, path });
  const resolvedLanguage = language || inferLanguageFromPath(filePath);
  const resolvedContent = content || starterTemplate(filePath, resolvedLanguage);
  const existingFile = await CodeFile.findOne({ project: project._id, path: filePath }).populate(filePopulate);

  if (existingFile) {
    throw duplicatePathError();
  }

  try {
    const file = await CodeFile.create({
      project: project._id,
      room: project.room,
      filename: getBasename(filePath),
      path: filePath,
      language: resolvedLanguage,
      content: resolvedContent,
      lastEditedBy: userId,
      lastEditedAt: new Date(),
      editCount: resolvedContent ? 1 : 0
    });

    return CodeFile.findById(file._id).populate(filePopulate);
  } catch (error) {
    if (isMongoDuplicateError(error)) {
      throw duplicatePathError();
    }

    throw error;
  }
};

export const listFilesByProject = async (projectId, userId) => {
  await assertProjectAccess(projectId, userId);

  return CodeFile.find({ project: projectId }).sort({ path: 1, filename: 1 }).populate(filePopulate);
};

export const getFileById = async (fileId, userId) => {
  const file = await CodeFile.findById(fileId).populate(filePopulate);
  if (!file) {
    throw new ApiError(404, 'File not found');
  }

  await assertRoomMember(file.room, userId);
  return file;
};

export const updateFile = async (fileId, userId, payload) => {
  const file = await CodeFile.findById(fileId);
  if (!file) {
    throw new ApiError(404, 'File not found');
  }

  const room = await assertRoomMember(file.room, userId);
  if (!canEditRoom(userId, room)) {
    throw new ApiError(403, 'You have view-only access in this room.');
  }

  const contentChanged = Object.prototype.hasOwnProperty.call(payload, 'content') && payload.content !== file.content;
  const nextPayload = { ...payload };
  if (Object.prototype.hasOwnProperty.call(nextPayload, 'path') || Object.prototype.hasOwnProperty.call(nextPayload, 'filename')) {
    const filePath = getFilePath({ filename: nextPayload.filename || file.filename, path: nextPayload.path || file.path });
    const pathChanged = filePath !== getFilePath(file);
    if (pathChanged && !canManageFiles(userId, room)) {
      throw new ApiError(403, 'You have view-only access in this room.');
    }
    const duplicate = await CodeFile.findOne({ project: file.project, path: filePath, _id: { $ne: file._id } });
    if (duplicate) {
      throw duplicatePathError();
    }

    nextPayload.path = filePath;
    nextPayload.filename = getBasename(filePath);
  }

  Object.assign(file, nextPayload);
  file.lastEditedBy = userId;

  if (contentChanged) {
    file.version += 1;
    file.editCount = (file.editCount || 0) + 1;
    file.lastEditedAt = new Date();
  }

  try {
    await file.save();
  } catch (error) {
    if (isMongoDuplicateError(error)) {
      throw duplicatePathError();
    }

    throw error;
  }

  return CodeFile.findById(file._id).populate(filePopulate);
};

export const deleteFile = async (fileId, userId) => {
  const file = await CodeFile.findById(fileId);
  if (!file) {
    throw new ApiError(404, 'File not found');
  }

  const room = await assertRoomMember(file.room, userId);
  if (!canManageFiles(userId, room)) {
    throw new ApiError(403, 'You have view-only access in this room.');
  }
  await file.deleteOne();

  return { deleted: true };
};

export const listFilesByRoom = async (roomId, userId) => {
  await assertRoomMember(roomId, userId);

  const projects = await Project.find({ room: roomId }).select('_id');
  const projectIds = projects.map((project) => project._id);

  return CodeFile.find({ project: { $in: projectIds } }).sort({ updatedAt: -1 }).populate(filePopulate);
};
