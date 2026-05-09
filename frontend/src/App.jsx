import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import Conversations from './components/Conversations';
import Enquiries from './components/Enquiries';
import Simulator from './components/Simulator';
import './App.css';

function App() {
  const { user, logout, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'chats', 'enquiries', or 'simulate'
  const [selectedContact, setSelectedContact] = useState(null);

  const handleLogout = () => {
    logout();
    setCurrentView('dashboard');
    setSelectedContact(null);
  };

  const handleSelectContact = (phoneNumber) => {
    setSelectedContact(phoneNumber);
  };

  const handleBackToContacts = () => {
    setSelectedContact(null);
  };

  const handleNavigate = (view) => {
    setCurrentView(view);
    setSelectedContact(null);
  };

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return <Login />;
  }

  return (
    <div className="app">
      <Navbar
        user={user}
        onLogout={handleLogout}
        currentView={currentView}
        onNavigate={handleNavigate}
      />
      <div className="app-content">
        {currentView === 'dashboard' && (
          <Dashboard />
        )}
        {currentView === 'chats' && (
          <Conversations
            selectedContact={selectedContact}
            onSelectContact={handleSelectContact}
            onBack={handleBackToContacts}
          />
        )}
        {currentView === 'enquiries' && (
          <Enquiries />
        )}
        {currentView === 'simulate' && (
          <Simulator />
        )}
      </div>
    </div>
  );
}

export default App;