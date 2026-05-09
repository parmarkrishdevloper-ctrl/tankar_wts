/**
 * Check if user is disinterested
 */
function isUserDisinterested(text, conversationHistory = []) {
    const lowerText = text.toLowerCase();

    // Direct disinterest signals
    const disinterestKeywords = [
        'no thanks', 'not interested', 'don\'t want', 'no need', 'cancel',
        'stop', 'later', 'bye', 'goodbye', 'talk to you later',
        'call me later', 'not now', 'maybe later', 'another time'
    ];

    if (disinterestKeywords.some(keyword => lowerText.includes(keyword))) {
        return true;
    }

    return false;
}

/**
 * Dummy parser for compatibility
 */
function parseComprehensiveResponse(text) {
    return {};
}

module.exports = {
    isUserDisinterested,
    parseComprehensiveResponse
};
