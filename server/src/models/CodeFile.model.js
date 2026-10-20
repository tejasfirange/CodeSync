import mongoose from 'mongoose';

const codeFileSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true
    },
    filename: {
      type: String,
      required: [true, 'Filename is required'],
      trim: true,
      minlength: 1,
      maxlength: 180
    },
    path: {
      type: String,
      trim: true,
      minlength: 1,
      maxlength: 180,
      default: undefined
    },
    language: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: 'javascript'
    },
    content: {
      type: String,
      default: ''
    },
    version: {
      type: Number,
      default: 1,
      min: 1
    },
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    lastEditedAt: {
      type: Date,
      default: null
    },
    editCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

codeFileSchema.index({ project: 1, path: 1 }, { unique: true, sparse: true });
codeFileSchema.index({ room: 1, updatedAt: -1 });
codeFileSchema.index({ room: 1, language: 1 });

const CodeFile = mongoose.model('CodeFile', codeFileSchema);

const normalizeLegacyPath = (value) => String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');

const backfillMissingCodeFilePaths = async () => {
  const existingPathDocs = await CodeFile.find({
    path: { $exists: true, $nin: [null, ''] }
  }).select('project path');
  const pathsByProject = new Map();

  existingPathDocs.forEach((doc) => {
    const projectId = doc.project.toString();
    if (!pathsByProject.has(projectId)) {
      pathsByProject.set(projectId, new Set());
    }
    pathsByProject.get(projectId).add(doc.path);
  });

  const legacyFiles = await CodeFile.find({
    $or: [{ path: { $exists: false } }, { path: null }, { path: '' }]
  }).sort({ createdAt: 1, _id: 1 });

  for (const file of legacyFiles) {
    const projectId = file.project.toString();
    const usedPaths = pathsByProject.get(projectId) || new Set();
    const fallbackName = normalizeLegacyPath(file.filename) || `file-${file._id.toString()}.txt`;
    let nextPath = fallbackName;
    let suffix = 2;

    while (usedPaths.has(nextPath)) {
      const dotIndex = fallbackName.lastIndexOf('.');
      nextPath =
        dotIndex > 0
          ? `${fallbackName.slice(0, dotIndex)}-${suffix}${fallbackName.slice(dotIndex)}`
          : `${fallbackName}-${suffix}`;
      suffix += 1;
    }

    usedPaths.add(nextPath);
    pathsByProject.set(projectId, usedPaths);
    await CodeFile.updateOne({ _id: file._id }, { $set: { path: nextPath, filename: normalizeLegacyPath(file.filename) || nextPath } });
  }
};

export const ensureCodeFileIndexes = async () => {
  await backfillMissingCodeFilePaths();

  let indexes;
  try {
    indexes = await CodeFile.collection.indexes();
  } catch (error) {
    if (error?.code !== 26 && error?.codeName !== 'NamespaceNotFound') {
      throw error;
    }

    // A fresh database has no namespace yet; createIndex below will create it.
    indexes = [];
  }
  const safeDropIndex = async (index) => {
    if (!index?.name || index.name === '_id_') {
      return;
    }

    try {
      await CodeFile.collection.dropIndex(index.name);
    } catch (error) {
      if (error?.codeName !== 'IndexNotFound') {
        throw error;
      }
    }
  };

  const legacyFilenameIndex = indexes.find((index) => index.key?.project === 1 && index.key?.filename === 1);
  if (legacyFilenameIndex) {
    await safeDropIndex(legacyFilenameIndex);
  }

  const pathIndex = indexes.find((index) => index.key?.project === 1 && index.key?.path === 1);
  if (pathIndex && (!pathIndex.unique || !pathIndex.sparse)) {
    await safeDropIndex(pathIndex);
  }

  await CodeFile.collection.createIndex({ project: 1, path: 1 }, { unique: true, sparse: true });
  await CodeFile.collection.createIndex({ room: 1, updatedAt: -1 });
};

export default CodeFile;
