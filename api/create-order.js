/* POST /api/create-order
   Creates a Razorpay order for one or more photographs.
   Accepts { items: [{path, title}, ...] } for cart checkout,
   or legacy { photo, title } for single-photo (backwards compat).
   Prices are decided HERE server-side — browser cannot tamper. */
const Razorpay = require("razorpay");

const PRICE_PAISE = 4900;        /* Rs 49 per photo */
const BUNDLE_OF_3_PAISE = 14000; /* Rs 140 for every 3 (save Rs 7) */

/* Bundle pricing: every complete group of 3 photos costs Rs 140,
   the remaining 1-2 photos are Rs 49 each. Kept identical on the client
   for display, but THIS is the amount actually charged. */
function priceForCountPaise(count) {
  const bundles = Math.floor(count / 3);
  const rest = count % 3;
  return bundles * BUNDLE_OF_3_PAISE + rest * PRICE_PAISE;
}

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

  const body = req.body || {};

  /* Normalise to items array — support legacy single-photo calls */
  let items = [];
  if (Array.isArray(body.items) && body.items.length) {
    items = body.items;
  } else if (body.photo && typeof body.photo === "string") {
    items = [{ path: body.photo, title: body.title || "" }];
  } else {
    return res.status(400).json({ error: "Missing items or photo" });
  }

  /* Validate each path */
  for (const item of items) {
    if (!item.path || typeof item.path !== "string" || !/^assets\/img\/[a-z0-9-]+\.jpg$/.test(item.path)) {
      return res.status(400).json({ error: "Invalid photo path: " + item.path });
    }
  }

  const amount = priceForCountPaise(items.length);

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  try {
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: ("cart-" + Date.now()).slice(0, 40),
      notes: {
        items: JSON.stringify(items.map(function (i) { return i.path; })),
        count: String(items.length),
      },
    });
    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      items: items,
    });
  } catch (err) {
    const status = err && err.statusCode === 401 ? 401 : 500;
    return res.status(status).json({ error: "Could not create order" });
  }
};
