import { Router } from 'express';
import Joi from 'joi';
import { runCode } from '../controllers/execute.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { executeLimiter } from '../middlewares/rateLimit.middleware.js';
import validate from '../middlewares/validate.middleware.js';

const router = Router();
const objectId = Joi.string().hex().length(24);

const executeSchema = Joi.object({
  body: Joi.object({
    roomId: objectId.required(),
    projectId: objectId.required(),
    fileId: objectId.required(),
    language: Joi.string().trim().lowercase().valid('javascript', 'js', 'node', 'python', 'py', 'cpp', 'c++', 'cc', 'cxx', 'c').required(),
    code: Joi.string().max(200 * 1024).allow('').required(),
    stdin: Joi.string().max(20 * 1024).allow('').default('')
  })
});

router.use(protect);
router.post('/', executeLimiter, validate(executeSchema), runCode);

export default router;
