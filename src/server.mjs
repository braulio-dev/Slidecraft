import express from "express";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import cors from "cors";
import { fileURLToPath } from "url";
import { convertMarkdownToPPTX } from "./convertToPPTX.mjs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Import MongoDB connection and models
import connectDB from "../db/connection.mjs";
import Conversion from "../models/Conversion.mjs";
import SlideType from "../models/SlideType.mjs";

// Import routes
import authRoutes from "../routes/auth.mjs";
import adminRoutes from "../routes/admin.mjs";
import chatRoutes from "../routes/chats.mjs";
import providersRoutes from "../routes/providers.mjs";

// Import middleware
import { authenticateToken } from "../middleware/auth.mjs";
import { proxyChat } from "./chatProxy.mjs";

const app = express();
const PORT = 4000;

// Corregir __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to MongoDB
connectDB();

// --- Middlewares ---
app.use(cors({ exposedHeaders: ['X-Conversion-Id', 'X-Conversion-Filename'] }));
app.use(express.json({ limit: "10mb" }));

// Servir archivos estáticos (miniaturas)
app.use('/thumbnails', express.static(path.resolve(__dirname, '../public/thumbnails')));

// --- Authentication Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/providers", providersRoutes);
app.post("/api/chat", authenticateToken, proxyChat);

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

// --- Helper: detect slide types from markdown ---
function detectSlides(markdown) {
  const slides = [];
  const lines = markdown.split('\n');
  let currentSlide = null;
  let slideNumber = 0;

  for (const line of lines) {
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      if (currentSlide) slides.push(currentSlide);
      slideNumber++;
      currentSlide = { slideNumber, type: 'title', title: line.replace(/^#\s+/, ''), hasImage: false, hasBullets: false };
    } else if (line.startsWith('## ')) {
      if (currentSlide) slides.push(currentSlide);
      slideNumber++;
      currentSlide = { slideNumber, type: 'content', title: line.replace(/^##\s*/, ''), hasImage: false, hasBullets: false };
    } else if (currentSlide) {
      if (line.startsWith('- ') || line.startsWith('* ')) currentSlide.hasBullets = true;
      if (line.startsWith('![')) currentSlide.hasImage = true;
    }
  }
  if (currentSlide) slides.push(currentSlide);

  return slides.map(s => ({
    slideNumber: s.slideNumber,
    title: s.title,
    slideType: s.hasImage ? 'image' : s.type
  }));
}

// --- Endpoint: listar slide types ---
app.get("/api/slide-types", async (req, res) => {
  try {
    const types = await SlideType.find({});
    res.json({ slideTypes: types });
  } catch (error) {
    console.error("Error fetching slide types:", error);
    res.status(500).json({ error: "Failed to fetch slide types" });
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
    const detectedSlides = detectSlides(processedMarkdown);
    const slideCount = detectedSlides.length;
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
      },
      slides: detectedSlides
    });

    await conversion.save();
    console.log("💾 Saved conversion record to MongoDB");

    // Return conversionId; client downloads on-demand via GET /download/:conversionId
    res.json({ conversionId: conversion._id.toString(), filename });
  } catch (error) {
    console.error("❌ Error converting markdown to PPTX:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      error: "Error converting markdown to PPTX",
      details: error.message
    });
  }
});

// --- Helper: locate LibreOffice executable ---
function findLibreOffice() {
  const candidates = [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'LibreOffice', 'program', 'soffice.exe'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return 'soffice'; // fall back to PATH
}

// --- Endpoint: convert saved PPTX to PDF via LibreOffice (Protected) ---
app.post("/convert-to-pdf", authenticateToken, async (req, res) => {
  const { pptxBase64, filename } = req.body;
  if (!pptxBase64) return res.status(400).json({ error: "No PPTX data provided" });

  const outputDir = path.resolve(__dirname, `../uploads/${req.user._id}`);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = Date.now();
  const pptxFile = path.join(outputDir, `temp_${timestamp}.pptx`);
  const pdfFile = path.join(outputDir, `temp_${timestamp}.pdf`);

  try {
    const base64Data = pptxBase64.replace(/^data:[^;]+;base64,/, '');
    fs.writeFileSync(pptxFile, Buffer.from(base64Data, 'base64'));

    const soffice = findLibreOffice();
    console.log("📄 Using LibreOffice at:", soffice);
    await new Promise((resolve, reject) => {
      exec(
        `"${soffice}" --headless --norestore --convert-to pdf --outdir "${outputDir}" "${pptxFile}"`,
        { shell: true, timeout: 30000 },
        (error, stdout, stderr) => {
          console.log("LibreOffice stdout:", stdout);
          if (stderr) console.warn("LibreOffice stderr:", stderr);
          if (error) reject(new Error(`LibreOffice failed: ${stderr || error.message}`));
          else resolve(stdout);
        }
      );
    });

    if (!fs.existsSync(pdfFile)) throw new Error("LibreOffice ran but no PDF was produced. Check that soffice is in PATH or installed at a standard location.");

    const downloadName = filename ? filename.replace(/\.pptx$/i, '.pdf') : `presentation_${timestamp}.pdf`;
    res.download(pdfFile, downloadName, () => {
      if (fs.existsSync(pptxFile)) fs.unlinkSync(pptxFile);
      if (fs.existsSync(pdfFile)) fs.unlinkSync(pdfFile);
    });
  } catch (error) {
    if (fs.existsSync(pptxFile)) fs.unlinkSync(pptxFile);
    console.error("❌ PDF conversion error:", error.message);
    res.status(500).json({ error: "PDF conversion failed", details: error.message });
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

// --- Endpoint: re-download a previously generated PPTX by conversionId ---
app.get("/download/:conversionId", authenticateToken, async (req, res) => {
  try {
    const conversion = await Conversion.findOne({ _id: req.params.conversionId, userId: req.user._id });
    if (!conversion) return res.status(404).json({ error: 'Conversion not found' });
    if (!fs.existsSync(conversion.filePath)) return res.status(404).json({ error: 'File not found on server' });
    res.download(conversion.filePath, conversion.filename);
  } catch (error) {
    console.error("❌ Error downloading conversion:", error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// --- Inicializar servidor ---
app.listen(PORT, () => {
  console.log(`✅ Pandoc conversion server running at http://localhost:${PORT}`);
});
