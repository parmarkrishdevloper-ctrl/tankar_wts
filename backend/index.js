require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const helmet = require("helmet");

const connectDB = require("./config/database");
const { saveContact, saveConversation, estimateTokens } = require("./functions/conversationHelper");

const dashboardRoutes = require("./routes/dashboard");
const adminRoutes = require("./routes/admin.js");
const enquiriesRoutes = require("./routes/enquiries.js");
const settingsRoutes = require("./routes/settings.js");
const profileRoutes = require("./routes/profile.js");
const messagesRoutes = require("./routes/messages.js");
const followupsRoutes = require("./routes/followups.js");
const templatesRoutes = require("./routes/templates.js");
const campaignsRoutes = require("./routes/campaigns.js");
const analyticsRoutes = require("./routes/analytics.js");

const {
  getOrCreateEnquiry,
  upsertEnquiryFromMessage,
  createCallbackRequest,
  updateEnquiryData,
  resetEnquiry,
} = require("./functions/enquiryHelper");
const { generateSystemPrompt } = require("./functions/systemPromptGenerator");
const { isUserDisinterested } = require("./functions/responseParser");
const BotConfig = require("./models/BotConfig");

// Try to match user message against a configured Q&A pair.
function matchQA(qaList, userText) {
  if (!Array.isArray(qaList) || qaList.length === 0) return null;
  const text = (userText || "").toLowerCase();
  for (const qa of qaList) {
    if (qa.enabled === false) continue;
    if (!Array.isArray(qa.keywords) || qa.keywords.length === 0) continue;
    if (qa.keywords.some((kw) => kw && text.includes(kw.toLowerCase()))) {
      return qa;
    }
  }
  return null;
}

function applyTemplate(tpl, vars) {
  if (!tpl) return tpl;
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

const { logger, httpLogger } = require("./middleware/logger");
const {
  verifyWebhookSignature,
  captureRawBody,
  apiLimiter,
  authLimiter,
  buildCorsOptions,
} = require("./middleware/security");

const requiredInProd = ["JWT_SECRET", "MONGODB_URI"];
if (process.env.NODE_ENV === "production") {
  const missing = requiredInProd.filter((k) => !process.env[k]);
  if (missing.length) {
    logger.fatal({ missing }, "Missing required environment variables in production");
    process.exit(1);
  }
}

const app = express();
app.set("trust proxy", 1);

connectDB();

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: "1mb", verify: captureRawBody }));
app.use(httpLogger);

const { VERIFY_TOKEN, WHATSAPP_TOKEN, PHONE_NUMBER_ID, GROQ_API_KEY } = process.env;

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.get("/", (_req, res) => {
  res.send("Tankar Solution WhatsApp Bot is running");
});

// Stricter limiter on admin login
app.use("/api/admin/login", authLimiter);

// General API limiter for all /api routes
app.use("/api", apiLimiter);

app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/enquiries", enquiriesRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/followups", followupsRoutes);
app.use("/api/templates", templatesRoutes);
app.use("/api/campaigns", campaignsRoutes);
app.use("/api/analytics", analyticsRoutes);

// ─── Privacy policy (legal) ─────────────────────────────────────
app.get(["/privacy", "/privacy-policy"], (_req, res) => {
  res.send(`
    <html>
      <head><title>Privacy Policy - Tankar Solution</title></head>
      <body style="font-family: sans-serif; padding: 40px; line-height: 1.6; max-width: 800px; margin: auto;">
        <h1>Privacy Policy for Tankar Solution</h1>
        <p>Last updated: ${new Date().toLocaleDateString()}</p>
        <p>Tankar Solution operates a WhatsApp bot to provide website-development consultations.
           We only collect details necessary for project estimation.</p>
        <h2>1. Data we collect</h2>
        <ul><li>Name</li><li>Business details</li><li>Project requirements</li></ul>
        <h2>2. How we use data</h2>
        <p>To provide website-development guidance and quotes. We never sell or share your data.</p>
        <h2>3. Contact</h2>
        <p>For questions, write to <strong>tankarsolution@gmail.com</strong>.</p>
      </body>
    </html>
  `);
});

// ─── WhatsApp webhook ───────────────────────────────────────────
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    logger.info("Webhook verified");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

async function sendWhatsAppMessage(to, body, token, phoneId) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    { messaging_product: "whatsapp", to, text: { body } },
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
  );
}

