require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const connectDB = require("./config/database");
const dashboardRoutes = require("./routes/dashboard");
const { saveContact, saveConversation, estimateTokens } = require("./functions/conversationHelper");
const adminRoutes = require("./routes/admin.js");
const enquiriesRoutes = require("./routes/enquiries.js");
const {
  getOrCreateEnquiry,
  upsertEnquiryFromMessage,
  createCallbackRequest,
  updateEnquiryData,
  getEnquirySummary,
  resetEnquiry
} = require("./functions/enquiryHelper");
const { generateSystemPrompt, generateConversationContext } = require("./functions/systemPromptGenerator");
const { isUserDisinterested } = require("./functions/responseParser");

const app = express();

connectDB();

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    console.log(`🔍 [CORS] Preflight OPTIONS request for ${req.url}`);
  } else {
    console.log(`📩 [HTTP] ${req.method} ${req.url}`);
  }
  next();
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: '*',
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(express.json());

const {
  VERIFY_TOKEN,
  WHATSAPP_TOKEN,
  PHONE_NUMBER_ID,
  GROQ_API_KEY
} = process.env;

app.get("/", (req, res) => {
  res.send("Tankar Solution WhatsApp Bot is running");
});

app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/enquiries", enquiriesRoutes);

// Privacy Policy Route for Facebook/WhatsApp Setup
app.get("/privacy", (req, res) => {
  res.send(`
    <html>
      <head><title>Privacy Policy - Tankar Solution</title></head>
      <body style="font-family: sans-serif; padding: 40px; line-height: 1.6; max-width: 800px; margin: auto;">
        <h1>Privacy Policy for Tankar Solution</h1>
        <p>Last updated: ${new Date().toLocaleDateString()}</p>
        <p>Tankar Solution operates the WhatsApp bot to provide website building consultations. We value your privacy and only collect details necessary for the project estimation.</p>
        <h2>1. Data We Collect</h2>
        <ul>
          <li>Name</li>
          <li>Business Details</li>
          <li>Project Requirements</li>
        </ul>
        <h2>2. How We Use Data</h2>
        <p>We use this data solely to provide you with website development guidance and quotes. We do not sell or share your data with third parties.</p>
        <h2>3. Contact Us</h2>
        <p>If you have questions, please contact us via our official WhatsApp channel.</p>
      </body>
    </html>
  `);
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

async function sendWhatsAppMessage(to, body, token, phoneId) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body }
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    }
  );
}

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (value?.statuses) {
      return;
    }

    const message = value?.messages?.[0];
    if (!message || message.type !== "text") {
      return;
    }

    const from = message.from;
    const userText = message.text?.body;
    if (!userText) {
      return;
    }

    let enquiry = await getOrCreateEnquiry(from);

    let conversationHistory = [];
    try {
      const Conversation = require("./models/Conversation");
      const recentConversation = await Conversation.findOne({ phoneNumber: from }).sort({ createdAt: -1 });
      if (recentConversation?.messages?.length) {
        conversationHistory = recentConversation.messages.slice(-15).map((msg) => ({
          role: msg.role,
          content: msg.content
        }));
      }
    } catch (historyError) {
      console.error("Conversation history error:", historyError.message);
    }

    const upsertResult = await upsertEnquiryFromMessage(from, userText);
    enquiry = upsertResult.enquiry;

    if (upsertResult.isReset) {
      console.log(`🔄 [RESET] Enquiry reset for ${from}. Continuing to AI flow.`);
    }

    const isGreeting = /^(hi|hello|hey|greetings|namaste|hola)/i.test(userText.trim());

    if (isGreeting && enquiry.status === 'in_progress') {
      console.log(`🔄 [AUTO-RESET] User sent greeting "${userText}". Resetting for new consultation.`);
      await resetEnquiry(from);
    }

    if (isUserDisinterested(userText, conversationHistory)) {
      console.log(`📉 [DISINTERESTED] User ${from} seems disinterested.`);
      await createCallbackRequest(from);
      // Let the AI handle the final goodbye in the user's language
    }

    if (upsertResult.hasAllPrimaryFields && enquiry.status !== 'completed') {
      console.log(`✅ [COMPLETE] All primary fields collected for ${from}.`);
      await updateEnquiryData(from, "review", { status: 'completed' });
      // We don't return here anymore, let the AI send the package details and continue the flow
    }

    const stageForPrompt = enquiry.conversationStage || "greeting";
    const systemPrompt = generateSystemPrompt(stageForPrompt, enquiry.toJSON());
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: userText }
    ];

    const aiResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages,
        temperature: 0.5,
        max_tokens: 300
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const replyText = aiResponse.data?.choices?.[0]?.message?.content || "Thanks. Our website specialist will call you shortly.";
    const usage = aiResponse.data.usage || {};
    const inputTokens = usage.prompt_tokens || estimateTokens(userText);
    const outputTokens = usage.completion_tokens || estimateTokens(replyText);

    try {
      await saveContact(from);
      await saveConversation(from, userText, replyText, inputTokens, outputTokens);
    } catch (dbError) {
      console.error("Database save error:", dbError.message);
    }

    await sendWhatsAppMessage(from, replyText, WHATSAPP_TOKEN, PHONE_NUMBER_ID);
  } catch (error) {
    console.error("ERROR:", error.response?.data || error.message);
  }
});

app.get("/privacy-policy", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Privacy Policy - Tankar Solution</title>
      </head>
      <body style="font-family: Arial; padding: 20px;">
        <h1>Privacy Policy</h1>
        <p>This application uses the WhatsApp Cloud API to receive and respond to messages sent by users.</p>
        <p>We do not store, sell, or share personal data beyond project requirements. Messages are processed for automated replies using AI.</p>
        <p>If you have any questions, contact us at: <strong>tankarsolution@gmail.com</strong></p>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 [TANKAR_BOT] Server running on port ${PORT}`);
});