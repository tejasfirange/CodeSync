import crypto from 'crypto';
import ChatMessage from '../models/ChatMessage.model.js';
import CodeFile from '../models/CodeFile.model.js';
import GitRepository from '../models/GitRepository.model.js';
import Project from '../models/Project.model.js';
import Room from '../models/Room.model.js';
import User from '../models/User.model.js';
import ApiError from '../utils/ApiError.js';
import idsEqual from '../utils/idsEqual.js';

const userSelect = 'name email avatarColor role';
const defaultRoomSettings = {
  allowEditorsToRunCode: false,
  allowViewersToRunCode: false,
  allowEditorsToManageFiles: true,
  allowViewersToChat: true,
  allowScreenShare: true,
  allowViewersToScreenShare: false
};
const getMemberUserId = (member) => member?.user || member?._id || member;
const getMemberJoinedAt = (member) => member?.joinedAt || null;
const getMemberRoleValue = (room, member, userId) => {
  if (idsEqual(room.owner, userId)) {
    return 'owner';
  }
  return member?.role || 'editor';
};
const memberQuery = (userId) => ({
  $or: [{ members: userId }, { 'members.user': userId }]
});

export const roomSettings = (room) => ({
  ...defaultRoomSettings,
  ...(room?.settings?.toObject ? room.settings.toObject() : room?.settings || {})
});

export const getRoomMemberRole = (room, userId) => {
  if (!room || !userId) {
    return null;
  }

  if (idsEqual(room.owner, userId)) {
    return 'owner';
  }

  const member = (room.members || []).find((entry) => idsEqual(getMemberUserId(entry), userId));
  return member ? getMemberRoleValue(room, member, userId) : null;
};

export const canManageRoom = (userId, room) => getRoomMemberRole(room, userId) === 'owner';
export const canEditRoom = (userId, room) => ['owner', 'editor'].includes(getRoomMemberRole(room, userId));
export const canManageFiles = (userId, room) => {
  const role = getRoomMemberRole(room, userId);
  return role === 'owner' || (role === 'editor' && roomSettings(room).allowEditorsToManageFiles);
};
export const canRunCode = (userId, room) => {
  const role = getRoomMemberRole(room, userId);
  const settings = roomSettings(room);
  return role === 'owner' || (role === 'editor' && settings.allowEditorsToRunCode) || (role === 'viewer' && settings.allowViewersToRunCode);
};
export const canChatInRoom = (userId, room) => {
  const role = getRoomMemberRole(room, userId);
  return role === 'owner' || role === 'editor' || (role === 'viewer' && roomSettings(room).allowViewersToChat);
};
export const canScreenShare = (userId, room) => {
  const role = getRoomMemberRole(room, userId);
  const settings = roomSettings(room);
  return role === 'owner' || (role === 'editor' && settings.allowScreenShare) || (role === 'viewer' && settings.allowViewersToScreenShare);
};

const populateRoom = async (room) => {
  if (!room) {
    return room;
  }

  const plain = room.toJSON ? room.toJSON() : room;
  const memberIds = (plain.members || []).map(getMemberUserId).filter(Boolean);
  const users = await User.find({ _id: { $in: [plain.owner, ...memberIds] } }).select(userSelect);
  const userMap = new Map(users.map((item) => [item._id.toString(), item.toJSON()]));
  const owner = userMap.get(plain.owner?.toString()) || plain.owner;

  return {
    ...plain,
    owner,
    settings: {
      ...defaultRoomSettings,
      ...(plain.settings || {})
    },
    members: memberIds.map((memberId) => {
      const rawMember = (plain.members || []).find((entry) => idsEqual(getMemberUserId(entry), memberId));
      const user = userMap.get(memberId.toString()) || { _id: memberId };
      return {
        ...user,
        user,
        _id: user._id,
        role: getMemberRoleValue(plain, rawMember, memberId),
        joinedAt: getMemberJoinedAt(rawMember)
      };
    })
  };
};

const generateRoomCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

export const createUniqueRoomCode = async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const roomCode = generateRoomCode();
    const existingRoom = await Room.exists({ roomCode });

    if (!existingRoom) {
      return roomCode;
    }
  }

  throw new ApiError(500, 'Could not generate a unique room code');
};

export const createRoom = async (payload, userId) => {
  const roomCode = await createUniqueRoomCode();
  const room = await Room.create({
    ...payload,
    roomCode,
    owner: userId,
    members: [{ user: userId, role: 'owner', joinedAt: new Date() }],
    settings: defaultRoomSettings
  });

  return populateRoom(await Room.findById(room._id));
};

export const listRoomsForUser = async (userId) => {
  const rooms = await Room.find(memberQuery(userId)).sort({ updatedAt: -1 });
  return Promise.all(rooms.map(populateRoom));
};

