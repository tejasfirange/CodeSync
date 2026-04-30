const registerCodeSocket = (io, socket, getRoomState) => {
  socket.on('code:change', (payload = {}, ack) => {
    const { roomId, fileId, filename, path, project, content, language, version, deleted } = payload;

    if (!roomId || !fileId || !socket.rooms.has(roomId)) {
      ack?.({ success: false, message: 'Join the room before syncing code' });
      return;
    }

    const roomState = getRoomState(roomId);
    const nextFileState = {
      _id: fileId,
      fileId,
      filename,
      path,
      project,
      content: typeof content === 'string' ? content : '',
      language,
      version: Number.isFinite(version) ? version : Date.now(),
      deleted: Boolean(deleted),
      updatedAt: new Date().toISOString(),
      lastEditedBy: {
        _id: socket.user._id,
        name: socket.user.name,
        email: socket.user.email,
        avatarColor: socket.user.avatarColor
      }
    };

    roomState.files.set(fileId, nextFileState);

    socket.to(roomId).emit('code:sync', {
      type: 'change',
      roomId,
      ...nextFileState
    });

    ack?.({ success: true });
  });
};

export default registerCodeSocket;
