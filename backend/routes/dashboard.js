const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Enquiry = require('../models/Enquiry');
const { authMiddleware } = require('../middleware/auth.cjs');

// Apply authentication middleware to all dashboard routes
router.use(authMiddleware);

// Get all contacts with pagination and search
router.get('/contacts', async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        let query = {};
        if (search) {
            query.phoneNumber = { $regex: search, $options: 'i' };
        }

        // Get contacts with pagination
        const contacts = await Contact.find(query)
            .sort({ lastContactDate: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count
        const total = await Contact.countDocuments(query);

        res.json({
            success: true,
            data: contacts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get conversations for a specific phone number
router.get('/conversations/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Get conversations with pagination
        const conversations = await Conversation.find({ phoneNumber })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count
        const total = await Conversation.countDocuments({ phoneNumber });

        res.json({
            success: true,
            data: conversations,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get overall statistics
router.get('/stats', async (req, res) => {
    try {
        // Get enquiry stats
        const totalEnquiries = await Enquiry.countDocuments();
        const pendingEnquiries = await Enquiry.countDocuments({ status: 'new' });
        const progressEnquiries = await Enquiry.countDocuments({ status: 'in_progress' });
        const completedEnquiries = await Enquiry.countDocuments({ status: 'completed' });
        const callbackRequests = await Enquiry.countDocuments({ status: 'callback_requested' });
        
        // Contacts and tokens
        const totalContacts = await Contact.countDocuments();
        const tokenStats = await Contact.aggregate([
            {
                $group: {
                    _id: null,
                    totalInputTokens: { $sum: '$totalInputTokens' },
                    totalOutputTokens: { $sum: '$totalOutputTokens' }
                }
            }
        ]);

        const stats = {
            totalEnquiries,
            pendingEnquiries,
            progressEnquiries,
            completedEnquiries,
            callbackRequests,
            totalContacts,
            totalTokens: (tokenStats[0]?.totalInputTokens || 0) + (tokenStats[0]?.totalOutputTokens || 0)
        };

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get contact details
router.get('/contact/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const contact = await Contact.findOne({ phoneNumber });

        if (!contact) {
            return res.status(404).json({
                success: false,
                error: 'Contact not found'
            });
        }

        res.json({
            success: true,
            data: contact
        });
    } catch (error) {
        console.error('Error fetching contact:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;