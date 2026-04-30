import {
  createFile,
  deleteFile,
  getFileById,
  listFilesByProject,
  updateFile
} from '../services/file.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const create = asyncHandler(async (req, res) => {
  const file = await createFile(req.body, req.user._id);
  res.status(201).json(new ApiResponse(201, { file }, 'File created'));
});

export const listByProject = asyncHandler(async (req, res) => {
  const files = await listFilesByProject(req.params.projectId, req.user._id);
  res.status(200).json(new ApiResponse(200, { files }, 'Files loaded'));
});

export const getById = asyncHandler(async (req, res) => {
  const file = await getFileById(req.params.fileId, req.user._id);
  res.status(200).json(new ApiResponse(200, { file }, 'File loaded'));
});

export const update = asyncHandler(async (req, res) => {
  const file = await updateFile(req.params.fileId, req.user._id, req.body);
  res.status(200).json(new ApiResponse(200, { file }, 'File updated'));
});

export const remove = asyncHandler(async (req, res) => {
  const result = await deleteFile(req.params.fileId, req.user._id);
  res.status(200).json(new ApiResponse(200, result, 'File deleted'));
});
