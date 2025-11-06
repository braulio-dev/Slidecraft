import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import { convertMarkdownToPPTX } from "./convertToPPTX.mjs";

const app = express();
const PORT = 4000;

// Corregir __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.post("/convert", async (req, res) => {
  try {
    console.log("📥 Received conversion request");

    const { markdown, images } = req.body;
    console.log("📝 Markdown length:", markdown?.length || 0);
    console.log("🖼️ Images count:", images?.length || 0);
    
    if (!markdown) {
      console.error("❌ No markdown content received");
      return res.status(400).send("❌ No markdown content received");
    }

    // Crear carpeta de salida si no existe
    const outputDir = path.resolve(__dirname, "../uploads");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // Procesar imágenes si existen
    let processedMarkdown = markdown;
    
    // Eliminar TODAS las referencias a imágenes del markdown generado por el modelo
    // Solo queremos el texto, las imágenes las agregamos nosotros
    processedMarkdown = processedMarkdown.replace(/!\[.*?\]\(.*?\)/g, '');
    
    if (images && images.length > 0) {
      console.log(`🖼️ Processing ${images.length} image(s)...`);
      
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

    // Archivo temporal de salida
    const outputFile = path.join(outputDir, `presentation_${Date.now()}.pptx`);
    console.log("📄 Generating presentation at:", outputFile);

    // Prioridad de templates:
    // 1. template.pptx (si existe) - plantilla personalizada del usuario
    // 2. blank_default.pptx - plantilla blanca básica
    const customTemplatePath = path.resolve(__dirname, "../templates/template.pptx");
    const blankTemplatePath = path.resolve(__dirname, "../templates/blank_default.pptx");
    let useTemplate = null;
    
    // Usar template blanco por defecto siempre
    // Si quieres usar un template personalizado, cámbialo manualmente
    if (fs.existsSync(blankTemplatePath)) {
      useTemplate = blankTemplatePath;
      console.log("📋 Using blank white template");
    } else if (fs.existsSync(customTemplatePath)) {
      useTemplate = customTemplatePath;
      console.log("🎨 Using template:", customTemplatePath);
    } else {
      console.log("⚠️ No template found, using Pandoc default");
    }

    // Pasar ruta del template al convertidor
    await convertMarkdownToPPTX(processedMarkdown, outputFile, useTemplate);

    // Enviar el archivo resultante
    res.download(outputFile, (err) => {
      if (err) console.error("Error sending file:", err);
      // Limpieza después de 5 segundos
      setTimeout(() => fs.unlink(outputFile, () => {}), 5000);
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

app.listen(PORT, () => {
  console.log(`✅ Pandoc conversion server running at http://localhost:${PORT}`);
});
