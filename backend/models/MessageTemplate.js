const mongoose = require("mongoose");

const messageTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: {
      type: String,
      enum: [
        "welcome",
        "pricing",
        "followup",
        "reminder",
        "payment",
        "thankyou",
        "custom",
      ],
      default: "custom",
    },
    body: { type: String, required: true },

    // Auto-extracted variable names like ["name", "businessName"]
    variables: [{ type: String }],

    // Stats
    usageCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

messageTemplateSchema.index({ category: 1, name: 1 });

module.exports = mongoose.model("MessageTemplate", messageTemplateSchema);
