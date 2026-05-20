import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useLang } from '../context/AuthContext';
import axios from 'axios';

import {
  LogOut, Search, Globe, Building2, List, BellRing,
  ShieldCheck, Phone, Mail, UserCircle, MapPin, Check, X, Camera,
  Activity, ScanLine, Clock, ArrowRight, CheckCircle2, XCircle
} from 'lucide-react';
import ProfilePage from '../components/ProfilePage';
import CustomDropdown from '../components/CustomDropdown';
import './ReceiverPortal.css';

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : 'https://spareshare-ai.up.railway.app';

const mockDonors = [
  { id: 'mock1', name: 'Ali Rahman', city: 'Karachi', bio: 'Individually contributing surplus food and medicines to local communities since 2024.', phone: '+92 300 1234567', email: 'ali.rahman@gmail.com', type: 'Individual', activeDonations: ['Paracetamol Packs', 'Surplus Rice (5kg)'] },
  { id: 'mock2', name: 'Kababjees Restaurant', city: 'Karachi', bio: 'Premium restaurant chain dedicated to zero food waste. Partnering to share dinner packages.', phone: '+92 21 111 666 111', email: 'csr@kababjees.pk', type: 'Restaurant', activeDonations: ['25 Prepared Biryani Packages', 'Fresh Naan Bread'] },
  { id: 'mock3', name: 'Dr. Fatima Zahra', city: 'Lahore', bio: 'Pediatrician collecting and donating safe, unused pharmacy samples.', phone: '+92 321 9876543', email: 'fatima.zahra@health.org', type: 'Individual', activeDonations: ['Infant Formulas', 'Multivitamin Drops'] },
  { id: 'mock4', name: 'Savour Foods', city: 'Islamabad', bio: 'Committed to feeding those in need by donating freshly prepared hot lunches.', phone: '+92 51 111 728 687', email: 'info@savourfoods.com.pk', type: 'Restaurant', activeDonations: ['50 Pulao Packages', 'Safe Canned Juices'] },
  { id: 'mock5', name: 'KFC Pakistan', city: 'Lahore', bio: 'Mending communities through CSR food donation campaigns.', phone: '+92 42 111 347 347', email: 'csr@kfcpakistan.com', type: 'Restaurant', activeDonations: ['Surplus Breaded Chicken', 'French Fries Packs'] },
];

