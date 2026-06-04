import { assertRoomMember, canScreenShare } from '../services/room.service.js';

const roomScreenShare = new Map();

const isJoinedToRoom = (socket, roomId) => Boolean(roomId && socket.rooms.has(roomId));

const emitActiveShare = (io, roomId) => {
  io.to(roomId).emit('screen:active', {
    roomId,
    activeShare: roomScreenShare.get(roomId) || null
  });
};

const stopActiveShare = (io, socket, roomId) => {
  const activeShare = roomScreenShare.get(roomId);
  if (!activeShare || activeShare.sharerSocketId !== socket.id) {
    return false;
  }

  roomScreenShare.delete(roomId);
  io.to(roomId).emit('screen:stop', { roomId, activeShare });
  emitActiveShare(io, roomId);
  return true;
};

export const emitScreenShareForSocket = (socket, roomId) => {
  socket.emit('screen:active', {
    roomId,
    activeShare: roomScreenShare.get(roomId) || null
  });
};

export const cleanupScreenShareForSocket = (io, socket, roomId) => {
  if (roomId) {
    stopActiveShare(io, socket, roomId);
    return;
  }

  Array.from(roomScreenShare.entries()).forEach(([activeRoomId, activeShare]) => {
    if (activeShare.sharerSocketId === socket.id) {
      roomScreenShare.delete(activeRoomId);
      io.to(activeRoomId).emit('screen:stop', { roomId: activeRoomId, activeShare });
      emitActiveShare(io, activeRoomId);
    }
  });
};

const relayToSocket = (io, socket, eventName, payload = {}) => {
  const { roomId, to } = payload;
  if (!to || !isJoinedToRoom(socket, roomId)) {
    return;
  }

  const activeShare = roomScreenShare.get(roomId);
  if (!activeShare) {
    return;
  }

  const fromSharer = socket.id === activeShare.sharerSocketId;
  const toSharer = to === activeShare.sharerSocketId;
  if (!fromSharer && !toSharer) {
    return;
  }

  io.to(to).emit(eventName, {
    ...payload,
    from: socket.id,
    fromUserId: socket.user._id.toString(),
    fromName: socket.user.name
  });
};

const registerScreenSocket = (io, socket) => {
  socket.on('screen:start', async ({ roomId } = {}, ack) => {
    try {
      if (!isJoinedToRoom(socket, roomId)) {
        throw new Error('Join the room before sharing your screen.');
      }

      const room = await assertRoomMember(roomId, socket.user._id);
      if (!canScreenShare(socket.user._id, room)) {
        socket.emit('permission:error', { message: 'Screen sharing is disabled by the room owner.' });
        ack?.({ success: false, message: 'Screen sharing is disabled by the room owner.' });
        return;
      }

      const activeShare = roomScreenShare.get(roomId);
      if (activeShare && activeShare.sharerSocketId !== socket.id) {
        ack?.({
          success: false,
          message: `${activeShare.sharerName} is currently sharing their screen.`,
          activeShare
        });
        emitActiveShare(io, roomId);
        return;
      }

      const nextShare = {
        sharerUserId: socket.user._id.toString(),
        sharerSocketId: socket.id,
        sharerName: socket.user.name,
        startedAt: new Date().toISOString()
      };

      roomScreenShare.set(roomId, nextShare);
      emitActiveShare(io, roomId);
      ack?.({ success: true, activeShare: nextShare });
    } catch (error) {
      ack?.({ success: false, message: error.message });
      socket.emit('socket:error', { message: error.message });
    }
  });

  socket.on('screen:stop', ({ roomId } = {}, ack) => {
    const stopped = isJoinedToRoom(socket, roomId) ? stopActiveShare(io, socket, roomId) : false;
    ack?.({ success: true, stopped });
  });

  socket.on('screen:user-joined-viewer', (payload = {}) => {
    const { roomId } = payload;
    const activeShare = roomScreenShare.get(roomId);
    if (!activeShare || activeShare.sharerSocketId === socket.id || !isJoinedToRoom(socket, roomId)) {
      return;
    }

    io.to(activeShare.sharerSocketId).emit('screen:user-joined-viewer', {
      roomId,
      viewerSocketId: socket.id,
      viewerUserId: socket.user._id.toString(),
      viewerName: socket.user.name
    });
  });

  socket.on('screen:user-left-viewer', (payload = {}) => {
    const { roomId } = payload;
    const activeShare = roomScreenShare.get(roomId);
    if (!activeShare || activeShare.sharerSocketId === socket.id) {
      return;
    }

    io.to(activeShare.sharerSocketId).emit('screen:user-left-viewer', {
      roomId,
      viewerSocketId: socket.id,
      viewerUserId: socket.user._id.toString()
    });
  });

  socket.on('webrtc:offer', (payload = {}) => relayToSocket(io, socket, 'webrtc:offer', payload));
  socket.on('webrtc:answer', (payload = {}) => relayToSocket(io, socket, 'webrtc:answer', payload));
  socket.on('webrtc:ice-candidate', (payload = {}) => relayToSocket(io, socket, 'webrtc:ice-candidate', payload));
};

export default registerScreenSocket;
