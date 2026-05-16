import axios from 'axios';

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || 'https://tankarsolutions.tech/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add token to requests
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('adminToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Handle 401 errors (unauthorized)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
            const target = `${base}/login`;
            if (window.location.pathname !== target) {
                window.location.href = target;
            }
        }
        return Promise.reject(error);
    }
);

export const adminAPI = {
    // Login admin
    login: (name, password) => {
        return api.post('/admin/login', { name, password });
    },

    // Create admin (for initial setup)
    createAdmin: (name, password) => {
        return api.post('/admin/create', { name, password });
    },
};

export const dashboardAPI = {
    // Get all contacts with pagination and search
    getContacts: (page = 1, limit = 10, search = '') => {
        return api.get('/dashboard/contacts', {
            params: { page, limit, search }
        });
    },

    // Get conversations for a specific phone number
    getConversations: (phoneNumber, page = 1, limit = 10) => {
        return api.get(`/dashboard/conversations/${phoneNumber}`, {
            params: { page, limit }
        });
    },

    // Get overall statistics
    getStats: () => {
        return api.get('/dashboard/stats');
    },

    // Get daily enquiry counts for the trend chart
    getTrend: (days = 7) => {
        return api.get('/dashboard/trend', { params: { days } });
    },

    // Get latest N enquiries for the recent-activity card
    getRecent: (limit = 5) => {
        return api.get('/dashboard/recent', { params: { limit } });
    },

    // LLM cost dashboard
    getCost: (days = 30) => {
        return api.get('/dashboard/cost', { params: { days } });
    },

    // Get contact details
    getContact: (phoneNumber) => {
        return api.get(`/dashboard/contact/${phoneNumber}`);
    },

    // Update contact flags (botPaused, notes)
    updateContact: (phoneNumber, patch) => {
        return api.patch(`/dashboard/contact/${phoneNumber}`, patch);
    },

    // Generate (or refresh) an AI summary of the conversation
    summarize: (phoneNumber) => {
        return api.post(`/dashboard/conversations/${phoneNumber}/summarize`);
    },
};

export const enquiriesAPI = {
    // Get enquiry statistics
    getStats: () => {
        return api.get('/enquiries/stats');
    },

    // Get all enquiries with filters
    getEnquiries: (filters = {}) => {
        return api.get('/enquiries', { params: filters });
    },

    // Get specific enquiry
    getEnquiry: (id) => {
        return api.get(`/enquiries/${id}`);
    },

    // Get latest enquiry by phone number (or null)
    getByPhone: (phoneNumber) => {
        return api.get(`/enquiries/by-phone/${phoneNumber}`);
    },

    // Update enquiry status
    updateStatus: (id, status) => {
        return api.put(`/enquiries/${id}/status`, { status });
    },

    // Replace tags
    updateTags: (id, tags) => {
        return api.put(`/enquiries/${id}/tags`, { tags });
    },

    // Get pending callbacks
    getPendingCallbacks: () => {
        return api.get('/enquiries/callback/pending');
    },

    // Get enquiries by tag
    getByTag: (tag) => {
        return api.get(`/enquiries/tags/${tag}`);
    },

    // Get enquiries by loan type
    getByLoanType: (type) => {
        return api.get(`/enquiries/loantype/${type}`);
    },

    // Simulate WhatsApp message
    simulate: (phoneNumber, message) => {
        return api.post('/enquiries/simulate', { phoneNumber, message });
    },
};

export const settingsAPI = {
    getBot: () => api.get('/settings/bot'),
    updateBot: (patch) => api.put('/settings/bot', patch),
    addQA: (data) => api.post('/settings/qa', data),
    updateQA: (id, data) => api.put(`/settings/qa/${id}`, data),
    deleteQA: (id) => api.delete(`/settings/qa/${id}`),
    addQuickReply: (data) => api.post('/settings/quickreply', data),
    updateQuickReply: (id, data) => api.put(`/settings/quickreply/${id}`, data),
    deleteQuickReply: (id) => api.delete(`/settings/quickreply/${id}`),
};

export const profileAPI = {
    me: () => api.get('/profile'),
    update: (data) => api.put('/profile', data),
    changePassword: (data) => api.put('/profile/password', data),
};

export const messagesAPI = {
    send: (phoneNumber, body) => api.post('/messages/send', { phoneNumber, body }),
    broadcast: (phoneNumbers, body) => api.post('/messages/broadcast', { phoneNumbers, body }),
};

export const followupsAPI = {
    list: () => api.get('/followups'),
    create: (data) => api.post('/followups', data),
    update: (id, data) => api.put(`/followups/${id}`, data),
    remove: (id) => api.delete(`/followups/${id}`),
    runNow: (id) => api.post(`/followups/${id}/run`),
};

export const templatesAPI = {
    list: () => api.get('/templates'),
    create: (data) => api.post('/templates', data),
    update: (id, data) => api.put(`/templates/${id}`, data),
    remove: (id) => api.delete(`/templates/${id}`),
    render: (id, phoneNumber) => api.post(`/templates/${id}/render`, { phoneNumber }),
};

export const campaignsAPI = {
    list: () => api.get('/campaigns'),
    get: (id) => api.get(`/campaigns/${id}`),
    preview: (target) => api.post('/campaigns/preview', { target }),
    create: (data) => api.post('/campaigns', data),
    send: (id) => api.post(`/campaigns/${id}/send`),
    remove: (id) => api.delete(`/campaigns/${id}`),
};

export const analyticsAPI = {
    get: (days = 30) => api.get('/analytics', { params: { days } }),
};

export default api;