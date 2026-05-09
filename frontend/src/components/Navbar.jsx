import React from 'react';
import { FiLogOut, FiHome, FiMessageSquare, FiClipboard } from 'react-icons/fi';
import './Navbar.css';

const Navbar = ({ user, onLogout, currentView, onNavigate }) => {
    return (
        <nav className="navbar">
            <div className="navbar-container">
                <div className="navbar-brand">
                    <div className="logo">
                        <div className="logo-text">Tankar Solution</div>
                    </div>
                </div>

                <div className="navbar-menu">
                    <div className="nav-tabs">
                        <button
                            className={`nav-tab \${currentView === 'dashboard' ? 'active' : ''}`}
                            onClick={() => onNavigate('dashboard')}
                        >
                            <FiHome />
                            <span>Dashboard</span>
                        </button>
                        <button
                            className={`nav-tab \${currentView === 'chats' ? 'active' : ''}`}
                            onClick={() => onNavigate('chats')}
                        >
                            <FiMessageSquare />
                            <span>Chats</span>
                        </button>
                        <button
                            className={`nav-tab \${currentView === 'enquiries' ? 'active' : ''}`}
                            onClick={() => onNavigate('enquiries')}
                        >
                            <FiClipboard />
                            <span>Enquiries</span>
                        </button>
                        <button
                            className={`nav-tab \${currentView === 'simulate' ? 'active' : ''}`}
                            onClick={() => onNavigate('simulate')}
                        >
                            <FiMessageSquare />
                            <span>Simulate</span>
                        </button>
                    </div>

                    <button className="logout-btn" onClick={onLogout}>
                        <FiLogOut />
                        <span>Logout</span>
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;