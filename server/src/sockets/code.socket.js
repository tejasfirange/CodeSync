import CodeFile from '../models/CodeFile.model.js';
import { assertRoomMember, canEditRoom, canManageFiles } from '../services/room.service.js';

const metadataFields = ['filename', 'path', 'language'];

export const getCodeMutationIntent = (payload = {}, file = {}) => ({
  deleted: Boolean(payload.deleted),
  metadataChanged: metadataFields.some((field) => payload[field] !== undefined && payload[field] !== file[field]),
  content: typeof payload.content === 'string' ? payload.content : file.content || ''
});

const registerCodeSocket = (io, socket, getRoomState) => {
  socket.on('code:change', async (payload = {}, ack) => {
    const { roomId, fileId, version } = payload;

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

      const file = await CodeFile.findOne({ _id: fileId, room: roomId }).lean();
      if (!file) {
        ack?.({ success: false, message: 'File not found in this room' });
        return;
      }

      const mutation = getCodeMutationIntent(payload, file);
      if ((mutation.deleted || mutation.metadataChanged) && !canManageFiles(socket.user._id, room)) {
        const message = 'You do not have permission to manage files in this room.';
        ack?.({ success: false, message });
        socket.emit('permission:error', { roomId, message });
        return;
      }

      const roomState = getRoomState(roomId);
      const incomingVersion = Number.isFinite(version) ? version : Date.now();
      const liveFile = roomState.files.get(fileId);
      if (liveFile && Number.isFinite(liveFile.version) && incomingVersion < liveFile.version) {
        ack?.({ success: true, ignored: true });
        return;
      }
      const nextFileState = {
        _id: fileId,
        fileId,
        filename: file.filename,
        path: file.path || file.filename,
        project: file.project,
        content: mutation.content,
        language: file.language,
        version: incomingVersion,
        deleted: mutation.deleted,
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
