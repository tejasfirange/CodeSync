import { listRoomMessages, searchRoomMessages } from '../services/chat.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const listByRoom = asyncHandler(async (req, res) => {
  const messages = await listRoomMessages(req.params.roomId, req.user._id);
  res.status(200).json(new ApiResponse(200, { messages }, 'Messages loaded'));
});

export const searchByRoom = asyncHandler(async (req, res) => {
  const result = await searchRoomMessages(req.params.roomId, req.user._id, req.query);
  res.status(200).json(new ApiResponse(200, result, 'Messages searched'));
});
