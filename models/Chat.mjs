import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  images: [{ name: String, data: String }],
  isPresentation: { type: Boolean, default: false },
  conversionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversion', default: null },
  pptxFilename: { type: String, default: null }
}, { _id: false });

const chatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, default: 'New Chat' },
  messages: [messageSchema]
}, { timestamps: true });

chatSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model('Chat', chatSchema);
