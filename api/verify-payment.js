/* POST /api/verify-payment
   Confirms a payment really happened: recomputes
   HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET) and compares it
   to the signature Razorpay handed the browser. Only a match counts. */
const crypto = require("crypto");

const ALLOWED_ORIGINS = [
  "https://beginnerns.github.io",
  "http://localhost:5050",
  "http://localhost:5051",
];

function applyCors(req, res) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async (req, res) => {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.RAZORPAY_KEY_SECRET) {
    return res.status(401).json({ error: "Payment keys are not configured" });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ verified: false, error: "Missing required fields" });
  }

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  const provided = String(razorpay_signature);
  const match =
    expected.length === provided.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));

  if (!match) {
    return res.status(400).json({ verified: false, error: "Signature mismatch" });
  }
  return res.status(200).json({ verified: true });
};
