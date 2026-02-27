
// Genera miniaturas PNG de la primera diapositiva de cada PPTX usando LibreOffice

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Scan the templates/ folder and generate a PNG thumbnail for each .pptx
 * file whose thumbnail is missing or outdated.
 *
 * @param {string} [basePath]  Project root (defaults to .. relative to this file)
 */
export function generateThumbnails(basePath) {
  const root          = basePath || path.resolve(__dirname, '..');
  const templatesDir  = path.join(root, 'templates');
  const thumbnailsDir = path.join(root, 'public', 'thumbnails');

  try {
    fs.mkdirSync(thumbnailsDir, { recursive: true });

    if (!fs.existsSync(templatesDir)) {
      console.log('⚠️  No templates/ directory - skipping thumbnail generation');
      return;
    }

    const pptxFiles = fs.readdirSync(templatesDir).filter(f => f.endsWith('.pptx'));
    if (pptxFiles.length === 0) {
      console.log('ℹ️  No .pptx templates found');
      return;
    }

    // Check if LibreOffice and pdftoppm are available
    const hasLibreOffice = commandExists('libreoffice');
    const hasPdftoppm    = commandExists('pdftoppm');

    if (!hasLibreOffice || !hasPdftoppm) {
      console.log('⚠️  LibreOffice or pdftoppm not found - cannot generate real thumbnails');
      console.log(`    libreoffice: ${hasLibreOffice ? '✅' : '❌'}  pdftoppm: ${hasPdftoppm ? '✅' : '❌'}`);
      return;
    }

    console.log(`🖼️  Checking thumbnails for ${pptxFiles.length} template(s)...`);

    const stats = { generated: 0, cached: 0, failed: 0 };

    for (const file of pptxFiles) {
      const baseName  = file.replace('.pptx', '');
      const pptxPath  = path.join(templatesDir, file);
      const pptxMtime = fs.statSync(pptxPath).mtimeMs;

      // -- Cache check --
      const pngPath = path.join(thumbnailsDir, `${baseName}.png`);
      if (fs.existsSync(pngPath) && fs.statSync(pngPath).mtimeMs >= pptxMtime) {
        stats.cached++;
        continue;
      }

      // -- Render first slide --
      if (renderFirstSlide(pptxPath, pngPath, baseName)) {
        // Remove stale SVG / JPEG if present
        cleanStaleFormats(thumbnailsDir, baseName);
        stats.generated++;
      } else {
        stats.failed++;
      }
    }

    console.log(
      `📊 Thumbnails: ${stats.generated} generated, ${stats.cached} cached, ${stats.failed} failed`
    );
  } catch (error) {
    console.error('❌ Thumbnail generation error:', error.message);
  }
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function commandExists(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * PPTX  ->  PDF (via LibreOffice)  ->  first-page PNG (via pdftoppm)
 */
function renderFirstSlide(pptxPath, pngOutPath, label) {
  const tmpDir = fs.mkdtempSync(path.join(path.dirname(pngOutPath), '.thumb-'));

  try {
    // 1. PPTX -> PDF   (set HOME to writable dir so LO doesn't fail as root)
    execSync(
      `libreoffice --headless --norestore --convert-to pdf --outdir "${tmpDir}" "${pptxPath}"`,
      { stdio: 'pipe', timeout: 120_000, env: { ...process.env, HOME: tmpDir } }
    );

    const pdfName = path.basename(pptxPath).replace('.pptx', '.pdf');
    const pdfPath = path.join(tmpDir, pdfName);

    if (!fs.existsSync(pdfPath)) {
      console.log(`  ❌ ${label} - LibreOffice did not produce a PDF`);
      return false;
    }

    // 2. First page of PDF -> PNG  (resolution 150 dpi ~ 1500x840 for 16:9)
    const pngPrefix = path.join(tmpDir, label);
    execSync(
      `pdftoppm -f 1 -l 1 -png -r 150 -singlefile "${pdfPath}" "${pngPrefix}"`,
      { stdio: 'ignore', timeout: 15_000 }
    );

    const renderedPng = `${pngPrefix}.png`;
    if (!fs.existsSync(renderedPng)) {
      console.log(`  ❌ ${label} - pdftoppm did not produce a PNG`);
      return false;
    }

    // 3. Move to final location
    fs.copyFileSync(renderedPng, pngOutPath);
    console.log(`  ✅ ${label} - first-slide thumbnail generated`);
    return true;
  } catch (error) {
    console.error(`  ❌ ${label} - render error: ${error.message}`);
    return false;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

function cleanStaleFormats(dir, baseName) {
  for (const ext of ['svg', 'jpeg', 'jpg']) {
    const p = path.join(dir, `${baseName}.${ext}`);
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  }
}

/* ------------------------------------------------------------------ */
/*  Standalone execution                                               */
/* ------------------------------------------------------------------ */
const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  generateThumbnails();
}
