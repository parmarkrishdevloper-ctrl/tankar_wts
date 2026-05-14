const axios = require('axios');
require('dotenv').config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

/**
 * Extract structured project data from user message using LLM
 * @param {string} text - User's message text
 * @param {object} currentEnquiry - Current enquiry state (optional context for better extraction)
 * @returns {object} - Extracted data object
 */
async function extractDataWithAI(text, currentEnquiry = {}) {
    const phoneNumber = currentEnquiry.phoneNumber || "Unknown";
    console.log(`\n--- 📥 [AI_START] Processing message from ${phoneNumber} ---`);
    try {
        const systemPrompt = `
You are a precise and intelligent data extraction assistant for Tankar Solution, a website building company.
Your task is to extract structured information from the user's message and return it in STRICT JSON format.

-----------------------------------
🎯 OBJECTIVE
-----------------------------------
- Extract ONLY explicitly mentioned details.
- Normalize and standardize values.
- Do NOT assume missing data.
- Output must ALWAYS be valid JSON.
- **Hinglish Support**: User messages may be in Hinglish (Hindi mixed with English). Understand the context and extract details accurately.

-----------------------------------
📌 OUTPUT RULES
-----------------------------------
1. Return ONLY a valid JSON object.
2. Do NOT add explanations, text, or comments.
3. Do NOT include fields that are not mentioned.

-----------------------------------
📊 FIELDS TO EXTRACT
-----------------------------------
- clientName: The full name of the user.
- email: The professional email address of the user.
- businessName: The name of the user's business or brand.
- websiteType: Type of business or website (e.g., Real Estate, E-commerce, Gym).
- pagesCount: Number of pages requested (e.g., 5, Home/About/Contact).
- domainStatus: Whether they have a domain or need one (e.g., "Already has", "Naya lena hai").
- stylePreference: Which style they liked from the samples.
- intent: Set to "new_consultation" if they want to start over.
- language: The language used by the user (e.g., "Hindi", "English", "Hinglish").
- conversationStage: The current stage of the conversation based on the flow (greeting, business_type, project_details, package, portfolio, closing).

-----------------------------------
⚠️ SPECIAL HANDLING RULES
-----------------------------------
1. Extract clean names only: "My name is Krish Patel" → "Krish Patel"
2. Normalize website types into professional categories (e.g., "ai tool" → "AI-Powered SaaS Tool").
3. For existing websites, extract the full URL if provided.
4. For timeline, extract timeframes like "2 weeks", "next month", "ASAP".
`;

        const cleanedEnquiry = currentEnquiry && typeof currentEnquiry.toObject === 'function'
            ? currentEnquiry.toObject()
            : currentEnquiry;

        const requestPayload = {
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `Current Collected Data: ${JSON.stringify(cleanedEnquiry)}\n\nNew User Message: "${text}"\n\nExtract any new or updated information from the message above accurately.`
                }
            ],
            temperature: 0.1,
            max_tokens: 1024,
            response_format: { type: "json_object" }
        };

        console.log("🚀 [AI_REQUEST] Calling Groq API...");
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            requestPayload,
            {
                headers: {
                    Authorization: `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("✅ [AI_SUCCESS] Groq Response Received");

        let content = response.data?.choices?.[0]?.message?.content;
        if (!content) {
            console.log("⚠️ [AI_EMPTY] No content in response.");
            return {};
        }

        if (content.includes('```')) {
            content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        try {
            const parsed = JSON.parse(content);
            console.log("💎 [AI_DATA] Extracted:", JSON.stringify(parsed));
            return parsed;
        } catch (jsonError) {
            console.error("❌ [AI_PARSE_ERROR]", jsonError.message);
            return {};
        }

    } catch (error) {
        console.error("‼️ [AI_CRITICAL_FAILURE] ‼️");
        return {};
    }
}

module.exports = { extractDataWithAI };