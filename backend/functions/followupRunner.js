const axios = require("axios");
const FollowupSequence = require("../models/FollowupSequence");
const Contact = require("../models/Contact");
const Enquiry = require("../models/Enquiry");
const Conversation = require("../models/Conversation");
const BotConfig = require("../models/BotConfig");
const { logger } = require("../middleware/logger");

function applyTemplate(tpl, vars) {
  if (!tpl) return tpl;
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
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

/**
 * Find every contact that matches the sequence's criteria *right now*.
 * Criteria:
 *   - Last contact activity older than `afterMinutes`
 *   - Not paused
 *   - Has an enquiry whose status is in the sequence's `statuses` filter (if any)
 *   - Has not received this sequence `maxSendsPerContact` times already
 */
async function findMatchesForSequence(seq) {
  const cutoff = new Date(Date.now() - seq.afterMinutes * 60 * 1000);

  const baseQuery = {
    lastContactDate: { $lte: cutoff },
    $or: [{ botPaused: false }, { botPaused: { $exists: false } }],
  };

  const contacts = await Contact.find(baseQuery);

  // For each candidate contact, check enquiry status + send count
  const results = [];
  for (const c of contacts) {
    const sentCount = (c.followupsSent || []).filter(
      (f) => String(f.sequenceId) === String(seq._id)
    ).length;
    if (sentCount >= seq.maxSendsPerContact) continue;

    if (seq.statuses && seq.statuses.length > 0) {
      const enquiry = await Enquiry.findOne({ phoneNumber: c.phoneNumber }).sort({
        createdAt: -1,
      });
      if (!enquiry || !seq.statuses.includes(enquiry.status)) continue;
    }
    results.push(c);
  }
  return results;
}

async function sendFollowupToContact(seq, contact, botConfig) {
  const body = applyTemplate(seq.messageBody, {
    businessName: botConfig?.businessName || "Tankar",
    services: botConfig?.services || "",
    pricing: botConfig?.pricing || "",
    tagline: botConfig?.tagline || "",
  });

  await sendWhatsApp(contact.phoneNumber, body);

  // Record the outbound message in conversation history
  let convo = await Conversation.findOne({ phoneNumber: contact.phoneNumber }).sort({
    createdAt: -1,
  });
  if (!convo) convo = new Conversation({ phoneNumber: contact.phoneNumber, messages: [] });
  convo.messages.push({
    role: "assistant",
    content: body,
    timestamp: new Date(),
  });
  await convo.save();

  // Mark this followup sent for this contact
  contact.followupsSent = contact.followupsSent || [];
  contact.followupsSent.push({ sequenceId: seq._id, sentAt: new Date() });
  await contact.save();

  return body;
}

/** Run a single sequence end-to-end. */
async function runFollowupOnce(seq) {
  if (!seq.enabled) return { sent: 0, skipped: 0, reason: "disabled" };
  const botConfig = await BotConfig.findOne();
  const matches = await findMatchesForSequence(seq);
  let sent = 0;
  const errors = [];
  for (const contact of matches) {
    try {
      await sendFollowupToContact(seq, contact, botConfig);
      sent += 1;
    } catch (err) {
      errors.push({
        phoneNumber: contact.phoneNumber,
        error: err.response?.data?.error?.message || err.message,
      });
    }
  }
  seq.totalSent = (seq.totalSent || 0) + sent;
  seq.lastRunAt = new Date();
  await seq.save();
  return { sent, candidates: matches.length, errors: errors.slice(0, 10) };
}

/** Scan every enabled sequence. Returns aggregate stats. */
async function scanAllSequences() {
  const sequences = await FollowupSequence.find({ enabled: true });
  let totalSent = 0;
  for (const seq of sequences) {
    try {
      const result = await runFollowupOnce(seq);
      if (result.sent > 0) {
        logger.info(
          { sequenceId: seq._id.toString(), sequenceName: seq.name, sent: result.sent },
          "followup sequence fired"
        );
      }
      totalSent += result.sent;
    } catch (err) {
      logger.error({ err: err.message, sequenceId: seq._id.toString() }, "followup run failed");
    }
  }
  return { totalSent, sequences: sequences.length };
}

/** Start a background loop. Pass interval in seconds. */
function startScheduler({ intervalSeconds = 60 } = {}) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await scanAllSequences();
    } catch (err) {
      logger.error({ err: err.message }, "followup scheduler tick failed");
    } finally {
      running = false;
    }
  };
  setInterval(tick, intervalSeconds * 1000);
  logger.info({ intervalSeconds }, "followup scheduler started");
}

module.exports = {
  findMatchesForSequence,
  runFollowupOnce,
  scanAllSequences,
  startScheduler,
};
