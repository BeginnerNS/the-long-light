/* verify-site.mjs — CI sanity checks, run by GitHub Actions on every push
 * (and locally via `npm run verify`). Fails the build if the site is broken. */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_IMAGE_KB = 900;
const errors = [];

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

/* 1. every local image referenced in index.html must exist */
const refs = [...html.matchAll(/(?:src|data-full)="(assets\/[^"]+)"/g)].map((m) => m[1]);
for (const rel of new Set(refs)) {
  if (!fs.existsSync(path.join(ROOT, rel))) errors.push(`Missing image: ${rel} is referenced in index.html but not in the repo.`);
}

/* 2. gallery images must stay web-sized (performance guard) */
const imgDir = path.join(ROOT, "assets", "img");
for (const f of fs.readdirSync(imgDir)) {
  const kb = Math.round(fs.statSync(path.join(imgDir, f)).size / 1024);
  if (kb > MAX_IMAGE_KB) errors.push(`Oversized image: assets/img/${f} is ${kb}KB (max ${MAX_IMAGE_KB}KB). Full-res files must never be committed - the repo is public.`);
}

/* 3. secrets must never be tracked by git */
let gitBin = "git";
if (fs.existsSync("C:\\Program Files\\Git\\cmd\\git.exe")) {
  gitBin = '"C:\\Program Files\\Git\\cmd\\git.exe"';
}
const tracked = execSync(`${gitBin} ls-files`, { cwd: ROOT, encoding: "utf8" }).split(/\r?\n/);
if (tracked.includes(".env")) errors.push(".env is tracked by git - remove it immediately (git rm --cached .env) and rotate the keys.");
const trackedContent = tracked.filter((f) => /\.(js|mjs|html|css|json|md)$/.test(f));
for (const f of trackedContent) {
  const text = fs.readFileSync(path.join(ROOT, f), "utf8");
  const m = text.match(/rzp_(test|live)_[A-Za-z0-9]{10,}[^"'\s]*['"]?\s*[:=]\s*['"][A-Za-z0-9]{15,}/);
  if (m) errors.push(`Possible key+secret pair committed in ${f} - keys belong in env vars only.`);
}

/* 4. the gallery insert marker must survive (add-photos.mjs depends on it) */
if (!html.includes("<!-- gallery:insert")) errors.push("index.html lost the <!-- gallery:insert --> marker; npm run add-photos will fail.");

/* 5. required payment plumbing stays intact */
for (const rel of ["api/create-order.js", "api/verify-payment.js", "assets/js/main.js"]) {
  if (!fs.existsSync(path.join(ROOT, rel))) errors.push(`Missing required file: ${rel}`);
}

if (errors.length) {
  console.error(`FAILED - ${errors.length} problem(s):\n`);
  for (const e of errors) console.error("  ✗ " + e);
  process.exit(1);
}
console.log(`OK - checked ${new Set(refs).size} image refs, ${fs.readdirSync(imgDir).length} images, ${trackedContent.length} tracked files. Site is sane.`);
