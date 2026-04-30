import { Router } from 'express';
import Joi from 'joi';
import {
  connectProjectRepo,
  deleteAccount,
  deleteRepository,
  getAccount,
  getBranches,
  getRepositoryChangePreview,
  getProjectRepository,
  getRepos,
  oauthCallback,
  oauthStart,
  pullRepository,
  pushRepository
} from '../controllers/github.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { githubLimiter } from '../middlewares/rateLimit.middleware.js';
import validate from '../middlewares/validate.middleware.js';

const router = Router();
const objectId = Joi.string().hex().length(24);

const ownerName = Joi.string().trim().min(1).max(120).pattern(/^[A-Za-z0-9_.-]+$/);
const repoName = Joi.string().trim().min(1).max(120).pattern(/^[A-Za-z0-9_.-]+$/);
const branch = Joi.string().trim().min(1).max(160).pattern(/^[A-Za-z0-9._\-/]+$/);
const repoPath = Joi.string()
  .trim()
  .min(1)
  .max(180)
  .pattern(/^(?!.*\.\.)(?![\\/])[A-Za-z0-9._\-/ ]+$/)
  .messages({
    'string.pattern.base': 'File path contains invalid path characters'
  });

const reposQuerySchema = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    perPage: Joi.number().integer().min(1).max(100).default(30),
    search: Joi.string().trim().max(120).allow('').default(''),
    visibility: Joi.string().valid('all', 'public', 'private').default('all')
  })
});

const branchParamSchema = Joi.object({
  params: Joi.object({
    owner: ownerName.required(),
    repo: repoName.required()
  })
});

const projectParamSchema = Joi.object({
  params: Joi.object({
    projectId: objectId.required()
  })
});

const repositoryParamSchema = Joi.object({
  params: Joi.object({
    id: objectId.required()
  })
});

const connectRepoSchema = Joi.object({
  params: Joi.object({
    projectId: objectId.required()
  }),
  body: Joi.object({
    owner: ownerName.required(),
    repo: repoName.required(),
    branch: branch.required()
  })
});

const pullSchema = Joi.object({
  params: Joi.object({
    id: objectId.required()
  }),
  body: Joi.object({
    selectedPaths: Joi.array().items(repoPath).max(100).default([])
  })
});

const pushSchema = Joi.object({
  params: Joi.object({
    id: objectId.required()
  }),
  body: Joi.object({
    fileIds: Joi.array().items(objectId).max(100).default([]),
    files: Joi.array()
      .items(
        Joi.object({
          fileId: objectId.required(),
          path: repoPath.required()
        })
      )
      .max(100)
      .default([]),
    commitMessage: Joi.string().trim().min(3).max(180).required()
  })
});

router.use(githubLimiter);

router.get('/oauth/callback', oauthCallback);

router.use(protect);

router.get('/oauth/start', oauthStart);
router.get('/account', getAccount);
router.delete('/account/disconnect', deleteAccount);

router.get('/repos', validate(reposQuerySchema), getRepos);
router.get('/repos/:owner/:repo/branches', validate(branchParamSchema), getBranches);

router.post('/projects/:projectId/connect-repo', validate(connectRepoSchema), connectProjectRepo);
router.get('/project/:projectId', validate(projectParamSchema), getProjectRepository);
router.delete('/repositories/:id/disconnect', validate(repositoryParamSchema), deleteRepository);

router.get('/repositories/:id/changes', validate(repositoryParamSchema), getRepositoryChangePreview);
router.post('/repositories/:id/pull', validate(pullSchema), pullRepository);
router.post('/repositories/:id/push', validate(pushSchema), pushRepository);

export default router;
