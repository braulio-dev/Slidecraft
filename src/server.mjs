import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import { convertMarkdownToPPTX } from "./convertToPPTX.mjs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Import MongoDB connection and models
import connectDB from "../db/connection.mjs";
import Conversion from "../models/Conversion.mjs";

// Import routes
import authRoutes from "../routes/auth.mjs";
import adminRoutes from "../routes/admin.mjs";

// Import middleware
import { authenticateToken } from "../middleware/auth.mjs";

const app = express();
const PORT = 4000;

// Corregir __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to MongoDB
connectDB();

// --- Middlewares ---
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Servir archivos estáticos (miniaturas)
app.use('/thumbnails', express.static(path.resolve(__dirname, '../public/thumbnails')));

// --- Authentication Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

// Endpoint para listar plantillas disponibles
app.get("/api/templates", (req, res) => {
  try {
    const templatesDir = path.resolve(__dirname, "../templates");
    
    if (!fs.existsSync(templatesDir)) {
      return res.json({ templates: [] });
    }

    const files = fs.readdirSync(templatesDir);
    
    // Información visual para cada plantilla
    const templateInfo = {
      'blank_default.pptx': { color: '#ffffff', icon: '📄', description: 'Plantilla blanca limpia' },
      'template.pptx': { color: '#4a90e2', icon: '🎨', description: 'Plantilla con diseño azul' },
      'template_custom.pptx': { color: '#f5a623', icon: '✨', description: 'Plantilla personalizada' },
      'templateFull.pptx': { color: '#9b59b6', icon: '📊', description: 'Plantilla completa' },
      'modern_dark.pptx': { color: '#2c3e50', icon: '🌙', description: 'Diseño oscuro moderno' },
      'vibrant_gradient.pptx': { color: '#e74c3c', icon: '🎭', description: 'Gradientes vibrantes' },
      'professional_blue.pptx': { color: '#3498db', icon: '💼', description: 'Profesional azul' },
      'elegant_purple.pptx': { color: '#9b59b6', icon: '👔', description: 'Elegante morado' },
      'fresh_green.pptx': { color: '#27ae60', icon: '🌿', description: 'Verde fresco' },
      'warm_orange.pptx': { color: '#e67e22', icon: '🔥', description: 'Naranja cálido' },
      'minimal_gray.pptx': { color: '#95a5a6', icon: '⚡', description: 'Minimalista gris' },
      'creative_pink.pptx': { color: '#e91e63', icon: '🎀', description: 'Rosa creativo' }
    };
    
    const thumbnailsDir = path.resolve(__dirname, "../public/thumbnails");
    
    const templates = files
      .filter(file => file.endsWith('.pptx'))
      .map(file => {
        const baseName = file.replace('.pptx', '');
        
        // Buscar thumbnail PNG o SVG
        const pngPath = path.join(thumbnailsDir, `${baseName}.png`);
        const svgPath = path.join(thumbnailsDir, `${baseName}.svg`);
        
        let thumbnailUrl = null;
        if (fs.existsSync(pngPath)) {
          thumbnailUrl = `/thumbnails/${baseName}.png`;
        } else if (fs.existsSync(svgPath)) {
          thumbnailUrl = `/thumbnails/${baseName}.svg`;
        }
        
        return {
          filename: file,
          color: templateInfo[file]?.color || '#9ca3af',
          icon: templateInfo[file]?.icon || '📊',
          description: templateInfo[file]?.description || 'Plantilla PowerPoint',
          thumbnail: thumbnailUrl
        };
      });

    res.json({ templates });
  } catch (error) {
    console.error("Error listing templates:", error);
    res.status(500).json({ error: "Failed to list templates" });
  }
});

