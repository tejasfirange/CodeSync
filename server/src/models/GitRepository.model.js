import mongoose from 'mongoose';

const gitRepositorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    githubAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GitHubAccount',
      required: true,
      index: true
    },
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
    repoId: {
      type: Number,
      required: true
    },
    owner: {
      type: String,
      required: true,
      trim: true
    },
    repoName: {
      type: String,
      required: true,
      trim: true
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    htmlUrl: {
      type: String,
      required: true,
      trim: true
    },
    cloneUrl: {
      type: String,
      required: true,
      trim: true
    },
    defaultBranch: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160
    },
    selectedBranch: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160
    },
    visibility: {
      type: String,
      enum: ['public', 'private'],
      required: true
    },
    permissions: {
      admin: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
      pull: { type: Boolean, default: true },
      maintain: { type: Boolean, default: false },
      triage: { type: Boolean, default: false }
    },
    connectedAt: {
      type: Date,
      default: Date.now
    },
    lastSyncAt: {
      type: Date,
      default: null
    },
    lastPullAt: {
      type: Date,
      default: null
    },
    lastPushAt: {
      type: Date,
      default: null
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

gitRepositorySchema.index({ user: 1, project: 1 }, { unique: true });
gitRepositorySchema.index({ room: 1, connectedAt: -1 });

const GitRepository = mongoose.model('GitRepository', gitRepositorySchema);

export default GitRepository;
