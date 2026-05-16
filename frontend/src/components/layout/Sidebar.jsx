import { NavLink, useNavigate } from 'react-router-dom';
import {
  FiGrid,
  FiMessageSquare,
  FiInbox,
  FiPlay,
  FiClock,
  FiDollarSign,
  FiSettings,
  FiUser,
  FiLogOut,
  FiFileText,
  FiTarget,
  FiBarChart2,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: FiGrid },
  { to: '/enquiries', label: 'Enquiries', icon: FiInbox },
  { to: '/conversations', label: 'Conversations', icon: FiMessageSquare },
  { to: '/campaigns', label: 'Campaigns', icon: FiTarget },
  { to: '/templates', label: 'Templates', icon: FiFileText },
  { to: '/followups', label: 'Follow-ups', icon: FiClock },
  { to: '/analytics', label: 'Analytics', icon: FiBarChart2 },
  { to: '/cost', label: 'LLM cost', icon: FiDollarSign },
  { to: '/simulator', label: 'Simulator', icon: FiPlay },
];

const ADMIN_NAV = [
  { to: '/settings', label: 'Settings', icon: FiSettings },
  { to: '/profile', label: 'Profile', icon: FiUser },
];

function initials(name = '') {
  return (
    name
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'A'
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">T</div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">Tankar</span>
          <span className="sidebar-brand-sub">WhatsApp Suite</span>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Workspace</div>
        <nav className="sidebar-nav">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="sidebar-link">
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Admin</div>
        <nav className="sidebar-nav">
          {ADMIN_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="sidebar-link">
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        <button
          type="button"
          className="user-card"
          onClick={() => navigate('/profile')}
          style={{ width: '100%', cursor: 'pointer', border: '1px solid var(--c-border)' }}
        >
          <div className="avatar avatar-md">{initials(user?.name)}</div>
          <div className="user-card-body" style={{ textAlign: 'left' }}>
            <div className="user-card-name">{user?.name || 'Admin'}</div>
            <div className="user-card-role">Administrator</div>
          </div>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            title="Sign out"
            onClick={(e) => {
              e.stopPropagation();
              logout();
            }}
            aria-label="Sign out"
          >
            <FiLogOut />
          </button>
        </button>
      </div>
    </aside>
  );
}
