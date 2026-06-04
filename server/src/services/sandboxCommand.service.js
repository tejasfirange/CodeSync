import ApiError from '../utils/ApiError.js';
import { validateNodePackageName, validatePythonPackageName } from './sandboxPackage.service.js';

const UNSAFE_COMMAND_PATTERN = /(;|&&|\|\||\||`|\$\(|\$\{|<|>)/;
const BLOCKED_COMMANDS = new Set(['rm', 'sudo', 'curl', 'wget', 'docker', 'bash', 'sh', 'powershell', 'pwsh', 'cmd']);
const SAFE_FILE_PATH = /^(?!.*\.\.)(?![\\/])[A-Za-z0-9._\-/ ]+$/;

const tokenize = (command) => String(command || '').trim().split(/\s+/).filter(Boolean);

const assertSafeCommand = (command) => {
  const value = String(command || '').trim();
  if (!value || UNSAFE_COMMAND_PATTERN.test(value)) {
    throw new ApiError(400, 'Unsupported sandbox command. Type help to see allowed commands.');
  }

  const [first] = tokenize(value);
  if (BLOCKED_COMMANDS.has(String(first || '').toLowerCase())) {
    throw new ApiError(400, 'Unsupported sandbox command. Type help to see allowed commands.');
  }

  return value;
};

export const parseSandboxCommand = (command) => {
  const value = assertSafeCommand(command);
  const parts = tokenize(value);
  const [base, subcommand, maybePackage] = parts;
  const normalizedBase = base.toLowerCase();
  const normalizedSubcommand = String(subcommand || '').toLowerCase();

  if (parts.length === 1 && normalizedBase === 'run') {
    return { action: 'run' };
  }

  if (parts.length === 1 && normalizedBase === 'clear') {
    return { action: 'clear' };
  }

  if (parts.length === 1 && normalizedBase === 'help') {
    return { action: 'help' };
  }

  if (parts.length === 3 && normalizedBase === 'install' && normalizedSubcommand === 'python') {
    return { action: 'install-package', language: 'python', packageName: validatePythonPackageName(maybePackage) };
  }

  if (parts.length === 3 && normalizedBase === 'install' && ['node', 'javascript', 'js'].includes(normalizedSubcommand)) {
    return { action: 'install-package', language: 'javascript', packageName: validateNodePackageName(maybePackage) };
  }

  if (parts.length === 3 && normalizedBase === 'pip' && normalizedSubcommand === 'install') {
    return { action: 'install-package', language: 'python', packageName: validatePythonPackageName(maybePackage) };
  }

  if (parts.length === 3 && normalizedBase === 'npm' && ['install', 'add'].includes(normalizedSubcommand)) {
    return { action: 'install-package', language: 'javascript', packageName: validateNodePackageName(maybePackage) };
  }

  // --- node <file.js> ---
  if (normalizedBase === 'node' && parts.length === 2) {
    if (['current-file', '<current-file>'].includes(normalizedSubcommand)) {
      return { action: 'run-current-file', language: 'javascript' };
    }
    const filePath = subcommand.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!SAFE_FILE_PATH.test(filePath) || !filePath.endsWith('.js')) {
      throw new ApiError(400, 'node can only run .js files.');
    }
    return { action: 'run-file', language: 'javascript', path: filePath };
  }

  // --- python <file.py> / py <file.py> ---
  if (['python', 'py'].includes(normalizedBase) && parts.length === 2) {
    if (['current-file', '<current-file>'].includes(normalizedSubcommand)) {
      return { action: 'run-current-file', language: 'python' };
    }
    const filePath = subcommand.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!SAFE_FILE_PATH.test(filePath) || !filePath.endsWith('.py')) {
      throw new ApiError(400, 'python can only run .py files.');
    }
    return { action: 'run-file', language: 'python', path: filePath };
  }

  // --- gcc <file.c> [-o <output>] ---
  if (normalizedBase === 'gcc' && parts.length >= 2 && parts.length <= 4) {
    const filePath = subcommand.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!SAFE_FILE_PATH.test(filePath) || !filePath.endsWith('.c')) {
      throw new ApiError(400, 'gcc can only compile .c files.');
    }
    let outputName = 'main';
    if (parts.length >= 3 && parts[2] === '-o' && parts[3]) {
      const out = parts[3].replace(/\\/g, '/').replace(/^\/+/, '');
      if (!SAFE_FILE_PATH.test(out)) {
        throw new ApiError(400, 'Invalid output name.');
      }
      outputName = out;
    }
    return { action: 'run-file', language: 'c', path: filePath, outputName };
  }

  // --- g++ <file.cpp> [-o <output>] ---
  if (normalizedBase === 'g++' && parts.length >= 2 && parts.length <= 4) {
    const filePath = subcommand.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!SAFE_FILE_PATH.test(filePath) || !(filePath.endsWith('.cpp') || filePath.endsWith('.cc') || filePath.endsWith('.cxx'))) {
      throw new ApiError(400, 'g++ can only compile .cpp, .cc, or .cxx files.');
    }
    let outputName = 'main';
    if (parts.length >= 3 && parts[2] === '-o' && parts[3]) {
      const out = parts[3].replace(/\\/g, '/').replace(/^\/+/, '');
      if (!SAFE_FILE_PATH.test(out)) {
        throw new ApiError(400, 'Invalid output name.');
      }
      outputName = out;
    }
    return { action: 'run-file', language: 'cpp', path: filePath, outputName };
  }

  // --- ./main (run compiled binary) ---
  if (parts.length === 1 && (normalizedBase === './main' || normalizedBase === './a.out')) {
    return { action: 'run-binary', binaryName: base };
  }

  throw new ApiError(400, 'Unsupported sandbox command. Type help to see allowed commands.');
};
