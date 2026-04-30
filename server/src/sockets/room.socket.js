import CodeFile from '../models/CodeFile.model.js';
import { assertRoomMember } from '../services/room.service.js';

const objectIdPattern = /^[a-f\d]{24}$/i;

const toSocketUser = (socket) => ({
  socketId: socket.id,
  _id: socket.user._id,
  userId: socket.user._id.toString(),
  name: socket.user.name,
  email: socket.user.email,
  avatarColor: socket.user.avatarColor
});

export const emitRoomUsers = (io, roomId, roomState) => {
  const users = Array.from(roomState.users.values()).map((entry) => ({
    ...entry.user,
    cursor: entry.cursor,
    joinedAt: entry.joinedAt
  }));

  io.to(roomId).emit('room:users', { roomId, users });
};

export const emitPresenceUsers = (io, roomId, roomState) => {
  const users = Array.from(roomState.presence.values()).map((entry) => ({
    userId: entry.userId,
    _id: entry.userId,
    socketId: entry.socketId,
    name: entry.name,
    email: entry.email,
    avatarColor: entry.avatarColor,
    activeFileId: entry.activeFileId || null,
    activeFileName: entry.activeFileName || null,
    activeFilePath: entry.activeFilePath || null,
    cursor: entry.cursor || null,
    lastSeen: entry.lastSeen,
    connected: true
  }));

  io.to(roomId).emit('presence:users-update', { roomId, users });
};

const upsertPresence = (roomState, socket, patch = {}) => {
  const userId = socket.user._id.toString();
  const current = roomState.presence.get(userId) || {};
  const next = {
    userId,
    name: socket.user.name,
    email: socket.user.email,
    avatarColor: socket.user.avatarColor,
    activeFileId: current.activeFileId || null,
    activeFileName: current.activeFileName || null,
    activeFilePath: current.activeFilePath || null,
    cursor: current.cursor || null,
    ...patch,
    socketId: socket.id,
    lastSeen: new Date().toISOString()
  };

  roomState.presence.set(userId, next);
  return next;
};

const hydrateFilesForJoin = async (roomId, roomState) => {
  const files = await CodeFile.find({ room: roomId }).sort({ filename: 1 }).populate({
    path: 'lastEditedBy',
    select: 'name email avatarColor role'
  });

  return files.map((file) => {
    const plainFile = file.toJSON();
    const liveFile = roomState.files.get(file._id.toString());

    return liveFile
      ? {
          ...plainFile,
          ...liveFile
        }
      : plainFile;
  });
};

const leaveRoom = (io, socket, roomId, getRoomState) => {
  const roomState = getRoomState(roomId);
  const userId = socket.user._id.toString();

  roomState.users.delete(socket.id);
  roomState.presence.delete(userId);
  roomState.typing.delete(socket.id);
  socket.leave(roomId);
  socket.data.joinedRooms?.delete(roomId);

  emitRoomUsers(io, roomId, roomState);
  emitPresenceUsers(io, roomId, roomState);
  socket.to(roomId).emit('room:user-left', { roomId, userId, socketId: socket.id });

  if (roomState.users.size === 0) {
    roomState.typing.clear();
    roomState.presence.clear();
  }
};

export const cleanupSocketRooms = (io, socket, getRoomState) => {
  const joinedRooms = Array.from(socket.data.joinedRooms || []);
  joinedRooms.forEach((roomId) => leaveRoom(io, socket, roomId, getRoomState));
};

const registerRoomSocket = (io, socket, getRoomState) => {
  socket.on('room:join', async ({ roomId } = {}, ack) => {
    try {
      if (!objectIdPattern.test(roomId || '')) {
        throw new Error('Invalid room id');
      }

      await assertRoomMember(roomId, socket.user._id);

      const roomState = getRoomState(roomId);
      socket.join(roomId);
      socket.data.joinedRooms.add(roomId);
      roomState.users.set(socket.id, {
        user: toSocketUser(socket),
        cursor: null,
        joinedAt: new Date().toISOString()
      });
      upsertPresence(roomState, socket);

      const files = await hydrateFilesForJoin(roomId, roomState);
      socket.emit('code:sync', {
        type: 'initial',
        roomId,
        files
      });

      emitRoomUsers(io, roomId, roomState);
      emitPresenceUsers(io, roomId, roomState);
      ack?.({ success: true });
    } catch (error) {
      ack?.({ success: false, message: error.message });
      socket.emit('socket:error', { message: error.message });
    }
  });

  socket.on('room:leave', ({ roomId } = {}, ack) => {
    if (roomId && socket.data.joinedRooms?.has(roomId)) {
      leaveRoom(io, socket, roomId, getRoomState);
    }

    ack?.({ success: true });
  });

  socket.on('presence:file-change', (payload = {}, ack) => {
    const { roomId, fileId, filePath, fileName } = payload;

    if (!roomId || !socket.rooms.has(roomId)) {
      ack?.({ success: false, message: 'Join the room before updating presence' });
      return;
    }

    const roomState = getRoomState(roomId);
    const activeFileId = fileId || null;
    const currentPresence = roomState.presence.get(socket.user._id.toString());
    upsertPresence(roomState, socket, {
      activeFileId,
      activeFileName: fileName || null,
      activeFilePath: filePath || null,
      cursor: activeFileId && currentPresence?.activeFileId === activeFileId ? currentPresence.cursor || null : null
    });

    const legacyUser = roomState.users.get(socket.id);
    if (legacyUser && (!activeFileId || currentPresence?.activeFileId !== activeFileId)) {
      legacyUser.cursor = null;
    }

    emitPresenceUsers(io, roomId, roomState);
    ack?.({ success: true });
  });
};

export default registerRoomSocket;
