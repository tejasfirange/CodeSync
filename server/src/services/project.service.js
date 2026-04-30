import CodeFile from '../models/CodeFile.model.js';
import Project from '../models/Project.model.js';
import Room from '../models/Room.model.js';
import ApiError from '../utils/ApiError.js';
import idsEqual from '../utils/idsEqual.js';
import { assertRoomMember } from './room.service.js';

const projectPopulate = [
  { path: 'owner', select: 'name email avatarColor role' },
  { path: 'room', select: 'name roomCode owner members isPrivate' }
];

export const assertProjectAccess = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  const room = await assertRoomMember(project.room, userId);
  return { project, room };
};

export const createProject = async ({ roomId, title, description }, userId) => {
  await assertRoomMember(roomId, userId);

  const project = await Project.create({
    title,
    description,
    room: roomId,
    owner: userId
  });

  return Project.findById(project._id).populate(projectPopulate);
};

export const listProjectsByRoom = async (roomId, userId) => {
  await assertRoomMember(roomId, userId);

  return Project.find({ room: roomId }).sort({ updatedAt: -1 }).populate(projectPopulate);
};

export const getProjectById = async (projectId, userId) => {
  await assertProjectAccess(projectId, userId);

  return Project.findById(projectId).populate(projectPopulate);
};

export const updateProject = async (projectId, userId, payload) => {
  const { project, room } = await assertProjectAccess(projectId, userId);

  if (!idsEqual(project.owner, userId) && !idsEqual(room.owner, userId)) {
    throw new ApiError(403, 'Only a project owner or room owner can update this project');
  }

  Object.assign(project, payload);
  await project.save();

  return Project.findById(project._id).populate(projectPopulate);
};

export const deleteProject = async (projectId, userId) => {
  const { project, room } = await assertProjectAccess(projectId, userId);

  if (!idsEqual(project.owner, userId) && !idsEqual(room.owner, userId)) {
    throw new ApiError(403, 'Only a project owner or room owner can delete this project');
  }

  await CodeFile.deleteMany({ project: projectId });
  await project.deleteOne();

  return { deleted: true };
};

export const getRoomForProject = async (projectId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  const room = await Room.findById(project.room);
  if (!room) {
    throw new ApiError(404, 'Room not found');
  }

  return { project, room };
};
