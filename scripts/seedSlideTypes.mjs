import connectDB from '../db/connection.mjs';
import SlideType from '../models/SlideType.mjs';

const slideTypes = [
  {
    name: 'title',
    description: 'Opening title slide with a subtitle. Use for the first slide.',
    markdownPattern: '# Presentation Title\n\nSubtitle or brief description',
    qualities: {
      hasTitle: true,
      hasBullets: false,
      hasImage: false,
      isIntro: true,
      pptxLayout: 'Title Slide'
    }
  },
  {
    name: 'content',
    description: 'Standard content slide with a heading and bullet points.',
    markdownPattern: '## Slide Title\n\n- First key point\n- Second key point\n- Third key point',
    qualities: {
      hasTitle: true,
      hasBullets: true,
      hasImage: false,
      isIntro: false,
      pptxLayout: 'Title and Content'
    }
  },
  {
    name: 'image',
    description: 'Slide focused on an image with an optional heading.',
    markdownPattern: '## \n\n![](image_path)',
    qualities: {
      hasTitle: false,
      hasBullets: false,
      hasImage: true,
      isIntro: false,
      pptxLayout: 'Picture with Caption'
    }
  },
  {
    name: 'closing',
    description: 'Closing slide for conclusions or thank you.',
    markdownPattern: '# Thank You\n\nContact info or closing message',
    qualities: {
      hasTitle: true,
      hasBullets: false,
      hasImage: false,
      isIntro: false,
      pptxLayout: 'Title Slide'
    }
  }
];

async function seed() {
  await connectDB();
  await SlideType.deleteMany({});
  await SlideType.insertMany(slideTypes);
  console.log('Slide types seeded successfully.');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
