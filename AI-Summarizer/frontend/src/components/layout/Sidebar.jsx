import { useTheme } from '../../context/ThemeContext';
import { useUser, useClerk } from '@clerk/react';
import { useState, useEffect } from 'react';
import { checkHealth } from '../../api/client';

const NAV_ITEMS = [
  { key: 'summarize',  icon: '⚡', label: 'Summarize',       subtitle: 'Paste and summarize any text' },
  { key: 'upload',     icon: '📄', label: 'Upload File',     subtitle: 'Upload PDF, DOCX, or TXT files' },
  { key: 'chat',       icon: '💬', label: 'Chat with AI',     subtitle: 'Interactive Q&A based on PDF', badge: 'NEW' },
  { key: 'keywords',   icon: '🔍', label: 'Keywords & NLP',  subtitle: 'Keywords, sentiment, topics & questions' },
  { key: 'processor',  icon: '✍️', label: 'Grammar Checker',  subtitle: 'Proofread and fix writing errors', badge: 'NEW' },
  { key: 'plagiarism', icon: '🛡️', label: 'Plagiarism Check', subtitle: 'Check text & file originality', badge: 'NEW' },
  { key: 'audio',      icon: '🔊', label: 'Audio TTS',       subtitle: 'Convert summary to speech' },
  { key: 'history',    icon: '🕐', label: 'History',         subtitle: 'View past summaries' },
];

export default function Sidebar({ activeSection, onSectionChange, isOpen, onClose }) {
  const { theme, toggleTheme } = useTheme();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [apiStatus, setApiStatus] = useState('checking');

  useEffect(() => {
    checkHealth()
      .then(() => setApiStatus('online'))
      .catch(() => setApiStatus('offline'));
  }, []);

  return (
    <nav className={`sidebar ${isOpen ? 'open' : ''}`} aria-label="Main Navigation">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon" aria-hidden="true">🤖</div>
        <div className="logo-text">
          <span className="logo-title">AI Summarizer</span>
          <span className="logo-subtitle">Smart NLP Platform</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="sidebar-nav" role="list">
        {NAV_ITEMS.map(item => (
          <div
            key={item.key}
            className={`nav-item ${activeSection === item.key ? 'active' : ''}`}
            role="listitem"
            tabIndex={0}
            onClick={() => { onSectionChange(item.key); onClose?.(); }}
            onKeyDown={e => e.key === 'Enter' && onSectionChange(item.key)}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.badge && <span className="nav-badge">{item.badge}</span>}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        {/* User profile card */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, background: 'var(--glass-bg)', borderRadius: 'var(--r-md)', marginBottom: 4 }}>
            <img src={user.imageUrl} alt={user.fullName || 'User Avatar'} style={{ width: 28, height: 28, borderRadius: '50%' }} />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.fullName || user.primaryEmailAddress?.emailAddress}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.primaryEmailAddress?.emailAddress}
              </span>
            </div>
          </div>
        )}

        {/* API Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', fontSize: 12, color: 'var(--text-4)' }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: apiStatus === 'online' ? 'var(--success)' : apiStatus === 'offline' ? 'var(--error)' : 'var(--text-4)',
            boxShadow: apiStatus === 'online' ? '0 0 8px var(--success)' : apiStatus === 'offline' ? '0 0 8px var(--error)' : 'none',
          }} />
          <span>{apiStatus === 'online' ? 'API Online' : apiStatus === 'offline' ? 'API Offline' : 'Checking API…'}</span>
        </div>

        {/* Theme Toggle */}
        <div className="theme-toggle" onClick={toggleTheme} role="button" tabIndex={0} aria-label="Toggle dark/light mode">
          <span style={{ fontSize: 13 }}>{theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}</span>
          <div className="toggle-switch" aria-hidden="true">
            <div className="toggle-knob" />
          </div>
        </div>

        {/* Logout */}
        <button className="logout-btn" onClick={() => signOut()} aria-label="Logout">
          🚪 Logout
        </button>
      </div>
    </nav>
  );
}

export { NAV_ITEMS };
