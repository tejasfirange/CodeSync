import mongoose from 'mongoose';

const projectDependencySchema = new mongoose.Schema(
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
    language: {
      type: String,
      enum: ['python', 'javascript'],
      required: true,
      index: true
    },
    packageName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    version: {
      type: String,
      trim: true,
      default: ''
    },
    installedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    installedAt: {
      type: Date,
      default: Date.now
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

projectDependencySchema.index({ project: 1, language: 1, packageName: 1 }, { unique: true });
projectDependencySchema.index({ room: 1, installedAt: -1 });

const ProjectDependency = mongoose.model('ProjectDependency', projectDependencySchema);

export default ProjectDependency;
