import { Router } from 'express';
import Joi from 'joi';
import { getVoice, listByRoom, searchByRoom, uploadVoice } from '../controllers/chat.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { voiceNoteLimiter } from '../middlewares/rateLimit.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { uploadVoiceNote } from '../middlewares/voiceUpload.middleware.js';

const router = Router();
const objectId = Joi.string().hex().length(24);

const roomParamSchema = Joi.object({
  params: Joi.object({
    roomId: objectId.required()
  })
});

const voiceFileSchema = Joi.object({
  params: Joi.object({
    fileName: Joi.string().pattern(/^voice_[a-f\d]{24}_[a-f\d]{24}_\d+\.(webm|ogg|mp4)$/i).required()
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

router.get('/voice/:fileName', validate(voiceFileSchema), getVoice);
router.get('/room/:roomId/search', validate(searchSchema), searchByRoom);
router.post('/room/:roomId/voice', validate(roomParamSchema), voiceNoteLimiter, uploadVoiceNote, uploadVoice);
router.get('/room/:roomId', validate(roomParamSchema), listByRoom);

import { deleteMessage, editMessage } from '../controllers/chat.controller.js';

const messageIdSchema = Joi.object({
  params: Joi.object({
    messageId: objectId.required()
  })
});

router.patch('/messages/:messageId', validate(messageIdSchema), editMessage);
router.delete('/messages/:messageId', validate(messageIdSchema), deleteMessage);

export default router;

