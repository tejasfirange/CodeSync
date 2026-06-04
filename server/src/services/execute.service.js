import { spawn } from 'child_process';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import CodeFile from '../models/CodeFile.model.js';
import ExecutionLog from '../models/ExecutionLog.model.js';
import Project from '../models/Project.model.js';
import ProjectDependency from '../models/ProjectDependency.model.js';
import ApiError from '../utils/ApiError.js';
import idsEqual from '../utils/idsEqual.js';
import { assertRoomMember, canRunCode } from './room.service.js';

const CODE_SIZE_LIMIT = 200 * 1024;
const STDIN_SIZE_LIMIT = 20 * 1024;
const OUTPUT_SIZE_LIMIT = 128 * 1024;
const EXECUTION_TIMEOUT_MS = 5000;
const PACKAGE_INSTALL_TIMEOUT_MS = 30000;

const LANGUAGE_CONFIG = {
  javascript: {
    image: 'node:20-alpine',
    filename: 'main.js',
    command: 'node main.js < input.txt'
  },
  python: {
    image: 'python:3.11-alpine',
    filename: 'main.py',
    command: 'python main.py < input.txt'
  },
  c: {
    image: 'gcc:13',
    filename: 'main.c',
    command: 'gcc main.c -O2 -pipe -o /tmp/main && /tmp/main < input.txt'
  },
  cpp: {
    image: 'gcc:13',
    filename: 'main.cpp',
    command: 'g++ main.cpp -O2 -pipe -std=c++17 -o /tmp/main && /tmp/main < input.txt'
  }
};

const normalizeLanguage = (language) => {
  const value = String(language || '').toLowerCase();
  if (['js', 'node', 'javascript'].includes(value)) {
    return 'javascript';
  }
  if (['py', 'python'].includes(value)) {
    return 'python';
  }
  if (['cpp', 'c++', 'cc', 'cxx'].includes(value)) {
    return 'cpp';
  }
  if (value === 'c') {
    return 'c';
  }
  return value;
};

const truncateOutput = (value) => {
  if (value.length <= OUTPUT_SIZE_LIMIT) {
    return value;
  }

  return `${value.slice(0, OUTPUT_SIZE_LIMIT)}\n[output truncated]`;
};

const runProcess = (command, args, { timeoutMs = EXECUTION_TIMEOUT_MS } = {}) =>
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
        stderr: timedOut ? `${stderr}\nExecution timed out after ${timeoutMs / 1000} seconds.`.trim() : stderr,
        exitCode,
        executionTimeMs: Date.now() - startedAt
      });
    });
  });

export const checkDockerAvailable = async () => {
  const result = await runProcess('docker', ['info', '--format', '{{.ServerVersion}}'], { timeoutMs: 3000 });
  return result.status === 'success';
};

const assertExecutionAccess = async ({ roomId, projectId, fileId }, userId) => {
  const project = await Project.findById(projectId);
  if (!project || !idsEqual(project.room, roomId)) {
    throw new ApiError(404, 'Project not found');
  }

  const room = await assertRoomMember(roomId, userId);
  if (!canRunCode(userId, room)) {
    throw new ApiError(403, 'Terminal access is disabled by the room owner.');
  }

  const file = await CodeFile.findById(fileId);
  if (!file || !idsEqual(file.project, projectId) || !idsEqual(file.room, roomId)) {
    throw new ApiError(404, 'File not found');
  }

  return { project, file };
};

const buildDockerArgs = ({ image, command, workdir }) => [
  'run',
  '--rm',
  '--network',
  'none',
  '--memory',
  '128m',
  '--cpus',
  '0.5',
  '--pids-limit',
  '64',
  '--read-only',
  '--tmpfs',
  '/tmp:rw,nosuid,nodev,size=16m',
  '-v',
  `${workdir}:/workspace`,
  '-w',
  '/workspace',
  image,
  'sh',
  '-c',
  command
];

const buildPythonDependencyInstallArgs = ({ workdir }) => [
  'run',
  '--rm',
  '--memory',
  '128m',
  '--cpus',
  '0.5',
  '--pids-limit',
  '64',
  '-v',
  `${workdir}:/workspace`,
  '-w',
  '/workspace',
  'python:3.11-alpine',
  'python',
  '-m',
  'pip',
  'install',
  '--disable-pip-version-check',
  '--no-cache-dir',
  '-r',
  'requirements.txt',
  '--target',
  '/workspace/deps'
];

