import { Router } from 'express';
import Joi from 'joi';
import { create, getById, listByRoom, remove, update } from '../controllers/project.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';

const router = Router();
const objectId = Joi.string().hex().length(24);

const createProjectSchema = Joi.object({
  body: Joi.object({
    roomId: objectId.required(),
    title: Joi.string().trim().min(2).max(160).required(),
    description: Joi.string().trim().max(700).allow('').default('')
  })
});

const roomParamSchema = Joi.object({
  params: Joi.object({
    roomId: objectId.required()
  })
});

const projectParamSchema = Joi.object({
  params: Joi.object({
    projectId: objectId.required()
  })
});

const updateProjectSchema = Joi.object({
  params: Joi.object({
    projectId: objectId.required()
  }),
  body: Joi.object({
    title: Joi.string().trim().min(2).max(160),
    description: Joi.string().trim().max(700).allow('')
  }).min(1)
});

router.use(protect);
router.post('/', validate(createProjectSchema), create);
router.get('/room/:roomId', validate(roomParamSchema), listByRoom);
router.route('/:projectId').get(validate(projectParamSchema), getById).patch(validate(updateProjectSchema), update).delete(validate(projectParamSchema), remove);

export default router;
