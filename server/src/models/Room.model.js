import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
      minlength: 2,
      maxlength: 120
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    roomCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    members: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    settings: {
      allowEditorsToRunCode: { type: Boolean, default: false },
      allowViewersToRunCode: { type: Boolean, default: false },
      allowEditorsToManageFiles: { type: Boolean, default: true },
      allowViewersToChat: { type: Boolean, default: true },
      allowScreenShare: { type: Boolean, default: true },
      allowViewersToScreenShare: { type: Boolean, default: false }
    },
    isPrivate: {
      type: Boolean,
      default: false
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

roomSchema.index({ members: 1 });
roomSchema.index({ owner: 1, createdAt: -1 });

const Room = mongoose.model('Room', roomSchema);

export default Room;
