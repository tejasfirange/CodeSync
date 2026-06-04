import fs from 'fs';
import { createVoiceChatMessage, listRoomMessages, searchRoomMessages } from '../services/chat.service.js';
import { assertRoomMember } from '../services/room.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { getSafeVoicePath, removeUploadedVoiceFile } from '../middlewares/voiceUpload.middleware.js';

export const listByRoom = asyncHandler(async (req, res) => {
  const messages = await listRoomMessages(req.params.roomId, req.user._id);
  res.status(200).json(new ApiResponse(200, { messages }, 'Messages loaded'));
});

export const searchByRoom = asyncHandler(async (req, res) => {
  const result = await searchRoomMessages(req.params.roomId, req.user._id, req.query);
  res.status(200).json(new ApiResponse(200, result, 'Messages searched'));
});

export const uploadVoice = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'Voice note audio is required.');
  }

  try {
    const chatMessage = await createVoiceChatMessage(
      {
        roomId: req.params.roomId,
        fileName: req.file.filename,
        mimeType: req.file.mimetype.split(';')[0].trim(),
        duration: req.body.duration,
        size: req.file.size
      },
      req.user._id
    );

    req.app.get('io')?.to(req.params.roomId).emit('chat:new', {
      roomId: req.params.roomId,
      message: chatMessage
    });

    res.status(201).json(new ApiResponse(201, { message: chatMessage }, 'Voice note sent'));
  } catch (error) {
    removeUploadedVoiceFile(req.file);
    throw error;
  }
});

export const getVoice = asyncHandler(async (req, res) => {
  const filePath = getSafeVoicePath(req.params.fileName);
  const roomId = req.params.fileName.split('_')[1];
  await assertRoomMember(roomId, req.user._id);

  if (!fs.existsSync(filePath)) {
    throw new ApiError(404, 'Voice note not found.');
  }

  res.sendFile(filePath);
});

import ChatMessage from '../models/ChatMessage.model.js';
import Room from '../models/Room.model.js';
import idsEqual from '../utils/idsEqual.js';
import xss from 'xss';

export const editMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { message } = req.body;

  const chatMessage = await ChatMessage.findById(messageId);
  if (!chatMessage) {
    throw new ApiError(404, 'Message not found');
  }

  await assertRoomMember(chatMessage.room, req.user._id);

  if (!idsEqual(chatMessage.sender, req.user._id)) {
    throw new ApiError(403, 'You can only edit your own messages');
  }

  if (chatMessage.isDeleted) {
    throw new ApiError(400, 'Cannot edit a deleted message');
  }

  if (chatMessage.type === 'voice') {
    throw new ApiError(400, 'Voice notes cannot be edited');
  }

  const cleanMessage = xss((message || '').trim());
  if (!cleanMessage) {
    throw new ApiError(400, 'Message content cannot be empty');
  }

  if (cleanMessage.length > 2000) {
    throw new ApiError(400, 'Message cannot exceed 2000 characters');
  }

  chatMessage.message = cleanMessage;
  chatMessage.isEdited = true;
  chatMessage.editedAt = new Date();
  await chatMessage.save();

  req.app.get('io')?.to(chatMessage.room.toString()).emit('chat:message-edited', {
    messageId: chatMessage._id,
    message: chatMessage.message,
    isEdited: chatMessage.isEdited,
    editedAt: chatMessage.editedAt
  });

  res.status(200).json(new ApiResponse(200, { message: chatMessage }, 'Message updated successfully'));
});

export const deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const chatMessage = await ChatMessage.findById(messageId);
  if (!chatMessage) {
    throw new ApiError(404, 'Message not found');
  }

  const room = await Room.findById(chatMessage.room);
  if (!room) {
    throw new ApiError(404, 'Room not found');
  }

  await assertRoomMember(chatMessage.room, req.user._id);

  const isSender = idsEqual(chatMessage.sender, req.user._id);
  const isOwner = idsEqual(room.owner, req.user._id);

  if (!isSender && !isOwner) {
    throw new ApiError(403, 'You do not have permission to delete this message');
  }

  chatMessage.isDeleted = true;
  chatMessage.deletedAt = new Date();
  chatMessage.deletedBy = req.user._id;
  await chatMessage.save();

  req.app.get('io')?.to(chatMessage.room.toString()).emit('chat:message-deleted', {
    messageId: chatMessage._id,
    isDeleted: chatMessage.isDeleted,
    deletedAt: chatMessage.deletedAt
  });

  res.status(200).json(new ApiResponse(200, { message: chatMessage }, 'Message deleted successfully'));
});

