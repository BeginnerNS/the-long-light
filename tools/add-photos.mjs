/* add-photos.mjs — the "add a photo" pipeline for The Long Light.
 *
 * Drop full-resolution photos into new-photos/ named like:
 *     landscape--first-light-on-the-ridge.jpg
 *     street--rain-on-mg-road.jpg
 *   (category is "landscape" or "street"; the rest becomes the title)
 *
 * Then run:
 *     npm run add-photos            process + update index.html
 *     npm run add-photos -- --push  ...and commit + push (deploys the site)
 *
 * For each photo this script:
 *   1. resizes to 1800px on the long edge, quality 82
 *   2. bakes in the watermark (diagonal centre + corner mark)
 *   3. writes the web copy to assets/img/<slug>.jpg
 *   4. inserts a gallery <figure> block into index.html
 *   5. moves the clean original into _originals/ (gitignored backup)
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INCOMING = path.join(ROOT, "new-photos");
const OUT_DIR = path.join(ROOT, "assets", "img");
const ARCHIVE = path.join(ROOT, "_originals");
const INDEX = path.join(ROOT, "index.html");
const MARKER = "<!-- gallery:insert";
const MAX_EDGE = 1800;
const WATERMARK = "The Long Light";
const CATEGORIES = new Set(["landscape", "street"]);

function titleCase(slugWords) {
  const s = slugWords.replace(/-+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function watermarkSvg(w, h) {
  /* keep in sync with tools/rewatermark.mjs: smaller marks, low opacity */
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

function figureBlock(relSrc, title, cat, w, h) {
  const t = escapeHtml(title);
  const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
  /* first line has no indent: it lands where the marker's own indent already is */
  return [
    `<figure class="shot reveal" data-cat="${cat}">`,
    `          <button class="shot__btn" type="button" aria-label="Open image: ${t}">`,
    `            <img src="${relSrc}" data-full="${relSrc}" alt="${t}" loading="lazy" width="${w}" height="${h}">`,
    `          </button>`,
    `          <figcaption class="shot__cap"><span class="shot__title">${t}</span><span class="shot__cat">${catLabel}</span></figcaption>`,
    `        </figure>`,
    ``,
  ].join("\n");
}

async function main() {
  const push = process.argv.includes("--push");
  if (!fs.existsSync(INCOMING)) fs.mkdirSync(INCOMING, { recursive: true });
  const files = fs.readdirSync(INCOMING).filter((f) => /\.(jpe?g|png|webp|tiff?)$/i.test(f));

  if (files.length === 0) {
    console.log(`Nothing to do - put photos in new-photos\\ first.`);
    console.log(`Name them like: landscape--first-light-on-the-ridge.jpg`);
    return;
  }

  let html = fs.readFileSync(INDEX, "utf8");
  if (!html.includes(MARKER)) {
    throw new Error(`index.html is missing the "${MARKER}" marker - cannot insert gallery blocks.`);
  }

  const added = [];
  for (const file of files) {
    const m = file.match(/^(\w+)--(.+)\.(jpe?g|png|webp|tiff?)$/i);
    if (!m || !CATEGORIES.has(m[1].toLowerCase())) {
      console.warn(`SKIP ${file}: name it "<landscape|street>--<title-with-dashes>.jpg"`);
      continue;
    }
    const cat = m[1].toLowerCase();
    const slug = m[2].toLowerCase().replace(/[^a-z0-9-]/g, "");
    const title = titleCase(m[2]);
    const outName = `${slug}.jpg`;
    const outPath = path.join(OUT_DIR, outName);
    if (fs.existsSync(outPath)) {
      console.warn(`SKIP ${file}: assets/img/${outName} already exists.`);
      continue;
    }

    const srcPath = path.join(INCOMING, file);
    const img = sharp(srcPath, { failOn: "none" }).rotate(); /* respect EXIF orientation */
    const meta = await img.metadata();
    const scale = Math.min(1, MAX_EDGE / Math.max(meta.width, meta.height));
    const w = Math.round(meta.width * scale);
    const h = Math.round(meta.height * scale);

    await img
      .resize(w, h)
      .composite([{ input: watermarkSvg(w, h) }])
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(outPath);

    const rel = `assets/img/${outName}`;
    html = html.replace(MARKER, figureBlock(rel, title, cat, w, h) + "        " + MARKER);

    fs.renameSync(srcPath, path.join(ARCHIVE, file));
    const kb = Math.round(fs.statSync(outPath).size / 1024);
    console.log(`ADDED  ${title}  [${cat}]  ${w}x${h}  ${kb}KB  -> ${rel}`);
    added.push(title);
  }

  if (added.length === 0) {
    console.log("No photos were added.");
    return;
  }

  fs.writeFileSync(INDEX, html);
  console.log(`\nUpdated index.html with ${added.length} photo(s). Originals archived to _originals\\.`);

  if (push) {
    execSync("git add assets/img index.html", { cwd: ROOT, stdio: "inherit" });
    execSync(`git commit -m "Add photos: ${added.join(", ").slice(0, 120)}"`, { cwd: ROOT, stdio: "inherit" });
    execSync("git push", { cwd: ROOT, stdio: "inherit" });
    console.log("\nPushed - GitHub Pages and Vercel will deploy in ~1 minute.");
  } else {
    console.log(`Review locally, then deploy with: git add assets/img index.html && git commit -m "Add photos" && git push`);
    console.log(`(or run: npm run add-photos -- --push next time)`);
  }
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
