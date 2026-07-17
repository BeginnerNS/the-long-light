/* GET /api/download-bundle?order_id=..&payment_id=..&signature=..&items=JSON
 *
 * Delivers a ZIP of watermark-free originals for a cart order.
 * Three security gates:
 *   1. HMAC signature validates the payment is genuine
 *   2. Razorpay order must be "paid"
 *   3. Every requested photo must be listed in the order's notes.items
 * Then each .enc is decrypted and packed into a ZIP stream.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const CANONICAL = "https://the-long-light-xi.vercel.app";

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

  /* Stream a ZIP containing each decrypted photo */
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="the-long-light-downloads.zip"');
  res.setHeader("Cache-Control", "no-store");

  const archive = archiver("zip", { zlib: { level: 0 } }); /* no compress for jpegs */
  archive.pipe(res);

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
      archive.append(clean, { name: "the-long-light-" + slug + ".jpg" });
    } catch (e) { continue; }
  }

  await archive.finalize();
};
