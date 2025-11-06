import { exec } from "child_process";
import fs from "fs";

export async function convertMarkdownToPPTX(markdownText, outputFile, templatePath) {
  const tempFile = "temp.md";
  fs.writeFileSync(tempFile, markdownText);

  console.log("🎨 Using template:", templatePath);

  const command = `pandoc "${tempFile}" -o "${outputFile}" --from markdown --to pptx --reference-doc="${templatePath}"`;
  console.log("🧠 Running command:", command);

  return new Promise((resolve, reject) => {
    exec(command, { shell: true }, (error, stdout, stderr) => {
      console.log("Pandoc stdout:", stdout);
      if (stderr) console.log("Pandoc stderr:", stderr);
      if (error) {
        console.error("❌ Pandoc conversion failed:", stderr || error);
        reject(error);
      } else {
        console.log(`✅ Markdown converted to: ${outputFile}`);
        fs.unlinkSync(tempFile);
        resolve(outputFile);
      }
    });
  });
}
