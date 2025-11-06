import mongoose from 'mongoose';

const conversionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  markdown: {
    type: String,
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  metadata: {
    slideCount: Number,
    characterCount: Number,
    generationTime: Number
  }
});

// Index for efficient querying by user and timestamp
conversionSchema.index({ userId: 1, timestamp: -1 });

const Conversion = mongoose.model('Conversion', conversionSchema);

export default Conversion;
