import mongoose from 'mongoose';

const gitHubAccountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    githubId: {
      type: String,
      required: true,
      trim: true
    },
    username: {
      type: String,
      required: true,
      trim: true
    },
    displayName: {
      type: String,
      trim: true,
      default: ''
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: ''
    },
    profileUrl: {
      type: String,
      trim: true,
      default: ''
    },
    accessTokenEncrypted: {
      type: String,
      required: true,
      select: false
    },
    scope: {
      type: String,
      trim: true,
      default: ''
    },
    connectedAt: {
      type: Date,
      default: Date.now
    },
    lastUsedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        delete ret.accessTokenEncrypted;
        return ret;
      }
    }
  }
);

gitHubAccountSchema.index({ user: 1, githubId: 1 }, { unique: true });

const GitHubAccount = mongoose.model('GitHubAccount', gitHubAccountSchema);

export default GitHubAccount;
