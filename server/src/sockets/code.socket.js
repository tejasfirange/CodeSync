import { assertRoomMember, canEditRoom } from '../services/room.service.js';

const registerCodeSocket = (io, socket, getRoomState) => {
  socket.on('code:change', async (payload = {}, ack) => {
    const { roomId, fileId, filename, path, project, content, language, version, deleted } = payload;

    try {
      if (!roomId || !fileId || !socket.rooms.has(roomId)) {
        ack?.({ success: false, message: 'Join the room before syncing code' });
        return;
      }

      const room = await assertRoomMember(roomId, socket.user._id);
      if (!canEditRoom(socket.user._id, room)) {
        const message = 'You have view-only access in this room.';
        ack?.({ success: false, message });
        socket.emit('permission:error', { roomId, message });
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
    } catch (error) {
      ack?.({ success: false, message: error.message });
      socket.emit('permission:error', { roomId, message: error.message });
    }
  });
};

export default registerCodeSocket;
