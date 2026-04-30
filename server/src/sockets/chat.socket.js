import { createChatMessage } from '../services/chat.service.js';

const registerChatSocket = (io, socket, getRoomState) => {
  socket.on('chat:send', async (payload = {}, ack) => {
    const { roomId, message } = payload;

    try {
      if (!roomId || !socket.rooms.has(roomId)) {
        throw new Error('Join the room before sending messages');
      }

      const chatMessage = await createChatMessage({ roomId, message }, socket.user._id);
      io.to(roomId).emit('chat:new', {
        roomId,
        message: chatMessage
      });

      ack?.({ success: true });
    } catch (error) {
      ack?.({ success: false, message: error.message });
      socket.emit('socket:error', { message: error.message });
    }
  });

  socket.on('typing:start', ({ roomId } = {}) => {
    if (!roomId || !socket.rooms.has(roomId)) {
      return;
    }

    const roomState = getRoomState(roomId);
    roomState.typing.set(socket.id, {
      _id: socket.user._id,
      name: socket.user.name,
      avatarColor: socket.user.avatarColor
    });

    socket.to(roomId).emit('typing:start', {
      roomId,
      user: roomState.typing.get(socket.id)
    });
  });

  socket.on('typing:stop', ({ roomId } = {}) => {
    if (!roomId || !socket.rooms.has(roomId)) {
      return;
    }

    const roomState = getRoomState(roomId);
    roomState.typing.delete(socket.id);

    socket.to(roomId).emit('typing:stop', {
      roomId,
      user: {
        _id: socket.user._id,
        name: socket.user.name,
        avatarColor: socket.user.avatarColor
      }
    });
  });
};

export default registerChatSocket;
