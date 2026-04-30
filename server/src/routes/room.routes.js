import { Router } from 'express';
import Joi from 'joi';
import { create, getById, join, list, remove, update } from '../controllers/room.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';

const router = Router();
const objectId = Joi.string().hex().length(24);

const createRoomSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(120).required(),
    description: Joi.string().trim().max(500).allow('').default(''),
    isPrivate: Joi.boolean().default(false)
  })
});

const joinRoomSchema = Joi.object({
  body: Joi.object({
    roomCode: Joi.string().trim().alphanum().min(6).max(16).required()
  })
});

const roomIdSchema = Joi.object({
  params: Joi.object({
    roomId: objectId.required()
  })
});

const updateRoomSchema = Joi.object({
  params: Joi.object({
    roomId: objectId.required()
  }),
  body: Joi.object({
    name: Joi.string().trim().min(2).max(120),
    description: Joi.string().trim().max(500).allow(''),
    isPrivate: Joi.boolean()
  }).min(1)
});

router.use(protect);
router.route('/').post(validate(createRoomSchema), create).get(list);
router.post('/join', validate(joinRoomSchema), join);
router.route('/:roomId').get(validate(roomIdSchema), getById).patch(validate(updateRoomSchema), update).delete(validate(roomIdSchema), remove);

export default router;
