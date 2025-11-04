import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import { convertMarkdownToPPTX } from "./convertToPPTX.js";

const app = express();
const PORT = 4000;

// Corregir __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.post("/convert", async (req, res) => {
  try {
    console.log("Console log proof");

    const { markdown } = req.body;
    if (!markdown) return res.status(400).send("❌ No markdown content received");

    // Crear carpeta de salida si no existe
    const outputDir = path.resolve(__dirname, "../uploads");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // Archivo temporal de salida
    const outputFile = path.join(outputDir, `presentation_${Date.now()}.pptx`);
    console.log("📄 Generating presentation at:", outputFile);

    // Ruta absoluta del template
    const templatePath = path.resolve(__dirname, "../templates/template.pptx");
    if (!fs.existsSync(templatePath)) {
      console.error("⚠️ Template not found at:", templatePath);
      return res.status(500).send("Template file not found. Check templates/template.pptx");
    }

    // Pasar ruta del template al convertidor
    await convertMarkdownToPPTX(markdown, outputFile, templatePath);

    // Enviar el archivo resultante
    res.download(outputFile, (err) => {
      if (err) console.error("Error sending file:", err);
      // Limpieza después de 5 segundos
      setTimeout(() => fs.unlink(outputFile, () => {}), 5000);
    });
  } catch (error) {
    console.error("❌ Error converting markdown to PPTX:", error);
    res.status(500).send("Error converting markdown to PPTX");
  }
});

app.listen(PORT, () => {
  console.log(`✅ Pandoc conversion server running at http://localhost:${PORT}`);
});
