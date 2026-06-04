import { Router } from 'express';
import Joi from 'joi';
import { analytics, create, getById, join, list, remove, update, updateRole, updateSettings } from '../controllers/room.controller.js';
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

const updateSettingsSchema = Joi.object({
  params: Joi.object({
    roomId: objectId.required()
  }),
  body: Joi.object({
    allowEditorsToRunCode: Joi.boolean(),
    allowViewersToRunCode: Joi.boolean(),
    allowEditorsToManageFiles: Joi.boolean(),
    allowViewersToChat: Joi.boolean(),
    allowScreenShare: Joi.boolean(),
    allowViewersToScreenShare: Joi.boolean()
  }).min(1)
});

const updateRoleSchema = Joi.object({
  params: Joi.object({
    roomId: objectId.required(),
    userId: objectId.required()
  }),
  body: Joi.object({
    role: Joi.string().valid('owner', 'editor', 'viewer').required()
  })
});

router.use(protect);
router.route('/').post(validate(createRoomSchema), create).get(list);
router.post('/join', validate(joinRoomSchema), join);
router.get('/:roomId/analytics', validate(roomIdSchema), analytics);
router.patch('/:roomId/settings', validate(updateSettingsSchema), updateSettings);
router.patch('/:roomId/members/:userId/role', validate(updateRoleSchema), updateRole);
router.route('/:roomId').get(validate(roomIdSchema), getById).patch(validate(updateRoomSchema), update).delete(validate(roomIdSchema), remove);

export default router;
