/* encrypt-originals.mjs — encrypt the clean full-res originals so they can be
 * committed to the PUBLIC repo safely and served only to paying buyers.
 *
 * Each _originals/<IMG>.jpg is encrypted with AES-256-GCM into
 * private/<site-slug>.enc  (layout: iv[12] + authTag[16] + ciphertext).
 * The key lives ONLY in the DOWNLOAD_ENC_KEY env var (local .env + Vercel).
 * Without the key the .enc files are useless noise, so publishing them is safe.
 *
 *   node tools/encrypt-originals.mjs      (generates a key into .env if missing)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const ORIG = path.join(ROOT, "_originals");
const OUT = path.join(ROOT, "private");
const ENV = path.join(ROOT, ".env");

/* load .env */
if (fs.existsSync(ENV)) {
  for (const line of fs.readFileSync(ENV, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

/* ensure a key exists; generate + append to .env if not */
let keyHex = process.env.DOWNLOAD_ENC_KEY;
if (!keyHex || keyHex.length !== 64) {
  keyHex = crypto.randomBytes(32).toString("hex");
  fs.appendFileSync(ENV, `${fs.existsSync(ENV) ? "" : ""}DOWNLOAD_ENC_KEY=${keyHex}\n`);
  console.log("Generated a new DOWNLOAD_ENC_KEY and saved it to .env");
  console.log(">>> Copy this SAME value into Vercel env vars (see instructions).");
}
const key = Buffer.from(keyHex, "hex");

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

fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const [id, slug] of Object.entries(SLUG)) {
  const src = path.join(ORIG, id + ".jpg");
  if (!fs.existsSync(src)) { console.warn("MISSING original:", id); continue; }
  const data = fs.readFileSync(src);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  fs.writeFileSync(path.join(OUT, slug + ".enc"), Buffer.concat([iv, tag, enc]));
  console.log(`encrypted ${slug}.enc  (${Math.round(data.length / 1024)}KB clean)`);
  n++;
}
console.log(`\nDone: ${n} originals encrypted into private/. Safe to commit.`);