export const getRoomForUser = async (roomId, userId) => {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new ApiError(404, 'Room not found');
  }

  const isMember = room.members.some((member) => idsEqual(getMemberUserId(member), userId));
  if (room.isPrivate && !isMember) {
    throw new ApiError(403, 'You do not have access to this room');
  }

  return populateRoom(room);
};

export const assertRoomMember = async (roomId, userId) => {
  const room = await Room.findOne({ _id: roomId, ...memberQuery(userId) });
  if (!room) {
    throw new ApiError(403, 'You are not a member of this room');
  }

  return room;
};

export const assertRoomOwner = async (roomId, userId) => {
  const room = await assertRoomMember(roomId, userId);

  if (!idsEqual(room.owner, userId)) {
    throw new ApiError(403, 'Only the room host can use GitHub integration');
  }

  return room;
};

export const joinRoomByCode = async (roomCode, userId) => {
  const room = await Room.findOne({ roomCode: roomCode.toUpperCase() });
  if (!room) {
    throw new ApiError(404, 'Room code not found');
  }

  const isMember = room.members.some((member) => idsEqual(getMemberUserId(member), userId));
  if (!isMember) {
    room.members.push({ user: userId, role: 'editor', joinedAt: new Date() });
    await room.save();
  }

  return populateRoom(await Room.findById(room._id));
};

export const updateRoom = async (roomId, userId, payload) => {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new ApiError(404, 'Room not found');
  }

  if (!idsEqual(room.owner, userId)) {
    throw new ApiError(403, 'Only the room owner can update this room');
  }

  Object.assign(room, payload);
  await room.save();

  return populateRoom(await Room.findById(room._id));
};

export const updateRoomSettings = async (roomId, userId, settings) => {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new ApiError(404, 'Room not found');
  }
  if (!canManageRoom(userId, room)) {
    throw new ApiError(403, 'Only the room owner can change this setting.');
  }

  room.settings = { ...roomSettings(room), ...settings };
  await room.save();
  return populateRoom(room);
};

export const updateMemberRole = async (roomId, targetUserId, ownerId, role) => {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new ApiError(404, 'Room not found');
  }
  if (!canManageRoom(ownerId, room)) {
    throw new ApiError(403, 'Only the room owner can change this setting.');
  }

  const targetIndex = room.members.findIndex((member) => idsEqual(getMemberUserId(member), targetUserId));
  if (targetIndex === -1) {
    throw new ApiError(404, 'Room member not found');
  }

  const owners = room.members.filter((member) => getMemberRoleValue(room, member, getMemberUserId(member)) === 'owner');
  if (idsEqual(targetUserId, ownerId) && role !== 'owner' && owners.length <= 1) {
    throw new ApiError(400, 'There must always be at least one room owner.');
  }

  room.members[targetIndex] = {
    user: getMemberUserId(room.members[targetIndex]),
    role,
    joinedAt: getMemberJoinedAt(room.members[targetIndex]) || new Date()
  };
  room.markModified('members');

  if (role === 'owner') {
    room.owner = targetUserId;
  } else if (idsEqual(room.owner, targetUserId)) {
    const nextOwner = room.members.find((member) => !idsEqual(getMemberUserId(member), targetUserId) && member.role === 'owner');
    if (nextOwner) {
      room.owner = getMemberUserId(nextOwner);
    }
  }

  await room.save();
  return populateRoom(room);
};

export const deleteRoom = async (roomId, userId) => {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new ApiError(404, 'Room not found');
  }

  if (!idsEqual(room.owner, userId)) {
    throw new ApiError(403, 'You are not allowed to disband this room.');
  }

  const [filesCount, messagesCount, projectsCount, githubConnectionsCount] = await Promise.all([
    CodeFile.countDocuments({ room: roomId }),
    ChatMessage.countDocuments({ room: roomId }),
    Project.countDocuments({ room: roomId }),
    GitRepository.countDocuments({ room: roomId })
  ]);

  await Promise.all([
    CodeFile.deleteMany({ room: roomId }),
    ChatMessage.deleteMany({ room: roomId }),
    Project.deleteMany({ room: roomId }),
    GitRepository.deleteMany({ room: roomId })
  ]);

  const deletedRoom = {
    _id: room._id,
    name: room.name,
    roomCode: room.roomCode,
    owner: room.owner,
    members: room.members,
    deletedCounts: {
      files: filesCount,
      messages: messagesCount,
      projects: projectsCount,
      githubConnections: githubConnectionsCount
    }
  };

  await room.deleteOne();

  console.info('[room:disbanded]', {
    roomId: room._id.toString(),
    ownerId: userId.toString(),
    roomName: room.name,
    deletedAt: new Date().toISOString(),
    deletedCounts: deletedRoom.deletedCounts
  });

  return { deleted: true, room: deletedRoom };
};
