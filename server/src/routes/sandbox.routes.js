import { Router } from 'express';
import Joi from 'joi';
import { installPackage, listPackages, parseCommand, removePackage } from '../controllers/sandbox.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { executeLimiter } from '../middlewares/rateLimit.middleware.js';
import validate from '../middlewares/validate.middleware.js';

const router = Router();
const objectId = Joi.string().hex().length(24);

const installPackageSchema = Joi.object({
  body: Joi.object({
    roomId: objectId.required(),
    projectId: objectId.required(),
    language: Joi.string().valid('python', 'py', 'javascript', 'js', 'node').required(),
    packageName: Joi.string().trim().min(1).max(80).required()
  })
});

const projectParamSchema = Joi.object({
  params: Joi.object({
    projectId: objectId.required()
  })
});

const dependencyParamSchema = Joi.object({
  params: Joi.object({
    dependencyId: objectId.required()
  })
});

const parseCommandSchema = Joi.object({
  body: Joi.object({
    command: Joi.string().trim().min(1).max(180).required()
  })
});

router.use(protect);
router.get('/packages/:projectId', validate(projectParamSchema), listPackages);
router.post('/packages/install', executeLimiter, validate(installPackageSchema), installPackage);
router.post('/commands/parse', validate(parseCommandSchema), parseCommand);
router.delete('/packages/:dependencyId', validate(dependencyParamSchema), removePackage);

export default router;
