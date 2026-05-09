const Enquiry = require('../models/Enquiry');
const { extractDataWithAI } = require('./llmDataExtractor');

function applyParsedData(enquiry, data = {}) {
    if (data.clientName) enquiry.clientName = data.clientName;
    if (data.email) enquiry.email = data.email;
    if (data.businessName) enquiry.businessName = data.businessName;
    if (data.websiteType) enquiry.websiteType = data.websiteType;
    if (data.timeline) enquiry.timeline = data.timeline;
    if (data.existingWebsite) enquiry.existingWebsite = data.existingWebsite;
    if (data.targetAudience) enquiry.targetAudience = data.targetAudience;
    if (data.coreFeature) enquiry.coreFeature = data.coreFeature;
    if (data.features) enquiry.features = data.features;
    if (data.budget) enquiry.budget = data.budget;
}

function hasAllPrimaryFields(enquiry) {
    return Boolean(
        enquiry.clientName &&
        enquiry.websiteType &&
        enquiry.email &&
        enquiry.timeline &&
        enquiry.coreFeature
    );
}

async function getOrCreateEnquiry(phoneNumber) {
    try {
        let enquiry = await Enquiry.findOne({ phoneNumber }).sort({ updatedAt: -1 });

        if (!enquiry) {
            enquiry = new Enquiry({
                phoneNumber,
                conversationStage: 'greeting'
            });
            await enquiry.save();
        }

        return enquiry;
    } catch (error) {
        console.error('Error in getOrCreateEnquiry:', error);
        throw error;
    }
}

async function upsertEnquiryFromMessage(phoneNumber, messageText) {
    try {
        const enquiry = await getOrCreateEnquiry(phoneNumber);
        
        let llmData = {};
        try {
            llmData = await extractDataWithAI(messageText, enquiry);
        } catch (aiError) {
            console.error('AI Extraction Failed:', aiError);
        }

        if (llmData.intent === 'new_consultation') {
            await resetEnquiry(phoneNumber);
            const newEnquiry = await getOrCreateEnquiry(phoneNumber);
            return { enquiry: newEnquiry, isReset: true };
        }

        applyParsedData(enquiry, llmData);

        if (hasAllPrimaryFields(enquiry)) {
            enquiry.status = 'completed';
            enquiry.conversationStage = 'completed';
        } else {
            enquiry.status = 'in_progress';
            enquiry.conversationStage = 'collecting';
        }

        await enquiry.save();

        return {
            enquiry,
            hasAllPrimaryFields: hasAllPrimaryFields(enquiry),
            isReset: false
        };
    } catch (error) {
        console.error('Error in upsertEnquiryFromMessage:', error);
        throw error;
    }
}

async function updateEnquiryData(phoneNumber, stage, data) {
    const enquiry = await getOrCreateEnquiry(phoneNumber);
    applyParsedData(enquiry, data);
    await enquiry.save();
    return enquiry;
}

async function resetEnquiry(phoneNumber) {
    try {
        const enquiry = await getOrCreateEnquiry(phoneNumber);
        enquiry.status = 'new';
        enquiry.conversationStage = 'greeting';
        enquiry.clientName = null;
        enquiry.email = null;
        enquiry.businessName = null;
        enquiry.websiteType = null;
        enquiry.timeline = null;
        enquiry.existingWebsite = null;
        enquiry.targetAudience = null;
        enquiry.coreFeature = null;
        enquiry.features = null;
        enquiry.budget = null;
        await enquiry.save();
        return enquiry;
    } catch (error) {
        console.error('Error in resetEnquiry:', error);
        throw error;
    }
}

async function getAllEnquiries(filters = {}) {
    try {
        const query = {};
        if (filters.status) query.status = filters.status;
        return await Enquiry.find(query).sort({ createdAt: -1 }).limit(filters.limit || 100);
    } catch (error) {
        console.error('Error in getAllEnquiries:', error);
        throw error;
    }
}

async function getEnquiryById(id) {
    return await Enquiry.findById(id);
}

async function updateEnquiryStatus(id, status) {
    try {
        const enquiry = await Enquiry.findById(id);
        if (enquiry) {
            enquiry.status = status;
            await enquiry.save();
        }
        return enquiry;
    } catch (error) {
        console.error('Error in updateEnquiryStatus:', error);
        throw error;
    }
}

async function getEnquiryStats() {
    try {
        const total = await Enquiry.countDocuments();
        const completed = await Enquiry.countDocuments({ status: 'completed' });
        const inProgress = await Enquiry.countDocuments({ status: 'in_progress' });
        return { total, completed, inProgress };
    } catch (error) {
        console.error('Error in getEnquiryStats:', error);
        throw error;
    }
}

function getEnquirySummary(enquiry) {
    return `Name: ${enquiry.clientName || 'N/A'}, Business: ${enquiry.businessName || 'N/A'}`;
}

async function createCallbackRequest(phoneNumber) {
    const enquiry = await getOrCreateEnquiry(phoneNumber);
    enquiry.status = 'callback_requested';
    await enquiry.save();
    return enquiry;
}

module.exports = {
    getOrCreateEnquiry,
    upsertEnquiryFromMessage,
    updateEnquiryData,
    resetEnquiry,
    hasAllPrimaryFields,
    getAllEnquiries,
    getEnquiryById,
    updateEnquiryStatus,
    getEnquiryStats,
    getEnquirySummary,
    createCallbackRequest
};