app.post("/webhook", verifyWebhookSignature, async (req, res) => {
  // Ack Meta immediately — they retry on slow responses.
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const value = entry?.changes?.[0]?.value;
    if (value?.statuses) return;

    const message = value?.messages?.[0];
    if (!message || message.type !== "text") return;

    const from = message.from;
    const userText = message.text?.body;
    if (!userText) return;

    // Load tenant/bot config (single-doc for now)
    const botConfig = await BotConfig.findOne();
    if (botConfig && botConfig.botEnabled === false) {
      logger.info({ phone: from }, "bot disabled — skipping AI reply");
      return;
    }

    // Per-contact pause — admin has taken over this thread manually
    try {
      const Contact = require("./models/Contact");
      const contact = await Contact.findOne({ phoneNumber: from });
      if (contact?.botPaused) {
        logger.info({ phone: from }, "bot paused for contact — skipping AI reply");
        return;
      }
    } catch (err) {
      logger.error({ err: err.message }, "pause check failed");
    }

    // Try Q&A keyword match first (cheap, deterministic, no LLM cost)
    const qaHit = matchQA(botConfig?.qa, userText);
    if (qaHit) {
      logger.info({ phone: from, qaId: qaHit._id?.toString() }, "Q&A keyword match");
      try {
        await saveContact(from);
        await saveConversation(from, userText, qaHit.answer, 0, 0);
      } catch (err) {
        logger.error({ err: err.message }, "Q&A persist failed");
      }
      await sendWhatsAppMessage(from, qaHit.answer, WHATSAPP_TOKEN, PHONE_NUMBER_ID);
      return;
    }

    let enquiry = await getOrCreateEnquiry(from);

    let conversationHistory = [];
    try {
      const Conversation = require("./models/Conversation");
      const recent = await Conversation.findOne({ phoneNumber: from }).sort({ createdAt: -1 });
      if (recent?.messages?.length) {
        conversationHistory = recent.messages.slice(-15).map((m) => ({ role: m.role, content: m.content }));
      }
    } catch (err) {
      logger.error({ err: err.message, phone: from }, "history fetch failed");
    }

    const upsert = await upsertEnquiryFromMessage(from, userText);
    enquiry = upsert.enquiry;

    const isGreeting = /^(hi|hello|hey|greetings|namaste|hola)/i.test(userText.trim());
    if (isGreeting && enquiry.status === "in_progress") {
      logger.info({ phone: from }, "auto-reset on greeting");
      await resetEnquiry(from);
    }

    if (isUserDisinterested(userText, conversationHistory)) {
      logger.info({ phone: from }, "user disinterested — callback queued");
      await createCallbackRequest(from);
    }

    if (upsert.hasAllPrimaryFields && enquiry.status !== "completed") {
      await updateEnquiryData(from, "review", { status: "completed" });
    }

    const stage = enquiry.conversationStage || "greeting";
    let systemPrompt = generateSystemPrompt(stage, enquiry.toJSON());

    // If the admin has supplied a custom prompt template, prepend it as the
    // primary system context (the generated default still steers stage/flow).
    if (botConfig?.promptTemplate?.trim()) {
      const custom = applyTemplate(botConfig.promptTemplate, {
        businessName: botConfig.businessName,
        services: botConfig.services,
        pricing: botConfig.pricing,
        tagline: botConfig.tagline,
        workingHours: botConfig.workingHours,
      });
      systemPrompt = `${custom}\n\n${systemPrompt}`;
    }

    const aiResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
          { role: "user", content: userText },
        ],
        temperature: 0.5,
        max_tokens: 300,
      },
      {
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      }
    );

    const replyText = aiResponse.data?.choices?.[0]?.message?.content
      || "Thanks. Our website specialist will call you shortly.";
    const usage = aiResponse.data.usage || {};
    const inputTokens = usage.prompt_tokens || estimateTokens(userText);
    const outputTokens = usage.completion_tokens || estimateTokens(replyText);

    try {
      await saveContact(from);
      await saveConversation(from, userText, replyText, inputTokens, outputTokens);
    } catch (err) {
      logger.error({ err: err.message, phone: from }, "conversation persist failed");
    }

    await sendWhatsAppMessage(from, replyText, WHATSAPP_TOKEN, PHONE_NUMBER_ID);
  } catch (error) {
    logger.error({ err: error.response?.data || error.message }, "webhook handler failed");
  }
});

// ─── Catch-all error handler ────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error({ err: err.message, url: req.url }, "unhandled error");
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || "development" }, "Tankar bot online");

  // Boot the followup scheduler (60s tick) once the HTTP server is up
  try {
    const { startScheduler } = require("./functions/followupRunner");
    startScheduler({ intervalSeconds: 60 });
  } catch (err) {
    logger.error({ err: err.message }, "followup scheduler failed to start");
  }
});
