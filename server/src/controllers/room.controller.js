import {
  createRoom,
  deleteRoom,
  getRoomForUser,
  joinRoomByCode,
  listRoomsForUser,
  updateRoom
} from '../services/room.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const create = asyncHandler(async (req, res) => {
  const room = await createRoom(req.body, req.user._id);
  res.status(201).json(new ApiResponse(201, { room }, 'Room created'));
});

export const list = asyncHandler(async (req, res) => {
  const rooms = await listRoomsForUser(req.user._id);
  res.status(200).json(new ApiResponse(200, { rooms }, 'Rooms loaded'));
});

export const getById = asyncHandler(async (req, res) => {
  const room = await getRoomForUser(req.params.roomId, req.user._id);
  res.status(200).json(new ApiResponse(200, { room }, 'Room loaded'));
});

export const join = asyncHandler(async (req, res) => {
  const room = await joinRoomByCode(req.body.roomCode, req.user._id);
  res.status(200).json(new ApiResponse(200, { room }, 'Joined room'));
});

export const update = asyncHandler(async (req, res) => {
  const room = await updateRoom(req.params.roomId, req.user._id, req.body);
  res.status(200).json(new ApiResponse(200, { room }, 'Room updated'));
});

export const remove = asyncHandler(async (req, res) => {
  const result = await deleteRoom(req.params.roomId, req.user._id);
  const io = req.app.get('io');

  io?.to(req.params.roomId).emit('room:disbanded', {
    roomId: req.params.roomId,
    message: 'This room has been disbanded by the owner.'
  });

  res.status(200).json(new ApiResponse(200, result, 'Room disbanded successfully'));
});
