const isValidPosition = (position) =>
  Number.isInteger(position?.lineNumber) &&
  Number.isInteger(position?.column) &&
  position.lineNumber > 0 &&
  position.column > 0;

const registerCursorSocket = (io, socket, getRoomState) => {
  socket.on('cursor:move', (payload = {}, ack) => {
    const { roomId, fileId, position, selection } = payload;

    if (!roomId || !fileId || !socket.rooms.has(roomId) || !isValidPosition(position)) {
      ack?.({ success: false, message: 'Invalid cursor update' });
      return;
    }

    const roomState = getRoomState(roomId);
    const userEntry = roomState.users.get(socket.id);
    const userId = socket.user._id.toString();
    const presenceEntry = roomState.presence.get(userId);
    const cursor = {
      fileId,
      position,
      selection: selection || null,
      updatedAt: new Date().toISOString()
    };

    if (userEntry) {
      userEntry.cursor = cursor;
    }

    if (presenceEntry) {
      presenceEntry.cursor = cursor;
      presenceEntry.activeFileId = presenceEntry.activeFileId || fileId;
      presenceEntry.lastSeen = new Date().toISOString();
    } else {
      roomState.presence.set(userId, {
        userId,
        name: socket.user.name,
        email: socket.user.email,
        avatarColor: socket.user.avatarColor,
        activeFileId: fileId,
        activeFileName: null,
        activeFilePath: null,
        cursor,
        socketId: socket.id,
        lastSeen: new Date().toISOString()
      });
    }

    const update = {
      roomId,
      userId,
      name: socket.user.name,
      avatarColor: socket.user.avatarColor,
      fileId,
      position,
      selection: selection || null,
      user: {
        socketId: socket.id,
        _id: socket.user._id,
        userId,
        name: socket.user.name,
        email: socket.user.email,
        avatarColor: socket.user.avatarColor
      }
    };

    socket.to(roomId).emit('cursor:update', update);

    ack?.({ success: true });
  });
};

export default registerCursorSocket;
