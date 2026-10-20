import { Router } from 'express';
import Joi from 'joi';
import { generate } from '../controllers/ai.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { aiLimiter } from '../middlewares/rateLimit.middleware.js';
import validate from '../middlewares/validate.middleware.js';

const router = Router();
const objectId = Joi.string().hex().length(24);

const generateSchema = Joi.object({
  body: Joi.object({
    roomId: objectId.required(),
    projectId: objectId.required(),
    fileId: objectId.optional(),
    intent: Joi.string().trim().lowercase().valid('generate', 'explain', 'fix', 'review').required(),
    prompt: Joi.string().trim().min(1).max(4000).required(),
    selection: Joi.string().max(20000).allow('').optional()
  }).required()
});

router.use(protect);
router.post('/generate', aiLimiter, validate(generateSchema), generate);

export default router;
