const express = require("express");
const router = express.Router();
const Conversation = require("../models/Conversation");
const Contact = require("../models/Contact");
const Enquiry = require("../models/Enquiry");
const { authMiddleware } = require("../middleware/auth.cjs");

router.use(authMiddleware);

// GET /api/analytics
// Returns conversation-level metrics:
//   totals.incoming / outgoing
//   replySuccessRate — % of incoming messages that received a follow-up assistant reply
//   avgResponseSecs   — mean delta (seconds) between user msg and next assistant msg
//   botResolutionPct  — % of completed enquiries with no human takeover
//   humanTakeoverPct  — % of contacts with botPaused ever true
//   daily             — last 30 days bar/line: incoming, outgoing
router.get("/", async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days || "30", 10), 365);
    const startWindow = new Date();
    startWindow.setHours(0, 0, 0, 0);
    startWindow.setDate(startWindow.getDate() - (days - 1));

    // ---- totals by role
    const roleAgg = await Conversation.aggregate([
      { $unwind: "$messages" },
      {
        $group: {
          _id: "$messages.role",
          count: { $sum: 1 },
        },
      },
    ]);
    const totalsByRole = Object.fromEntries(roleAgg.map((r) => [r._id, r.count]));
    const incoming = totalsByRole.user || 0;
    const outgoing = totalsByRole.assistant || 0;

    // ---- response time + reply success rate
    // We compute per-conversation by stepping through messages in order.
    const conversations = await Conversation.find({}, { messages: 1 });
    let pairCount = 0;
    let respondedUserMsgs = 0;
    let totalUserMsgs = 0;
    let totalResponseMs = 0;
    let slowestMs = 0;
    let fastestMs = Infinity;

    for (const c of conversations) {
      const msgs = (c.messages || []).slice().sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );
      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        if (m.role !== "user") continue;
        totalUserMsgs += 1;
        // Look forward for next assistant message within 24 hours
        for (let j = i + 1; j < msgs.length; j++) {
          const n = msgs[j];
          if (n.role === "user") break;
          if (n.role === "assistant") {
            const delta = new Date(n.timestamp) - new Date(m.timestamp);
            if (delta >= 0 && delta < 24 * 60 * 60 * 1000) {
              respondedUserMsgs += 1;
              totalResponseMs += delta;
              pairCount += 1;
              if (delta > slowestMs) slowestMs = delta;
              if (delta < fastestMs) fastestMs = delta;
            }
            break;
          }
        }
      }
    }
    const replySuccessRate =
      totalUserMsgs === 0 ? 0 : (respondedUserMsgs / totalUserMsgs) * 100;
    const avgResponseSecs =
      pairCount === 0 ? 0 : totalResponseMs / pairCount / 1000;

    // ---- bot resolution + human takeover
    const totalContacts = await Contact.countDocuments();
    const everPausedContacts = await Contact.countDocuments({
      $or: [{ botPausedAt: { $ne: null } }, { botPausedTotalCount: { $gt: 0 } }, { botPaused: true }],
    });
    const humanTakeoverPct =
      totalContacts === 0 ? 0 : (everPausedContacts / totalContacts) * 100;

    const totalEnq = await Enquiry.countDocuments();
    const completedEnq = await Enquiry.countDocuments({ status: "completed" });

    // "Bot resolved" = completed enquiry where the contact was never paused
    let botResolvedEnq = 0;
    if (completedEnq > 0) {
      const completedList = await Enquiry.find({ status: "completed" }, { phoneNumber: 1 });
      const phones = completedList.map((e) => e.phoneNumber);
      botResolvedEnq = await Contact.countDocuments({
        phoneNumber: { $in: phones },
        $and: [
          { $or: [{ botPaused: false }, { botPaused: { $exists: false } }] },
          { $or: [{ botPausedTotalCount: 0 }, { botPausedTotalCount: { $exists: false } }] },
        ],
      });
    }
    const botResolutionPct = totalEnq === 0 ? 0 : (botResolvedEnq / totalEnq) * 100;

    // ---- daily incoming vs outgoing for the chart
    const daily = await Conversation.aggregate([
      { $unwind: "$messages" },
      { $match: { "messages.timestamp": { $gte: startWindow } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$messages.timestamp" } },
            role: "$messages.role",
          },
          count: { $sum: 1 },
        },
      },
    ]);
    const byDay = new Map();
    daily.forEach((row) => {
      const key = row._id.day;
      const entry = byDay.get(key) || { date: key, incoming: 0, outgoing: 0 };
      if (row._id.role === "user") entry.incoming = row.count;
      else if (row._id.role === "assistant") entry.outgoing = row.count;
      byDay.set(key, entry);
    });
    const trend = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startWindow);
      d.setDate(startWindow.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const row = byDay.get(key) || { incoming: 0, outgoing: 0 };
      trend.push({
        date: key,
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        incoming: row.incoming,
        outgoing: row.outgoing,
      });
    }

    res.json({
      success: true,
      data: {
        totals: { incoming, outgoing },
        replySuccessRate,
        avgResponseSecs,
        slowestSecs: slowestMs === 0 ? 0 : slowestMs / 1000,
        fastestSecs: fastestMs === Infinity ? 0 : fastestMs / 1000,
        botResolutionPct,
        humanTakeoverPct,
        completedEnquiries: completedEnq,
        totalEnquiries: totalEnq,
        botResolvedEnquiries: botResolvedEnq,
        totalContacts,
        everPausedContacts,
        trend,
      },
    });
  } catch (err) {
    console.error("analytics error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
