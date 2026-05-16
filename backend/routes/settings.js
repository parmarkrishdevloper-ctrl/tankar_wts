const express = require("express");
const router = express.Router();
const BotConfig = require("../models/BotConfig");
const { authMiddleware } = require("../middleware/auth.cjs");

router.use(authMiddleware);

async function getOrCreate() {
  let cfg = await BotConfig.findOne();
  if (!cfg) cfg = await BotConfig.create({});
  return cfg;
}

// GET /api/settings/bot — current bot configuration
router.get("/bot", async (_req, res) => {
  try {
    const cfg = await getOrCreate();
    res.json({ success: true, data: cfg });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/settings/bot — update bot configuration
router.put("/bot", async (req, res) => {
  try {
    const allowed = [
      "businessName", "tagline", "services", "pricing",
      "languages", "timezone", "workingHours",
      "promptTemplate", "botEnabled",
    ];
    // Allow nested LLM pricing patch — merges instead of replacing
    if (req.body.llmPricing && typeof req.body.llmPricing === "object") {
      const cfg = await getOrCreate();
      const existing = cfg.llmPricing?.toObject?.() ?? cfg.llmPricing ?? {};
      cfg.llmPricing = { ...existing, ...req.body.llmPricing };
      cfg.updatedBy = req.adminId;
      // Also apply the rest of the allowed fields if present
      for (const k of allowed) if (k in req.body) cfg[k] = req.body[k];
      await cfg.save();
      return res.json({ success: true, data: cfg });
    }
    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
    patch.updatedBy = req.adminId;

    const cfg = await BotConfig.findOneAndUpdate({}, patch, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
    res.json({ success: true, data: cfg });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/settings/qa — add a Q&A pair
router.post("/qa", async (req, res) => {
  try {
    const { keywords, answer, enabled = true } = req.body;
    if (!answer || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ success: false, error: "keywords[] and answer are required" });
    }
    const cfg = await getOrCreate();
    cfg.qa.push({ keywords: keywords.map((k) => k.trim().toLowerCase()), answer, enabled });
    await cfg.save();
    res.json({ success: true, data: cfg.qa[cfg.qa.length - 1] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/settings/qa/:id — update a Q&A pair
router.put("/qa/:id", async (req, res) => {
  try {
    const cfg = await getOrCreate();
    const item = cfg.qa.id(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: "Q&A not found" });
    if (Array.isArray(req.body.keywords))
      item.keywords = req.body.keywords.map((k) => k.trim().toLowerCase());
    if (typeof req.body.answer === "string") item.answer = req.body.answer;
    if (typeof req.body.enabled === "boolean") item.enabled = req.body.enabled;
    await cfg.save();
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/settings/qa/:id
router.delete("/qa/:id", async (req, res) => {
  try {
    const cfg = await getOrCreate();
    const item = cfg.qa.id(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: "Q&A not found" });
    item.deleteOne();
    await cfg.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/settings/quickreply — add quick reply
router.post("/quickreply", async (req, res) => {
  try {
    const { label, body } = req.body;
    if (!label || !body) {
      return res.status(400).json({ success: false, error: "label and body are required" });
    }
    const cfg = await getOrCreate();
    cfg.quickReplies.push({ label, body });
    await cfg.save();
    res.json({ success: true, data: cfg.quickReplies[cfg.quickReplies.length - 1] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/settings/quickreply/:id
router.put("/quickreply/:id", async (req, res) => {
  try {
    const cfg = await getOrCreate();
    const item = cfg.quickReplies.id(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: "Quick reply not found" });
    if (typeof req.body.label === "string") item.label = req.body.label;
    if (typeof req.body.body === "string") item.body = req.body.body;
    await cfg.save();
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/settings/quickreply/:id
router.delete("/quickreply/:id", async (req, res) => {
  try {
    const cfg = await getOrCreate();
    const item = cfg.quickReplies.id(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: "Quick reply not found" });
    item.deleteOne();
    await cfg.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
