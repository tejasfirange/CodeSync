import xss from 'xss';
import ChatMessage from '../models/ChatMessage.model.js';
import User from '../models/User.model.js';
import ApiError from '../utils/ApiError.js';
import { assertRoomMember } from './room.service.js';

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
  const query = {
    room: roomId,
    $or: [{ message: regex }, ...(senderIds.length ? [{ sender: { $in: senderIds } }] : [])]
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
  await assertRoomMember(roomId, userId);

  const cleanMessage = xss(message.trim());
  if (!cleanMessage) {
    throw new ApiError(400, 'Message cannot be empty');
  }

  const chatMessage = await ChatMessage.create({
    room: roomId,
    sender: userId,
    message: cleanMessage
  });

  return ChatMessage.findById(chatMessage._id).populate(chatPopulate);
};
