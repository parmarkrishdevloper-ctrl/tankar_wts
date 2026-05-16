import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { FullSpinner } from './components/ui/Spinner';
import AppShell from './components/layout/AppShell';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Enquiries from './pages/Enquiries';
import Conversations from './pages/Conversations';
import Simulator from './pages/Simulator';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Followups from './pages/Followups';
import Cost from './pages/Cost';
import Templates from './pages/Templates';
import Campaigns from './pages/Campaigns';
import Analytics from './pages/Analytics';
import './App.css';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullSpinner label="Loading workspace…" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullSpinner />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <Login />
          </RedirectIfAuthed>
        }
      />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/enquiries" element={<Enquiries />} />
        <Route path="/conversations" element={<Conversations />} />
        <Route path="/conversations/:phoneNumber" element={<Conversations />} />
        <Route path="/simulator" element={<Simulator />} />
        <Route path="/followups" element={<Followups />} />
        <Route path="/cost" element={<Cost />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
