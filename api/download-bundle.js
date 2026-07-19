/* GET /api/download-bundle?order_id=..&payment_id=..&signature=..&items=JSON
 *
 * Delivers a ZIP of watermark-free originals for a cart order.
 * Three security gates:
 *   1. HMAC signature validates the payment is genuine
 *   2. Razorpay order must be "paid"
 *   3. Every requested photo must be listed in the order's notes.items
 * Then each .enc is decrypted and packed into a ZIP.
 *
 * The ZIP is assembled with Node built-ins only (no archiver / npm deps) as a
 * "stored" archive — jpegs are already compressed, so we skip deflate. This
 * keeps the serverless function free of any dependency that could fail to load
 * on Vercel's runtime (the earlier archiver-based version crashed on invoke).
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const CANONICAL = "https://the-long-light-xi.vercel.app";

/* --- Minimal store-only ZIP writer (CRC32 + local/central headers + EOCD) --- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function buildZip(files) {
  const chunks = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const crc = crc32(f.data);
    const size = f.data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);   // local file header signature
    local.writeUInt16LE(20, 4);            // version needed
    local.writeUInt16LE(0, 6);             // flags
    local.writeUInt16LE(0, 8);             // method = 0 (store)
    local.writeUInt16LE(0, 10);            // mod time
    local.writeUInt16LE(0x21, 12);         // mod date (1980-01-01)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);         // compressed size
    local.writeUInt32LE(size, 22);         // uncompressed size
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);            // extra length
    chunks.push(local, name, f.data);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);      // central dir signature
    cen.writeUInt16LE(20, 4);              // version made by
    cen.writeUInt16LE(20, 6);              // version needed
    cen.writeUInt16LE(0, 8);               // flags
    cen.writeUInt16LE(0, 10);              // method
    cen.writeUInt16LE(0, 12);              // mod time
    cen.writeUInt16LE(0x21, 14);           // mod date
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(size, 20);
    cen.writeUInt32LE(size, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt16LE(0, 30);              // extra length
    cen.writeUInt16LE(0, 32);              // comment length
    cen.writeUInt16LE(0, 34);              // disk number start
    cen.writeUInt16LE(0, 36);              // internal attrs
    cen.writeUInt32LE(0, 38);              // external attrs
    cen.writeUInt32LE(offset, 42);         // local header offset
    central.push(Buffer.concat([cen, name]));

    offset += local.length + name.length + size;
  }

  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);       // EOCD signature
  eocd.writeUInt16LE(0, 4);                // disk number
  eocd.writeUInt16LE(0, 6);                // disk with central dir
  eocd.writeUInt16LE(files.length, 8);     // records on this disk
  eocd.writeUInt16LE(files.length, 10);    // total records
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);          // central dir offset
  eocd.writeUInt16LE(0, 20);               // comment length
  return Buffer.concat([...chunks, centralBuf, eocd]);
}

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const q = req.query || {};
  const orderId = q.order_id, paymentId = q.payment_id, signature = q.signature;
  let requestedItems;
  try {
    requestedItems = JSON.parse(q.items || "[]");
    if (!Array.isArray(requestedItems) || requestedItems.length === 0) throw new Error();
  } catch (e) {
    return res.status(400).json({ error: "Missing or invalid items parameter" });
  }

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ error: "Missing payment parameters" });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  const encKey = process.env.DOWNLOAD_ENC_KEY;
  if (!secret || !encKey || encKey.length !== 64) {
    return res.status(401).json({ error: "Download is not configured on the server" });
  }

  /* Gate 1: HMAC signature */
  const expected = crypto.createHmac("sha256", secret).update(orderId + "|" + paymentId).digest("hex");
  const provided = String(signature);
  const sigOk = expected.length === provided.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  if (!sigOk) return res.status(403).json({ error: "Invalid payment signature" });

  /* Gates 2 + 3: confirm order is paid and items match */
  let allowedPaths;
  try {
    const auth = "Basic " + Buffer.from(process.env.RAZORPAY_KEY_ID + ":" + secret).toString("base64");
    const r = await fetch("https://api.razorpay.com/v1/orders/" + encodeURIComponent(orderId), { headers: { Authorization: auth } });
    if (!r.ok) return res.status(402).json({ error: "Could not confirm the order" });
    const order = await r.json();
    if (order.status !== "paid") return res.status(402).json({ error: "This order is not paid" });
    allowedPaths = JSON.parse(order.notes && order.notes.items ? order.notes.items : "[]");
    if (!Array.isArray(allowedPaths)) allowedPaths = [];
  } catch (e) {
    return res.status(502).json({ error: "Could not reach the payment provider" });
  }

  /* Validate each requested photo is in the paid order */
  const key = Buffer.from(encKey, "hex");
  for (const photoPath of requestedItems) {
    if (!allowedPaths.includes(photoPath)) {
      return res.status(403).json({ error: "Photo not in this order: " + photoPath });
    }
  }

  /* Decrypt each requested photo into memory */
  const files = [];
  for (const photoPath of requestedItems) {
    const slug = path.basename(String(photoPath)).replace(/\.[a-z0-9]+$/i, "");
    if (!/^[a-z0-9-]+$/.test(slug)) continue;

    let blob;
    const localPath = path.join(process.cwd(), "private", slug + ".enc");
    try {
      if (fs.existsSync(localPath)) {
        blob = fs.readFileSync(localPath);
      } else {
        const er = await fetch(CANONICAL + "/private/" + slug + ".enc");
        if (!er.ok) continue;
        blob = Buffer.from(await er.arrayBuffer());
      }
    } catch (e) { continue; }

    try {
      const iv = blob.subarray(0, 12), tag = blob.subarray(12, 28), data = blob.subarray(28);
      const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
      d.setAuthTag(tag);
      const clean = Buffer.concat([d.update(data), d.final()]);
      files.push({ name: "the-long-light-" + slug + ".jpg", data: clean });
    } catch (e) { continue; }
  }

  if (files.length === 0) {
    return res.status(404).json({ error: "None of the requested photos could be prepared" });
  }

  const zip = buildZip(files);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="the-long-light-downloads.zip"');
  res.setHeader("Content-Length", String(zip.length));
  res.setHeader("Cache-Control", "no-store");
  return res.end(zip);
};
