import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useLang } from '../context/AuthContext';
import { ArrowRight, LogOut, LayoutDashboard, Globe, Menu, X } from 'lucide-react';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLang();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="container nav-container">
        <Link to="/" className="nav-logo">
          <img src="/logo.png" alt="SpareShare Logo" className="logo-img-large" />
          <span className="logo-text">SpareShare AI</span>
        </Link>

        <div className="nav-links">
          <Link to="/" className="nav-link">{t('Explore', 'تلاش کریں')}</Link>
          <Link to="/about" className="nav-link">{t('About', 'ہمارے بارے میں')}</Link>
          <Link to="/zakat" className="nav-link text-green-accent">{t('Zakat Calendar', 'زکوٰۃ کیلکولیٹر')}</Link>
        </div>

        <div className="nav-actions">
          <div className="lang-dropdown-wrapper" style={{ position: 'relative', marginRight: '0.5rem' }} onClick={(e) => {
            const menu = document.getElementById('navbar-lang-menu');
            if (menu) menu.classList.toggle('open');
            e.stopPropagation();
          }}>
            <button
              className="lang-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#e2e8f0', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}
            >
              <Globe size={16} />
              {lang === 'Eng' ? 'Eng' : 'اردو'}
            </button>
            <div
              id="navbar-lang-menu"
              style={{
                position: 'absolute', top: '110%', right: 0, zIndex: 999,
                background: 'white', borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                minWidth: '130px', overflow: 'hidden', display: 'none'
              }}
              className="lang-menu"
            >
              <button
                onClick={() => { setLang('Eng'); document.getElementById('navbar-lang-menu').classList.remove('open'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '10px 16px', border: 'none',
                  background: lang === 'Eng' ? '#f0fdf4' : 'white',
                  color: lang === 'Eng' ? '#10b981' : '#1e293b',
                  fontWeight: lang === 'Eng' ? 700 : 500,
                  cursor: 'pointer', textAlign: 'left', fontSize: '0.9rem',
                  borderBottom: '1px solid #f1f5f9'
                }}
              >
                🇬🇧 English
              </button>
              <button
                onClick={() => { setLang('اردو'); document.getElementById('navbar-lang-menu').classList.remove('open'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '10px 16px', border: 'none',
                  background: lang !== 'Eng' ? '#f0fdf4' : 'white',
                  color: lang !== 'Eng' ? '#10b981' : '#1e293b',
                  fontWeight: lang !== 'Eng' ? 700 : 500,
                  cursor: 'pointer', textAlign: 'right', fontSize: '0.9rem',
                  direction: 'rtl', fontFamily: 'var(--font-urdu, serif)'
                }}
              >
                🇵🇰 اردو
              </button>
            </div>
          </div>

          <div className="hide-on-mobile-flex">
            {!user ? (
              <>
                <Link to="/auth/donor" className="nav-btn nav-btn-outline">
                  {t('Donor Login', 'ڈونر لاگ ان')} <ArrowRight size={15} />
                </Link>
                <Link to="/auth/receiver" className="nav-btn nav-btn-solid">
                  {t('Receiver Signup', 'وصول کنندہ سائن اپ')} <ArrowRight size={15} />
                </Link>
              </>
            ) : (
              <div className="user-menu">
                <span className="user-greeting">{t('Hi', 'سلام')}, {user.name?.split(' ')[0]}</span>
                <button
                  onClick={() => navigate(user.role === 'donor' ? '/contributor' : user.role === 'admin' ? '/admin' : '/receiver')}
                  className="nav-btn nav-btn-outline"
                >
                  <LayoutDashboard size={15} /> {t('Dashboard', 'ڈیش بورڈ')}
                </button>
                <button onClick={logout} className="nav-btn" style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '7px 14px' }}>
                  <LogOut size={15} />
                </button>
              </div>
            )}
          </div>

          <button className="hamburger-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle Navigation">
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="mobile-drawer">
          <div className="mobile-drawer-links">
            <Link to="/" className="mobile-drawer-link" onClick={() => setMobileMenuOpen(false)}>{t('Explore', 'تلاش کریں')}</Link>
            <Link to="/about" className="mobile-drawer-link" onClick={() => setMobileMenuOpen(false)}>{t('About', 'ہمارے بارے میں')}</Link>
            <Link to="/zakat" className="mobile-drawer-link text-green-accent" onClick={() => setMobileMenuOpen(false)}>{t('Zakat Calendar', 'زکوٰۃ کیلکولیٹر')}</Link>
          </div>
          <div className="mobile-drawer-actions">
            {!user ? (
              <>
                <Link to="/auth/donor" className="mobile-drawer-btn nav-btn-outline" onClick={() => setMobileMenuOpen(false)}>
                  {t('Donor Login', 'ڈونر لاگ ان')} <ArrowRight size={14} />
                </Link>
                <Link to="/auth/receiver" className="mobile-drawer-btn nav-btn-solid" onClick={() => setMobileMenuOpen(false)}>
                  {t('Receiver Signup', 'وصول کنندہ سائن اپ')} <ArrowRight size={14} />
                </Link>
              </>
            ) : (
              <div className="mobile-drawer-user">
                <span className="mobile-user-greeting">{t('Hi', 'سلام')}, {user.name?.split(' ')[0]}</span>
                <button
                  onClick={() => {
                    navigate(user.role === 'donor' ? '/contributor' : user.role === 'admin' ? '/admin' : '/receiver');
                    setMobileMenuOpen(false);
                  }}
                  className="mobile-drawer-btn nav-btn-outline"
                >
                  <LayoutDashboard size={14} /> {t('Dashboard', 'ڈیش بورڈ')}
                </button>
                <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="mobile-drawer-btn" style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '99px', width: '100%', fontWeight: 700 }}>
                  <LogOut size={14} /> {t('Logout', 'لاگ آؤٹ')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

// Global click listener to close menu
document.addEventListener('click', (e) => {
  const menu = document.getElementById('navbar-lang-menu');
  if (menu && !e.target.closest('.lang-dropdown-wrapper')) {
    menu.classList.remove('open');
  }
});

export default Navbar;
