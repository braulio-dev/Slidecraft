import { exec } from "child_process";
import fs from "fs";
import path from "path";

export async function convertMarkdownToPPTX(markdownText, outputFile, templatePath) {
  const tempFile = path.join(path.dirname(outputFile), `temp_${Date.now()}.md`);
  
  try {
    // Escribir archivo temporal
    fs.writeFileSync(tempFile, markdownText, 'utf8');
    console.log("📝 Markdown guardado en:", tempFile);

    // Verificar que pandoc está instalado
    await new Promise((resolve, reject) => {
      exec('pandoc --version', (error) => {
        if (error) reject(new Error('Pandoc no está instalado o accesible'));
        resolve();
      });
    });

    // Construir comando
    const command = `pandoc "${tempFile}" -o "${outputFile}" --from markdown --to pptx --reference-doc="${templatePath}"`;
    console.log("🔄 Ejecutando:", command);

    // Ejecutar pandoc
    const result = await new Promise((resolve, reject) => {
      exec(command, { shell: true }, (error, stdout, stderr) => {
        if (stderr) console.warn("⚠️ Pandoc stderr:", stderr);
        if (error) {
          console.error("❌ Error de Pandoc:", error);
          reject(error);
          return;
        }
        resolve(stdout);
      });
    });

    // Verificar archivo generado
    if (!fs.existsSync(outputFile)) {
      throw new Error('El archivo PPTX no fue generado');
    }

    console.log("✅ PPTX generado en:", outputFile);
    return outputFile;

  } catch (error) {
    console.error("❌ Error en conversión:", error);
    throw error;
  } finally {
    // Limpiar archivo temporal
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
      console.log("🧹 Archivo temporal eliminado:", tempFile);
    }
  }
}
