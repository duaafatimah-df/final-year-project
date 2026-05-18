import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useLang } from '../context/AuthContext';
import axios from 'axios';

const t = (lang, enText, urText) => lang === 'Eng' ? enText : urText;
import { 
  LogOut, Search, Globe, Building2, List, BellRing, 
  ShieldCheck, Phone, Mail, UserCircle, MapPin, Check, X, Camera,
  Activity, ScanLine, Clock, ArrowRight, CheckCircle2, XCircle
} from 'lucide-react';
import ProfilePage from '../components/ProfilePage';
import './ReceiverPortal.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ReceiverPortal = () => {
  const { user, logout } = useAuth();
  const { lang, setLang } = useLang();
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
  const [profileSaving, setProfileSaving] = useState(false);

  // Modals and Interaction State
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [acceptedDonor, setAcceptedDonor] = useState(null); 
  const [requestStatus, setRequestStatus] = useState({});
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [selectedMyPost, setSelectedMyPost] = useState(null);

  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostUrgency, setNewPostUrgency] = useState('Medium');
  const [newPostDesc, setNewPostDesc] = useState('');

  useEffect(() => {
    fetchMyPosts();
    fetchIncoming();
    fetchCompleted();
    fetchAiMatches();
    const savedBio = localStorage.getItem(`bio_${user?.id}`) || '';
    const savedCity = localStorage.getItem(`city_${user?.id}`) || 'Pakistan';
    setProfileBio(savedBio);
    setProfileCity(savedCity);
  }, []);

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    // Save to localStorage for now (persists across sessions)
    localStorage.setItem(`bio_${user?.id}`, profileBio);
    localStorage.setItem(`city_${user?.id}`, profileCity);
    setTimeout(() => {
      setProfileSaving(false);
      setIsEditingProfile(false);
    }, 600);
  };

  const fetchMyPosts = async () => {
    try {
      const res = await axios.get(`${API}/api/posts/my-posts`);
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
      setRequestStatus({...requestStatus, [reqId]: 'accepted'});
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
      setRequestStatus({...requestStatus, [reqId]: 'rejected'});
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
      });
      setMyPosts([res.data, ...myPosts]);
      setShowCreatePost(false);
      setNewPostTitle(''); setNewPostDesc('');
    } catch (err) { console.error(err); }
  };

  const togglePostStatus = async (post) => {
    const newStatus = post.status === 'Fulfilled' ? 'Active' : 'Fulfilled';
    try {
      await axios.put(`${API}/api/posts/${post._id}/status`, { status: newStatus });
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
            <Building2 size={18}/> {lang === 'Eng' ? 'NGO Profile' : 'این جی او پروفائل'}
          </button>
          <button className={`nav-tab ${activeTab === 'ai_matches' ? 'active' : ''}`} onClick={() => setActiveTab('ai_matches')} style={{position: 'relative'}}>
            <ScanLine size={18}/> {lang === 'Eng' ? 'AI Matches' : 'اے آئی میچز'}
            {aiMatches.length > 0 && (
              <span style={{ marginLeft: 4, background: '#3b82f6', color: 'white', borderRadius: 99, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 800 }}>
                {aiMatches.length}
              </span>
            )}
          </button>
          <button className={`nav-tab ${activeTab === 'my_posts' ? 'active' : ''}`} onClick={() => setActiveTab('my_posts')}>
            <List size={18}/> {lang === 'Eng' ? 'My Demand Posts' : 'میری پوسٹس'}
          </button>
          <button className={`nav-tab ${activeTab === 'incoming' ? 'active' : ''}`} onClick={() => setActiveTab('incoming')} style={{position: 'relative'}}>
            <BellRing size={18}/> {lang === 'Eng' ? 'Incoming' : 'آنے والے'}
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
          <button className={`nav-tab ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')} style={{position: 'relative'}}>
            <CheckCircle2 size={18}/> {lang === 'Eng' ? 'Completed' : 'مکمل'}
            {completedDonations.length > 0 && (
              <span style={{ marginLeft: 4, background: '#10b981', color: 'white', borderRadius: 99, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 800 }}>
                {completedDonations.length}
              </span>
            )}
          </button>
        </nav>

        <div className="portal-actions">
          <div className="portal-search">
            <Search size={16} className="search-icon"/>
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
                <path d="M1 3L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <div id="recv-lang-menu" className="lang-menu" style={{
              position: 'absolute', top: '110%', right: 0, zIndex: 999,
              background: 'white', borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              minWidth: '130px', overflow: 'hidden', display: 'none'
            }}>
              <button onClick={() => { setLang('Eng'); document.getElementById('recv-lang-menu').classList.remove('open'); }}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', border: 'none',
                  background: lang === 'Eng' ? '#f0fdf4' : 'white', color: lang === 'Eng' ? '#10b981' : '#1e293b',
                  fontWeight: lang === 'Eng' ? 700 : 500, cursor: 'pointer', fontSize: '0.9rem', borderBottom: '1px solid #f1f5f9' }}
              >🇬🇧 English</button>
              <button onClick={() => { setLang('اردو'); document.getElementById('recv-lang-menu').classList.remove('open'); }}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', border: 'none',
                  background: lang !== 'Eng' ? '#f0fdf4' : 'white', color: lang !== 'Eng' ? '#10b981' : '#1e293b',
                  fontWeight: lang !== 'Eng' ? 700 : 500, cursor: 'pointer', fontSize: '0.9rem',
                  direction: 'rtl', fontFamily: 'serif' }}
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
            <LogOut size={16}/> {lang === 'Eng' ? 'Logout' : 'لاگ آؤٹ'}
          </button>
        </div>
      </header>

      {/* Profile Slide-in Panel */}
      {showProfile && <ProfilePage onClose={() => setShowProfile(false)} />}

      <main className="portal-main">
        
        {activeTab === 'profile' && (
          <div className="receiver-profile-view animate-fade-in">
            <div className="rp-header-banner">
              <div className="rp-header-content">
                <div className="rp-logo-container">
                  <UserCircle size={80} color="#fff"/>
                </div>
                <div>
                  <h1 style={{color: 'white', marginBottom: '0.5rem'}}>{user?.name || 'Your Organization'}</h1>
                  <p style={{color: '#a7f3d0'}}><MapPin size={16}/> {profileCity || 'Pakistan'}</p>
                  <div className="rp-badges" style={{marginTop: '1rem'}}>
                    <span className="badge-verified-large"><ShieldCheck size={16}/> SpareShare Verified</span>
                    <span className="badge-trusted">Trusted Partner</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rp-stats-grid">
              <div className="rp-stat-card">
                <h3>Total Donations Received</h3>
                <div className="stat-number">1,240</div>
                <p>Items processed via SpareShare AI</p>
              </div>
              <div className="rp-stat-card">
                <h3>My Demand Posts</h3>
                <div className="stat-number text-primary">{myPosts.length}</div>
                <p>Currently requesting items</p>
              </div>
              <div className="rp-stat-card">
                <h3>Trust Score</h3>
                <div className="stat-number" style={{color: '#f59e0b'}}>99%</div>
                <p>Based on donor reviews</p>
              </div>
            </div>

            {/* Editable Public Profile Section */}
            <div className="rp-about-section glass-panel">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                <div>
                  <h2>Public Profile on Donor Portal</h2>
                  <p style={{fontSize: '0.85rem', color: '#64748b', marginTop: '4px'}}>
                    This information is shown to donors when they click your organization card.
                  </p>
                </div>
                {!isEditingProfile ? (
                  <button className="btn btn-outline" style={{whiteSpace: 'nowrap'}} onClick={() => setIsEditingProfile(true)}>
                    ✏️ Edit Profile
                  </button>
                ) : (
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <button className="btn btn-outline" onClick={() => setIsEditingProfile(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSaveProfile} disabled={profileSaving}>
                      {profileSaving ? 'Saving...' : '✅ Save'}
                    </button>
                  </div>
                )}
              </div>

              {isEditingProfile ? (
                <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                  <div>
                    <label style={{display: 'block', fontWeight: 600, marginBottom: '6px', color: '#374151'}}>Organization City / Location</label>
                    <input
                      type="text"
                      value={profileCity}
                      onChange={e => setProfileCity(e.target.value)}
                      placeholder="e.g. Karachi, Pakistan"
                      style={{width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem'}}
                    />
                  </div>
                  <div>
                    <label style={{display: 'block', fontWeight: 600, marginBottom: '6px', color: '#374151'}}>About Your Organization (shown on donor portal)</label>
                    <textarea
                      value={profileBio}
                      onChange={e => setProfileBio(e.target.value)}
                      placeholder="Describe your organization's mission, history, and impact..."
                      rows={5}
                      style={{width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', resize: 'vertical'}}
                    />
                  </div>
                  <div style={{background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px', fontSize: '0.85rem', color: '#166534'}}>
                    💡 <strong>Tip:</strong> A complete profile with a detailed bio gets 3x more donations. Tell donors your story!
                  </div>
                </div>
              ) : (
                <div>
                  {profileBio ? (
                    <p style={{lineHeight: 1.7, color: '#4b5563'}}>{profileBio}</p>
                  ) : (
                    <div style={{background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '16px', color: '#92400e'}}>
                      ⚠️ You haven't added an "About" description yet. Click <strong>Edit Profile</strong> to add your organization's story — donors want to know who they're helping!
                    </div>
                  )}
                  <div style={{marginTop: '1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.9rem'}}>
                      <Mail size={16} color="#10b981"/> {user?.email}
                    </div>
                    {user?.phone && (
                      <div style={{display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.9rem'}}>
                        <Phone size={16} color="#10b981"/> {user?.phone}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* All Demands Summary */}
            <div className="rp-about-section glass-panel" style={{marginTop: '1.5rem'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                <h2>All Demand Posts</h2>
                <button className="btn btn-primary" style={{fontSize: '0.85rem', padding: '0.5rem 1rem'}} onClick={() => setActiveTab('my_posts')}>
                  + Create New
                </button>
              </div>
              {myPosts.length === 0 ? (
                <p style={{color: '#64748b'}}>No demand posts yet. Create your first demand so donors can find and help you!</p>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                  {myPosts.map(post => (
                    <div key={post._id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#f8fafc'}}>
                      <div>
                        <p style={{fontWeight: 600, margin: 0}}>{post.title}</p>
                        <p style={{fontSize: '0.8rem', color: '#64748b', margin: 0}}>{post.urgency} Urgency • {new Date(post.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className={`status-badge ${(post.status || 'Active').replace(' ','-').toLowerCase()}`}>{post.status || 'Active'}</span>
                    </div>
                  ))}
                </div>
              )}
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
            <div style={{display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem'}}>
              <h2 className="section-title" style={{margin: 0}}>Incoming Donation Requests</h2>
              {incomingRequests.filter(r => !requestStatus[r._id]).length > 0 && (
                <span style={{background: '#fef3c7', color: '#92400e', borderRadius: 99, padding: '3px 12px', fontSize: '0.8rem', fontWeight: 700}}>
                  🔔 {incomingRequests.filter(r => !requestStatus[r._id]).length} New
                </span>
              )}
            </div>
            <p style={{marginBottom: '2rem', color: 'var(--text-muted)'}}>Donors have sent you items — review and decide to Accept or Reject each request.</p>

            <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              {incomingRequests.filter(r => !requestStatus[r._id]).length === 0 && (
                <div style={{textAlign: 'center', padding: '4rem 2rem', background: 'var(--bg-card)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)'}}>
                  <BellRing size={48} color="#334155" style={{margin: '0 auto 1rem'}}/>
                  <h3 style={{color: 'var(--text-muted)', marginBottom: '0.5rem'}}>No Incoming Donations Yet</h3>
                  <p style={{color: 'var(--text-dim)', fontSize: '0.9rem'}}>When donors send you items, their requests will appear here.</p>
                </div>
              )}
              {incomingRequests.map(req => {
                if (requestStatus[req._id]) return null;
                const timeAgo = new Date(req.createdAt).toLocaleString('en-PK', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});
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
                    <div style={{background: 'linear-gradient(135deg, #064e3b, #047857)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <BellRing size={14} color="#a7f3d0"/>
                      <span style={{color: '#a7f3d0', fontSize: '0.8rem', fontWeight: 600}}>New Donation Request • {timeAgo}</span>
                    </div>

                    <div style={{display: 'flex', gap: '1.5rem', padding: '1.25rem 1.5rem', alignItems: 'center', flexWrap: 'wrap'}}>
                      {/* Donation image */}
                      <div style={{position: 'relative', flexShrink: 0}}>
                        {req.imageUrl ? (
                          <img src={req.imageUrl} alt="Donation"
                            style={{width: 80, height: 80, objectFit: 'cover', borderRadius: 12, border: '2px solid #d1fae5'}}
                            onError={e => e.target.style.display = 'none'}
                          />
                        ) : (
                          <div style={{width: 80, height: 80, borderRadius: 12, background: '#f0fdf4', border: '2px solid #d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                            <ShieldCheck size={32} color="#10b981"/>
                          </div>
                        )}
                        <div style={{position: 'absolute', bottom: -6, right: -6, background: '#10b981', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white'}}>
                          <Check size={12} color="white"/>
                        </div>
                      </div>

                      {/* Donor info */}
                      <div style={{flex: 1, minWidth: 180}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px'}}>
                          <UserCircle size={20} color="#10b981"/>
                          <span style={{fontWeight: 700, color: 'var(--text-main)'}}>{req.donorId?.name || 'Anonymous Donor'}</span>
                          <span style={{background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(16,185,129,0.2)'}}>Verified Donor</span>
                        </div>
                        <p style={{margin: 0, fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px'}}>{req.title}</p>
                        <p style={{margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)'}}>Category: <span style={{color: '#10b981', fontWeight: 600}}>{req.category || req.aiDetectedItems}</span></p>
                      </div>

                      {/* AI score */}
                      <div style={{textAlign: 'center', flexShrink: 0}}>
                        <div style={{width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #064e3b, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px'}}>
                          <span style={{color: 'white', fontWeight: 800, fontSize: '0.9rem'}}>{req.aiSafetyScore}%</span>
                        </div>
                        <p style={{margin: 0, fontSize: '0.7rem', color: '#64748b', fontWeight: 600}}>AI Score</p>
                      </div>

                      {/* CTA */}
                      <button
                        className="btn btn-primary"
                        style={{flexShrink: 0, fontSize: '0.85rem', padding: '0.6rem 1.2rem'}}
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
      </main>

      {/* ============ DONATION DETAIL MODAL ============ */}
      {selectedRequest && (
        <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{maxWidth: 600, width: '95%', padding: 0, overflow: 'hidden', borderRadius: 20}}
          >
            {/* Modal Header */}
            <div style={{background: 'linear-gradient(135deg, #064e3b, #047857)', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                <h2 style={{color: 'white', margin: 0, fontSize: '1.2rem'}}>📦 Donation Request Review</h2>
                <p style={{color: '#a7f3d0', margin: 0, fontSize: '0.85rem'}}>Received {new Date(selectedRequest.createdAt).toLocaleString('en-PK', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'})}</p>
              </div>
              <button onClick={() => setSelectedRequest(null)} style={{background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white'}}>
                <X size={18}/>
              </button>
            </div>

            <div style={{padding: '1.5rem 2rem', overflowY: 'auto', maxHeight: '70vh'}}>

              {/* Donor Details Card */}
              <div style={{background: '#f8fafc', borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem', border: '1px solid #e2e8f0'}}>
                <p style={{color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 1rem'}}>Donor Information</p>
                <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                  <div style={{width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #064e3b, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                    <UserCircle size={32} color="white"/>
                  </div>
                  <div style={{flex: 1}}>
                    <h3 style={{margin: 0, fontSize: '1.05rem', color: '#0f172a'}}>{selectedRequest.donorId?.name || 'Anonymous Donor'}</h3>
                    <span style={{background: '#d1fae5', color: '#065f46', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99}}>✓ SpareShare Verified</span>
                  </div>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontSize: '0.9rem'}}>
                    <Mail size={16} color="#10b981"/> {selectedRequest.donorId?.email || '—'}
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontSize: '0.9rem'}}>
                    <Phone size={16} color="#10b981"/> {selectedRequest.donorId?.phone || 'Not provided'}
                  </div>
                </div>
              </div>

              {/* Donation Image */}
              <div style={{marginBottom: '1.25rem'}}>
                <p style={{color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 0.75rem'}}>Donation Items Photo</p>
                {selectedRequest.imageUrl ? (
                  <img
                    src={selectedRequest.imageUrl}
                    alt="Donated items"
                    style={{width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, border: '1px solid #e2e8f0'}}
                    onError={e => { e.target.style.display='none'; }}
                  />
                ) : (
                  <div style={{width: '100%', height: 160, background: '#f1f5f9', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1'}}>
                    <Camera size={36}/>
                    <p style={{margin: '8px 0 0', fontSize: '0.85rem'}}>No image uploaded</p>
                  </div>
                )}
              </div>

              {/* AI Analysis */}
              <div style={{background: '#0f172a', borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem'}}>
                  <Activity size={18} color="#10b981"/>
                  <p style={{color: 'white', margin: 0, fontWeight: 700}}>SpareShare AI Analysis</p>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem'}}>
                  <div style={{background: '#1e293b', borderRadius: 10, padding: '0.9rem', textAlign: 'center'}}>
                    <p style={{color: '#94a3b8', fontSize: '0.7rem', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.5}}>Safety Score</p>
                    <p style={{color: '#10b981', fontSize: '1.5rem', fontWeight: 800, margin: 0}}>{selectedRequest.aiSafetyScore}%</p>
                    <p style={{color: '#10b981', fontSize: '0.7rem', margin: 0}}>✅ Safe</p>
                  </div>
                  <div style={{background: '#1e293b', borderRadius: 10, padding: '0.9rem', textAlign: 'center'}}>
                    <p style={{color: '#94a3b8', fontSize: '0.7rem', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.5}}>Category</p>
                    <p style={{color: 'white', fontSize: '0.9rem', fontWeight: 700, margin: 0}}>{selectedRequest.category || 'General'}</p>
                    <p style={{color: '#94a3b8', fontSize: '0.7rem', margin: 0}}>Detected</p>
                  </div>
                  <div style={{background: '#1e293b', borderRadius: 10, padding: '0.9rem', textAlign: 'center'}}>
                    <p style={{color: '#94a3b8', fontSize: '0.7rem', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.5}}>Verdict</p>
                    <p style={{color: '#10b981', fontSize: '0.9rem', fontWeight: 700, margin: 0}}>Approved</p>
                    <p style={{color: '#94a3b8', fontSize: '0.7rem', margin: 0}}>AI verified</p>
                  </div>
                </div>
                <p style={{color: '#64748b', fontSize: '0.8rem', marginTop: '0.75rem', margin: '0.75rem 0 0'}}>
                  💡 {selectedRequest.aiAnalysisReason || 'Items appear fresh and safe for distribution.'}
                </p>
              </div>

              {/* Actions */}
              <div style={{display: 'flex', gap: '0.75rem'}}>
                <button
                  className="btn btn-outline"
                  style={{flex: 1, padding: '0.9rem', borderColor: '#ef4444', color: '#ef4444', fontSize: '0.95rem', fontWeight: 700}}
                  onClick={() => handleRejectRequest(selectedRequest._id)}
                >
                  ✗ Reject Donation
                </button>
                <button
                  className="btn btn-primary"
                  style={{flex: 1, padding: '0.9rem', fontSize: '0.95rem', fontWeight: 700}}
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
            <h2 style={{ margin: 0 }}>Completed Donations</h2>
            <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: 99, padding: '3px 12px', fontSize: '0.8rem', fontWeight: 700 }}>
              ✅ {completedDonations.length} received
            </span>
          </div>
          <p style={{ color: '#64748b', marginBottom: '2rem' }}>
            All donations your organization has accepted — full details, donor info, and AI analysis stored here.
          </p>

          {completedDonations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#f8fafc', borderRadius: 16, border: '1px dashed #e2e8f0' }}>
              <CheckCircle2 size={48} color="#cbd5e1" style={{ margin: '0 auto 1rem', display: 'block' }} />
              <h3 style={{ color: '#94a3b8', marginBottom: '0.5rem' }}>No Completed Donations Yet</h3>
              <p style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>When you accept donation requests, they'll be stored here with all details.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {completedDonations.map(don => (
                <div key={don._id} style={{ background: 'white', borderRadius: 18, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
                  {/* Top banner */}
                  <div style={{ background: 'linear-gradient(135deg, #064e3b, #047857)', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#a7f3d0', fontSize: '0.82rem', fontWeight: 700 }}>✅ Donation Accepted & Completed</span>
                    <span style={{ color: '#6ee7b7', fontSize: '0.75rem' }}>
                      {new Date(don.updatedAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                    {/* Donation image */}
                    <div style={{ gridColumn: '1' }}>
                      {don.imageUrl ? (
                        <img src={don.imageUrl} alt="Donation" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 12, border: '2px solid #d1fae5' }} onError={e => e.target.style.display='none'} />
                      ) : (
                        <div style={{ width: 80, height: 80, borderRadius: 12, background: '#f0fdf4', border: '2px dashed #d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle2 size={32} color="#10b981" />
                        </div>
                      )}
                    </div>

                    {/* Donation details */}
                    <div>
                      <p style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px' }}>Donation Details</p>
                      <h3 style={{ margin: '0 0 6px', color: '#0f172a', fontSize: '1.05rem' }}>{don.title}</h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '8px' }}>
                        <span style={{ background: '#f0fdf4', color: '#065f46', padding: '3px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600 }}>
                          📦 {don.category || 'General'}
                        </span>
                        <span style={{ background: '#f0fdf4', color: '#065f46', padding: '3px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600 }}>
                          🛡️ AI Score: {don.aiSafetyScore}%
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                        {don.aiAnalysisReason || 'Items verified safe by SpareShare AI.'}
                      </p>
                    </div>

                    {/* Donor contact card */}
                    <div style={{ background: '#f8fafc', borderRadius: 12, padding: '1rem', border: '1px solid #e2e8f0' }}>
                      <p style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 10px' }}>Donor Contact</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        {don.donorId?.profilePic ? (
                          <img src={don.donorId.profilePic} alt="donor" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid #d1fae5' }} />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#1e40af,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UserCircle size={22} color="white" />
                          </div>
                        )}
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{don.donorId?.name || 'Anonymous Donor'}</p>
                          <span style={{ background: '#dbeafe', color: '#1e40af', fontSize: '0.68rem', fontWeight: 700, padding: '1px 7px', borderRadius: 99 }}>Verified Donor</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {don.donorId?.email && (
                          <p style={{ margin: 0, fontSize: '0.78rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Mail size={13} color="#10b981" /> {don.donorId.email}
                          </p>
                        )}
                        {don.donorId?.phone && (
                          <p style={{ margin: 0, fontSize: '0.78rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Phone size={13} color="#10b981" /> {don.donorId.phone}
                          </p>
                        )}
                        {don.donorId?.city && (
                          <p style={{ margin: 0, fontSize: '0.78rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <MapPin size={13} color="#10b981" /> {don.donorId.city}
                          </p>
                        )}
                      </div>
                    </div>
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
            <button className="close-modal" onClick={() => setAcceptedDonor(null)}><X size={20}/></button>
            <div className="success-icon-container">
              <Check size={48} color="#10b981"/>
            </div>
            <h2 style={{textAlign: 'center', marginBottom: '0.5rem'}}>Donation Accepted!</h2>
            <p style={{textAlign: 'center', color: '#64748b', marginBottom: '2rem'}}>
              You can now contact the donor to coordinate pickup/delivery.
            </p>

            <div className="donor-info-card">
              <div style={{display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0'}}>
                <UserCircle size={48} className="text-primary"/>
                <div>
                  <h3 style={{margin: 0}}>{acceptedDonor.donorName}</h3>
                  <p style={{margin: 0, fontSize: '0.85rem', color: '#10b981'}}><ShieldCheck size={14}/> Verified Donor</p>
                </div>
              </div>
              
              <div className="contact-row">
                <Phone size={18} className="text-primary"/>
                <span>{acceptedDonor.donorPhone}</span>
              </div>
              <div className="contact-row">
                <Mail size={18} className="text-primary"/>
                <span>{acceptedDonor.donorEmail}</span>
              </div>
            </div>

            <div style={{textAlign: 'center', marginTop: '2rem'}}>
              <button className="btn btn-primary" onClick={() => setAcceptedDonor(null)}>Done</button>
            </div>
          </div>
        </div>
      )}



      {/* Create Post Modal */}
      {showCreatePost && (
        <div className="modal-overlay" onClick={() => setShowCreatePost(false)}>
          <div className="modal-content post-modal" onClick={e => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setShowCreatePost(false)}><X size={20}/></button>
            <div className="rd-header">
              <h2>Create New Demand</h2>
              <p>Post your urgent requirements so donors can fulfill them.</p>
            </div>
            <form className="rd-body" onSubmit={handleCreatePost}>
              <div style={{marginBottom: '1rem'}}>
                <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 'bold'}}>What do you need?</label>
                <input 
                  type="text" 
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  placeholder="e.g. Need 50 Blankets" 
                  style={{width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ccc'}}
                  required
                />
              </div>
              <div style={{marginBottom: '2rem'}}>
                <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 'bold'}}>Urgency Level</label>
                <select 
                  value={newPostUrgency}
                  onChange={(e) => setNewPostUrgency(e.target.value)}
                  style={{width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ccc'}}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div style={{marginBottom: '2rem'}}>
                <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 'bold'}}>Description</label>
                <textarea 
                  value={newPostDesc}
                  onChange={(e) => setNewPostDesc(e.target.value)}
                  placeholder="Explain exactly what you need and why..." 
                  style={{width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ccc', minHeight: '100px'}}
                />
              </div>
              <div style={{display: 'flex', justifyContent: 'flex-end', gap: '1rem'}}>
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
            <button className="close-modal" onClick={() => setSelectedMyPost(null)}><X size={20}/></button>
            <div className="rd-header">
              <h2>{selectedMyPost.title}</h2>
              <p>Status: <strong className={`text-${selectedMyPost.status === 'Fulfilled' ? 'primary' : 'danger'}`}>{selectedMyPost.status}</strong></p>
            </div>
            <div className="rd-body">
              <div style={{background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem'}}>
                <h3 style={{marginBottom: '0.5rem'}}>Description</h3>
                <p>{selectedMyPost.desc}</p>
                <div style={{marginTop: '1rem', display: 'flex', gap: '2rem', color: '#64748b', fontSize: '0.9rem'}}>
                  <span><strong>Urgency:</strong> {selectedMyPost.urgency}</span>
                  <span><strong>Posted:</strong> {new Date(selectedMyPost.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div style={{display: 'flex', justifyContent: 'center'}}>
                <button className="btn btn-outline" onClick={() => setSelectedMyPost(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


export default ReceiverPortal;
