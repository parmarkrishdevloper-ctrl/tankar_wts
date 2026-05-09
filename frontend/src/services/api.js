import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000'; // Adjust for your backend URL
const API2 = "api"

const api = axios.create({
    baseURL: `${API_BASE_URL}/${API2}`,
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
            // Token expired or invalid
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = '/';
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

    // Get contact details
    getContact: (phoneNumber) => {
        return api.get(`/dashboard/contact/${phoneNumber}`);
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

    // Update enquiry status
    updateStatus: (id, status) => {
        return api.put(`/enquiries/${id}/status`, { status });
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

export default api;