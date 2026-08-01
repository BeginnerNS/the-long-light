/* build-pinterest-feed.mjs — generate a Pinterest catalog data source (CSV)
 * from the gallery in index.html. Each photograph becomes a product row.
 *   node tools/build-pinterest-feed.mjs
 * Output: pinterest-catalog.csv at repo root, served at
 *   https://the-long-light-xi.vercel.app/pinterest-catalog.csv
 * Register that URL in Pinterest → Business → Catalogs → Add data source.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SITE = "https://the-long-light-xi.vercel.app";
const PRICE = "49.00 INR";
const BRAND = "The Long Light";
const GCAT = "Home & Garden > Decor > Artwork > Posters, Prints & Visual Artwork";

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

/* pull each gallery figure: category, image slug, alt, title */
const figRe = /<figure class="shot reveal"[^>]*data-cat="([^"]+)"[\s\S]*?<img src="assets\/img\/([^"]+\.jpg)"[^>]*alt="([^"]*)"[\s\S]*?<span class="shot__title">([^<]*)<\/span>/g;

const rows = [];
let m;
while ((m = figRe.exec(html)) !== null) {
  const [, cat, file, alt, title] = m;
  const slug = file.replace(/\.jpg$/, "");
  const pretty = cat.charAt(0).toUpperCase() + cat.slice(1);
  rows.push({
    id: slug,
    title: decode(title).slice(0, 100),
    description: decode(alt) || decode(title),
    link: SITE + "/index.html",
    image_link: SITE + "/assets/img/" + file,
    price: PRICE,
    availability: "in stock",
    condition: "new",
    brand: BRAND,
    google_product_category: GCAT,
    product_type: "Photography > " + pretty
  });
}

function decode(s) {
  return String(s)
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'").replace(/&mdash;/g, "—")
    .trim();
}
function csv(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const cols = ["id", "title", "description", "link", "image_link", "price",
  "availability", "condition", "brand", "google_product_category", "product_type"];
const out = [cols.join(",")]
  .concat(rows.map((r) => cols.map((c) => csv(r[c])).join(",")))
  .join("\n") + "\n";

fs.writeFileSync(path.join(ROOT, "pinterest-catalog.csv"), out);
console.log(`Wrote pinterest-catalog.csv — ${rows.length} products.`);
