import { installProjectDependency, listProjectDependencies, removeProjectDependency } from '../services/sandboxPackage.service.js';
import { parseSandboxCommand } from '../services/sandboxCommand.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const listPackages = asyncHandler(async (req, res) => {
  const dependencies = await listProjectDependencies(req.params.projectId, req.user._id);
  res.status(200).json(new ApiResponse(200, { dependencies }, 'Sandbox packages loaded'));
});

export const installPackage = asyncHandler(async (req, res) => {
  const result = await installProjectDependency(req.body, req.user._id);
  res.status(200).json(new ApiResponse(200, result, 'Sandbox package install finished'));
});

export const removePackage = asyncHandler(async (req, res) => {
  const result = await removeProjectDependency(req.params.dependencyId, req.user._id);
  res.status(200).json(new ApiResponse(200, result, 'Sandbox package removed'));
});

export const parseCommand = asyncHandler(async (req, res) => {
  const result = parseSandboxCommand(req.body.command);
  res.status(200).json(new ApiResponse(200, result, 'Sandbox command parsed'));
});
