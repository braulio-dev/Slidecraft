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

// --- Corregir __dirname en módulos ES ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to MongoDB
connectDB();

// --- Middlewares ---
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// --- Authentication Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);


// --- Endpoint principal: conversión Markdown -> PPTX (Protected) ---
app.post("/convert", authenticateToken, async (req, res) => {
  try {
    console.log("✅ /convert endpoint hit by user:", req.user.username);

    const { markdown } = req.body;
    if (!markdown) return res.status(400).send("❌ No markdown content received");

    // --- Crear carpeta de salida por usuario ---
    const outputDir = path.resolve(__dirname, `../uploads/${req.user._id}`);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // --- Archivo de salida ---
    const timestamp = Date.now();
    const filename = `presentation_${timestamp}.pptx`;
    const outputFile = path.join(outputDir, filename);
    console.log("📄 Generating presentation at:", outputFile);

    // --- Ruta del template ---
    const templatePath = path.resolve(__dirname, "../templates/template.pptx");
    if (!fs.existsSync(templatePath)) {
      console.error("⚠️ Template not found at:", templatePath);
      return res.status(500).send("Template file not found. Check templates/template.pptx");
    }

    // --- Conversión ---
    const startTime = Date.now();
    await convertMarkdownToPPTX(markdown, outputFile, templatePath);
    const generationTime = Date.now() - startTime;

    // --- Guardar registro en MongoDB ---
    const slideCount = (markdown.match(/^##\s/gm) || []).length;
    const conversion = new Conversion({
      userId: req.user._id,
      markdown: markdown,
      filename: filename,
      filePath: outputFile,
      metadata: {
        slideCount: slideCount,
        characterCount: markdown.length,
        generationTime: generationTime
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
    res.status(500).send("Error converting markdown to PPTX");
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
