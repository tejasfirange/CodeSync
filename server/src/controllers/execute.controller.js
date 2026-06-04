import { executeCode } from '../services/execute.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const runCode = asyncHandler(async (req, res) => {
  const result = await executeCode(req.body, req.user._id);
  res.status(200).json(new ApiResponse(200, result, 'Code executed'));
});
