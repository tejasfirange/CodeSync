import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { corsOptions } from '../config/cors.js';
import { env } from '../config/env.js';
import User from '../models/User.model.js';
import registerChatSocket from './chat.socket.js';
import registerCodeSocket from './code.socket.js';
import registerCursorSocket from './cursor.socket.js';
import registerRoomSocket, { cleanupSocketRooms } from './room.socket.js';
import registerScreenSocket, { cleanupScreenShareForSocket } from './screen.socket.js';

const collaborationState = {
  rooms: new Map()
};

export const getRoomState = (roomId) => {
  const key = roomId.toString();

  if (!collaborationState.rooms.has(key)) {
    collaborationState.rooms.set(key, {
      users: new Map(),
      presence: new Map(),
      files: new Map(),
      typing: new Map()
    });
  }

  return collaborationState.rooms.get(key);
};

const parseCookies = (cookieHeader = '') =>
  cookieHeader.split(';').reduce((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName) {
      return cookies;
    }

    cookies[rawName] = decodeURIComponent(rawValue.join('='));
    return cookies;
  }, {});

const readSocketToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  const authorization = socket.handshake.headers.authorization;

  if (authToken) {
    return authToken;
  }

  if (authorization?.startsWith('Bearer ')) {
    return authorization.split(' ')[1];
  }

  const cookies = parseCookies(socket.handshake.headers.cookie);
  return cookies[env.cookieName];
};

const authenticateSocket = async (socket, next) => {
  try {
    const token = readSocketToken(socket);
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.id);
    if (!user) {
      next(new Error('User no longer exists'));
      return;
    }

    socket.user = user;
    socket.data.joinedRooms = new Set();
    next();
  } catch (error) {
    next(new Error('Session expired or invalid'));
  }
};

export const setupSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: corsOptions,
    pingTimeout: 30000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    registerRoomSocket(io, socket, getRoomState);
    registerCodeSocket(io, socket, getRoomState);
    registerCursorSocket(io, socket, getRoomState);
    registerChatSocket(io, socket, getRoomState);
    registerScreenSocket(io, socket);

    socket.on('disconnect', () => {
      cleanupScreenShareForSocket(io, socket);
      cleanupSocketRooms(io, socket, getRoomState);
    });
  });

  return io;
};
