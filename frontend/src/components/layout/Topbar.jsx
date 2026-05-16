import { useLocation } from 'react-router-dom';
import { FiSun, FiMoon } from 'react-icons/fi';
import { useTheme } from '../../context/ThemeContext';

const TITLES = {
  '/dashboard': { title: 'Dashboard', breadcrumb: 'Overview of your WhatsApp lead activity' },
  '/enquiries': { title: 'Enquiries', breadcrumb: 'All leads captured from WhatsApp' },
  '/conversations': { title: 'Conversations', breadcrumb: 'Live chats with prospects' },
  '/simulator': { title: 'Simulator', breadcrumb: 'Test the bot in a sandboxed conversation' },
  '/followups': { title: 'Follow-ups', breadcrumb: 'Automated nudges for silent leads' },
  '/cost': { title: 'LLM cost', breadcrumb: 'Token usage and estimated spend' },
  '/templates': { title: 'Templates', breadcrumb: 'Reusable messages with variables' },
  '/campaigns': { title: 'Campaigns', breadcrumb: 'Targeted broadcasts using templates' },
  '/analytics': { title: 'Analytics', breadcrumb: 'Reply rates, response times, bot resolution' },
  '/settings': { title: 'Settings', breadcrumb: 'Bot configuration and Q&A library' },
  '/profile': { title: 'Profile', breadcrumb: 'Your account and credentials' },
};

export default function Topbar() {
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
  const matched = Object.keys(TITLES).find((k) => pathname.startsWith(k));
  const meta = matched ? TITLES[matched] : { title: 'Tankar', breadcrumb: '' };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-title">{meta.title}</span>
        {meta.breadcrumb && <span className="topbar-breadcrumb">{meta.breadcrumb}</span>}
      </div>
      <div className="topbar-right">
        <button
          className="btn btn-ghost btn-icon"
          onClick={toggle}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <FiMoon /> : <FiSun />}
        </button>
      </div>
    </header>
  );
}