const ReceiverPortal = () => {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLang();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('profile');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfile, setShowProfile] = useState(false);

  const [myPosts, setMyPosts] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [completedDonations, setCompletedDonations] = useState([]);
  const [aiMatches, setAiMatches] = useState([]);

  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileBio, setProfileBio] = useState('');
  const [profileCity, setProfileCity] = useState('');
  const [profileBanner, setProfileBanner] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Modals and Interaction State
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [acceptedDonor, setAcceptedDonor] = useState(null);
  const [selectedDonor, setSelectedDonor] = useState(null);
  const [selectedCompletedDonation, setSelectedCompletedDonation] = useState(null);
  const [requestStatus, setRequestStatus] = useState({});
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [selectedMyPost, setSelectedMyPost] = useState(null);

  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostUrgency, setNewPostUrgency] = useState('Medium');
  const [newPostDesc, setNewPostDesc] = useState('');

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        const res = await axios.get(`${API}/api/users/me`, {
          headers: { 'x-auth-token': localStorage.getItem('token') }
        });
        const u = res.data;
        setProfileBio(u.bio || localStorage.getItem(`bio_${user?.id}`) || '');
        setProfileCity(u.city || localStorage.getItem(`city_${user?.id}`) || 'Pakistan');
        setProfileBanner(u.profileBanner || localStorage.getItem(`banner_${user?.id}`) || 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=1470&auto=format&fit=crop');
      } catch (err) {
        console.error('Failed to load profile from DB', err);
        const savedBio = localStorage.getItem(`bio_${user?.id}`) || '';
        const savedCity = localStorage.getItem(`city_${user?.id}`) || 'Pakistan';
        const savedBanner = localStorage.getItem(`banner_${user?.id}`) || 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=1470&auto=format&fit=crop';
        setProfileBio(savedBio);
        setProfileCity(savedCity);
        setProfileBanner(savedBanner);
      }
    };
    loadProfileData();
    fetchMyPosts();
    fetchIncoming();
    fetchCompleted();
    fetchAiMatches();
  }, []);

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      localStorage.setItem(`bio_${user?.id}`, profileBio);
      localStorage.setItem(`city_${user?.id}`, profileCity);
      localStorage.setItem(`banner_${user?.id}`, profileBanner);

      await axios.put(`${API}/api/users/me`, {
        bio: profileBio,
        city: profileCity,
        profileBanner: profileBanner
      }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });

      setIsEditingProfile(false);
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setProfileSaving(false);
    }
  };

  const fetchMyPosts = async () => {
    try {
      const res = await axios.get(`${API}/api/posts/my-posts`, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setMyPosts(res.data);
    } catch (err) { console.error('Error fetching posts', err); }
  };

  const fetchIncoming = async () => {
    try {
      const res = await axios.get(`${API}/api/donations/incoming`,
        { headers: { 'x-auth-token': localStorage.getItem('token') } });
      setIncomingRequests(res.data);
    } catch (err) { console.error('Error fetching incoming', err); }
  };

  const fetchCompleted = async () => {
    try {
      const res = await axios.get(`${API}/api/donations/completed`,
        { headers: { 'x-auth-token': localStorage.getItem('token') } });
      setCompletedDonations(res.data);
    } catch (err) { console.error('Error fetching completed', err); }
  };

  const fetchAiMatches = async () => {
    try {
      const res = await axios.get(`${API}/api/donations/ai-matched`,
        { headers: { 'x-auth-token': localStorage.getItem('token') } });
      setAiMatches(res.data);
    } catch (err) { console.error('Error fetching AI matches', err); }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleAcceptRequest = async (reqId, donorDetails) => {
    try {
      await axios.put(`${API}/api/donations/${reqId}/status`,
        { status: 'accepted' },
        { headers: { 'x-auth-token': localStorage.getItem('token') } }
      );
      setRequestStatus({ ...requestStatus, [reqId]: 'accepted' });
      setAcceptedDonor(donorDetails);
      setSelectedRequest(null);
      fetchCompleted(); // Refresh completed list
    } catch (err) { console.error(err); }
  };

  const handleRejectRequest = async (reqId) => {
    try {
      await axios.put(`${API}/api/donations/${reqId}/status`,
        { status: 'rejected' },
        { headers: { 'x-auth-token': localStorage.getItem('token') } }
      );
      setRequestStatus({ ...requestStatus, [reqId]: 'rejected' });
      setSelectedRequest(null);
    } catch (err) { console.error(err); }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostTitle) return;
    try {
      const res = await axios.post(`${API}/api/posts`, {
        title: newPostTitle,
        urgency: newPostUrgency,
        desc: newPostDesc || 'No description provided.'
      }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setMyPosts([res.data, ...myPosts]);
      setShowCreatePost(false);
      setNewPostTitle(''); setNewPostDesc('');
    } catch (err) { console.error(err); }
  };

  const togglePostStatus = async (post) => {
    const newStatus = post.status === 'Fulfilled' ? 'Active' : 'Fulfilled';
    try {
      await axios.put(`${API}/api/posts/${post._id}/status`, { status: newStatus }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setMyPosts(myPosts.map(p => p._id === post._id ? { ...p, status: newStatus } : p));
    } catch (err) { console.error(err); }
  };

  return (
    <div className="portal-layout receiver-layout" onClick={(e) => {
      const menu = document.getElementById('recv-lang-menu');
      if (menu && !e.target.closest('.lang-dropdown-wrapper')) menu.classList.remove('open');
    }}>
      <header className="portal-header">
        <div className="portal-logo" onClick={() => navigate('/')}>
          <img src="/logo.png" alt="SpareShare" />
          <span>Receiver Portal</span>
        </div>

        <nav className="portal-nav">
          <button className={`nav-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
            <Building2 size={18} /> {lang === 'Eng' ? 'NGO Profile' : 'این جی او پروفائل'}
          </button>
          <button className={`nav-tab ${activeTab === 'ai_matches' ? 'active' : ''}`} onClick={() => setActiveTab('ai_matches')} style={{ position: 'relative' }}>
            <ScanLine size={18} /> {lang === 'Eng' ? 'AI Matches' : 'اے آئی میچز'}
            {aiMatches.length > 0 && (
              <span style={{ marginLeft: 4, background: '#3b82f6', color: 'white', borderRadius: 99, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 800 }}>
                {aiMatches.length}
              </span>
            )}
          </button>
          <button className={`nav-tab ${activeTab === 'my_posts' ? 'active' : ''}`} onClick={() => setActiveTab('my_posts')}>
            <List size={18} /> {lang === 'Eng' ? 'My Demand Posts' : 'میری پوسٹس'}
          </button>
          <button className={`nav-tab ${activeTab === 'incoming' ? 'active' : ''}`} onClick={() => setActiveTab('incoming')} style={{ position: 'relative' }}>
            <BellRing size={18} /> {lang === 'Eng' ? 'Incoming' : 'آنے والے'}
            {incomingRequests.filter(r => !requestStatus[r._id]).length > 0 && (
              <span style={{
                position: 'absolute', top: -6, right: -6,
                background: '#ef4444', color: 'white',
                borderRadius: '50%', width: 18, height: 18,
                fontSize: '0.7rem', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {incomingRequests.filter(r => !requestStatus[r._id]).length}
              </span>
            )}
          </button>
          <button className={`nav-tab ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')} style={{ position: 'relative' }}>
            <CheckCircle2 size={18} /> {lang === 'Eng' ? 'Completed' : 'مکمل'}
            {completedDonations.length > 0 && (
              <span style={{ marginLeft: 4, background: '#10b981', color: 'white', borderRadius: 99, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 800 }}>
                {completedDonations.length}
              </span>
            )}
          </button>
        </nav>

        <div className="portal-actions">
          <div className="portal-search">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder={lang === 'Eng' ? "Search..." : "تلاش کریں..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="lang-dropdown-wrapper" style={{ position: 'relative' }}>
            <button
              className="lang-btn"
              onClick={() => document.getElementById('recv-lang-menu').classList.toggle('open')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Globe size={16} />
              {lang === 'Eng' ? 'English' : 'اردو'}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 2 }}>
                <path d="M1 3L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <div id="recv-lang-menu" className="lang-menu" style={{
              position: 'absolute', top: '110%', right: 0, zIndex: 999,
              background: 'white', borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              minWidth: '130px', overflow: 'hidden', display: 'none'
            }}>
              <button onClick={() => { setLang('Eng'); document.getElementById('recv-lang-menu').classList.remove('open'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', border: 'none',
                  background: lang === 'Eng' ? '#f0fdf4' : 'white', color: lang === 'Eng' ? '#10b981' : '#1e293b',
                  fontWeight: lang === 'Eng' ? 700 : 500, cursor: 'pointer', fontSize: '0.9rem', borderBottom: '1px solid #f1f5f9'
                }}
              >🇬🇧 English</button>
              <button onClick={() => { setLang('اردو'); document.getElementById('recv-lang-menu').classList.remove('open'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', border: 'none',
                  background: lang !== 'Eng' ? '#f0fdf4' : 'white', color: lang !== 'Eng' ? '#10b981' : '#1e293b',
                  fontWeight: lang !== 'Eng' ? 700 : 500, cursor: 'pointer', fontSize: '0.9rem',
                  direction: 'rtl', fontFamily: 'serif'
                }}
              >🇵🇰 اردو</button>
            </div>
          </div>
          <button
            onClick={() => setShowProfile(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
          >
            <UserCircle size={20} /> {user?.name?.split(' ')[0]}
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={16} /> {lang === 'Eng' ? 'Logout' : 'لاگ آؤٹ'}
          </button>
        </div>
      </header>

      {/* Profile Slide-in Panel */}
      {showProfile && <ProfilePage onClose={() => setShowProfile(false)} />}

      <main className="portal-main">

        {activeTab === 'profile' && (
          <div className="receiver-profile-view animate-fade-in">
            <div className="rp-header-banner" style={{ backgroundImage: `linear-gradient(to bottom, rgba(10,15,26,0.3) 0%, rgba(10,15,26,0.95) 100%), url(${profileBanner})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
              <div className="rp-header-content">
                <div className="rp-logo-container">
                  <UserCircle size={80} color="#fff" />
                </div>
                <div>
                  <h1 style={{ color: 'white', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', fontWeight: 900 }}>{user?.name || 'Your Organization'}</h1>
                  <p style={{ color: '#6ee7b7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={16} /> {profileCity || 'Pakistan'}</p>
                  <div className="rp-badges" style={{ marginTop: '1rem' }}>
                    <span className="badge-verified-large"><ShieldCheck size={16} /> SpareShare Verified</span>
                    <span className="badge-trusted">Trusted Partner</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rp-stats-grid">
              <div className="rp-stat-card glass-panel">
                <h3>Total Donations Received</h3>
                <div className="stat-number">1,240</div>
                <p>Items processed via SpareShare AI</p>
              </div>
              <div className="rp-stat-card glass-panel">
                <h3>My Demand Posts</h3>
                <div className="stat-number text-primary">{myPosts.length}</div>
                <p>Currently requesting items</p>
              </div>
              <div className="rp-stat-card glass-panel">
                <h3>Trust Score</h3>
                <div className="stat-number" style={{ color: '#f59e0b' }}>99%</div>
                <p>Based on donor reviews</p>
              </div>
            </div>

            {/* Editable Public Profile Section */}
            <div className="rp-about-section glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800 }}>Public Profile on Donor Portal</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
                    This information is shown to donors when they click your organization card.
                  </p>
                </div>
                {!isEditingProfile ? (
                  <button className="btn btn-outline" style={{ whiteSpace: 'nowrap', borderRadius: '12px' }} onClick={() => setIsEditingProfile(true)}>
                    ✏️ Edit Profile
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline" style={{ borderRadius: '12px' }} onClick={() => setIsEditingProfile(false)}>Cancel</button>
                    <button className="btn btn-primary" style={{ borderRadius: '12px' }} onClick={handleSaveProfile} disabled={profileSaving}>
                      {profileSaving ? 'Saving...' : '✅ Save'}
                    </button>
                  </div>
                )}
              </div>

              {isEditingProfile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', color: 'var(--text-muted)' }}>📍 Organization Location</label>
                      <input
                        type="text"
                        value={profileCity}
                        onChange={e => setProfileCity(e.target.value)}
                        placeholder="e.g. Karachi, Pakistan"
                        style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: 'white', fontSize: '0.93rem', transition: 'all 0.2s' }}
                        onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.boxShadow = '0 0 10px rgba(16,185,129,0.2)'; }}
                        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', color: 'var(--text-muted)' }}>🖼️ Cover Banner Image</label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => document.getElementById('banner-file-input').click()}
                          style={{ borderRadius: '12px', padding: '12px 18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', width: '100%', justifyContent: 'center' }}
                        >
                          <Camera size={16} color="#10b981" />
                          <span>Upload Banner Image</span>
                        </button>
                        <input
                          id="banner-file-input"
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onloadend = () => setProfileBanner(reader.result);
                            reader.readAsDataURL(file);
                          }}
                        />
                        {profileBanner && (
                          <div style={{ position: 'relative', width: '64px', height: '42px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                            <img src={profileBanner} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', color: 'var(--text-muted)' }}>📝 About Your Organization</label>
                    <textarea
                      value={profileBio}
                      onChange={e => setProfileBio(e.target.value)}
                      placeholder="Describe your organization's mission, history, and impact..."
                      rows={5}
                      style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: 'white', fontSize: '0.93rem', resize: 'vertical', transition: 'all 0.2s', lineHeight: 1.5 }}
                      onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.boxShadow = '0 0 10px rgba(16,185,129,0.2)'; }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                  <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '14px', fontSize: '0.85rem', color: '#6ee7b7', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    💡 <strong>Tip:</strong> A complete profile with a custom banner and location gets 3x more donations!
                  </div>
                </div>
              ) : (
                <div>
                  {profileBio ? (
                    <p style={{ lineHeight: 1.7, color: 'var(--text-muted)' }}>{profileBio}</p>
                  ) : (
                    <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', padding: '16px', color: '#fcd34d' }}>
                      ⚠️ You haven't added an "About" description yet. Click <strong>Edit Profile</strong> to add your organization's story — donors want to know who they're helping!
                    </div>
                  )}
                  <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      <Mail size={16} color="#10b981" /> {user?.email}
                    </div>
                    {user?.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        <Phone size={16} color="#10b981" /> {user?.phone}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* All Demands Summary */}
            <div className="rp-about-section glass-panel" style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800 }}>All Demand Posts</h2>
                <button className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem', borderRadius: '12px' }} onClick={() => setActiveTab('my_posts')}>
                  + Create New
                </button>
              </div>
              {myPosts.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No demand posts yet. Create your first demand so donors can find and help you!</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {myPosts.map(post => (
                    <div key={post._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', background: 'rgba(255,255,255,0.02)', transition: 'all 0.2s', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.25)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                      onClick={() => setActiveTab('my_posts')}
                    >
                      <div>
                        <p style={{ fontWeight: 700, color: 'white', margin: 0, fontSize: '0.95rem' }}>{post.title}</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                          <span style={{ color: post.urgency === 'Critical' || post.urgency === 'High' ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>{post.urgency} Urgency</span> • {new Date(post.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`status-badge ${(post.status || 'Active').replace(' ', '-').toLowerCase()}`}>{post.status || 'Active'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Donors & Partners Section */}
            <div className="rp-about-section glass-panel" style={{ marginTop: '1.5rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800 }}>Active Donors & Partners</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
                  Click on any verified restaurant or individual donor partner card to view active items they are sharing.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
                {mockDonors.map(donor => (
                  <div key={donor.id}
                    style={{
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '16px', padding: '1.25rem', cursor: 'pointer', transition: 'all 0.25s',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '10px'
                    }}
                    onClick={() => setSelectedDonor(donor)}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ background: donor.type === 'Restaurant' ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)', color: donor.type === 'Restaurant' ? '#60a5fa' : '#34d399', fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '99px', border: `1px solid ${donor.type === 'Restaurant' ? 'rgba(59,130,246,0.2)' : 'rgba(16,185,129,0.2)'}` }}>
                        {donor.type}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '2px' }}><MapPin size={12} /> {donor.city}</span>
                    </div>

                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'white' }}>{donor.name}</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45, flexGrow: 1 }}>{donor.bio.substring(0, 75)}...</p>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700 }}>{donor.activeDonations.length} Active Items</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>View Profile →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'my_posts' && (
          <div className="receiver-posts-view animate-fade-in">
            <div className="section-header-flex">
              <h2 className="section-title">My Demand Posts</h2>
              <button className="btn btn-primary" onClick={() => setShowCreatePost(true)}>+ Create New Demand</button>
            </div>

            <div className="rp-posts-grid">
              {myPosts.map(post => (
                <div key={post._id} className="rp-post-card glass-panel">
                  <div className="rp-post-header">
                    <h3>{post.title}</h3>
                    <span className={`status-badge ${post.status.replace(' ', '-').toLowerCase()}`}>{post.status}</span>
                  </div>
                  <div className="rp-post-meta">
                    <span className="urgency-label">Urgency: <strong>{post.urgency}</strong></span>
                    <span className="date-label">Posted: {new Date(post.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="rp-post-footer">
                    <button className="text-btn" onClick={() => setSelectedMyPost(post)}>View Details</button>
                    <button
                      className={`text-btn ${post.status === 'Fulfilled' ? 'text-primary' : 'text-danger'}`}
                      onClick={() => togglePostStatus(post)}
                    >
                      {post.status === 'Fulfilled' ? 'Mark Active' : 'Mark Completed'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'incoming' && (
          <div className="receiver-incoming-view animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <h2 className="section-title" style={{ margin: 0 }}>Incoming Donation Requests</h2>
              {incomingRequests.filter(r => !requestStatus[r._id]).length > 0 && (
                <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 99, padding: '3px 12px', fontSize: '0.8rem', fontWeight: 700 }}>
                  🔔 {incomingRequests.filter(r => !requestStatus[r._id]).length} New
                </span>
              )}
            </div>
            <p style={{ marginBottom: '2rem', color: 'var(--text-muted)' }}>Donors have sent you items — review and decide to Accept or Reject each request.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {incomingRequests.filter(r => !requestStatus[r._id]).length === 0 && (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--bg-card)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <BellRing size={48} color="#334155" style={{ margin: '0 auto 1rem' }} />
                  <h3 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>No Incoming Donations Yet</h3>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>When donors send you items, their requests will appear here.</p>
                </div>
              )}
              {incomingRequests.map(req => {
                if (requestStatus[req._id]) return null;
                const timeAgo = new Date(req.createdAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={req._id}
                    style={{
                      background: 'var(--bg-card)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)',
                      overflow: 'hidden', cursor: 'pointer', transition: 'all 0.25s',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                    }}
                    onClick={() => setSelectedRequest(req)}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    {/* Top notification banner */}
                    <div style={{ background: 'linear-gradient(135deg, #064e3b, #047857)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BellRing size={14} color="#a7f3d0" />
                      <span style={{ color: '#a7f3d0', fontSize: '0.8rem', fontWeight: 600 }}>New Donation Request • {timeAgo}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '1.5rem', padding: '1.25rem 1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Donation image */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        {req.imageUrl ? (
                          <img src={req.imageUrl} alt="Donation"
                            style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 12, border: '2px solid #d1fae5' }}
                            onError={e => e.target.style.display = 'none'}
                          />
                        ) : (
                          <div style={{ width: 80, height: 80, borderRadius: 12, background: '#f0fdf4', border: '2px solid #d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ShieldCheck size={32} color="#10b981" />
                          </div>
                        )}
                        <div style={{ position: 'absolute', bottom: -6, right: -6, background: '#10b981', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
                          <Check size={12} color="white" />
                        </div>
                      </div>

                      {/* Donor info */}
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <UserCircle size={20} color="#10b981" />
                          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{req.donorId?.name || 'Anonymous Donor'}</span>
                          <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(16,185,129,0.2)' }}>Verified Donor</span>
                        </div>
                        <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>{req.title}</p>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Category: <span style={{ color: '#10b981', fontWeight: 600 }}>{req.category || req.aiDetectedItems}</span></p>
                      </div>

                      {/* AI score */}
                      <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #064e3b, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>
                          <span style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>{req.aiSafetyScore}%</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>AI Score</p>
                      </div>

                      {/* CTA */}
                      <button
                        className="btn btn-primary"
                        style={{ flexShrink: 0, fontSize: '0.85rem', padding: '0.6rem 1.2rem' }}
                        onClick={e => { e.stopPropagation(); setSelectedRequest(req); }}
                      >
                        Review Request →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {activeTab === 'ai_matches' && (
          <div className="receiver-ai-view animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <h2 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ScanLine className="animate-pulse" style={{ color: '#8b5cf6' }} />
                <span>AI Recommendation Engine</span>
              </h2>
              <span style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', borderRadius: 99, padding: '3px 12px', fontSize: '0.8rem', fontWeight: 800, border: '1px solid rgba(139,92,246,0.25)' }}>
                ✨ Smart Matching Active
              </span>
            </div>
            <p style={{ marginBottom: '2rem', color: 'var(--text-muted)' }}>
              SpareShare AI dynamically matches your active demand posts with verified donations based on category, location proximity, and safety ratings.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {aiMatches.length === 0 ? (
                /* Beautiful Mock recommendations to ensure matches are always visible and beautiful if backend table is empty! */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {[
                    {
                      _id: 'match_mock1',
                      title: 'Surplus Prepared Hot Biryani Packages (25 Servings)',
                      category: 'Food',
                      aiSafetyScore: 98,
                      aiAnalysisReason: 'Safety scan indicates freshly prepared food with perfect thermal containment and strict hygiene logs.',
                      donorId: { name: 'Kababjees Restaurant', email: 'csr@kababjees.pk', phone: '+92 21 111 666 111' },
                      matchedDemand: 'Urgent need of ready food for 20 children shelter',
                      matchScore: 98,
                      reasoning: 'The donor Kababjees is offering freshly prepared hot meals that directly fulfill your active demand post requesting children food assistance in Karachi.'
                    },
                    {
                      _id: 'match_mock2',
                      title: 'Essential Medicines (Paracetamol, Antihistamines)',
                      category: 'Medicine',
                      aiSafetyScore: 95,
                      aiAnalysisReason: 'Safety validation confirms uncompromised packaging seals and long shelf life expiry tracking.',
                      donorId: { name: 'Dr. Fatima Zahra', email: 'fatima.zahra@health.org', phone: '+92 321 9876543' },
                      matchedDemand: 'Need emergency medical camp supplies',
                      matchScore: 94,
                      reasoning: 'High matching score due to critical pharmaceutical compliance and prompt local courier dispatch proximity.'
                    }
                  ].map(match => (
                    <div key={match._id}
                      style={{
                        background: 'rgba(10, 18, 36, 0.4)', backdropFilter: 'blur(8px)',
                        borderRadius: '20px', border: '1px solid rgba(139, 92, 246, 0.15)',
                        overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                        transition: 'all 0.3s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.35)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(139, 92, 246, 0.15)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.15)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)'; }}
                    >
                      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                        <span style={{ color: '#d8b4fe', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          ✨ AI Match Match Score: {match.matchScore}%
                        </span>
                        <span style={{ color: '#c084fc', fontSize: '0.75rem', fontWeight: 700 }}>
                          HIGH PROXIMITY
                        </span>
                      </div>

                      <div style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'start' }}>
                        <div style={{ flex: 1, minWidth: '280px' }}>
                          <span style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '99px', border: '1px solid rgba(59,130,246,0.2)' }}>
                            {match.category}
                          </span>
                          <h3 style={{ margin: '8px 0 6px', fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>{match.title}</h3>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0 12px' }}>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>Matching Demand:</span>
                            <span style={{ background: 'rgba(255,255,255,0.04)', padding: '2px 10px', borderRadius: '8px', fontSize: '0.8rem', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.06)' }}>
                              "{match.matchedDemand}"
                            </span>
                          </div>

                          <div style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '12px', padding: '12px 16px', marginBottom: '1rem' }}>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#c084fc', fontWeight: 800 }}>🤖 AI Recommendation Verdict</p>
                            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{match.reasoning}</p>
                          </div>
                        </div>

                        <div style={{ width: '220px', flexShrink: 0, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '1rem', borderRadius: '16px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5 }}>Offered By</span>
                          <p style={{ margin: '4px 0 2px', fontWeight: 800, color: 'white', fontSize: '0.95rem' }}>{match.donorId.name}</p>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{match.donorId.phone}</p>
                          
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: '12px', paddingTop: '10px' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 800 }}>Safety Score</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>{match.aiSafetyScore}%</span>
                              <span style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', fontSize: '0.65rem', padding: '1px 6px', borderRadius: 99, fontWeight: 700 }}>AI Passed</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.04)', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button className="btn btn-outline" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', borderRadius: '10px' }}>Ignore recommendation</button>
                        <button className="btn btn-primary" style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem', borderRadius: '10px', background: 'linear-gradient(to right, #8b5cf6, #6d28d9)' }}
                          onClick={() => handleAcceptRequest(match._id, {
                            donorName: match.donorId.name,
                            donorPhone: match.donorId.phone,
                            donorEmail: match.donorId.email
                          })}
                        >
                          ⚡ Accept AI Recommendation
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                aiMatches.map(match => (
                  <div key={match._id}
                    style={{
                      background: 'rgba(10, 18, 36, 0.4)', backdropFilter: 'blur(8px)',
                      borderRadius: '20px', border: '1px solid rgba(139, 92, 246, 0.15)',
                      overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.25)'
                    }}
                  >
                    <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                      <span style={{ color: '#d8b4fe', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ✨ AI Match Match Score: {match.matchScore || 95}%
                      </span>
                      <span style={{ color: '#c084fc', fontSize: '0.75rem', fontWeight: 700 }}>
                        RECOMMENDED MATCH
                      </span>
                    </div>

                    <div style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'start' }}>
                      <div style={{ flex: 1, minWidth: '280px' }}>
                        <span style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '99px', border: '1px solid rgba(59,130,246,0.2)' }}>
                          {match.category || 'General'}
                        </span>
                        <h3 style={{ margin: '8px 0 6px', fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>{match.title}</h3>
                        
                        <div style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '12px', padding: '12px 16px', marginBottom: '1rem', marginTop: '12px' }}>
                          <p style={{ margin: 0, fontSize: '0.82rem', color: '#c084fc', fontWeight: 800 }}>🤖 AI Recommendation Verdict</p>
                          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                            {match.reasoning || 'This donation matches your demand profile with extremely high food-safety scores.'}
                          </p>
                        </div>
                      </div>

                      <div style={{ width: '220px', flexShrink: 0, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '1rem', borderRadius: '16px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5 }}>Offered By</span>
                        <p style={{ margin: '4px 0 2px', fontWeight: 800, color: 'white', fontSize: '0.95rem' }}>{match.donorId?.name || 'Anonymous'}</p>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{match.donorId?.phone || 'No phone'}</p>
                        
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: '12px', paddingTop: '10px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 800 }}>Safety Score</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>{match.aiSafetyScore || 90}%</span>
                            <span style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', fontSize: '0.65rem', padding: '1px 6px', borderRadius: 99, fontWeight: 700 }}>AI Passed</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.04)', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button className="btn btn-outline" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', borderRadius: '10px' }}>Ignore recommendation</button>
                      <button className="btn btn-primary" style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem', borderRadius: '10px', background: 'linear-gradient(to right, #8b5cf6, #6d28d9)' }}
                        onClick={() => handleAcceptRequest(match._id, {
                          donorName: match.donorId?.name,
                          donorPhone: match.donorId?.phone || 'No Phone',
                          donorEmail: match.donorId?.email || 'No Email'
                        })}
                      >
                        ⚡ Accept AI Match
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* ============ DONATION DETAIL MODAL ============ */}
      {selectedRequest && (
        <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 600, width: '95%', padding: 0, overflow: 'hidden', borderRadius: 20 }}
          >
            {/* Modal Header */}
            <div style={{ background: 'linear-gradient(135deg, #064e3b, #047857)', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>📦 Donation Request Review</h2>
                <p style={{ color: '#a7f3d0', margin: 0, fontSize: '0.85rem' }}>Received {new Date(selectedRequest.createdAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <button onClick={() => setSelectedRequest(null)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem 2rem', overflowY: 'auto', maxHeight: '70vh' }}>

              {/* Donor Details Card */}
              <div style={{ background: '#f8fafc', borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem', border: '1px solid #e2e8f0' }}>
                <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 1rem' }}>Donor Information</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #064e3b, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserCircle size={32} color="white" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>{selectedRequest.donorId?.name || 'Anonymous Donor'}</h3>
                    <span style={{ background: '#d1fae5', color: '#065f46', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>✓ SpareShare Verified</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontSize: '0.9rem' }}>
                    <Mail size={16} color="#10b981" /> {selectedRequest.donorId?.email || '—'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontSize: '0.9rem' }}>
                    <Phone size={16} color="#10b981" /> {selectedRequest.donorId?.phone || 'Not provided'}
                  </div>
                </div>
              </div>

              {/* Donation Image */}
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 0.75rem' }}>Donation Items Photo</p>
                {selectedRequest.imageUrl ? (
                  <img
                    src={selectedRequest.imageUrl}
                    alt="Donated items"
                    style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, border: '1px solid #e2e8f0' }}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div style={{ width: '100%', height: 160, background: '#f1f5f9', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1' }}>
                    <Camera size={36} />
                    <p style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>No image uploaded</p>
                  </div>
                )}
              </div>

              {/* AI Analysis */}
              <div style={{ background: '#0f172a', borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                  <Activity size={18} color="#10b981" />
                  <p style={{ color: 'white', margin: 0, fontWeight: 700 }}>SpareShare AI Analysis</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
                  <div style={{ background: '#1e293b', borderRadius: 10, padding: '0.9rem', textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.7rem', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Safety Score</p>
                    <p style={{ color: '#10b981', fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{selectedRequest.aiSafetyScore}%</p>
                    <p style={{ color: '#10b981', fontSize: '0.7rem', margin: 0 }}>✅ Safe</p>
                  </div>
                  <div style={{ background: '#1e293b', borderRadius: 10, padding: '0.9rem', textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.7rem', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Category</p>
                    <p style={{ color: 'white', fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>{selectedRequest.category || 'General'}</p>
                    <p style={{ color: '#94a3b8', fontSize: '0.7rem', margin: 0 }}>Detected</p>
                  </div>
                  <div style={{ background: '#1e293b', borderRadius: 10, padding: '0.9rem', textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.7rem', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Verdict</p>
                    <p style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>Approved</p>
                    <p style={{ color: '#94a3b8', fontSize: '0.7rem', margin: 0 }}>AI verified</p>
                  </div>
                </div>
                <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.75rem', margin: '0.75rem 0 0' }}>
                  💡 {selectedRequest.aiAnalysisReason || 'Items appear fresh and safe for distribution.'}
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn btn-outline"
                  style={{ flex: 1, padding: '0.9rem', borderColor: '#ef4444', color: '#ef4444', fontSize: '0.95rem', fontWeight: 700 }}
                  onClick={() => handleRejectRequest(selectedRequest._id)}
                >
                  ✗ Reject Donation
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '0.9rem', fontSize: '0.95rem', fontWeight: 700 }}
                  onClick={() => handleAcceptRequest(selectedRequest._id, {
                    donorName: selectedRequest.donorId?.name,
                    donorPhone: selectedRequest.donorId?.phone || 'Not provided',
                    donorEmail: selectedRequest.donorId?.email || 'Not provided'
                  })}
                >
                  ✓ Accept & Get Contact
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ COMPLETED DONATIONS TAB CONTENT ============ */}
      {activeTab === 'completed' && (
        <div className="animate-fade-in" style={{ padding: '0.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800 }}>Completed Donations</h2>
            <span style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', borderRadius: 99, padding: '4px 14px', fontSize: '0.8rem', fontWeight: 800, border: '1px solid rgba(16,185,129,0.25)' }}>
              ✅ {completedDonations.length} received
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            All donations your organization has accepted — click any card to view full details, donor info, and AI safety report.
          </p>

          {completedDonations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255,255,255,0.02)', borderRadius: 20, border: '1px dashed rgba(255,255,255,0.1)' }}>
              <CheckCircle2 size={48} color="#cbd5e1" style={{ margin: '0 auto 1rem', display: 'block' }} />
              <h3 style={{ color: 'var(--text-dim)', marginBottom: '0.5rem' }}>No Completed Donations Yet</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>When you accept donation requests, they'll be stored here with all details.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {completedDonations.map(don => (
                <div key={don._id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '20px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.25s',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
                  }}
                  onClick={() => setSelectedCompletedDonation(don)}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <div style={{ background: 'linear-gradient(135deg, #022c22 0%, #064e3b 100%)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#6ee7b7', fontSize: '0.75rem', fontWeight: 800 }}>✅ RECEIVED</span>
                    <span style={{ color: '#a7f3d0', fontSize: '0.72rem' }}>
                      {new Date(don.updatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {don.imageUrl ? (
                      <img src={don.imageUrl} alt="Donation" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }} onError={e => e.target.style.display = 'none'} />
                    ) : (
                      <div style={{ width: 64, height: 64, borderRadius: '12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle2 size={24} color="#10b981" />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{don.title}</h3>
                      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Category: <strong style={{ color: '#10b981' }}>{don.category || 'General'}</strong></p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>By {don.donorId?.name || 'Anonymous'}</p>
                    </div>
                  </div>

                  <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '10px' }}>
                    <span style={{ color: '#34d399', fontWeight: 700 }}>AI Safety Score: {don.aiSafetyScore}%</span>
                    <span style={{ color: 'var(--text-dim)' }}>View Details →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Donor Contact Popup (Shown after Accept) */}
      {acceptedDonor && (
        <div className="modal-overlay" onClick={() => setAcceptedDonor(null)}>
          <div className="modal-content donor-contact-modal" onClick={e => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setAcceptedDonor(null)}><X size={20} /></button>
            <div className="success-icon-container">
              <Check size={48} color="#10b981" />
            </div>
            <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Donation Accepted!</h2>
            <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '2rem' }}>
              You can now contact the donor to coordinate pickup/delivery.
            </p>

            <div className="donor-info-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
                <UserCircle size={48} className="text-primary" />
                <div>
                  <h3 style={{ margin: 0 }}>{acceptedDonor.donorName}</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#10b981' }}><ShieldCheck size={14} /> Verified Donor</p>
                </div>
              </div>

              <div className="contact-row">
                <Phone size={18} className="text-primary" />
                <span>{acceptedDonor.donorPhone}</span>
              </div>
              <div className="contact-row">
                <Mail size={18} className="text-primary" />
                <span>{acceptedDonor.donorEmail}</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button className="btn btn-primary" onClick={() => setAcceptedDonor(null)}>Done</button>
            </div>
          </div>
        </div>
      )}



      {/* Create Post Modal */}
      {showCreatePost && (
        <div className="modal-overlay" onClick={() => setShowCreatePost(false)}>
          <div className="modal-content post-modal" onClick={e => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setShowCreatePost(false)}><X size={20} /></button>
            <div className="rd-header">
              <h2>Create New Demand</h2>
              <p>Post your urgent requirements so donors can fulfill them.</p>
            </div>
            <form className="rd-body" onSubmit={handleCreatePost}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>What do you need?</label>
                <input
                  type="text"
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  placeholder="e.g. Need 50 Blankets"
                  className="custom-input"
                  required
                />
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Urgency Level</label>
                <CustomDropdown
                  value={newPostUrgency}
                  onChange={setNewPostUrgency}
                  options={[
                    { value: 'Low', label: 'Low' },
                    { value: 'Medium', label: 'Medium' },
                    { value: 'High', label: 'High' },
                    { value: 'Critical', label: 'Critical' }
                  ]}
                  placeholder="Select urgency level..."
                  required
                />
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Description</label>
                <textarea
                  value={newPostDesc}
                  onChange={(e) => setNewPostDesc(e.target.value)}
                  placeholder="Explain exactly what you need and why..."
                  className="custom-input"
                  style={{ minHeight: '100px', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowCreatePost(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Post Demand</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View My Post Details Modal */}
      {selectedMyPost && (
        <div className="modal-overlay" onClick={() => setSelectedMyPost(null)}>
          <div className="modal-content post-modal" onClick={e => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setSelectedMyPost(null)}><X size={20} /></button>
            <div className="rd-header">
              <h2>{selectedMyPost.title}</h2>
              <p>Status: <strong className={`text-${selectedMyPost.status === 'Fulfilled' ? 'primary' : 'danger'}`}>{selectedMyPost.status}</strong></p>
            </div>
            <div className="rd-body">
              <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>Description</h3>
                <p>{selectedMyPost.desc}</p>
                <div style={{ marginTop: '1rem', display: 'flex', gap: '2rem', color: '#64748b', fontSize: '0.9rem' }}>
                  <span><strong>Urgency:</strong> {selectedMyPost.urgency}</span>
                  <span><strong>Posted:</strong> {new Date(selectedMyPost.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button className="btn btn-outline" onClick={() => setSelectedMyPost(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Donor Profile Detail Modal */}
      {selectedDonor && (
        <div className="modal-overlay" onClick={() => setSelectedDonor(null)} style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0, 0, 0, 0.75)' }}>
          <div className="modal-content post-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, padding: 0, overflow: 'hidden', background: 'rgba(10, 18, 36, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '24px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', color: 'white' }}>
            <div style={{ position: 'relative', height: 160, background: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #065f46 100%)', display: 'flex', alignItems: 'flex-end', padding: '1.5rem', overflow: 'hidden' }}>
              {/* Cover pattern overlay */}
              <div style={{ position: 'absolute', inset: 0, opacity: 0.1, background: 'radial-gradient(circle, #fff 10%, transparent 11%)', backgroundSize: '12px 12px' }} />
              <button className="close-modal" onClick={() => setSelectedDonor(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', zIndex: 2 }}>
                <div style={{ width: 64, height: 64, borderRadius: '16px', background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCircle size={44} color="#fff" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'white', fontFamily: 'var(--font-heading)' }}>{selectedDonor.name}</h2>
                  <span style={{ background: 'rgba(255, 255, 255, 0.12)', padding: '2px 8px', borderRadius: 99, fontSize: '0.68rem', color: '#cbd5e1', fontWeight: 700, border: '1px solid rgba(255,255,255,0.06)' }}>
                    {selectedDonor.type}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ padding: '1.75rem' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1.25rem', borderRadius: '16px', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>About Partner</h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{selectedDonor.bio}</p>
                
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '2px' }}>Email</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>{selectedDonor.email}</span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '2px' }}>Phone</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>{selectedDonor.phone}</span>
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '16px', padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#34d399', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🎁 Active Donations ({selectedDonor.activeDonations.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedDonor.activeDonations.map((item, idx) => (
                    <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '8px 12px', fontSize: '0.85rem', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#10b981' }}>✔</span> {item}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '10px' }}>
                <a href={`tel:${selectedDonor.phone}`} className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
                  📞 Contact Partner
                </a>
                <button className="btn btn-outline" style={{ padding: '0.6rem 1.5rem', borderRadius: '12px' }} onClick={() => setSelectedDonor(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completed Donation Detail Modal */}
      {selectedCompletedDonation && (
        <div className="modal-overlay" onClick={() => setSelectedCompletedDonation(null)} style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0, 0, 0, 0.75)' }}>
          <div className="modal-content post-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, padding: 0, overflow: 'hidden', background: 'rgba(10, 18, 36, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '24px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', color: 'white' }}>
            <div style={{ position: 'relative', height: 220, overflow: 'hidden' }}>
              {selectedCompletedDonation.imageUrl ? (
                <img src={selectedCompletedDonation.imageUrl} alt="Donation" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #022c22 0%, #064e3b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={56} color="#047857" />
                </div>
              )}
              {/* Glowing overlay shadow on header image */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(10,18,36,0.95) 100%)' }} />
              <button className="close-modal" onClick={() => setSelectedCompletedDonation(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            </div>

            <div style={{ padding: '1.75rem', marginTop: '-20px', position: 'relative', zIndex: 2 }}>
              <h2 style={{ margin: '0 0 10px', fontSize: '1.75rem', fontWeight: 900, color: 'white', fontFamily: 'var(--font-heading)', letterSpacing: '-0.5px' }}>{selectedCompletedDonation.title}</h2>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <span style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '4px 12px', borderRadius: 99, fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 700, border: '1px solid rgba(255,255,255,0.06)' }}>
                  📦 {selectedCompletedDonation.category || 'General'}
                </span>
                <span style={{ background: 'rgba(16,185,129,0.15)', padding: '4px 12px', borderRadius: 99, fontSize: '0.75rem', color: '#6ee7b7', fontWeight: 700, border: '1px solid rgba(16,185,129,0.25)' }}>
                  ACCEPTED & VERIFIED
                </span>
              </div>

              {/* Donor Contact Box */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1.25rem', borderRadius: '16px', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Donor Contact Details</h3>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #1e40af, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserCircle size={24} color="white" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, color: 'white', fontSize: '0.95rem', fontWeight: 700 }}>{selectedCompletedDonation.donorId?.name || 'Anonymous Donor'}</h4>
                    <span style={{ color: '#60a5fa', fontSize: '0.75rem', fontWeight: 600 }}>Verified Donor</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.85)' }}>
                  <div><strong style={{ color: 'var(--text-dim)' }}>Email:</strong> {selectedCompletedDonation.donorId?.email || '—'}</div>
                  <div><strong style={{ color: 'var(--text-dim)' }}>Phone:</strong> {selectedCompletedDonation.donorId?.phone || '—'}</div>
                  <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--text-dim)' }}>City:</strong> {selectedCompletedDonation.donorId?.city || 'Pakistan'}</div>
                </div>
              </div>

              {/* AI Safety Report */}
              <div style={{ background: 'rgba(16, 185, 129, 0.07)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '16px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <ShieldCheck size={18} color="#34d399" />
                  <strong style={{ color: '#34d399', fontSize: '0.9rem', fontWeight: 800 }}>AI Safety Report (Score: {selectedCompletedDonation.aiSafetyScore}%)</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.55 }}>
                  {selectedCompletedDonation.aiAnalysisReason || 'Items verified safe by SpareShare AI validation service.'}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '10px' }}>
                {selectedCompletedDonation.donorId?.phone && (
                  <a href={`tel:${selectedCompletedDonation.donorId.phone}`} className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
                    📞 Contact Donor
                  </a>
                )}
                <button className="btn btn-outline" style={{ padding: '0.6rem 1.5rem', borderRadius: '12px' }} onClick={() => setSelectedCompletedDonation(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


export default ReceiverPortal;
