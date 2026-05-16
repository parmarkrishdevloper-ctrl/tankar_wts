const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Enquiry = require('../models/Enquiry');
const BotConfig = require('../models/BotConfig');
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

// Daily enquiry counts for the last N days (default 7)
router.get('/trend', async (req, res) => {
    try {
        const days = Math.min(parseInt(req.query.days || '7', 10), 90);
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - (days - 1));

        const buckets = await Enquiry.aggregate([
            { $match: { createdAt: { $gte: start } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                },
            },
        ]);
        const byDay = new Map(buckets.map((b) => [b._id, b.count]));

        const data = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const key = d.toISOString().slice(0, 10);
            data.push({
                date: key,
                day: d.toLocaleDateString('en-US', { weekday: 'short' }),
                count: byDay.get(key) || 0,
            });
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching trend:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Latest enquiries for the recent-activity feed
router.get('/recent', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || '5', 10), 25);
        const recent = await Enquiry.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .select('clientName phoneNumber businessName websiteType status createdAt');
        res.json({ success: true, data: recent });
    } catch (error) {
        console.error('Error fetching recent enquiries:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/dashboard/cost — LLM token usage + estimated spend
router.get('/cost', async (req, res) => {
    try {
        const days = Math.min(parseInt(req.query.days || '30', 10), 365);

        const cfg = await BotConfig.findOne();
        const rates = {
            llmModel: cfg?.llmPricing?.llmModel || 'llama-3.1-8b-instant',
            inputPer1M: cfg?.llmPricing?.inputPer1M ?? 0.05,
            outputPer1M: cfg?.llmPricing?.outputPer1M ?? 0.08,
            currency: cfg?.llmPricing?.currency || 'USD',
            usdToInr: cfg?.llmPricing?.usdToInr ?? 83,
        };

        const costFor = (input, output) =>
            (input * rates.inputPer1M + output * rates.outputPer1M) / 1_000_000;

        const startWindow = new Date();
        startWindow.setHours(0, 0, 0, 0);
        startWindow.setDate(startWindow.getDate() - (days - 1));

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 6);
        const monthStart = new Date(todayStart);
        monthStart.setDate(monthStart.getDate() - 29);

        // Daily aggregation by message timestamp
        const daily = await Conversation.aggregate([
            { $unwind: '$messages' },
            { $match: { 'messages.timestamp': { $gte: startWindow } } },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$messages.timestamp' },
                    },
                    inputTokens: { $sum: '$messages.inputTokens' },
                    outputTokens: { $sum: '$messages.outputTokens' },
                    messages: { $sum: 1 },
                },
            },
        ]);
        const byDay = new Map(daily.map((d) => [d._id, d]));

        const trend = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(startWindow);
            d.setDate(startWindow.getDate() + i);
            const key = d.toISOString().slice(0, 10);
            const row = byDay.get(key) || { inputTokens: 0, outputTokens: 0, messages: 0 };
            trend.push({
                date: key,
                day: d.toLocaleDateString('en-US', { weekday: 'short' }),
                inputTokens: row.inputTokens,
                outputTokens: row.outputTokens,
                messages: row.messages,
                cost: costFor(row.inputTokens, row.outputTokens),
            });
        }

        // Today / week / month totals
        const totalsFor = async (since) => {
            const res = await Conversation.aggregate([
                { $unwind: '$messages' },
                { $match: { 'messages.timestamp': { $gte: since } } },
                {
                    $group: {
                        _id: null,
                        inputTokens: { $sum: '$messages.inputTokens' },
                        outputTokens: { $sum: '$messages.outputTokens' },
                        messages: { $sum: 1 },
                    },
                },
            ]);
            const r = res[0] || { inputTokens: 0, outputTokens: 0, messages: 0 };
            return { ...r, cost: costFor(r.inputTokens, r.outputTokens) };
        };

        const today = await totalsFor(todayStart);
        const week = await totalsFor(weekStart);
        const month = await totalsFor(monthStart);

        // Lifetime total from Contact aggregate (faster than scanning all messages)
        const lifetimeAgg = await Contact.aggregate([
            {
                $group: {
                    _id: null,
                    inputTokens: { $sum: '$totalInputTokens' },
                    outputTokens: { $sum: '$totalOutputTokens' },
                },
            },
        ]);
        const lifetimeRaw = lifetimeAgg[0] || { inputTokens: 0, outputTokens: 0 };
        const lifetime = {
            ...lifetimeRaw,
            cost: costFor(lifetimeRaw.inputTokens, lifetimeRaw.outputTokens),
        };

        // Top contacts by cost
        const topAgg = await Contact.aggregate([
            {
                $project: {
                    phoneNumber: 1,
                    totalInputTokens: 1,
                    totalOutputTokens: 1,
                    totalConversations: 1,
                    lastContactDate: 1,
                    totalTokens: { $add: ['$totalInputTokens', '$totalOutputTokens'] },
                },
            },
            { $sort: { totalTokens: -1 } },
            { $limit: 10 },
        ]);
        const topContacts = topAgg.map((c) => ({
            phoneNumber: c.phoneNumber,
            inputTokens: c.totalInputTokens || 0,
            outputTokens: c.totalOutputTokens || 0,
            totalConversations: c.totalConversations || 0,
            lastContactDate: c.lastContactDate,
            cost: costFor(c.totalInputTokens || 0, c.totalOutputTokens || 0),
        }));

        res.json({
            success: true,
            data: { rates, trend, today, week, month, lifetime, topContacts },
        });
    } catch (error) {
        console.error('Error computing LLM cost:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PATCH /api/dashboard/contact/:phoneNumber — update flags / notes on a contact
router.patch('/contact/:phoneNumber', async (req, res) => {
    try {
        const allowed = ['botPaused', 'notes'];
        const patch = {};
        for (const k of allowed) if (k in req.body) patch[k] = req.body[k];

        // Stamp pause audit fields when the bot is being paused (false → true)
        if (patch.botPaused === true) {
            const existing = await Contact.findOne({ phoneNumber: req.params.phoneNumber });
            if (!existing?.botPaused) {
                patch.botPausedAt = new Date();
                patch.botPausedTotalCount = (existing?.botPausedTotalCount || 0) + 1;
            }
        } else if (patch.botPaused === false) {
            patch.botPausedAt = null;
        }

        const updated = await Contact.findOneAndUpdate(
            { phoneNumber: req.params.phoneNumber },
            patch,
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/dashboard/conversations/:phoneNumber/summarize
// Generate or regenerate an AI summary of the full conversation history.
router.post('/conversations/:phoneNumber/summarize', async (req, res) => {
    try {
        const axios = require('axios');
        const phoneNumber = req.params.phoneNumber;

        if (!process.env.GROQ_API_KEY) {
            return res.status(503).json({
                success: false,
                error: 'GROQ_API_KEY not configured — summary unavailable',
            });
        }

        // Concatenate all messages from all conversations with this phone
        const conversations = await Conversation.find({ phoneNumber }).sort({ createdAt: 1 });
        const flatMessages = [];
        conversations.forEach((c) => {
            (c.messages || []).forEach((m) => {
                flatMessages.push({ role: m.role, content: m.content, ts: m.timestamp });
            });
        });
        if (flatMessages.length === 0) {
            return res.status(404).json({ success: false, error: 'No messages to summarize' });
        }

        const transcript = flatMessages
            .slice(-60)
            .map((m) => `[${m.role === 'user' ? 'Customer' : 'Bot'}] ${m.content}`)
            .join('\n');

        const ai = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.1-8b-instant',
                messages: [
                    {
                        role: 'system',
                        content:
                            'You are a CRM assistant. Summarise the customer chat in 2–4 short sentences. Capture: what the customer wants, key qualifying answers (business, budget, timeline), and the next action for the sales team. No preamble — start with the customer\'s intent.',
                    },
                    { role: 'user', content: transcript },
                ],
                temperature: 0.3,
                max_tokens: 200,
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const text = ai.data?.choices?.[0]?.message?.content?.trim() || '';
        const generatedAt = new Date();

        // Persist on the most recent conversation
        const latest = conversations[conversations.length - 1];
        if (latest) {
            latest.aiSummary = { text, generatedAt };
            await latest.save();
        }

        res.json({ success: true, data: { text, generatedAt } });
    } catch (error) {
        console.error('AI summary error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data?.error?.message || error.message,
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