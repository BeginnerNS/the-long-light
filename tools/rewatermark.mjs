/* rewatermark.mjs — regenerate every web image from the clean originals in
 * _originals/ with the current brand watermark, then rebuild the og-image and
 * the marketing crops. Run after changing watermark text/size/opacity.
 *   node tools/rewatermark.mjs
 */
import fs from "node:fs";
import path from "node:path";

const S = (await import("sharp")).default;
const ROOT = process.cwd();
const ORIG = path.join(ROOT, "_originals");
const IMG = path.join(ROOT, "assets", "img");
const MAX_EDGE = 1800;

const WATERMARK = "The Long Light";
/* Corner mark only — the big diagonal mark across the art was removed so the
   photographs read clean (theft protection lives in the encrypted originals +
   right-click/drag blocking, not in defacing the previews). */
const SMALL_DIV = 58, SMALL_WHITE = 0.30, SMALL_SHADOW = 0.16;

/* original IMG id -> site filename slug */
const SLUG = {
  IMG20260125183516: "dusk-river-pink-sky-wall-art",
  IMG20260604153249: "himalayan-dzong-river-print",
  IMG20260602172701: "prayer-flags-bridge-bhutan",
  IMG20260605110922: "tigers-nest-monastery-print",
  IMG20260602161257: "himalayan-town-street-photo",
  IMG20260602164505: "monsoon-valley-mist-landscape",
  IMG20260604191623: "blue-hour-dzong-golden-walls",
  IMG20260602131032: "golden-temple-roof-blue-sky",
  IMG20260602164939: "purple-verbena-field-botanical",
  IMG20260603101134: "misty-monastery-road-print",
  IMG20260605163912: "blue-hydrangeas-floral-photo",
};
/* original IMG id -> marketing export slug */
const EXPORT = {
  IMG20260125183516: "dusk-river",
  IMG20260604153249: "dzong-above-the-river",
  IMG20260602172701: "prayer-flags-bridge",
  IMG20260605110922: "monastery-on-the-cliff",
  IMG20260602161257: "road-into-the-hills",
  IMG20260602164505: "monsoon-valley",
  IMG20260604191623: "blue-hour-golden-walls",
  IMG20260602131032: "temple-against-the-sky",
  IMG20260602164939: "field-of-verbena",
  IMG20260603101134: "road-from-monastery",
  IMG20260605163912: "hydrangeas",
};

function watermarkSvg(w, h) {
  const small = Math.round(w / SMALL_DIV);
  const T = WATERMARK;
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
      `<text x="${w - 14}" y="${h - 12}" text-anchor="end" font-family="Georgia, serif" font-size="${small}" fill="black" fill-opacity="${SMALL_SHADOW}" dx="1" dy="1">${T}</text>` +
      `<text x="${w - 14}" y="${h - 12}" text-anchor="end" font-family="Georgia, serif" font-size="${small}" fill="white" fill-opacity="${SMALL_WHITE}">${T}</text>` +
      `</svg>`
  );
}

async function watermarkTo(srcPath, outPath) {
  const img = S(srcPath, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const scale = Math.min(1, MAX_EDGE / Math.max(meta.width, meta.height));
  const w = Math.round(meta.width * scale);
  const h = Math.round(meta.height * scale);
  await img.resize(w, h).composite([{ input: watermarkSvg(w, h) }]).jpeg({ quality: 82, mozjpeg: true }).toFile(outPath);
  return { w, h };
}

const IG = path.join(ROOT, "marketing", "exports", "instagram");
const PIN = path.join(ROOT, "marketing", "exports", "pinterest");
const doExports = fs.existsSync(IG) && fs.existsSync(PIN);

let n = 0;
const files = fs.readdirSync(ORIG).filter((f) => /\.(jpe?g)$/i.test(f));
for (const file of files) {
  const name = path.basename(file, path.extname(file));
  let slug = null;
  if (SLUG[name]) {
    slug = SLUG[name];
  } else if (name.includes("--")) {
    slug = name.split("--")[1];
  } else {
    slug = name;
  }
  const src = path.join(ORIG, file);
  const out = path.join(IMG, slug + ".jpg");
  const { w, h } = await watermarkTo(src, out);
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`site  ${slug}.jpg  ${w}x${h}  ${kb}KB`);
  n++;

  if (doExports) {
    const ex = EXPORT[name] || slug;
    await S(out).resize(1080, 1350, { fit: "cover", position: "attention" }).jpeg({ quality: 88 }).toFile(path.join(IG, ex + "-4x5.jpg"));
    await S(out).resize(1000, 1500, { fit: "cover", position: "attention" }).jpeg({ quality: 88 }).toFile(path.join(PIN, ex + "-2x3.jpg"));
  }
}

/* og-image from the (now re-watermarked) hero */
const hero = path.join(IMG, SLUG.IMG20260125183516 + ".jpg");
await S(hero).resize(1200, 630, { fit: "cover", position: "attention" }).jpeg({ quality: 85 }).toFile(path.join(ROOT, "assets", "og-image.jpg"));
console.log(`og-image.jpg rebuilt`);
console.log(`\nDone: ${n} site images re-watermarked "${WATERMARK}"${doExports ? " + 22 marketing crops" : ""} + og-image.`);
