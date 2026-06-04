import mongoose from 'mongoose';

const executionLogSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    file: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CodeFile',
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    language: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },
    status: {
      type: String,
      enum: ['success', 'error', 'timeout'],
      required: true,
      index: true
    },
    executionTimeMs: {
      type: Number,
      default: 0
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

executionLogSchema.index({ room: 1, createdAt: -1 });
executionLogSchema.index({ room: 1, status: 1 });
executionLogSchema.index({ room: 1, language: 1 });
executionLogSchema.index({ room: 1, user: 1 });

const ExecutionLog = mongoose.model('ExecutionLog', executionLogSchema);

export default ExecutionLog;