app.post("/convert", authenticateToken, async (req, res) => {
  try {
    console.log("✅ /convert endpoint hit by user:", req.user.username);

    const { markdown, images, template } = req.body;
    console.log(" Markdown length:", markdown?.length || 0);
    console.log(" Images count:", images?.length || 0);
    console.log(" Template requested:", template || 'default');

    if (!markdown) {
      console.error("❌ No markdown content received");
      return res.status(400).send("❌ No markdown content received");
    }

    // --- Crear carpeta de salida por usuario ---
    const outputDir = path.resolve(__dirname, `../uploads/${req.user._id}`);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // Procesar imágenes si existen
    let processedMarkdown = markdown;

    // Eliminar TODAS las referencias a imágenes del markdown generado por el modelo
    // Solo queremos el texto, las imágenes las agregamos nosotros
    processedMarkdown = processedMarkdown.replace(/!\[.*?\]\(.*?\)/g, '');

    if (images && images.length > 0) {
      console.log(` Processing ${images.length} image(s)...`);

      images.forEach((img, index) => {
        const imageFileName = `image_${Date.now()}_${index}.jpg`;
        const imagePath = path.join(outputDir, imageFileName);

        // Extraer el base64 de la imagen
        const base64Data = img.data.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(imagePath, Buffer.from(base64Data, 'base64'));

        console.log(`✅ Image saved: ${imageFileName}`);

        // Agregar la imagen al markdown SIN título
        processedMarkdown += `\n\n## \n\n![](${imagePath})\n`;
      });
    }

    // --- Archivo de salida ---
    const timestamp = Date.now();
    const filename = `presentation_${timestamp}.pptx`;
    const outputFile = path.join(outputDir, filename);
    console.log("📄 Generating presentation at:", outputFile);

    // Usar la plantilla seleccionada por el usuario
    let useTemplate = null;

    if (template) {
      const templatePath = path.resolve(__dirname, "../templates", template);
      console.log(" Looking for template:", templatePath);
      console.log(" Template exists?", fs.existsSync(templatePath));

      if (fs.existsSync(templatePath)) {
        useTemplate = templatePath;
        console.log(" Using selected template:", template);
      } else {
        console.log("⚠️ Selected template not found:", template);
        const blankTemplatePath = path.resolve(__dirname, "../templates/blank_default.pptx");
        if (fs.existsSync(blankTemplatePath)) {
          useTemplate = blankTemplatePath;
          console.log(" Fallback to blank default");
        }
      }
    } else {
      // Si no se especifica, usar blank_default.pptx
      console.log("ℹ️ No template specified in request");
      const blankTemplatePath = path.resolve(__dirname, "../templates/blank_default.pptx");
      if (fs.existsSync(blankTemplatePath)) {
        useTemplate = blankTemplatePath;
        console.log(" Using blank white template (default)");
      } else {
        console.log("⚠️ No template found, using Pandoc default");
      }
    }

    // --- Conversión ---
    const startTime = Date.now();
    await convertMarkdownToPPTX(processedMarkdown, outputFile, useTemplate);
    const generationTime = Date.now() - startTime;

    // --- Guardar registro en MongoDB ---
    const slideCount = (processedMarkdown.match(/^##\s/gm) || []).length;
    const conversion = new Conversion({
      userId: req.user._id,
      markdown: processedMarkdown,
      filename: filename,
      filePath: outputFile,
      metadata: {
        slideCount: slideCount,
        characterCount: processedMarkdown.length,
        generationTime: generationTime,
        imagesCount: images?.length || 0,
        template: template || 'blank_default.pptx'
      }
    });

    await conversion.save();
    console.log("💾 Saved conversion record to MongoDB");

    // --- Enviar el archivo al cliente ---
    res.download(outputFile, filename, (err) => {
      if (err) console.error("Error sending file:", err);
      // Keep file on disk for user history - don't delete
    });
  } catch (error) {
    console.error("❌ Error converting markdown to PPTX:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      error: "Error converting markdown to PPTX",
      details: error.message
    });
  }
});

// --- Endpoint: historial de conversiones del usuario (Protected) ---
app.get("/history", authenticateToken, async (req, res) => {
  try {
    const conversions = await Conversion.find({ userId: req.user._id })
      .sort({ timestamp: -1 })
      .select('-markdown'); // Don't send full markdown in list view

    res.json({ conversions });
  } catch (error) {
    console.error("❌ Error fetching history:", error);
    res.status(500).send("Error fetching conversion history");
  }
});

// --- Endpoint: obtener detalles de una conversión específica ---
app.get("/conversion/:id", authenticateToken, async (req, res) => {
  try {
    const conversion = await Conversion.findOne({
      _id: req.params.id,
      userId: req.user._id // Ensure user can only access their own conversions
    });

    if (!conversion) {
      return res.status(404).json({ error: "Conversion not found" });
    }

    res.json({ conversion });
  } catch (error) {
    console.error("❌ Error fetching conversion:", error);
    res.status(500).send("Error fetching conversion details");
  }
});

// --- Inicializar servidor ---
app.listen(PORT, () => {
  console.log(`✅ Pandoc conversion server running at http://localhost:${PORT}`);
});
