const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

/**
 * Verifies Meta's X-Hub-Signature-256 header on incoming webhook requests.
 *
 * Requires the raw request body to be captured (see captureRawBody below).
 * If META_APP_SECRET is not configured the middleware logs a warning and
 * passes through — so local development without secrets still works.
 */
function verifyWebhookSignature(req, res, next) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("⚠️ [WEBHOOK] META_APP_SECRET not set — rejecting in production");
      return res.sendStatus(401);
    }
    console.warn("⚠️ [WEBHOOK] META_APP_SECRET not set — skipping signature check (non-prod)");
    return next();
  }

  const signature = req.get("x-hub-signature-256");
  if (!signature || !signature.startsWith("sha256=")) {
    return res.sendStatus(401);
  }
  const expected = "sha256=" + crypto
    .createHmac("sha256", appSecret)
    .update(req.rawBody || "")
    .digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.sendStatus(401);
  }
  next();
}

/** Capture the raw body so signature verification can hash it. */
function captureRawBody(req, _res, buf) {
  req.rawBody = buf;
}

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests" },
});

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many login attempts. Try again later." },
});

function buildCorsOptions() {
  const raw = process.env.CORS_ORIGINS || "";
  const origins = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    // Permissive default for local development only
    return {
      origin: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: false,
    };
  }

  return {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (origins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  };
}

module.exports = {
  verifyWebhookSignature,
  captureRawBody,
  apiLimiter,
  authLimiter,
  buildCorsOptions,
};
