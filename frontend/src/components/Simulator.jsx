import React, { useState } from 'react';
import { enquiriesAPI } from '../services/api';
import './Simulator.css';

const Simulator = () => {
    const [phoneNumber, setPhoneNumber] = useState('1234567890');
    const [message, setMessage] = useState('');
    const [chat, setChat] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        const userMsg = { role: 'user', content: message };
        setChat([...chat, userMsg]);
        setLoading(true);
        setMessage('');

        try {
            const response = await enquiriesAPI.simulate(phoneNumber, message);
            const aiMsg = { role: 'bot', content: response.data.reply };
            setChat(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error('Simulation failed:', error);
            setChat(prev => [...prev, { role: 'error', content: 'Simulation failed. Please check console.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="simulator-container">
            <div className="simulator-header">
                <h2>WhatsApp Simulator</h2>
                <div className="phone-input">
                    <label>Simulated Phone Number:</label>
                    <input 
                        type="text" 
                        value={phoneNumber} 
                        onChange={(e) => setPhoneNumber(e.target.value)} 
                    />
                </div>
            </div>

            <div className="chat-window">
                {chat.length === 0 && (
                    <div className="empty-chat">
                        <p>Start a conversation by typing "Hi" or any message below.</p>
                    </div>
                )}
                {chat.map((msg, index) => (
                    <div key={index} className={`message ${msg.role}`}>
                        <div className="message-bubble">
                            {msg.content}
                        </div>
                    </div>
                ))}
                {loading && <div className="message bot"><div className="message-bubble loading-dots">Thinking...</div></div>}
            </div>

            <form className="message-input" onSubmit={handleSendMessage}>
                <input 
                    type="text" 
                    placeholder="Type a message..." 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={loading}
                />
                <button type="submit" disabled={loading || !message.trim()}>Send</button>
            </form>
        </div>
    );
};

export default Simulator;
