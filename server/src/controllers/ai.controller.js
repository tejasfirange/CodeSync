import { generateAiResponse } from '../services/ai.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const generate = asyncHandler(async (req, res) => {
  const result = await generateAiResponse(req.body, req.user._id);
  res.status(200).json(new ApiResponse(200, result, 'AI response generated'));
});
