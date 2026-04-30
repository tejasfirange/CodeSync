import {
  createProject,
  deleteProject,
  getProjectById,
  listProjectsByRoom,
  updateProject
} from '../services/project.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const create = asyncHandler(async (req, res) => {
  const project = await createProject(req.body, req.user._id);
  res.status(201).json(new ApiResponse(201, { project }, 'Project created'));
});

export const listByRoom = asyncHandler(async (req, res) => {
  const projects = await listProjectsByRoom(req.params.roomId, req.user._id);
  res.status(200).json(new ApiResponse(200, { projects }, 'Projects loaded'));
});

export const getById = asyncHandler(async (req, res) => {
  const project = await getProjectById(req.params.projectId, req.user._id);
  res.status(200).json(new ApiResponse(200, { project }, 'Project loaded'));
});

export const update = asyncHandler(async (req, res) => {
  const project = await updateProject(req.params.projectId, req.user._id, req.body);
  res.status(200).json(new ApiResponse(200, { project }, 'Project updated'));
});

export const remove = asyncHandler(async (req, res) => {
  const result = await deleteProject(req.params.projectId, req.user._id);
  res.status(200).json(new ApiResponse(200, result, 'Project deleted'));
});
