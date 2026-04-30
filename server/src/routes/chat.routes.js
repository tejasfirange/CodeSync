import { Router } from 'express';
import Joi from 'joi';
import { listByRoom, searchByRoom } from '../controllers/chat.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';

const router = Router();
const objectId = Joi.string().hex().length(24);

const roomParamSchema = Joi.object({
  params: Joi.object({
    roomId: objectId.required()
  })
});

const searchSchema = Joi.object({
  params: Joi.object({
    roomId: objectId.required()
  }),
  query: Joi.object({
    q: Joi.string().trim().max(200).allow('').default(''),
    limit: Joi.number().integer().min(1).max(100).default(50),
    page: Joi.number().integer().min(1).default(1)
  })
});

router.use(protect);
router.get('/room/:roomId/search', validate(searchSchema), searchByRoom);
router.get('/room/:roomId', validate(roomParamSchema), listByRoom);

export default router;
