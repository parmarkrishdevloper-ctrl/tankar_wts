import React, { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import {
    FiMessageSquare,
    FiDownload,
    FiUpload,
    FiUser,
    FiCpu,
    FiAlertCircle,
    FiSearch,
    FiClock,
    FiDollarSign
} from 'react-icons/fi';
import { BsInboxes } from 'react-icons/bs';
import './Conversations.css';

const Conversations = ({ selectedContact, onSelectContact, onBack }) => {
    const [contacts, setContacts] = useState([]);
    const [allMessages, setAllMessages] = useState([]);
    const [contactDetails, setContactDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchContacts();
    }, []);

    useEffect(() => {
        if (selectedContact) {
            fetchContactDetails();
            fetchAllConversations();
        }
    }, [selectedContact]);

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const response = await dashboardAPI.getContacts(1, 100, '');
            setContacts(response.data.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching contacts:', err);
            setError('Failed to load contacts');
        } finally {
            setLoading(false);
        }
    };

    const fetchContactDetails = async () => {
        try {
            const response = await dashboardAPI.getContact(selectedContact);
            setContactDetails(response.data.data);
        } catch (err) {
            console.error('Error fetching contact details:', err);
        }
    };

    const fetchAllConversations = async () => {
        setMessagesLoading(true);
        try {
            const response = await dashboardAPI.getConversations(selectedContact, 1, 1000);
            const conversations = response.data.data;

            const messages = [];
            conversations.forEach(conversation => {
                conversation.messages.forEach(message => {
                    messages.push({
                        ...message,
                        conversationId: conversation._id,
                        conversationDate: conversation.startedAt
                    });
                });
            });

            messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            setAllMessages(messages);
            setError(null);
        } catch (err) {
            console.error('Error fetching conversations:', err);
            setError('Failed to load conversations');
        } finally {
            setMessagesLoading(false);
        }
    };

    const formatNumber = (num) => {
        return num?.toLocaleString() || 0;
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount || 0);
    };

    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDate = (date) => {
        const messageDate = new Date(date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (messageDate.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (messageDate.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return messageDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        }
    };

    const formatLastMessageTime = (date) => {
        const messageDate = new Date(date);
        const today = new Date();

        if (messageDate.toDateString() === today.toDateString()) {
            return formatTime(date);
        } else {
            return messageDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
        }
    };

    const groupMessagesByDate = () => {
        const groups = {};
        allMessages.forEach(message => {
            const dateKey = new Date(message.timestamp).toDateString();
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(message);
        });
        return groups;
    };

    const filteredContacts = contacts.filter(contact =>
        contact.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const messageGroups = groupMessagesByDate();

    return (
        <div className="whatsapp-container">
            {/* Left Sidebar - Contacts List */}
            <div className="contacts-sidebar">
                <div className="sidebar-header">
                    <h2>Loan Chats</h2>
                </div>

                <div className="search-container">
                    <FiSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search contacts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>

                <div className="contacts-list">
                    {loading ? (
                        <div className="loading-contacts">
                            <div className="spinner"></div>
                            <p>Loading contacts...</p>
                        </div>
                    ) : filteredContacts.length === 0 ? (
                        <div className="empty-contacts">
                            <BsInboxes />
                            <p>No contacts found</p>
                        </div>
                    ) : (
                        filteredContacts.map((contact) => (
                            <div
                                key={contact._id}
                                className={`contact-item ${selectedContact === contact.phoneNumber ? 'active' : ''}`}
                                onClick={() => onSelectContact(contact.phoneNumber)}
                            >
                                <div className="contact-avatar">
                                    <FiUser />
                                </div>
                                <div className="contact-info">
                                    <div className="contact-header">
                                        <h3>{contact.phoneNumber}</h3>
                                        <span className="contact-time">
                                            {formatLastMessageTime(contact.lastContactDate)}
                                        </span>
                                    </div>
                                    <div className="contact-preview">
                                        <span className="message-count">
                                            {formatNumber(contact.totalConversations)} loan conversations
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right Side - Chat View */}
            <div className="chat-view">
                {!selectedContact ? (
                    <div className="no-chat-selected">
                        <FiMessageSquare />
                        <h2>Select a loan chat</h2>
                        <p>Choose a contact from the list to view loan enquiry conversations</p>
                    </div>
                ) : (
                    <>
                        {/* Chat Header */}
                        <div className="chat-header">
                            <div className="chat-header-info">
                                <div className="chat-avatar">
                                    <FiUser />
                                </div>
                                <div className="chat-title">
                                    <h2>{selectedContact}</h2>
                                    {contactDetails && (
                                        <div className="chat-stats">
                                            <span>
                                                <FiMessageSquare />
                                                {formatNumber(contactDetails.totalConversations)} chats
                                            </span>
                                            <span>•</span>
                                            <span>
                                                <FiDownload />
                                                {formatNumber(contactDetails.totalInputTokens)} in
                                            </span>
                                            <span>•</span>
                                            <span>
                                                <FiUpload />
                                                {formatNumber(contactDetails.totalOutputTokens)} out
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="messages-area">
                            {messagesLoading ? (
                                <div className="loading-messages">
                                    <div className="spinner"></div>
                                    <p>Loading messages...</p>
                                </div>
                            ) : allMessages.length === 0 ? (
                                <div className="empty-messages">
                                    <BsInboxes />
                                    <h3>No messages yet</h3>
                                    <p>No loan enquiry messages have been exchanged with this contact</p>
                                </div>
                            ) : (
                                <div className="messages-wrapper">
                                    {Object.keys(messageGroups).map((dateKey) => (
                                        <div key={dateKey}>
                                            {/* Date Separator */}
                                            <div className="date-separator">
                                                <span>{formatDate(new Date(dateKey))}</span>
                                            </div>

                                            {/* Messages for this date */}
                                            <div className="messages">
                                                {messageGroups[dateKey].map((message, index) => (
                                                    <div
                                                        key={`${message.conversationId}-${index}`}
                                                        className={`message ${message.role}`}
                                                    >
                                                        <div className="message-bubble">
                                                            <div className="message-content">
                                                                {message.content}
                                                            </div>
                                                            <div className="message-footer">
                                                                <span className="message-time">
                                                                    {formatTime(message.timestamp)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Conversations;