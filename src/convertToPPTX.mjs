import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function convertMarkdownToPPTX(markdownText, outputFile, templatePath) {
  const tempFile = path.join(path.dirname(outputFile), `temp_${Date.now()}.md`);

  try {
    // Procesar las imágenes en base64 (aunque ya no deberían venir así)
    const processedMarkdown = markdownText.replace(
      /!\[(.*?)\]\(data:image\/(.*?);base64,(.*?)\)/g,
      (match, alt, type, base64) => {
        const imageFileName = `image_${Date.now()}.${type}`;
        const imagePath = path.join(path.dirname(outputFile), imageFileName);

        // Guardar la imagen
        fs.writeFileSync(imagePath, Buffer.from(base64, 'base64'));
        console.log(`✅ Saved base64 image: ${imageFileName}`);

        // Devolver el markdown con la ruta local
        return `![${alt}](${imagePath})`;
      }
    );

    // Escribir archivo temporal
    fs.writeFileSync(tempFile, processedMarkdown, 'utf8');
    console.log("📝 Markdown saved to:", tempFile);

    // Find pandoc executable - try common Windows locations
    let pandocPath = 'pandoc'; // Default, try PATH first
    const possiblePaths = [
      'C:\\Program Files\\Pandoc\\pandoc.exe',
      'C:\\Program Files (x86)\\Pandoc\\pandoc.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Pandoc', 'pandoc.exe'),
      path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Pandoc', 'pandoc.exe')
    ];

    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        pandocPath = possiblePath;
        console.log("📍 Found Pandoc at:", pandocPath);
        break;
      }
    }

    // Construir comando con o sin template
    let command;
    if (templatePath) {
      console.log("🎨 Using template:", templatePath);
      command = `"${pandocPath}" "${tempFile}" -o "${outputFile}" --from markdown --to pptx --slide-level=2 --reference-doc="${templatePath}"`;
    } else {
      console.log("📋 Using default Pandoc template");
      command = `"${pandocPath}" "${tempFile}" -o "${outputFile}" --from markdown --to pptx --slide-level=2`;
    }

    console.log("🔄 Running command:", command);

    // Ejecutar pandoc
    await new Promise((resolve, reject) => {
      exec(command, { shell: true }, (error, stdout, stderr) => {
        console.log("📤 Pandoc stdout:", stdout);
        if (stderr) console.warn("⚠️ Pandoc stderr:", stderr);

        if (error) {
          console.error("❌ Pandoc conversion failed:", error.message);
          console.error("❌ Command was:", command);
          reject(new Error(`Pandoc failed: ${error.message}`));
          return;
        }
        resolve(stdout);
      });
    });

    // Verificar archivo generado
    if (!fs.existsSync(outputFile)) {
      throw new Error('PPTX file was not generated');
    }

    console.log("✅ PPTX generated at:", outputFile);
    return outputFile;

  } catch (error) {
    console.error("❌ Error in conversion:", error);
    throw error;
  } finally {
    // Limpiar archivo temporal
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
      console.log("🧹 Temp file cleaned up");
    }
  }
}
