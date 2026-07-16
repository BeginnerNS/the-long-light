/* POST /api/create-order
   Creates a Razorpay order for one photograph. Prices are decided HERE,
   server-side, so the browser can never tamper with the amount. */
const Razorpay = require("razorpay");

/* Price per photo in paise (Rs x 100). Add per-photo overrides keyed by
   the image path the site sends; anything not listed uses the default. */
const DEFAULT_PRICE_PAISE = 4900; /* Rs 49 */
const PRICES_PAISE = {
  /* "assets/img/tigers-nest-monastery-print.jpg": 79900, */
};

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

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return res.status(401).json({ error: "Payment keys are not configured" });
  }

  const { photo, title } = req.body || {};
  if (!photo || typeof photo !== "string") {
    return res.status(400).json({ error: "Missing photo id" });
  }

  const amount = PRICES_PAISE[photo] || DEFAULT_PRICE_PAISE;
  if (!Number.isInteger(amount) || amount < 100) {
    return res.status(400).json({ error: "Amount must be at least 100 paise" });
  }

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  try {
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: ("photo-" + Date.now()).slice(0, 40),
      notes: {
        photo,
        title: String(title || "").slice(0, 200),
      },
    });
    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    const status = err && err.statusCode === 401 ? 401 : 500;
    return res.status(status).json({ error: "Could not create order" });
  }
};
