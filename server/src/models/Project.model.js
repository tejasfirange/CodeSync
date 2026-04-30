import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true,
      minlength: 2,
      maxlength: 160
    },
    description: {
      type: String,
      trim: true,
      maxlength: 700,
      default: ''
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
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

projectSchema.index({ room: 1, createdAt: -1 });
projectSchema.index({ room: 1, title: 1 });

const Project = mongoose.model('Project', projectSchema);

export default Project;
