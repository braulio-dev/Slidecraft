// Script para generar miniaturas SVG de las plantillas
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const thumbnailsDir = path.resolve(__dirname, '../public/thumbnails');

// Crear directorio si no existe
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
}

// Definir plantillas con sus colores
const templates = {
  'blank_default': { 
    color: '#ffffff', 
    textColor: '#333333',
    title: 'Blank Default',
    subtitle: 'Plantilla blanca limpia'
  },
  'template': { 
    color: '#4a90e2', 
    textColor: '#ffffff',
    title: 'Template',
    subtitle: 'Plantilla con diseño azul'
  },
  'template_custom': { 
    color: '#f5a623', 
    textColor: '#ffffff',
    title: 'Template Custom',
    subtitle: 'Plantilla personalizada'
  },
  'templateFull': { 
    color: '#9b59b6', 
    textColor: '#ffffff',
    title: 'Template Full',
    subtitle: 'Plantilla completa'
  },
  'modern_dark': { 
    color: '#2c3e50', 
    textColor: '#ffffff',
    title: 'Modern Dark',
    subtitle: 'Diseño oscuro moderno'
  },
  'vibrant_gradient': { 
    color: '#e74c3c', 
    textColor: '#ffffff',
    title: 'Vibrant Gradient',
    subtitle: 'Gradientes vibrantes'
  },
  'professional_blue': { 
    color: '#3498db', 
    textColor: '#ffffff',
    title: 'Professional Blue',
    subtitle: 'Profesional azul'
  },
  'elegant_purple': { 
    color: '#9b59b6', 
    textColor: '#ffffff',
    title: 'Elegant Purple',
    subtitle: 'Elegante morado'
  },
  'fresh_green': { 
    color: '#27ae60', 
    textColor: '#ffffff',
    title: 'Fresh Green',
    subtitle: 'Verde fresco'
  },
  'warm_orange': { 
    color: '#e67e22', 
    textColor: '#ffffff',
    title: 'Warm Orange',
    subtitle: 'Naranja cálido'
  },
  'minimal_gray': { 
    color: '#95a5a6', 
    textColor: '#ffffff',
    title: 'Minimal Gray',
    subtitle: 'Minimalista gris'
  },
  'creative_pink': { 
    color: '#e91e63', 
    textColor: '#ffffff',
    title: 'Creative Pink',
    subtitle: 'Rosa creativo'
  }
};

console.log('🎨 Generando miniaturas SVG de plantillas...\n');

for (const [filename, config] of Object.entries(templates)) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="960" height="540" viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg">
  <!-- Fondo -->
  <rect width="960" height="540" fill="${config.color}"/>
  
  <!-- Línea decorativa superior -->
  <rect x="0" y="0" width="960" height="8" fill="rgba(0,0,0,0.1)"/>
  
  <!-- Título -->
  <text x="480" y="200" 
        font-family="Arial, sans-serif" 
        font-size="72" 
        font-weight="bold"
        fill="${config.textColor}" 
        text-anchor="middle">
    ${config.title}
  </text>
  
  <!-- Subtítulo -->
  <text x="480" y="280" 
        font-family="Arial, sans-serif" 
        font-size="32" 
        fill="${config.textColor}" 
        text-anchor="middle"
        opacity="0.9">
    ${config.subtitle}
  </text>
  
  <!-- Decoración inferior -->
  <circle cx="480" cy="420" r="40" fill="rgba(255,255,255,0.2)"/>
  <circle cx="380" cy="420" r="20" fill="rgba(255,255,255,0.1)"/>
  <circle cx="580" cy="420" r="20" fill="rgba(255,255,255,0.1)"/>
  
  <!-- Línea decorativa inferior -->
  <rect x="0" y="532" width="960" height="8" fill="rgba(0,0,0,0.1)"/>
</svg>`;

  const outputPath = path.join(thumbnailsDir, `${filename}.svg`);
  fs.writeFileSync(outputPath, svg);
  console.log(`✅ Creada: ${filename}.svg`);
}

console.log('\n✨ Todas las miniaturas SVG han sido creadas!');
console.log(`📁 Ubicación: ${thumbnailsDir}`);
