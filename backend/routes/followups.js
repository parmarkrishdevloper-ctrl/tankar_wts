const express = require("express");
const router = express.Router();
const FollowupSequence = require("../models/FollowupSequence");
const Contact = require("../models/Contact");
const Enquiry = require("../models/Enquiry");
const { authMiddleware } = require("../middleware/auth.cjs");
const { findMatchesForSequence, runFollowupOnce } = require("../functions/followupRunner");

router.use(authMiddleware);

// GET /api/followups — list all sequences with live match counts
router.get("/", async (_req, res) => {
  try {
    const sequences = await FollowupSequence.find().sort({ createdAt: -1 });
    const withCounts = await Promise.all(
      sequences.map(async (seq) => {
        const matches = await findMatchesForSequence(seq);
        return { ...seq.toObject(), matchesNow: matches.length };
      })
    );
    res.json({ success: true, data: withCounts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/followups — create
router.post("/", async (req, res) => {
  try {
    const { name, afterMinutes, statuses, maxSendsPerContact, messageBody, enabled } = req.body;
    if (!name || !afterMinutes || !messageBody) {
      return res.status(400).json({ success: false, error: "name, afterMinutes, messageBody are required" });
    }
    const seq = await FollowupSequence.create({
      name,
      afterMinutes,
      statuses: Array.isArray(statuses) ? statuses : [],
      maxSendsPerContact: maxSendsPerContact || 1,
      messageBody,
      enabled: enabled !== false,
    });
    res.json({ success: true, data: seq });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/followups/:id
router.put("/:id", async (req, res) => {
  try {
    const allowed = ["name", "afterMinutes", "statuses", "maxSendsPerContact", "messageBody", "enabled"];
    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
    const seq = await FollowupSequence.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!seq) return res.status(404).json({ success: false, error: "Sequence not found" });
    res.json({ success: true, data: seq });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/followups/:id
router.delete("/:id", async (req, res) => {
  try {
    const seq = await FollowupSequence.findByIdAndDelete(req.params.id);
    if (!seq) return res.status(404).json({ success: false, error: "Sequence not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/followups/:id/run — trigger this sequence right now (admin test)
router.post("/:id/run", async (req, res) => {
  try {
    const seq = await FollowupSequence.findById(req.params.id);
    if (!seq) return res.status(404).json({ success: false, error: "Sequence not found" });
    const result = await runFollowupOnce(seq);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
