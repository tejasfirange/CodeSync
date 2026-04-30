import crypto from 'crypto';
import ChatMessage from '../models/ChatMessage.model.js';
import CodeFile from '../models/CodeFile.model.js';
import GitRepository from '../models/GitRepository.model.js';
import Project from '../models/Project.model.js';
import Room from '../models/Room.model.js';
import ApiError from '../utils/ApiError.js';
import idsEqual from '../utils/idsEqual.js';

const roomPopulate = [
  { path: 'owner', select: 'name email avatarColor role' },
  { path: 'members', select: 'name email avatarColor role' }
];

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
    members: [userId]
  });

  return Room.findById(room._id).populate(roomPopulate);
};

export const listRoomsForUser = (userId) =>
  Room.find({ members: userId }).sort({ updatedAt: -1 }).populate(roomPopulate);

export const getRoomForUser = async (roomId, userId) => {
  const room = await Room.findById(roomId).populate(roomPopulate);
  if (!room) {
    throw new ApiError(404, 'Room not found');
  }

  const isMember = room.members.some((member) => idsEqual(member._id, userId));
  if (room.isPrivate && !isMember) {
    throw new ApiError(403, 'You do not have access to this room');
  }

  return room;
};

export const assertRoomMember = async (roomId, userId) => {
  const room = await Room.findOne({ _id: roomId, members: userId });
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

  const isMember = room.members.some((memberId) => idsEqual(memberId, userId));
  if (!isMember) {
    room.members.push(userId);
    await room.save();
  }

  return Room.findById(room._id).populate(roomPopulate);
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

  return Room.findById(room._id).populate(roomPopulate);
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
