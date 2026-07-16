/* GET /api/download?order_id=..&payment_id=..&signature=..&photo=assets/img/<slug>.jpg
 *
 * Delivers the clean, watermark-free original — but ONLY to someone who has
 * genuinely paid for THAT photo. Three gates before a single byte is served:
 *   1. HMAC signature must match (proves Razorpay issued this order+payment)
 *   2. Razorpay must confirm the order status is "paid"
 *   3. the order's notes.photo must equal the requested photo (so one payment
 *      can't unlock the whole gallery)
 * Then the encrypted original is fetched, decrypted with DOWNLOAD_ENC_KEY,
 * and streamed as an attachment. The clean file never exists in public form.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const CANONICAL = "https://the-long-light-xi.vercel.app";

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const q = req.query || {};
  const orderId = q.order_id, paymentId = q.payment_id, signature = q.signature, photo = q.photo;
  if (!orderId || !paymentId || !signature || !photo) {
    return res.status(400).json({ error: "Missing parameters" });
  }
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const encKey = process.env.DOWNLOAD_ENC_KEY;
  if (!secret || !encKey || encKey.length !== 64) {
    return res.status(401).json({ error: "Download is not configured on the server" });
  }

  /* gate 1: signature */
  const expected = crypto.createHmac("sha256", secret).update(orderId + "|" + paymentId).digest("hex");
  const provided = String(signature);
  const sigOk = expected.length === provided.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  if (!sigOk) return res.status(403).json({ error: "Invalid payment signature" });

  /* slug from the requested photo path */
  const slug = path.basename(String(photo)).replace(/\.[a-z0-9]+$/i, "");
  if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: "Bad photo id" });

  /* gates 2 + 3: confirm with Razorpay that this order is paid and for this photo */
  try {
    const auth = "Basic " + Buffer.from(process.env.RAZORPAY_KEY_ID + ":" + secret).toString("base64");
    const r = await fetch("https://api.razorpay.com/v1/orders/" + encodeURIComponent(orderId), { headers: { Authorization: auth } });
    if (!r.ok) return res.status(402).json({ error: "Could not confirm the order" });
    const order = await r.json();
    if (order.status !== "paid") return res.status(402).json({ error: "This order is not paid" });
    const boughtPhoto = order.notes && order.notes.photo ? String(order.notes.photo) : "";
    if (path.basename(boughtPhoto).replace(/\.[a-z0-9]+$/i, "") !== slug) {
      return res.status(403).json({ error: "This payment was for a different photo" });
    }
  } catch (e) {
    return res.status(502).json({ error: "Could not reach the payment provider" });
  }

  /* fetch the encrypted original (local fs in dev, static URL in prod) */
  let blob;
  const localPath = path.join(process.cwd(), "private", slug + ".enc");
  try {
    if (fs.existsSync(localPath)) {
      blob = fs.readFileSync(localPath);
    } else {
      const er = await fetch(CANONICAL + "/private/" + slug + ".enc");
      if (!er.ok) return res.status(404).json({ error: "File not found" });
      blob = Buffer.from(await er.arrayBuffer());
    }
  } catch (e) {
    return res.status(404).json({ error: "File not available" });
  }

  /* decrypt */
  let clean;
  try {
    const key = Buffer.from(encKey, "hex");
    const iv = blob.subarray(0, 12), tag = blob.subarray(12, 28), data = blob.subarray(28);
    const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
    d.setAuthTag(tag);
    clean = Buffer.concat([d.update(data), d.final()]);
  } catch (e) {
    return res.status(500).json({ error: "Could not prepare the file" });
  }

  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Content-Disposition", `attachment; filename="the-long-light-${slug}.jpg"`);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(clean);
};
