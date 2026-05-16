const express = require("express");
const router = express.Router();
const axios = require("axios");
const Contact = require("../models/Contact");
const Conversation = require("../models/Conversation");
const { authMiddleware } = require("../middleware/auth.cjs");

router.use(authMiddleware);

async function sendWhatsApp(to, body) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    // Allow the dashboard to work in local dev even without real credentials.
    return { simulated: true };
  }
  await axios.post(
    `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    { messaging_product: "whatsapp", to, text: { body } },
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
  );
  return { simulated: false };
}

async function recordOutbound(phoneNumber, body) {
  // Save to conversation history so the dashboard reflects the message we sent.
  let convo = await Conversation.findOne({ phoneNumber }).sort({ createdAt: -1 });
  if (!convo) convo = new Conversation({ phoneNumber, messages: [] });
  convo.messages.push({ role: "assistant", content: body, timestamp: new Date() });
  await convo.save();

  await Contact.findOneAndUpdate(
    { phoneNumber },
    { phoneNumber, lastContactDate: new Date() },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

// POST /api/messages/send — send one message
router.post("/send", async (req, res) => {
  try {
    const { phoneNumber, body } = req.body;
    if (!phoneNumber || !body) {
      return res.status(400).json({ success: false, error: "phoneNumber and body are required" });
    }
    const result = await sendWhatsApp(phoneNumber, body);
    await recordOutbound(phoneNumber, body);
    res.json({ success: true, simulated: result.simulated });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.response?.data?.error?.message || err.message,
    });
  }
});

// POST /api/messages/broadcast — send the same body to many numbers
router.post("/broadcast", async (req, res) => {
  try {
    const { phoneNumbers, body } = req.body;
    if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0 || !body) {
      return res.status(400).json({ success: false, error: "phoneNumbers[] and body required" });
    }
    if (phoneNumbers.length > 500) {
      return res.status(400).json({ success: false, error: "broadcast capped at 500 recipients" });
    }
    let sent = 0;
    let simulated = 0;
    let failed = 0;
    const errors = [];
    for (const num of phoneNumbers) {
      try {
        const r = await sendWhatsApp(num, body);
        await recordOutbound(num, body);
        sent += 1;
        if (r.simulated) simulated += 1;
      } catch (err) {
        failed += 1;
        errors.push({
          phoneNumber: num,
          error: err.response?.data?.error?.message || err.message,
        });
      }
    }
    res.json({
      success: true,
      sent,
      simulated,
      failed,
      errors: errors.slice(0, 25),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
