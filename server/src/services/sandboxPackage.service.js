import { spawn } from 'child_process';
import { mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import ProjectDependency from '../models/ProjectDependency.model.js';
import Project from '../models/Project.model.js';
import ApiError from '../utils/ApiError.js';
import idsEqual from '../utils/idsEqual.js';
import { assertRoomMember, canRunCode } from './room.service.js';
import { checkDockerAvailable } from './execute.service.js';

const MAX_DEPENDENCIES_PER_LANGUAGE = 20;
const PACKAGE_INSTALL_TIMEOUT_MS = 30000;
const OUTPUT_LIMIT = 64 * 1024;
const SAFE_PYTHON_PACKAGE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,78}(==[A-Za-z0-9][A-Za-z0-9._!*+-]{0,38})?$/;
const SAFE_NODE_PACKAGE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,78}(@[A-Za-z0-9][A-Za-z0-9._-]{0,38})?$/;
const UNSAFE_PACKAGE_PATTERN = /(\s|;|&|\||\$|`|<|>|\(|\)|\{|\}|\[|\]|\/|\\|:|http|git\+|\.\.)/i;

const truncateOutput = (value) => (value.length > OUTPUT_LIMIT ? `${value.slice(0, OUTPUT_LIMIT)}\n[output truncated]` : value);

const runProcess = (command, args, { timeoutMs = PACKAGE_INSTALL_TIMEOUT_MS } = {}) =>
  new Promise((resolve) => {
    const startedAt = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const child = spawn(command, args, {
      windowsHide: true,
      shell: false
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout = truncateOutput(stdout + chunk.toString());
    });

    child.stderr.on('data', (chunk) => {
      stderr = truncateOutput(stderr + chunk.toString());
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        status: 'error',
        stdout,
        stderr: error.message,
        exitCode: null,
        executionTimeMs: Date.now() - startedAt
      });
    });

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({
        status: timedOut ? 'timeout' : exitCode === 0 ? 'success' : 'error',
        stdout,
        stderr: timedOut ? `${stderr}\nPackage install timed out after ${timeoutMs / 1000} seconds.`.trim() : stderr,
        exitCode,
        executionTimeMs: Date.now() - startedAt
      });
    });
  });

export const normalizeSandboxLanguage = (language) => {
  const value = String(language || '').toLowerCase();
  if (['py', 'python'].includes(value)) {
    return 'python';
  }
  if (['js', 'node', 'javascript'].includes(value)) {
    return 'javascript';
  }
  return value;
};

export const validatePythonPackageName = (packageName) => {
  const normalized = String(packageName || '').trim();
  if (!normalized || normalized.length > 80 || UNSAFE_PACKAGE_PATTERN.test(normalized) || !SAFE_PYTHON_PACKAGE.test(normalized)) {
    throw new ApiError(400, 'Package name is not allowed in the sandbox.');
  }
  return normalized;
};

export const validateNodePackageName = (packageName) => {
  const normalized = String(packageName || '').trim();
  if (!normalized || normalized.length > 80 || UNSAFE_PACKAGE_PATTERN.test(normalized) || !SAFE_NODE_PACKAGE.test(normalized)) {
    throw new ApiError(400, 'Package name is not allowed in the sandbox.');
  }
  return normalized;
};

const assertProjectSandboxAccess = async ({ roomId, projectId }, userId) => {
  const project = await Project.findById(projectId);
  if (!project || (roomId && !idsEqual(project.room, roomId))) {
    throw new ApiError(404, 'Project not found');
  }

  const room = await assertRoomMember(project.room, userId);
  if (!canRunCode(userId, room)) {
    throw new ApiError(403, 'Terminal access is disabled by the room owner.');
  }

  return { project, roomId: String(project.room) };
};

export const listProjectDependencies = async (projectId, userId) => {
  await assertProjectSandboxAccess({ projectId }, userId);
  return ProjectDependency.find({ project: projectId }).sort({ language: 1, packageName: 1 }).populate('installedBy', 'name email avatarUrl');
};

export const installProjectDependency = async (payload, userId) => {
  const language = normalizeSandboxLanguage(payload.language);
  if (!['python', 'javascript'].includes(language)) {
    throw new ApiError(400, 'Only Python and Node package installation is supported right now.');
  }

  const packageName = language === 'python' ? validatePythonPackageName(payload.packageName) : validateNodePackageName(payload.packageName);
  const { project, roomId } = await assertProjectSandboxAccess(payload, userId);

  const existing = await ProjectDependency.findOne({ project: project._id, language, packageName });
  if (existing) {
    return {
      dependency: existing,
      result: {
        status: 'success',
        stdout: `${packageName} is already installed for this project.`,
        stderr: '',
        executionTimeMs: 0
      }
    };
  }

  const dependencyCount = await ProjectDependency.countDocuments({ project: project._id, language });
  if (dependencyCount >= MAX_DEPENDENCIES_PER_LANGUAGE) {
    throw new ApiError(409, 'This project has reached the 20 package limit for Python.');
  }

  const dockerReady = await checkDockerAvailable();
  if (!dockerReady) {
    throw new ApiError(503, 'Code execution requires Docker to be running on the server.');
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), language === 'python' ? 'codesync-pip-' : 'codesync-npm-'));
  try {
    const dockerArgs =
      language === 'python'
        ? [
        'run',
        '--rm',
        '--memory',
        '128m',
        '--cpus',
        '0.5',
        '--pids-limit',
        '64',
        '-v',
        `${tempDir}:/workspace`,
        '-w',
        '/workspace',
        'python:3.11-alpine',
        'python',
        '-m',
        'pip',
        'install',
        '--disable-pip-version-check',
        '--no-cache-dir',
        '--target',
        '/workspace/deps',
        packageName
          ]
        : [
            'run',
            '--rm',
            '--memory',
            '128m',
            '--cpus',
            '0.5',
            '--pids-limit',
            '64',
            '-v',
            `${tempDir}:/workspace`,
            '-w',
            '/workspace',
            'node:20-alpine',
            'npm',
            'install',
            '--ignore-scripts',
            '--no-audit',
            '--no-fund',
            packageName
          ];

    const result = await runProcess('docker', dockerArgs, { timeoutMs: PACKAGE_INSTALL_TIMEOUT_MS });

    if (result.status !== 'success') {
      return { dependency: null, result };
    }

    const dependency = await ProjectDependency.create({
      room: roomId,
      project: project._id,
      language,
      packageName,
      installedBy: userId,
      installedAt: new Date()
    });

    return { dependency, result };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

export const removeProjectDependency = async (dependencyId, userId) => {
  const dependency = await ProjectDependency.findById(dependencyId);
  if (!dependency) {
    throw new ApiError(404, 'Package dependency not found');
  }

  await assertProjectSandboxAccess({ roomId: dependency.room, projectId: dependency.project }, userId);
  await dependency.deleteOne();
  return { dependencyId };
};
