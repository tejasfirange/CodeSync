import mongoose from 'mongoose';
import ChatMessage from '../models/ChatMessage.model.js';
import CodeFile from '../models/CodeFile.model.js';
import ExecutionLog from '../models/ExecutionLog.model.js';
import GitRepository from '../models/GitRepository.model.js';
import Room from '../models/Room.model.js';
import ApiError from '../utils/ApiError.js';
import { assertRoomMember, getRoomMemberRole } from './room.service.js';

const cache = new Map();
const CACHE_TTL_MS = 30 * 1000;
const objectId = (value) => new mongoose.Types.ObjectId(value.toString());
const getCount = (items, key, fallback = 0) => items.find((item) => item._id === key)?.count || fallback;
const toMapObject = (items) =>
  items.reduce((acc, item) => {
    acc[item._id || 'unknown'] = item.count;
    return acc;
  }, {});

const mostFrequentUser = async (model, roomId, userField) => {
  const [top] = await model.aggregate([
    { $match: { room: roomId } },
    { $group: { _id: `$${userField}`, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 1 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $project: { count: 1, user: { _id: '$user._id', name: '$user.name', email: '$user.email', avatarColor: '$user.avatarColor' } } }
  ]);

  return top ? { user: top.user || null, count: top.count } : null;
};

export const getRoomAnalytics = async (roomId, userId) => {
  const room = await assertRoomMember(roomId, userId);
  const role = getRoomMemberRole(room, userId);
  if (!role) {
    throw new ApiError(403, 'You do not have access to this room');
  }

  const cacheKey = `${roomId}:${role}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const roomObjectId = objectId(roomId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalFiles,
    totalMessages,
    totalExecutions,
    githubRepository,
    fileLanguages,
    lineStats,
    recentlyEdited,
    mostEdited,
    messagesToday,
    recentMessagesCount,
    chatTopUser,
    executionStatuses,
    executionLanguages,
    executionTopUser,
    lastFile,
    lastMessage,
    lastExecution
  ] = await Promise.all([
    CodeFile.countDocuments({ room: roomObjectId }),
    ChatMessage.countDocuments({ room: roomObjectId }),
    ExecutionLog.countDocuments({ room: roomObjectId }),
    GitRepository.findOne({ room: roomObjectId }).sort({ connectedAt: -1 }).lean(),
    CodeFile.aggregate([{ $match: { room: roomObjectId } }, { $group: { _id: '$language', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    CodeFile.aggregate([
      { $match: { room: roomObjectId } },
      { $project: { lines: { $size: { $split: [{ $ifNull: ['$content', ''] }, '\n'] } } } },
      { $group: { _id: null, totalLines: { $sum: '$lines' } } }
    ]),
    CodeFile.find({ room: roomObjectId }).sort({ updatedAt: -1 }).limit(5).select('filename path language updatedAt lastEditedAt editCount').lean(),
    CodeFile.find({ room: roomObjectId }).sort({ editCount: -1, updatedAt: -1 }).limit(5).select('filename path language updatedAt editCount').lean(),
    ChatMessage.countDocuments({ room: roomObjectId, createdAt: { $gte: today } }),
    ChatMessage.countDocuments({ room: roomObjectId, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    mostFrequentUser(ChatMessage, roomObjectId, 'sender'),
    ExecutionLog.aggregate([{ $match: { room: roomObjectId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ExecutionLog.aggregate([{ $match: { room: roomObjectId } }, { $group: { _id: '$language', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    mostFrequentUser(ExecutionLog, roomObjectId, 'user'),
    CodeFile.findOne({ room: roomObjectId }).sort({ updatedAt: -1 }).select('updatedAt').lean(),
    ChatMessage.findOne({ room: roomObjectId }).sort({ createdAt: -1 }).select('createdAt').lean(),
    ExecutionLog.findOne({ room: roomObjectId }).sort({ createdAt: -1 }).select('createdAt').lean()
  ]);

  const roleBreakdown = (room.members || []).reduce((acc, member) => {
    const memberRole = member.role || 'editor';
    acc[memberRole] = (acc[memberRole] || 0) + 1;
    return acc;
  }, {});
  const lastActivityAt = [lastFile?.updatedAt, lastMessage?.createdAt, lastExecution?.createdAt, githubRepository?.lastSyncAt]
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] || null;
  const executionByLanguage = toMapObject(executionLanguages);
  const mostExecutedLanguage = executionLanguages[0]?._id || null;

  const data = {
    overview: {
      totalMembers: room.members?.length || 0,
      totalFiles,
      totalMessages,
      totalExecutions,
      lastActivityAt,
      githubConnected: Boolean(githubRepository)
    },
    members: {
      activeNow: 0,
      mostActiveUser: executionTopUser || chatTopUser,
      roleBreakdown
    },
    files: {
      total: totalFiles,
      totalLines: lineStats[0]?.totalLines || 0,
      byLanguage: toMapObject(fileLanguages),
      recentlyEdited,
      mostEdited
    },
    chat: {
      totalMessages,
      messagesToday,
      mostActiveUser: chatTopUser,
      recentMessagesCount
    },
    executions: {
      total: totalExecutions,
      success: getCount(executionStatuses, 'success'),
      failed: getCount(executionStatuses, 'error'),
      timeout: getCount(executionStatuses, 'timeout'),
      byLanguage: executionByLanguage,
      mostExecutedLanguage
    },
    github: {
      connected: Boolean(githubRepository),
      repoName: githubRepository?.fullName || null,
      branch: githubRepository?.selectedBranch || null,
      lastPullAt: githubRepository?.lastPullAt || null,
      lastPushAt: githubRepository?.lastPushAt || null,
      lastSyncAt: githubRepository?.lastSyncAt || null
    }
  };

  cache.set(cacheKey, { createdAt: Date.now(), data });
  return data;
};
