const express = require("express");
const router = express.Router();
const axios = require("axios");
const Campaign = require("../models/Campaign");
const MessageTemplate = require("../models/MessageTemplate");
const Contact = require("../models/Contact");
const Enquiry = require("../models/Enquiry");
const Conversation = require("../models/Conversation");
const BotConfig = require("../models/BotConfig");
const { authMiddleware } = require("../middleware/auth.cjs");
const { applyTemplate } = require("./templates");
const { logger } = require("../middleware/logger");

router.use(authMiddleware);

async function findTargetContacts(target = {}) {
  const baseQuery = {};

  if (target.inactiveDaysMin && target.inactiveDaysMin > 0) {
    const cutoff = new Date(Date.now() - target.inactiveDaysMin * 24 * 60 * 60 * 1000);
    baseQuery.lastContactDate = { $lte: cutoff };
  }

  if (target.respectPaused !== false) {
    baseQuery.$or = [{ botPaused: false }, { botPaused: { $exists: false } }];
  }

  const contacts = await Contact.find(baseQuery);

  // Filter by enquiry status + tags
  const wantStatuses = target.statuses || [];
  const wantTags = target.tags || [];
  if (wantStatuses.length === 0 && wantTags.length === 0) {
    return contacts.map((c) => ({ phoneNumber: c.phoneNumber }));
  }

  const filtered = [];
  for (const c of contacts) {
    const e = await Enquiry.findOne({ phoneNumber: c.phoneNumber }).sort({ createdAt: -1 });
    if (wantStatuses.length > 0 && (!e || !wantStatuses.includes(e.status))) continue;
    if (
      wantTags.length > 0 &&
      !(e?.tags || []).some((t) => wantTags.includes(t))
    )
      continue;
    filtered.push({ phoneNumber: c.phoneNumber, clientName: e?.clientName });
  }
  return filtered;
}

async function sendWhatsApp(to, body) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.PHONE_NUMBER_ID;
  if (!token || !phoneId) return { simulated: true };
  await axios.post(
    `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    { messaging_product: "whatsapp", to, text: { body } },
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
  );
  return { simulated: false };
}

// GET /api/campaigns
router.get("/", async (_req, res) => {
  try {
    const list = await Campaign.find()
      .sort({ createdAt: -1 })
      .populate("templateId", "name category")
      .lean();
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/campaigns/:id
router.get("/:id", async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id).populate("templateId", "name category body");
    if (!c) return res.status(404).json({ success: false, error: "Campaign not found" });
    res.json({ success: true, data: c });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/campaigns/preview — see how many contacts a target filter would hit
router.post("/preview", async (req, res) => {
  try {
    const target = req.body.target || {};
    const contacts = await findTargetContacts(target);
    res.json({ success: true, data: { count: contacts.length, sample: contacts.slice(0, 5) } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/campaigns — create (draft state)
router.post("/", async (req, res) => {
  try {
    const { name, templateId, target } = req.body;
    if (!name || !templateId) {
      return res.status(400).json({ success: false, error: "name and templateId are required" });
    }
    const tpl = await MessageTemplate.findById(templateId);
    if (!tpl) return res.status(400).json({ success: false, error: "Template not found" });
    const c = await Campaign.create({
      name,
      templateId,
      bodySnapshot: tpl.body,
      target: target || {},
      state: "draft",
      createdBy: req.adminId,
    });
    res.json({ success: true, data: c });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/campaigns/:id/send — execute immediately
router.post("/:id/send", async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) return res.status(404).json({ success: false, error: "Campaign not found" });
    if (c.state === "completed") {
      return res.status(400).json({ success: false, error: "Campaign already sent" });
    }
    const tpl = await MessageTemplate.findById(c.templateId);
    if (!tpl) return res.status(400).json({ success: false, error: "Template missing" });

    c.state = "sending";
    await c.save();

    const cfg = await BotConfig.findOne();
    const targets = await findTargetContacts(c.target);

    c.recipients = targets.map((t) => ({
      phoneNumber: t.phoneNumber,
      clientName: t.clientName || "",
      status: "pending",
    }));
    c.stats.total = c.recipients.length;
    await c.save();

    let sent = 0,
      failed = 0,
      simulated = 0;
    const errors = [];

    for (const r of c.recipients) {
      try {
        const enquiry = await Enquiry.findOne({ phoneNumber: r.phoneNumber }).sort({ createdAt: -1 });
        const body = applyTemplate(tpl.body, {
          name: enquiry?.clientName || "",
          businessName: cfg?.businessName || "",
          services: cfg?.services || "",
          pricing: cfg?.pricing || "",
          tagline: cfg?.tagline || "",
          customerBusiness: enquiry?.businessName || "",
          websiteType: enquiry?.websiteType || "",
          budget: enquiry?.budget || "",
          timeline: enquiry?.timeline || "",
        });

        const result = await sendWhatsApp(r.phoneNumber, body);

        // Record outbound in conversation history
        let convo = await Conversation.findOne({ phoneNumber: r.phoneNumber }).sort({
          createdAt: -1,
        });
        if (!convo) convo = new Conversation({ phoneNumber: r.phoneNumber, messages: [] });
        convo.messages.push({
          role: "assistant",
          content: body,
          timestamp: new Date(),
        });
        await convo.save();
        await Contact.findOneAndUpdate(
          { phoneNumber: r.phoneNumber },
          { phoneNumber: r.phoneNumber, lastContactDate: new Date() },
          { upsert: true, setDefaultsOnInsert: true }
        );

        r.status = result.simulated ? "simulated" : "sent";
        r.sentAt = new Date();
        if (result.simulated) simulated += 1;
        else sent += 1;
      } catch (err) {
        r.status = "failed";
        r.error = err.response?.data?.error?.message || err.message;
        failed += 1;
        errors.push({ phoneNumber: r.phoneNumber, error: r.error });
      }
    }

    c.stats = { total: c.recipients.length, sent, failed, simulated, replied: 0 };
    c.state = "completed";
    c.sentAt = new Date();
    c.bodySnapshot = tpl.body;
    await c.save();

    // bump template usage stats
    tpl.usageCount = (tpl.usageCount || 0) + (sent + simulated);
    tpl.lastUsedAt = new Date();
    await tpl.save();

    logger.info(
      { campaignId: c._id.toString(), sent, failed, simulated },
      "campaign sent"
    );

    res.json({
      success: true,
      data: { sent, failed, simulated, total: c.recipients.length, errors: errors.slice(0, 25) },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/campaigns/:id
router.delete("/:id", async (req, res) => {
  try {
    const c = await Campaign.findByIdAndDelete(req.params.id);
    if (!c) return res.status(404).json({ success: false, error: "Campaign not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
