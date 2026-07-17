import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PHOTO_DIR = path.join(ROOT, "photography");
const OUT_DIR = path.join(ROOT, "assets", "img");
const ARCHIVE = path.join(ROOT, "_originals");
const PRIVATE_DIR = path.join(ROOT, "private");
const INDEX = path.join(ROOT, "index.html");
const MAPPING_FILE = path.join(ROOT, "scratch", "mapping.json");
const ENV = path.join(ROOT, ".env");
const MARKER = "<!-- gallery:insert";
const MAX_EDGE = 1800;
const WATERMARK = "The Long Light";

function getSlug(title) {
  return title
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function watermarkSvg(w, h) {
  const big = Math.round(w / 18);
  const small = Math.round(w / 55);
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
      `<g transform="translate(${w / 2},${h / 2}) rotate(-30)">` +
      `<text x="2" y="3" text-anchor="middle" dominant-baseline="middle" ` +
      `font-family="Georgia, serif" font-style="italic" font-size="${big}" ` +
      `fill="black" fill-opacity="0.05">${WATERMARK}</text>` +
      `<text x="0" y="0" text-anchor="middle" dominant-baseline="middle" ` +
      `font-family="Georgia, serif" font-style="italic" font-size="${big}" ` +
      `fill="white" fill-opacity="0.09">${WATERMARK}</text>` +
      `</g>` +
      `<text x="${w - 14}" y="${h - 12}" text-anchor="end" ` +
      `font-family="Georgia, serif" font-size="${small}" ` +
      `fill="black" fill-opacity="0.18" dx="1" dy="1">${WATERMARK}</text>` +
      `<text x="${w - 14}" y="${h - 12}" text-anchor="end" ` +
      `font-family="Georgia, serif" font-size="${small}" ` +
      `fill="white" fill-opacity="0.34">${WATERMARK}</text>` +
      `</svg>`
  );
}

function figureBlock(relSrc, title, cat, altText, w, h) {
  const t = escapeHtml(title);
  const alt = escapeHtml(altText);
  const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
  return [
    `<figure class="shot reveal" data-cat="${cat}">`,
    `          <button class="shot__btn" type="button" aria-label="Open image: ${t}">`,
    `            <img src="${relSrc}" data-full="${relSrc}" alt="${alt}" loading="lazy" width="${w}" height="${h}">`,
    `          </button>`,
    `          <figcaption class="shot__cap"><span class="shot__title">${t}</span><span class="shot__cat">${catLabel}</span></figcaption>`,
    `        </figure>`,
    ``,
  ].join("\n");
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function main() {
  // Load environment variables for encryption
  if (fs.existsSync(ENV)) {
    for (const line of fs.readFileSync(ENV, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  }

  let keyHex = process.env.DOWNLOAD_ENC_KEY;
  if (!keyHex || keyHex.length !== 64) {
    keyHex = crypto.randomBytes(32).toString("hex");
    fs.appendFileSync(ENV, `${fs.existsSync(ENV) ? "" : ""}DOWNLOAD_ENC_KEY=${keyHex}\n`);
    console.log("Generated a new DOWNLOAD_ENC_KEY and saved it to .env");
  }
  const encKey = Buffer.from(keyHex, "hex");

  if (!fs.existsSync(MAPPING_FILE)) {
    throw new Error(`Mapping file does not exist at: ${MAPPING_FILE}`);
  }

  const mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, "utf8"));
  const files = fs.readdirSync(PHOTO_DIR).filter((f) => /\.(jpe?g|png|webp|tiff?)$/i.test(f));

  let html = fs.readFileSync(INDEX, "utf8");
  if (!html.includes(MARKER)) {
    throw new Error(`index.html is missing the "${MARKER}" marker - cannot insert gallery blocks.`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(ARCHIVE, { recursive: true });
  fs.mkdirSync(PRIVATE_DIR, { recursive: true });

  let addedCount = 0;
  let skipCount = 0;

  // Let's process sequentially
  for (const filename of files) {
    const metaInfo = mapping[filename];
    if (!metaInfo) {
      console.log(`SKIPPING (not in mapping/repetition): ${filename}`);
      skipCount++;
      continue;
    }

    const { category, title, alt } = metaInfo;
    const slug = getSlug(title);
    const outName = `${slug}.jpg`;
    const outPath = path.join(OUT_DIR, outName);

    if (fs.existsSync(outPath)) {
      console.log(`SKIPPING (already processed/exists in assets): ${filename} -> ${outName}`);
      skipCount++;
      continue;
    }

    const srcPath = path.join(PHOTO_DIR, filename);
    console.log(`PROCESSING: ${filename} -> ${title} (${category})`);

    // 1. Resize and watermark the image
    const img = sharp(srcPath, { failOn: "none" }).rotate();
    const meta = await img.metadata();
    const scale = Math.min(1, MAX_EDGE / Math.max(meta.width, meta.height));
    const w = Math.round(meta.width * scale);
    const h = Math.round(meta.height * scale);

    await img
      .resize(w, h)
      .composite([{ input: watermarkSvg(w, h) }])
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(outPath);

    // 2. Encrypt original clean high-res image
    const rawData = fs.readFileSync(srcPath);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", encKey, iv);
    const encData = Buffer.concat([cipher.update(rawData), cipher.final()]);
    const tag = cipher.getAuthTag();
    const encPath = path.join(PRIVATE_DIR, `${slug}.enc`);
    fs.writeFileSync(encPath, Buffer.concat([iv, tag, encData]));

    // 3. Move the original to _originals backup as <category>--<slug>.jpg
    const archiveName = `${category}--${slug}.jpg`;
    fs.copyFileSync(srcPath, path.join(ARCHIVE, archiveName));

    // 4. Update HTML gallery structure
    const relSrc = `assets/img/${outName}`;
    html = html.replace(MARKER, figureBlock(relSrc, title, category, alt, w, h) + "        " + MARKER);

    addedCount++;
    console.log(`SUCCESS: Added "${title}" to gallery and encrypted original.`);
  }

  if (addedCount > 0) {
    fs.writeFileSync(INDEX, html);
    console.log(`\nImport complete! Added ${addedCount} photo(s). Skipped ${skipCount} files.`);
    console.log(`index.html updated successfully.`);
  } else {
    console.log(`\nNo photos were added. (All files were already processed or skipped).`);
  }
}

main().catch((err) => {
  console.error("IMPORT FAILED:", err);
  process.exit(1);
});
