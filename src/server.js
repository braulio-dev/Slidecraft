import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import { convertMarkdownToPPTX } from "./convertToPPTX.js";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

const app = express();
const PORT = 4000;

// --- Corregir __dirname en módulos ES ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middlewares ---
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// --- Inicializar base de datos LowDB ---
const dbFile = path.join(__dirname, "db.json");
const adapter = new JSONFile(dbFile);
const db = new Low(adapter, { conversions: [] });

// Cargar datos existentes o crear archivo vacío
await db.read();
if (!db.data) db.data = { conversions: [] };


// --- Endpoint para cargar el chat guardado ---
app.get("/load", async (req, res) => {
  try {
    await db.read(); // Aseguramos que lea lo más reciente del archivo
    res.json(db.data); // Devuelve todo el contenido del JSON (por ejemplo, conversions o chats)
  } catch (err) {
    console.error("❌ Error loading saved chat:", err);
    res.status(500).send("Error loading saved chat");
  }
});


// --- Endpoint principal: conversión Markdown -> PPTX ---
app.post("/convert", async (req, res) => {
  try {
    console.log("✅ /convert endpoint hit");

    const { markdown } = req.body;
    if (!markdown) return res.status(400).send("❌ No markdown content received");

    // --- Crear carpeta de salida si no existe ---
    const outputDir = path.resolve(__dirname, "../uploads");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // --- Archivo de salida ---
    const timestamp = Date.now();
    const outputFile = path.join(outputDir, `presentation_${timestamp}.pptx`);
    console.log("📄 Generating presentation at:", outputFile);

    // --- Ruta del template ---
    const templatePath = path.resolve(__dirname, "../templates/template.pptx");
    if (!fs.existsSync(templatePath)) {
      console.error("⚠️ Template not found at:", templatePath);
      return res.status(500).send("Template file not found. Check templates/template.pptx");
    }

    // --- Conversión ---
    await convertMarkdownToPPTX(markdown, outputFile, templatePath);

    // --- Guardar registro en la base de datos ---
    await db.read();
    db.data.conversions.push({
      id: timestamp,
      file: outputFile,
      markdown: markdown.substring(0, 200) + "...",
      timestamp: new Date().toISOString()
    });
    await db.write();
    console.log("💾 Saved conversion record to db.json");

    // --- Enviar el archivo al cliente ---
    res.download(outputFile, (err) => {
      if (err) console.error("Error sending file:", err);
      setTimeout(() => fs.unlink(outputFile, () => {}), 5000);
    });
  } catch (error) {
    console.error("❌ Error converting markdown to PPTX:", error);
    res.status(500).send("Error converting markdown to PPTX");
  }
});

// --- Endpoint opcional: historial de conversiones ---
app.get("/history", async (req, res) => {
  await db.read();
  res.json(db.data.conversions);
});

// --- Inicializar servidor ---
app.listen(PORT, () => {
  console.log(`✅ Pandoc conversion server running at http://localhost:${PORT}`);
});
