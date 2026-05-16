const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    firstContactDate: {
        type: Date,
        default: Date.now
    },
    lastContactDate: {
        type: Date,
        default: Date.now
    },
    totalConversations: {
        type: Number,
        default: 0
    },
    totalInputTokens: {
        type: Number,
        default: 0
    },
    totalOutputTokens: {
        type: Number,
        default: 0
    },
    metadata: {
        type: Map,
        of: String,
        default: {}
    },
    botPaused: {
        type: Boolean,
        default: false
    },
    botPausedAt: {
        type: Date
    },
    botPausedTotalCount: {
        type: Number,
        default: 0
    },
    notes: {
        type: String,
        default: ''
    },
    followupsSent: [
        {
            sequenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'FollowupSequence' },
            sentAt: { type: Date, default: Date.now }
        }
    ]
}, {
    timestamps: true
});

// Index for faster searches
contactSchema.index({ phoneNumber: 'text' });

module.exports = mongoose.model('Contact', contactSchema);