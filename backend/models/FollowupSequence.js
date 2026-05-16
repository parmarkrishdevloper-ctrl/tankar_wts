const mongoose = require("mongoose");

const followupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true },

    // Inactivity-based trigger: send when no contact activity for this many minutes
    afterMinutes: { type: Number, required: true, min: 1 },

    // Only target enquiries in these statuses (empty = all)
    statuses: [{ type: String }],

    // Cap how many times this sequence can fire for the same contact
    maxSendsPerContact: { type: Number, default: 1, min: 1 },

    // The message to send. Supports {{businessName}}, {{services}}, {{pricing}} placeholders.
    messageBody: { type: String, required: true },

    // Internal stats
    totalSent: { type: Number, default: 0 },
    lastRunAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FollowupSequence", followupSchema);
