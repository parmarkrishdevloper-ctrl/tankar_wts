const mongoose = require("mongoose");

/**
 * Single-document configuration for the bot.
 * The whole system reads the first (and only) document in this collection.
 */
const qaSchema = new mongoose.Schema(
  {
    keywords: [{ type: String }],
    answer: { type: String, required: true },
    enabled: { type: Boolean, default: true },
  },
  { _id: true, timestamps: true }
);

const quickReplySchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    body: { type: String, required: true },
  },
  { _id: true, timestamps: true }
);

const botConfigSchema = new mongoose.Schema(
  {
    businessName: { type: String, default: "Tankar Solutions" },
    tagline: { type: String, default: "Website development services" },
    services: { type: String, default: "Website design, development, hosting, SEO" },
    pricing: { type: String, default: "Starting at ₹15,000 for a 5-page website" },
    languages: [{ type: String, default: ["english", "hindi", "hinglish"] }],
    timezone: { type: String, default: "Asia/Kolkata" },
    workingHours: { type: String, default: "10am–8pm IST" },

    // Custom prompt the user can edit. Variables: {{businessName}}, {{services}}, {{pricing}}
    // If blank, we fall back to the generated default prompt.
    promptTemplate: { type: String, default: "" },

    qa: [qaSchema],
    quickReplies: [quickReplySchema],

    botEnabled: { type: Boolean, default: true },

    // LLM pricing (defaults are for Groq llama-3.1-8b-instant in USD per 1M tokens)
    llmPricing: {
      llmModel: { type: String, default: "llama-3.1-8b-instant" },
      inputPer1M: { type: Number, default: 0.05 },
      outputPer1M: { type: Number, default: 0.08 },
      currency: { type: String, default: "USD" },
      // Multiplier used when displaying in INR. Set to 0 to disable INR display.
      usdToInr: { type: Number, default: 83 },
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BotConfig", botConfigSchema);
