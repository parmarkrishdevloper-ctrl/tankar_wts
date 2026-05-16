const mongoose = require("mongoose");

const recipientSchema = new mongoose.Schema(
  {
    phoneNumber: { type: String, required: true },
    clientName: String,
    status: {
      type: String,
      enum: ["pending", "sent", "failed", "replied", "simulated"],
      default: "pending",
    },
    sentAt: Date,
    repliedAt: Date,
    error: String,
  },
  { _id: false }
);

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    // What to send
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "MessageTemplate", required: true },
    bodySnapshot: { type: String, default: "" }, // template body at the time of send

    // Targeting filters
    target: {
      statuses: [{ type: String }], // enquiry statuses to include
      tags: [{ type: String }], // any of these tags
      inactiveDaysMin: Number, // only contacts inactive for >= N days
      respectPaused: { type: Boolean, default: true }, // skip botPaused = true
    },

    // Lifecycle
    state: {
      type: String,
      enum: ["draft", "queued", "sending", "completed", "cancelled"],
      default: "draft",
    },

    recipients: [recipientSchema],

    stats: {
      total: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      replied: { type: Number, default: 0 },
      simulated: { type: Number, default: 0 },
    },

    sentAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Campaign", campaignSchema);
