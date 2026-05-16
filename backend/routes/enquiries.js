const express = require('express');
const router = express.Router();
const {
    getAllEnquiries,
    getEnquiryById,
    updateEnquiryStatus,
    getEnquiryStats
} = require('../functions/enquiryHelper');
const { authMiddleware } = require('../middleware/auth.cjs');

/**
 * GET /api/enquiries/stats
 * Get enquiry statistics
 */
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const stats = await getEnquiryStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching enquiry stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch enquiry statistics',
            error: error.message
        });
    }
});

/**
 * GET /api/enquiries
 * Get all enquiries with optional filters
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            limit: req.query.limit ? parseInt(req.query.limit) : 100
        };

        const enquiries = await getAllEnquiries(filters);

        res.json({
            success: true,
            count: enquiries.length,
            data: enquiries
        });
    } catch (error) {
        console.error('Error fetching enquiries:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch enquiries',
            error: error.message
        });
    }
});

/**
 * GET /api/enquiries/by-phone/:phoneNumber
 * Return the most recent enquiry associated with a phone number (or null)
 */
router.get('/by-phone/:phoneNumber', authMiddleware, async (req, res) => {
    try {
        const Enquiry = require('../models/Enquiry');
        const enquiry = await Enquiry.findOne({ phoneNumber: req.params.phoneNumber })
            .sort({ createdAt: -1 });
        res.json({ success: true, data: enquiry });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch enquiry',
            error: error.message
        });
    }
});

/**
 * GET /api/enquiries/:id
 * Get specific enquiry by ID
 */
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const enquiry = await getEnquiryById(req.params.id);

        if (!enquiry) {
            return res.status(404).json({
                success: false,
                message: 'Enquiry not found'
            });
        }

        res.json({
            success: true,
            data: enquiry
        });
    } catch (error) {
        console.error('Error fetching enquiry:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch enquiry',
            error: error.message
        });
    }
});

/**
 * PUT /api/enquiries/:id/status
 * Update enquiry status
 */
router.put('/:id/status', authMiddleware, async (req, res) => {
    try {
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        const validStatuses = ['new', 'in_progress', 'completed', 'callback_requested', 'reviewing', 'contract_sent', 'won', 'lost'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        const enquiry = await updateEnquiryStatus(req.params.id, status);

        res.json({
            success: true,
            message: 'Status updated successfully',
            data: enquiry
        });
    } catch (error) {
        console.error('Error updating enquiry status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update enquiry status',
            error: error.message
        });
    }
});

/**
 * PUT /api/enquiries/:id/tags
 * Replace tags on an enquiry
 */
router.put('/:id/tags', authMiddleware, async (req, res) => {
    try {
        const { tags } = req.body;
        if (!Array.isArray(tags)) {
            return res.status(400).json({ success: false, message: 'tags must be an array' });
        }
        const Enquiry = require('../models/Enquiry');
        const enquiry = await Enquiry.findByIdAndUpdate(
            req.params.id,
            { tags: tags.map((t) => String(t).trim()).filter(Boolean) },
            { new: true }
        );
        if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });
        res.json({ success: true, data: enquiry });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update tags', error: error.message });
    }
});

/**
 * POST /api/enquiries/simulate
 * Simulate a WhatsApp message and get AI response
 */
router.post('/simulate', authMiddleware, async (req, res) => {
    console.log(`📡 [SIMULATOR] Received message from ${req.body.phoneNumber}: ${req.body.message}`);
    try {
        const { message, phoneNumber } = req.body;
        if (!message || !phoneNumber) {
            return res.status(400).json({ success: false, message: 'Message and phoneNumber are required' });
        }

        const { upsertEnquiryFromMessage } = require('../functions/enquiryHelper');
        const { generateSystemPrompt } = require('../functions/systemPromptGenerator');
        const axios = require('axios');
        const Conversation = require('../models/Conversation');

        // 1. Get or create enquiry and update with user message
        const { enquiry } = await upsertEnquiryFromMessage(phoneNumber, message);

        // 2. Get conversation history
        let conversationHistory = [];
        const recentConversation = await Conversation.findOne({ phoneNumber }).sort({ createdAt: -1 });
        if (recentConversation?.messages?.length) {
            conversationHistory = recentConversation.messages.slice(-15).map((msg) => ({
                role: msg.role,
                content: msg.content
            }));
        }

        // 3. Generate system prompt
        const systemPrompt = generateSystemPrompt(enquiry.conversationStage || "collecting", enquiry.toJSON());

        // 4. Call Groq AI
        const messages = [
            { role: "system", content: systemPrompt },
            ...conversationHistory,
            { role: "user", content: message }
        ];

        const aiResponse = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama-3.1-8b-instant",
                messages,
                temperature: 0.5,
                max_tokens: 300
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const replyText = aiResponse.data?.choices?.[0]?.message?.content || "No response from AI";

        // 5. Save conversation
        const { saveConversation } = require('../functions/conversationHelper');
        await saveConversation(phoneNumber, message, replyText, 0, 0);

        res.json({
            success: true,
            reply: replyText,
            enquiry: enquiry
        });
    } catch (error) {
        console.error('Simulation error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Simulation failed',
            error: error.message
        });
    }
});

module.exports = router;