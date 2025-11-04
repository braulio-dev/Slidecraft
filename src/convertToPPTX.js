import { exec } from "child_process";
import fs from "fs";
import path from "path";

export async function convertMarkdownToPPTX(markdownText, outputFile = "presentation.pptx") {
  const tempFile = "temp.md";
  fs.writeFileSync(tempFile, markdownText);

  const templatePath = path.join(__dirname, "../templates/template.pptx");
  console.log("DEBUG: templatePath ->", templatePath);
  if (!fs.existsSync(templatePath)) {
    fs.unlinkSync(tempFile);
    throw new Error("Template not found: " + templatePath);
  }

  const command = `pandoc "${tempFile}" -o "${outputFile}" --from markdown --to pptx --reference-doc="${templatePath}"`;
  console.log("DEBUG: pandoc command ->", command);

  return new Promise((resolve, reject) => {
    exec(command, { shell: true }, (error, stdout, stderr) => {
      console.log("pandoc stdout:", stdout);
      console.log("pandoc stderr:", stderr);
      if (error) {
        console.error("Pandoc conversion failed:", stderr || error);
        reject(error);
      } else {
        console.log(`✅ Markdown convertido a ${outputFile}`);
        fs.unlinkSync(tempFile);
        resolve(outputFile);
      }
    });
  });
}
