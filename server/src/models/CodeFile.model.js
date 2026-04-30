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

codeFileSchema.index({ project: 1, filename: 1 });
codeFileSchema.index({ project: 1, path: 1 }, { unique: true, sparse: true });
codeFileSchema.index({ room: 1, updatedAt: -1 });

const CodeFile = mongoose.model('CodeFile', codeFileSchema);

export default CodeFile;