const buildNodeDependencyInstallArgs = ({ workdir }) => [
  'run',
  '--rm',
  '--memory',
  '128m',
  '--cpus',
  '0.5',
  '--pids-limit',
  '64',
  '-v',
  `${workdir}:/workspace`,
  '-w',
  '/workspace',
  'node:20-alpine',
  'npm',
  'install',
  '--ignore-scripts',
  '--no-audit',
  '--no-fund'
];

const installPythonDependencies = async ({ projectId, workdir }) => {
  const dependencies = await ProjectDependency.find({ project: projectId, language: 'python' }).select('packageName').lean();
  if (!dependencies.length) {
    return null;
  }

  await writeFile(
    path.join(workdir, 'requirements.txt'),
    dependencies.map((dependency) => dependency.packageName).join('\n'),
    'utf8'
  );

  return runProcess('docker', buildPythonDependencyInstallArgs({ workdir }), {
    timeoutMs: PACKAGE_INSTALL_TIMEOUT_MS
  });
};

const installNodeDependencies = async ({ projectId, workdir }) => {
  const dependencies = await ProjectDependency.find({ project: projectId, language: 'javascript' }).select('packageName').lean();
  if (!dependencies.length) {
    return null;
  }

  const packageJson = {
    private: true,
    type: 'commonjs',
    dependencies: Object.fromEntries(dependencies.map((dependency) => [dependency.packageName, '*']))
  };
  await writeFile(path.join(workdir, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf8');

  return runProcess('docker', buildNodeDependencyInstallArgs({ workdir }), {
    timeoutMs: PACKAGE_INSTALL_TIMEOUT_MS
  });
};

export const executeCode = async (payload, userId) => {
  const language = normalizeLanguage(payload.language);
  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    throw new ApiError(400, 'Execution is only supported for JavaScript, Python, C++, and C.');
  }

  const code = String(payload.code || '');
  const stdin = String(payload.stdin || '');
  if (!code.trim()) {
    throw new ApiError(400, 'Cannot run an empty file.');
  }
  if (Buffer.byteLength(code, 'utf8') > CODE_SIZE_LIMIT) {
    throw new ApiError(413, 'Code is too large to run. Maximum size is 200KB.');
  }
  if (Buffer.byteLength(stdin, 'utf8') > STDIN_SIZE_LIMIT) {
    throw new ApiError(413, 'Input is too large. Maximum stdin size is 20KB.');
  }

  const { file } = await assertExecutionAccess(payload, userId);

  const dockerReady = await checkDockerAvailable();
  if (!dockerReady) {
    throw new ApiError(503, 'Code execution requires Docker to be running on the server.');
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'codesync-run-'));

  try {
    await writeFile(path.join(tempDir, config.filename), code, 'utf8');
    await writeFile(path.join(tempDir, 'input.txt'), stdin, 'utf8');

    if (language === 'python' || language === 'javascript') {
      const installResult =
        language === 'python'
          ? await installPythonDependencies({ projectId: payload.projectId, workdir: tempDir })
          : await installNodeDependencies({ projectId: payload.projectId, workdir: tempDir });
      if (installResult && installResult.status !== 'success') {
        return {
          success: false,
          status: installResult.status,
          stdout: installResult.stdout,
          stderr: installResult.stderr || `Failed to install project ${language === 'python' ? 'Python' : 'Node'} dependencies.`,
          exitCode: installResult.exitCode,
          executionTimeMs: installResult.executionTimeMs,
          memory: '128 MB limit',
          language
        };
      }
    }

    const runCommand = language === 'python' ? 'PYTHONPATH=/workspace/deps python main.py < input.txt' : config.command;

    // User code must only run inside this Docker sandbox. Do not replace this
    // with direct host execution; network, CPU, memory, process, and time
    // limits are applied by docker run.
    const result = await runProcess('docker', buildDockerArgs({ ...config, command: runCommand, workdir: tempDir }), {
      timeoutMs: EXECUTION_TIMEOUT_MS + 1500
    });

    const response = {
      success: result.status === 'success',
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      executionTimeMs: result.executionTimeMs,
      memory: '128 MB limit',
      language
    };

    ExecutionLog.create({
      room: payload.roomId,
      project: payload.projectId,
      file: file._id,
      user: userId,
      language,
      status: result.status === 'timeout' ? 'timeout' : result.status === 'success' ? 'success' : 'error',
      executionTimeMs: result.executionTimeMs
    }).catch((error) => console.warn('Execution log failed:', error.message));

    return response;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};
