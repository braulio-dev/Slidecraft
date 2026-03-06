import mongoose from 'mongoose';

const slideTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  markdownPattern: {
    type: String,
    required: true
  },
  qualities: {
    hasTitle: { type: Boolean, default: false },
    hasBullets: { type: Boolean, default: false },
    hasImage: { type: Boolean, default: false },
    isIntro: { type: Boolean, default: false },
    pptxLayout: { type: String, default: 'Title and Content' }
  }
});

const SlideType = mongoose.model('SlideType', slideTypeSchema);

export default SlideType;
