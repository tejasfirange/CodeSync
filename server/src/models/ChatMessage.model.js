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
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      minlength: 1,
      maxlength: 2000
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

chatMessageSchema.index({ room: 1, createdAt: -1 });
chatMessageSchema.index({ message: 'text' });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

export default ChatMessage;
