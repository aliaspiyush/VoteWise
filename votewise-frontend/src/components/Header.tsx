import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context';
import './Header.css';

export default function Header() {
  const { darkMode, toggleDarkMode, session } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  return (
    <header className="site-header" role="banner">
      <div className="header-inner container">
        {/* Logo */}
        <Link to="/" className="header-logo" aria-label="VoteWise home">
          <span className="logo-mark" aria-hidden="true">🗳</span>
          <span className="logo-text">VoteWise</span>
        </Link>

        {/* Nav */}
        {session && (
          <nav className="header-nav" aria-label="Main navigation">
            <Link to="/dashboard" className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}>
              Dashboard
            </Link>
            <Link to="/quiz" className={`nav-link ${location.pathname === '/quiz' ? 'active' : ''}`}>
              Quiz
            </Link>
          </nav>
        )}

        <div className="header-spacer" />

        {/* Controls */}
        <div className="header-controls">
          <button
            className="icon-btn"
            onClick={toggleDarkMode}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? '☀' : '☾'}
          </button>

          {!isHome && !session && (
            <button className="btn btn-primary" style={{ fontSize: '0.8125rem', padding: '0.4rem 0.875rem' }} onClick={() => navigate('/onboarding')}>
              Get started
            </button>
          )}

          {session && (
            <div className="user-chip">
              <span className="user-dot" />
              <span>{session.userState}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
