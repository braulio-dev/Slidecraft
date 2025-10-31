// server.js
import express from "express";
import fs from "fs";
import { exec } from "child_process";
import path from "path";
import cors from "cors";

const app = express();
// const filename = `presentation_${Date.now()}.pptx`;
// const outputPath = path.join(__dirname, filename);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Convierte Markdown a PPTX con Pandoc
app.post("/convert", async (req, res) => {
  const { markdown } = req.body;
  if (!markdown) return res.status(400).send("Missing markdown content");

  // Guarda el markdown temporalmente
  const mdPath = path.join(process.cwd(), "temp.md");
  const pptxPath = path.join(process.cwd(), "presentation.pptx");
  fs.writeFileSync(mdPath, markdown);

  // Ejecuta Pandoc
  exec(`pandoc "${mdPath}" -o "${pptxPath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error("Pandoc error:", stderr);
      return res.status(500).send("Error generating presentation");
    }
    res.download(pptxPath, "presentation.pptx", (err) => {
      if (err) console.error("Download error:", err);
      // Limpia archivos temporales
      fs.unlinkSync(mdPath);
      fs.unlinkSync(pptxPath);
    });
  });
});

const PORT = 4000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
