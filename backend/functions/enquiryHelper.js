const Enquiry = require('../models/Enquiry');
const { extractDataWithAI } = require('./llmDataExtractor');

function applyParsedData(enquiry, data = {}) {
    if (data.businessName) enquiry.businessName = data.businessName;
    if (data.websiteType) enquiry.websiteType = data.websiteType;
    if (data.pagesCount) enquiry.pagesCount = data.pagesCount;
    if (data.domainStatus) enquiry.domainStatus = data.domainStatus;
    if (data.stylePreference) enquiry.stylePreference = data.stylePreference;
    if (data.timeline) enquiry.timeline = data.timeline;
    if (data.email) enquiry.email = data.email;
    if (data.conversationStage) enquiry.conversationStage = data.conversationStage;
}

function hasAllPrimaryFields(enquiry) {
    return Boolean(
        enquiry.businessName &&
        enquiry.websiteType &&
        enquiry.pagesCount &&
        enquiry.domainStatus
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
        } else {
            enquiry.status = 'in_progress';
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
        enquiry.businessName = null;
        enquiry.websiteType = null;
        enquiry.pagesCount = null;
        enquiry.domainStatus = null;
        enquiry.stylePreference = null;
        enquiry.timeline = null;
        enquiry.email = null;
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