import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['text', 'voice'],
      default: 'text',
      index: true
    },
    message: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000
    },
    voiceUrl: {
      type: String,
      trim: true,
      default: ''
    },
    voiceFileName: {
      type: String,
      trim: true,
      default: ''
    },
    voiceMimeType: {
      type: String,
      trim: true,
      default: ''
    },
    voiceDuration: {
      type: Number,
      min: 0,
      max: 60,
      default: 0
    },
    voiceSize: {
      type: Number,
      min: 0,
      default: 0
    },
    isEdited: {
      type: Boolean,
      default: false
    },
    editedAt: {
      type: Date
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
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

chatMessageSchema.pre('validate', function validateMessageType(next) {
  if (this.type === 'voice') {
    if (!this.voiceUrl || !this.voiceDuration) {
      this.invalidate('voiceUrl', 'Voice message requires audio and duration');
      next();
      return;
    }
    this.message = this.message || 'Voice note';
    next();
    return;
  }

  if (!this.message?.trim()) {
    this.invalidate('message', 'Message is required');
    next();
    return;
  }

  next();
});

chatMessageSchema.index({ room: 1, createdAt: -1 });
chatMessageSchema.index({ message: 'text' });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

export default ChatMessage;
