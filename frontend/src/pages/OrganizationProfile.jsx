import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Heart, MapPin, Share2, Globe, ShieldCheck, Camera, Check, Phone, Mail, Building2, Clock, AlertCircle, ChevronLeft, LogOut, Search, UserCircle } from 'lucide-react';
import { useAuth, useLang } from '../context/AuthContext';
import { organizations } from './Home';
import axios from 'axios';
import './OrganizationProfile.css';

const t = (lang, en, ur) => lang === 'Eng' ? en : ur;

const FALLBACK_IMAGE = 'https://images.pexels.com/photos/6995136/pexels-photo-6995136.jpeg';

const OrganizationProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang, setLang } = useLang();

  const [shareToast, setShareToast] = useState(false);

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2500);
      });
    } else {
      // Fallback for browsers without clipboard API
      window.prompt('Copy this link:', url);
    }
  };

  // First check static orgs (from Home.jsx)
  const staticOrg = organizations.find(o => o.id === id);

  const [dbOrg, setDbOrg] = useState(null);
  const [dbPosts, setDbPosts] = useState([]);
  const [loadingDb, setLoadingDb] = useState(!staticOrg); // only load if not static
  const [selectedCategories, setSelectedCategories] = useState([]);

  useEffect(() => {
    if (!staticOrg) {
      // Fetch org from database
      const fetchOrg = async () => {
        try {
          const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
          const res = await axios.get(`${API}/api/users/org/${id}`);
          setDbOrg(res.data.org);
          setDbPosts(res.data.posts || []);
        } catch (err) {
          console.error('Failed to fetch org from DB', err);
        } finally {
          setLoadingDb(false);
        }
      };
      fetchOrg();
    }
  }, [id, staticOrg]);

  const toggleCategory = (cat) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleDonateClick = () => {
    if (selectedCategories.length === 0) {
      alert('Please select an item category first.');
      return;
    }
    if (!user) {
      navigate('/auth/donor');
    } else {
      navigate(`/donate/${id}?categories=${selectedCategories.join(',')}`);
    }
  };

  // LOADING STATE
  if (loadingDb) {
    return (
      <div className="org-loading-state">
        <div className="org-spinner" />
        <p>{t(lang, 'Loading organization profile...', 'تنظیم کی معلومات لوڈ ہو رہی ہے...')}</p>
      </div>
    );
  }

  // Build a unified org object from static OR db
  const org = staticOrg
    ? {
        name: staticOrg.name,
        type: staticOrg.type,
        city: staticOrg.city,
        desc: staticOrg.desc,
        image: staticOrg.image,
        logo: staticOrg.logo,
        email: staticOrg.email || '',
        phone: staticOrg.phone || '',
        isFromDb: false,
      }
    : dbOrg
    ? {
        name: dbOrg.name,
        type: dbOrg.orgType || 'Organization',
        city: dbOrg.city || localStorage.getItem(`city_${dbOrg._id}`) || 'Pakistan',
        desc: dbOrg.bio || localStorage.getItem(`bio_${dbOrg._id}`) || `${dbOrg.name} is a verified organization on SpareShare AI, actively collecting and distributing donations across Pakistan.`,
        image: FALLBACK_IMAGE,
        logo: dbOrg.profilePic || null,
        email: dbOrg.email || '',
        phone: dbOrg.phone || '',
        isFromDb: true,
      }
    : null;

  // NOT FOUND STATE
  if (!org) {
    return (
      <div className="org-not-found-state">
        <AlertCircle size={56} color="#ef4444" />
        <h2>{t(lang, 'Organization Not Found', 'تنظیم نہیں ملی')}</h2>
        <p>{t(lang, 'This organization may have been removed or the link is incorrect.', 'یہ تنظیم ہٹا دی گئی ہو سکتی ہے یا لنک غلط ہے۔')}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>{t(lang, 'Go Home', 'ہوم پر جائیں')}</button>
      </div>
    );
  }

  return (
    <div className="org-profile-wrapper">
      {/* Share Toast */}
      {shareToast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999,
          background: '#10b981', color: 'white', padding: '12px 20px',
          borderRadius: '10px', fontWeight: 600, fontSize: '0.9rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)', animation: 'fadeIn 0.3s ease'
        }}>
          ✅ {t(lang, 'Link copied to clipboard!', 'لنک کاپی ہو گیا!')}
        </div>
      )}

      {user && user.role === 'donor' && (
        <header className="portal-header" style={{ position: 'sticky', top: 0, zIndex: 1000, background: '#0f172a' }}>
          <div className="portal-logo" onClick={() => navigate('/')}>
            <img src="/logo.png" alt="SpareShare" />
            <span>{t(lang, 'Donor Portal', 'عطیہ دہندہ پورٹل')}</span>
          </div>

          <nav className="portal-nav" style={{ flex: 1, justifyContent: 'center' }}>
            <button className="nav-tab" onClick={() => navigate('/contributor')}>
              <ChevronLeft size={18} /> {t(lang, 'Back to Dashboard', 'ڈیش بورڈ پر واپس جائیں')}
            </button>
          </nav>

          <div className="portal-actions">
            <div className="lang-dropdown-wrapper" style={{ position: 'relative' }}>
              <button
                className="lang-btn"
                onClick={(e) => { e.stopPropagation(); document.getElementById('org-lang-menu').classList.toggle('open'); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Globe size={16} />
                {lang === 'Eng' ? 'English' : 'اردو'}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 2 }}>
                  <path d="M1 3L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
              <div
                id="org-lang-menu"
                style={{
                  position: 'absolute', top: '110%', right: 0, zIndex: 999,
                  background: 'white', borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  minWidth: '130px', overflow: 'hidden', display: 'none'
                }}
                className="lang-menu"
              >
                <button
                  onClick={() => { setLang('Eng'); document.getElementById('org-lang-menu').classList.remove('open'); }}
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
                  onClick={() => { setLang('Urdu'); document.getElementById('org-lang-menu').classList.remove('open'); }}
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
          </div>
        </header>
      )}

      {/* Cover Banner */}
      <div className="org-cover" style={{ backgroundImage: `url(${org.image})` }}>
        <div className="cover-overlay"></div>
      </div>

      <div className="container profile-container">
        {/* Main Content Area */}
        <div className="profile-main">
          <div className="org-header-clean">
            {org.logo ? (
              <img src={org.logo} alt={`${org.name} logo`} className="org-logo-large" />
            ) : (
              <div className="org-logo-placeholder">
                <Building2 size={36} color="#10b981" />
              </div>
            )}
            <div className="org-title-area">
              <h1>{org.name}</h1>
              <p className="org-subtitle"><MapPin size={16} /> {org.city}, {t(lang, 'Pakistan', 'پاکستان')} • {org.type}</p>
            </div>
            <div className="org-actions">
              <button className="btn btn-outline" onClick={handleShare} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Share2 size={18} /> {t(lang, 'Share', 'شیئر کریں')}
              </button>
            </div>
          </div>

          {/* About Section */}
          <div className="org-content-card glass-panel">
            <h2>{t(lang, 'About this organization', 'اس تنظیم کے بارے میں')}</h2>
            <p className="org-about-text">
              {org.desc}
              <br /><br />
              {t(lang,
                `By utilizing SpareShare AI, ${org.name} ensures that all received items are pre-scanned for safety and distributed effectively to those in need.`,
                `SpareShare AI کے ذریعے، ${org.name} یقینی بناتی ہے کہ تمام موصول شدہ اشیاء حفاظت کے لیے پہلے سے اسکین کی جائیں اور ضرورت مندوں میں مؤثر طریقے سے تقسیم کی جائیں۔`
              )}
            </p>

            <div className="org-contact-row">
              {org.email && (<div className="org-contact-item"><Mail size={16} color="#10b981" /> {org.email}</div>)}
              {org.phone && org.phone !== '+92 000 0000000' && (<div className="org-contact-item"><Phone size={16} color="#10b981" /> {org.phone}</div>)}
            </div>

            <div className="org-verification" style={{ marginTop: '1.5rem' }}>
              <div className="verify-badge">
                <ShieldCheck className="text-green" size={24} />
                <div>
                  <strong>{t(lang, 'SpareShare Verified', 'SpareShare تصدیق شدہ')}</strong>
                  <p>{t(lang, 'Identity and operational status verified by SpareShare AI admins.', 'شناخت اور آپریشنل حیثیت SpareShare AI منتظمین نے تصدیق کی ہے۔')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* All Posts — grouped by status */}
          <div className="org-content-card glass-panel">
            <h2>{t(lang, 'Needs & Demands', 'ضروریات اور مطالبات')}</h2>
            {org.isFromDb && dbPosts.length > 0 ? (
              <div className="updates-list">
                {dbPosts.map(post => (
                  <div key={post._id} className="update-item">
                    <div className="update-icon">
                      {post.urgency === 'High' || post.urgency === 'Critical'
                        ? <AlertCircle size={20} color={post.status === 'Fulfilled' ? '#10b981' : '#ef4444'} />
                        : <Camera size={20} />}
                    </div>
                    <div className="update-text" style={{flex: 1}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px'}}>
                        <strong style={{color: 'var(--text-main)'}}>{post.title}</strong>
                        <span className={`post-status-pill ${(post.status || 'active').toLowerCase()}`}>{t(lang, post.status || 'Active', post.status === 'Fulfilled' ? 'مکمل' : 'فعال')}</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>{post.desc}</p>
                      <span className="update-time">
                        <Clock size={12} /> {new Date(post.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {(post.urgency === 'High' || post.urgency === 'Critical') && post.status !== 'Fulfilled' &&
                          <span style={{ color: '#f87171', fontWeight: 700, marginLeft: '8px' }}>• {post.urgency} {t(lang, 'Urgency', 'ضرورت')}</span>
                        }
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="updates-list">
                <div className="update-item">
                  <div className="update-icon"><Camera size={20} /></div>
                  <div className="update-text">
                    <strong>{t(lang, 'Urgent Request:', 'فوری درخواست:')}</strong> {t(lang, 'Seeking non-perishable food items and blankets for the upcoming winter drive.', 'آنے والی موسم سرما کی مہم کے لیے غیر فاسد خوراکی اشیاء اور کمبل درکار ہیں۔')}
                    <span className="update-time">{t(lang, 'Recently posted', 'حال ہی میں پوسٹ')}</span>
                  </div>
                </div>
                <div className="update-item">
                  <div className="update-icon"><Camera size={20} /></div>
                  <div className="update-text">
                    <strong>{t(lang, 'Success Story:', 'کامیابی کی کہانی:')}</strong> {t(lang, 'Thanks to SpareShare Donors, we distributed 500 verified safe meals!', 'SpareShare عطیہ دہندگان کی بدولت ہم نے 500 تصدیق شدہ محفوظ کھانے تقسیم کیے!')}
                    <span className="update-time">{t(lang, 'Last week', 'گزشتہ ہفتہ')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Donation Sidebar */}
        <div className="profile-sidebar">
          <div className="donate-widget glass-panel">
            <h3>{t(lang, `Donate Items to ${org.name}`, `${org.name} کو اشیاء عطیہ کریں`)}</h3>
            <p>{t(lang, 'Select what you want to donate. Items will be verified by AI before delivery.', 'منتخب کریں کہ آپ کیا عطیہ کرنا چاہتے ہیں۔ ڈیلیوری سے پہلے اے آئی سے تصدیق ہوگی۔')}</p>

            <div className="impact-options">
              {[t(lang,'Food & Rations','خوراک اور راشن'), t(lang,'Clothing','کپڑے'), t(lang,'Medical Supplies','طبی سامان')].map(cat => (
                <div
                  key={cat}
                  className={`impact-btn ${selectedCategories.includes(cat) ? 'selected' : ''}`}
                  onClick={() => toggleCategory(cat)}
                >
                  <div className={`checkbox-circle ${selectedCategories.includes(cat) ? 'active' : ''}`}>
                    {selectedCategories.includes(cat) && <Check size={12} color="white" />}
                  </div>
                  {cat}
                </div>
              ))}
            </div>

            <button
              className="donate-submit"
              style={{ opacity: selectedCategories.length > 0 ? 1 : 0.6 }}
              onClick={handleDonateClick}
            >
              {t(lang, 'Start AI Scan & Donate', 'اے آئی اسکین شروع کریں اور عطیہ کریں')} <Heart size={18} />
            </button>

            <p className="tax-notice">
              <Globe size={14} /> {t(lang, '100% of your verified items go directly to the organization.', 'آپ کی تصدیق شدہ 100% اشیاء براہ راست تنظیم کو جاتی ہیں۔')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationProfile;
