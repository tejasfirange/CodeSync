import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import ApiError from '../utils/ApiError.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(currentDir, '..', '..');

export const voiceUploadDir = path.resolve(serverRoot, 'uploads', 'voice-notes');

const allowedMimeTypes = new Set(['audio/webm', 'audio/ogg', 'audio/mp4']);
const extensionByMimeType = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4'
};

fs.mkdirSync(voiceUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, voiceUploadDir);
  },
  filename(req, file, cb) {
    const mimeType = file.mimetype.split(';')[0].trim();
    const extension = extensionByMimeType[mimeType] || 'webm';
    const roomId = req.params.roomId;
    const userId = req.user?._id?.toString() || 'unknown';
    cb(null, `voice_${roomId}_${userId}_${Date.now()}.${extension}`);
  }
});

const fileFilter = (req, file, cb) => {
  const mimeType = file.mimetype.split(';')[0].trim();
  if (!allowedMimeTypes.has(mimeType)) {
    cb(new ApiError(400, 'Voice note must be audio/webm, audio/ogg, or audio/mp4.'));
    return;
  }

  cb(null, true);
};

export const uploadVoiceNote = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  }
}).single('audio');

export const removeUploadedVoiceFile = (file) => {
  if (!file?.path) {
    return;
  }

  fs.unlink(file.path, () => {});
};

export const getSafeVoicePath = (fileName) => {
  if (!/^voice_[a-f\d]{24}_[a-f\d]{24}_\d+\.(webm|ogg|mp4)$/i.test(fileName || '')) {
    throw new ApiError(400, 'Invalid voice note file name.');
  }

  const resolvedPath = path.resolve(voiceUploadDir, fileName);
  if (!resolvedPath.startsWith(`${voiceUploadDir}${path.sep}`)) {
    throw new ApiError(400, 'Invalid voice note file name.');
  }

  return resolvedPath;
};
