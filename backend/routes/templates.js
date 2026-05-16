const express = require("express");
const router = express.Router();
const MessageTemplate = require("../models/MessageTemplate");
const Enquiry = require("../models/Enquiry");
const BotConfig = require("../models/BotConfig");
const { authMiddleware } = require("../middleware/auth.cjs");

router.use(authMiddleware);

function extractVariables(body) {
  const set = new Set();
  const re = /\{\{\s*(\w+)\s*\}\}/g;
  let m;
  while ((m = re.exec(body)) !== null) set.add(m[1]);
  return [...set];
}

function applyTemplate(tpl, vars) {
  if (!tpl) return tpl;
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

// GET /api/templates
router.get("/", async (_req, res) => {
  try {
    const list = await MessageTemplate.find().sort({ category: 1, name: 1 });
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/templates
router.post("/", async (req, res) => {
  try {
    const { name, category, body } = req.body;
    if (!name || !body) {
      return res.status(400).json({ success: false, error: "name and body are required" });
    }
    const tpl = await MessageTemplate.create({
      name,
      category: category || "custom",
      body,
      variables: extractVariables(body),
      createdBy: req.adminId,
    });
    res.json({ success: true, data: tpl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/templates/:id
router.put("/:id", async (req, res) => {
  try {
    const patch = {};
    if (typeof req.body.name === "string") patch.name = req.body.name;
    if (typeof req.body.category === "string") patch.category = req.body.category;
    if (typeof req.body.body === "string") {
      patch.body = req.body.body;
      patch.variables = extractVariables(req.body.body);
    }
    const tpl = await MessageTemplate.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!tpl) return res.status(404).json({ success: false, error: "Template not found" });
    res.json({ success: true, data: tpl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/templates/:id
router.delete("/:id", async (req, res) => {
  try {
    const tpl = await MessageTemplate.findByIdAndDelete(req.params.id);
    if (!tpl) return res.status(404).json({ success: false, error: "Template not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/templates/:id/render — substitute variables for a given phone
// Body: { phoneNumber }
// Returns { body } with variables filled from the contact's latest enquiry + bot config.
router.post("/:id/render", async (req, res) => {
  try {
    const tpl = await MessageTemplate.findById(req.params.id);
    if (!tpl) return res.status(404).json({ success: false, error: "Template not found" });

    const { phoneNumber } = req.body;
    const cfg = await BotConfig.findOne();
    const enquiry = phoneNumber
      ? await Enquiry.findOne({ phoneNumber }).sort({ createdAt: -1 })
      : null;

    const vars = {
      name: enquiry?.clientName || "",
      businessName: cfg?.businessName || "",
      services: cfg?.services || "",
      pricing: cfg?.pricing || "",
      tagline: cfg?.tagline || "",
      workingHours: cfg?.workingHours || "",
      // Customer-side
      customerBusiness: enquiry?.businessName || "",
      websiteType: enquiry?.websiteType || "",
      budget: enquiry?.budget || "",
      timeline: enquiry?.timeline || "",
    };

    const body = applyTemplate(tpl.body, vars);
    res.json({ success: true, data: { body, variablesUsed: tpl.variables, vars } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
module.exports.extractVariables = extractVariables;
module.exports.applyTemplate = applyTemplate;
