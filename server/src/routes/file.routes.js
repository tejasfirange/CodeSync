import { Router } from 'express';
import Joi from 'joi';
import { create, getById, listByProject, remove, update } from '../controllers/file.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';

const router = Router();
const objectId = Joi.string().hex().length(24);

const filename = Joi.string()
  .trim()
  .min(1)
  .max(180)
  .pattern(/^(?!.*\.\.)(?![\\/])[A-Za-z0-9._\-/ ]+$/)
  .messages({
    'string.pattern.base': 'Filename contains invalid path characters'
  });
const filePath = filename;

const language = Joi.string().trim().lowercase().min(1).max(40);

const createFileSchema = Joi.object({
  body: Joi.object({
    projectId: objectId.required(),
    filename: filename.required(),
    path: filePath.optional(),
    language: language.default('javascript'),
    content: Joi.string().max(1000000).allow('').default('')
  })
});

const projectParamSchema = Joi.object({
  params: Joi.object({
    projectId: objectId.required()
  })
});

const fileParamSchema = Joi.object({
  params: Joi.object({
    fileId: objectId.required()
  })
});

const updateFileSchema = Joi.object({
  params: Joi.object({
    fileId: objectId.required()
  }),
  body: Joi.object({
    filename,
    path: filePath,
    language,
    content: Joi.string().max(1000000).allow('')
  }).min(1)
});

router.use(protect);
router.post('/', validate(createFileSchema), create);
router.get('/project/:projectId', validate(projectParamSchema), listByProject);
router.route('/:fileId').get(validate(fileParamSchema), getById).patch(validate(updateFileSchema), update).delete(validate(fileParamSchema), remove);

export default router;
