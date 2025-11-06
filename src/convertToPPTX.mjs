import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function convertMarkdownToPPTX(markdownText, outputFile, templatePath) {
  const tempFile = path.join(__dirname, `../uploads/temp_${Date.now()}.md`);
  
  // Crear directorio si no existe
  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  // Procesar las imágenes en base64 (aunque ya no deberían venir así)
  const processedMarkdown = markdownText.replace(
    /!\[(.*?)\]\(data:image\/(.*?);base64,(.*?)\)/g,
    (match, alt, type, base64) => {
      const imageFileName = `image_${Date.now()}.${type}`;
      const imagePath = path.join(uploadsDir, imageFileName);
      
      // Guardar la imagen
      fs.writeFileSync(imagePath, Buffer.from(base64, 'base64'));
      console.log(`✅ Saved base64 image: ${imageFileName}`);
      
      // Devolver el markdown con la ruta local
      return `![${alt}](${imagePath})`;
    }
  );
  
  fs.writeFileSync(tempFile, processedMarkdown);
  console.log("📝 Markdown saved to:", tempFile);

  // Construir comando con o sin template
  let command;
  if (templatePath) {
    console.log("🎨 Using template:", templatePath);
    command = `pandoc "${tempFile}" -o "${outputFile}" --from markdown --to pptx --reference-doc="${templatePath}"`;
  } else {
    console.log("📋 Using default Pandoc template");
    command = `pandoc "${tempFile}" -o "${outputFile}" --from markdown --to pptx`;
  }
  
  console.log("🧠 Running command:", command);

  return new Promise((resolve, reject) => {
    exec(command, { shell: true, cwd: path.join(__dirname, '..') }, (error, stdout, stderr) => {
      console.log("📤 Pandoc stdout:", stdout);
      if (stderr) console.warn("⚠️ Pandoc stderr:", stderr);
      
      // Limpiar archivo temporal
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
        console.log("🧹 Cleaned up temp file");
      }
      
      if (error) {
        console.error("❌ Pandoc conversion failed:", error.message);
        console.error("❌ Command was:", command);
        reject(new Error(`Pandoc failed: ${error.message}`));
      } else {
        console.log(`✅ Markdown converted to: ${outputFile}`);
        resolve(outputFile);
      }
    });
  });
}
