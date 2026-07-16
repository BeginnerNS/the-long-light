/* Local test harness: serves the static site and mounts the /api functions
   the same way Vercel does, loading credentials from .env.
   Usage: node dev-server.js   →  http://localhost:5051 */
const http = require("http");
const fs = require("fs");
const path = require("path");

/* load .env into process.env (no dependency needed) */
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  });
}

const createOrder = require("./api/create-order.js");
const verifyPayment = require("./api/verify-payment.js");
const download = require("./api/download.js");

const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon",
};

/* minimal Vercel-style req.body + res.status().json() helpers */
function wrap(handler, req, res) {
  let raw = "";
  req.query = Object.fromEntries(new URL(req.url, "http://localhost").searchParams);
  req.on("data", (c) => { raw += c; });
  req.on("end", () => {
    try { req.body = raw ? JSON.parse(raw) : {}; } catch (e) { req.body = {}; }
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(obj));
      return res;
    };
    res.send = (data) => { res.end(data); return res; };
    Promise.resolve(handler(req, res)).catch((err) => {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(err && err.message || err) }));
    });
  });
}

http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  if (url === "/api/create-order") return wrap(createOrder, req, res);
  if (url === "/api/verify-payment") return wrap(verifyPayment, req, res);
  if (url === "/api/download") return wrap(download, req, res);

  const file = path.join(__dirname, url === "/" ? "index.html" : decodeURIComponent(url));
  if (!file.startsWith(__dirname) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.statusCode = 404;
    return res.end("Not found");
  }
  res.setHeader("Content-Type", MIME[path.extname(file).toLowerCase()] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
}).listen(5051, () => console.log("dev server → http://localhost:5051"));
