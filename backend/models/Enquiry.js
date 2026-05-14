const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema({
    // Essential Contact Information
    phoneNumber: {
        type: String,
        required: true,
        index: true
    },
    clientName: { type: String, default: null },
    email: { type: String, default: null },
    businessName: { type: String, default: null },
    websiteType: { type: String, default: null }, // Business type
    pagesCount: { type: String, default: null },
    domainStatus: { type: String, default: null }, // e.g., Already has domain, Need new domain
    stylePreference: { type: String, default: null }, // Style from portfolio
    timeline: { type: String, default: null },
    existingWebsite: { type: String, default: null },
    targetAudience: { type: String, default: null },
    coreFeature: { type: String, default: null },
    features: { type: String, default: null }, // Description of features needed
    budget: { type: String, default: null },
    
    // Status & tags
    status: {
        type: String,
        default: 'new'
    },
    tags: [{ type: String }],

    // Conversation management
    conversationStage: { type: String, default: 'greeting' },
    callbackRequested: { type: Boolean, default: false },

    // Timestamps
    enquiryDate: { type: Date, default: Date.now },
    lastUpdated: { type: Date, default: Date.now }
}, {
    timestamps: true
});

enquirySchema.index({ phoneNumber: 1, createdAt: -1 });
enquirySchema.index({ status: 1 });

module.exports = mongoose.model('Enquiry', enquirySchema);