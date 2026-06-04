import xss from 'xss';
import ChatMessage from '../models/ChatMessage.model.js';
import User from '../models/User.model.js';
import ApiError from '../utils/ApiError.js';
import { assertRoomMember, canChatInRoom } from './room.service.js';

const chatPopulate = [{ path: 'sender', select: 'name email avatarColor role' }];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const listRoomMessages = async (roomId, userId) => {
  await assertRoomMember(roomId, userId);

  return ChatMessage.find({ room: roomId }).sort({ createdAt: 1 }).limit(200).populate(chatPopulate);
};

export const searchRoomMessages = async (roomId, userId, { q = '', limit = 50, page = 1 } = {}) => {
  await assertRoomMember(roomId, userId);

  const cleanQuery = q.trim();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);

  if (cleanQuery.length < 2) {
    return {
      messages: [],
      total: 0,
      page: safePage,
      limit: safeLimit,
      hasMore: false
    };
  }

  const regex = new RegExp(escapeRegex(cleanQuery), 'i');
  const matchingUsers = await User.find({ name: regex }).select('_id').limit(100);
  const senderIds = matchingUsers.map((user) => user._id);
  const voiceQuery = /voice note/i.test(cleanQuery) ? [{ type: 'voice' }] : [];
  const query = {
    room: roomId,
    $or: [{ message: regex }, ...voiceQuery, ...(senderIds.length ? [{ sender: { $in: senderIds } }] : [])]
  };
  const skip = (safePage - 1) * safeLimit;

  const [messages, total] = await Promise.all([
    ChatMessage.find(query).sort({ createdAt: 1 }).skip(skip).limit(safeLimit).populate(chatPopulate),
    ChatMessage.countDocuments(query)
  ]);

  return {
    messages,
    total,
    page: safePage,
    limit: safeLimit,
    hasMore: skip + messages.length < total
  };
};

export const createChatMessage = async ({ roomId, message }, userId) => {
  const room = await assertRoomMember(roomId, userId);
  if (!canChatInRoom(userId, room)) {
    throw new ApiError(403, 'Chat is disabled by the room owner.');
  }

  const cleanMessage = xss(message.trim());
  if (!cleanMessage) {
    throw new ApiError(400, 'Message cannot be empty');
  }

  const chatMessage = await ChatMessage.create({
    room: roomId,
    sender: userId,
    type: 'text',
    message: cleanMessage
  });

  return ChatMessage.findById(chatMessage._id).populate(chatPopulate);
};

export const createVoiceChatMessage = async ({ roomId, fileName, mimeType, duration, size }, userId) => {
  const room = await assertRoomMember(roomId, userId);
  if (!canChatInRoom(userId, room)) {
    throw new ApiError(403, 'Chat is disabled for your role.');
  }

  const safeDuration = Number(duration);
  if (!Number.isFinite(safeDuration) || safeDuration <= 0 || safeDuration > 60) {
    throw new ApiError(400, 'Voice note duration must be 60 seconds or less.');
  }

  const chatMessage = await ChatMessage.create({
    room: roomId,
    sender: userId,
    type: 'voice',
    message: 'Voice note',
    voiceUrl: `/api/chat/voice/${fileName}`,
    voiceFileName: fileName,
    voiceMimeType: mimeType,
    voiceDuration: Math.ceil(safeDuration),
    voiceSize: size
  });

  return ChatMessage.findById(chatMessage._id).populate(chatPopulate);
};
