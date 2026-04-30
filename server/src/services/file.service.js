import CodeFile from '../models/CodeFile.model.js';
import Project from '../models/Project.model.js';
import ApiError from '../utils/ApiError.js';
import { assertProjectAccess } from './project.service.js';
import { assertRoomMember } from './room.service.js';

const filePopulate = [{ path: 'lastEditedBy', select: 'name email avatarColor role' }];

const normalizePath = (value) => String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
const getBasename = (value) => normalizePath(value).split('/').filter(Boolean).pop() || normalizePath(value);
const getFilePath = (payload) => normalizePath(payload.path || payload.filename);

export const createFile = async ({ projectId, filename, path, language, content = '' }, userId) => {
  const { project } = await assertProjectAccess(projectId, userId);
  const filePath = getFilePath({ filename, path });
  const existingFile = await CodeFile.findOne({ project: project._id, path: filePath }).populate(filePopulate);

  if (existingFile) {
    return existingFile;
  }

  try {
    const file = await CodeFile.create({
      project: project._id,
      room: project.room,
      filename: getBasename(filePath),
      path: filePath,
      language,
      content,
      lastEditedBy: userId
    });

    return CodeFile.findById(file._id).populate(filePopulate);
  } catch (error) {
    if (error.code === 11000) {
      return CodeFile.findOne({ project: project._id, path: filePath }).populate(filePopulate);
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

  await assertRoomMember(file.room, userId);

  const contentChanged = Object.prototype.hasOwnProperty.call(payload, 'content') && payload.content !== file.content;
  const nextPayload = { ...payload };
  if (Object.prototype.hasOwnProperty.call(nextPayload, 'path') || Object.prototype.hasOwnProperty.call(nextPayload, 'filename')) {
    const filePath = getFilePath({ filename: nextPayload.filename || file.filename, path: nextPayload.path || file.path });
    nextPayload.path = filePath;
    nextPayload.filename = getBasename(filePath);
  }

  Object.assign(file, nextPayload);
  file.lastEditedBy = userId;

  if (contentChanged) {
    file.version += 1;
  }

  await file.save();

  return CodeFile.findById(file._id).populate(filePopulate);
};

export const deleteFile = async (fileId, userId) => {
  const file = await CodeFile.findById(fileId);
  if (!file) {
    throw new ApiError(404, 'File not found');
  }

  await assertRoomMember(file.room, userId);
  await file.deleteOne();

  return { deleted: true };
};

export const listFilesByRoom = async (roomId, userId) => {
  await assertRoomMember(roomId, userId);

  const projects = await Project.find({ room: roomId }).select('_id');
  const projectIds = projects.map((project) => project._id);

  return CodeFile.find({ project: { $in: projectIds } }).sort({ updatedAt: -1 }).populate(filePopulate);
};
