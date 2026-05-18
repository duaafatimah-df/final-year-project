import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useLang } from '../context/AuthContext';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import {
  RefreshCw, ArrowRight,
  LogOut, Search, Globe, Home, Activity, Calculator,
  UploadCloud, MapPin, ScanLine, Sun, Clock, Send, ShieldCheck,
  ChevronLeft, ChevronRight, UserCircle, X, Heart, History, Building2, Sparkles
} from "lucide-react";
import { organizations } from './Home';
import ZakatCalculator from './ZakatCalculator';
import ProfilePage from '../components/ProfilePage';
import SmartMap from '../components/SmartMap';
import './ContributorPortal.css';

const API = import.meta.env.VITE_API_URL;

// Mock Data for Charts
const monthlyData = [
  { name: 'Week 1', scans: 45 },
  { name: 'Week 2', scans: 52 },
  { name: 'Week 3', scans: 38 },
  { name: 'Week 4', scans: 65 },
];

// Removed mock receiverDemands, will fetch from API

const t = (lang, enText, urText) => lang === 'Eng' ? enText : urText;

const ContributorPortal = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('home');
  const { lang, setLang } = useLang(); // Global language context (like Saylani)
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [receiverDemands, setReceiverDemands] = useState([]);
  const [verifiedOrgs, setVerifiedOrgs] = useState([]);
  const [myDonations, setMyDonations] = useState([]);
  const [selectedDonation, setSelectedDonation] = useState(null);
  const [historyTab, setHistoryTab] = useState('active'); // active, completed, rejected

  // Donation Form State
  const [file, setFile] = useState(null);
  const [donTitle, setDonTitle] = useState('');
  const [category, setCategory] = useState('');
  const [itemType, setItemType] = useState('');
  const [condition, setCondition] = useState('');
  const [quantity, setQuantity] = useState('');
  const [description, setDescription] = useState('');
  const [expiryTime, setExpiryTime] = useState('');
  const [foodPreparedTime, setFoodPreparedTime] = useState('');
  const [isSealed, setIsSealed] = useState(false);
  const [location, setLocation] = useState('');
  const [donLat, setDonLat] = useState(0);
  const [donLng, setDonLng] = useState(0);
  const [validationError, setValidationError] = useState('');

  const [isTranslatingDesc, setIsTranslatingDesc] = useState(false);
  const [translationError, setTranslationError] = useState('');

  const handleTranslateDesc = async () => {
    if (!description) return;
    setIsTranslatingDesc(true);
    setTranslationError('');
    try {
      const res = await axios.post(`${API}/api/ai/translate`, {
        text: description,
        targetLang: lang === 'Eng' ? 'ur' : 'en'
      });
      setDescription(res.data.translatedText);
    } catch (err) {
      setTranslationError('❌ Translation failed');
    } finally {
      setIsTranslatingDesc(false);
    }
  };

  // City -> lat/lng map
  const CITY_COORDS = { Karachi: [24.8607, 67.0011], Lahore: [31.5204, 74.3587], Islamabad: [33.6844, 73.0479], Peshawar: [34.0151, 71.5249], Quetta: [30.1798, 66.975], Multan: [30.1575, 71.5249] };
  const setLatLng = (city) => { const c = CITY_COORDS[city]; if (c) { setDonLat(c[0]); setDonLng(c[1]); } };

  // Season helper
  const isSummerMonth = (() => { const m = new Date().getMonth(); return m >= 4 && m <= 8; })();

  // AI Dashboard State
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [currentDonationId, setCurrentDonationId] = useState(null);
  const [aiKeywords, setAiKeywords] = useState([]);
  const [selectedHistoryDonation, setSelectedHistoryDonation] = useState(null);

  // Carousel Ref
  const carouselRef = useRef(null);

  const scrollLeft = () => carouselRef.current?.scrollBy({ left: -400, behavior: 'smooth' });
  const scrollRight = () => carouselRef.current?.scrollBy({ left: 400, behavior: 'smooth' });

  // Location setup
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => { setDonLat(pos.coords.latitude); setDonLng(pos.coords.longitude); });
    }
  }, []);

  // Fetch AI Suggestion
  const [aiSuggestion, setAiSuggestion] = useState('');
  useEffect(() => {
    if (user?.userId) {
      axios.get(`${API}/api/ai/suggest-donation?userId=${user.userId}`)
        .then(res => setAiSuggestion(res.data.primary || 'Donate food today to help your community!'))
        .catch(() => setAiSuggestion('Donate food today to help your community!'));
    }
  }, [user]);

  // Fetch active receiver posts and verified orgs
  const fetchData = async () => {
    try {
      const postsRes = await axios.get(`${API}/api/posts/active`);
      setReceiverDemands(postsRes.data);

      const orgsRes = await axios.get(`${API}/api/users/receivers`);
      const formattedStaticOrgs = organizations.map(org => ({
        ...org,
        _id: org.id,
        orgType: org.type,
        email: org.desc
      }));
      setVerifiedOrgs([...formattedStaticOrgs, ...orgsRes.data]);

      // Fetch donor's own donations
      const donRes = await axios.get(`${API}/api/donations/my-donations`, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setMyDonations(donRes.data);
    } catch (err) {
      console.error('Failed to fetch data', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteDonation = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await axios.delete(`${API}/api/donations/${id}`, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setMyDonations(prev => prev.filter(d => d._id !== id));
    } catch (err) {
      console.error('Failed to delete', err);
      alert('Failed to delete donation.');
    }
  };

  const handleUpdateStatus = async (id, newStatus, e) => {
    if (e) e.stopPropagation();
    try {
      await axios.put(`${API}/api/donations/${id}/status`, { status: newStatus }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setMyDonations(prev => prev.map(d => d._id === id ? { ...d, status: newStatus } : d));
    } catch (err) {
      console.error('Failed to update status', err);
      alert('Failed to update status.');
    }
  };

  // Dropzone setup
  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles.length > 0) {
      setFile(Object.assign(acceptedFiles[0], { preview: URL.createObjectURL(acceptedFiles[0]) }));
    }
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] }, maxFiles: 1 });

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleDonateSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    if (!file) { setValidationError('An image is required.'); return; }
    // Client-side validation
    const now = new Date();

    if (category === 'Food') {
      if (!foodPreparedTime) { setValidationError('Time when food was prepared is required.'); return; }
      const prepared = new Date(foodPreparedTime);
      if (prepared > now) { setValidationError('Prepared time cannot be in the future.'); return; }
      const diffHours = (now - prepared) / 3600000;
      const maxHours = isSummerMonth ? 2 : 4;
      if (diffHours > maxHours) {
        setValidationError(`Food is expired. Maximum allowed time is ${maxHours} hours.`);
        return;
      }
    } else if (category === 'Medicine') {
      if (!expiryTime) { setValidationError('Expiry time is required for Medicine.'); return; }
      const expiry = new Date(expiryTime);
      if (expiry <= now) { setValidationError('Expiry time must be in the future.'); return; }
      const minExpiry = new Date(now.getTime() + 30 * 24 * 3600000);
      if (expiry < minExpiry) { setValidationError('Medicine must have at least 30 days until expiry.'); return; }
      if (!isSealed) { setValidationError('Medicine must be sealed/unopened.'); return; }
    } else {
      // Condition required for Clothes and Household
      if ((category === 'Clothes' || category === 'Household') && !condition) {
        setValidationError(`Condition is required for ${category}.`);
        return;
      }
    }

    if (category === 'Medicine' && !isSealed) { setValidationError('Medicine must be sealed/unopened.'); return; }
    if ((category === 'Clothes' || category === 'Household') && !condition) { setValidationError(`Condition is required for ${category}.`); return; }

    setActiveTab('ai_dashboard');
    setIsScanning(true);

    // Convert image to base64 for storage
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const imageUrl = reader.result;
        const res = await axios.post(`${API}/api/donations`, {
          title: donTitle,
          category,
          itemType: itemType || category,
          condition: condition || 'Good',
          quantity,
          description,
          foodPreparedTime: (category === 'Food' && foodPreparedTime) ? new Date(foodPreparedTime).toISOString() : null,
          expiryTime: (category === 'Medicine' && expiryTime) ? new Date(expiryTime).toISOString() : null,
          isSealed,
          lat: donLat,
          lng: donLng,
          address: location,
          imageUrl,
        }, { headers: { 'x-auth-token': localStorage.getItem('token') } });

        // Success
        setCurrentDonationId(res.data._id);
        setAiKeywords(res.data.aiKeywords || []);
        setAiResult({
          safetyScore: res.data.aiSafetyScore || 90,
          recommendation: res.data.status === 'rejected' ? 'Rejected' : res.data.isVerifiedSafe ? 'Accept' : 'Review',
          itemName: res.data.title || 'Donation Item',
          safetyNotes: res.data.aiAnalysisReason || 'Safe for distribution.',
          detectedCategory: res.data.aiDetectedItems || res.data.category,
          condition: condition || (res.data.isSealed ? 'Sealed/New' : 'Open/Used'),
          freshness: res.data.status === 'rejected' ? 'Spoiled/Unsafe' : 'Verified',
          estimatedItems: res.data.quantity || 'Unknown',
          matchReason: res.data.status === 'rejected' ? 'Safety limits exceeded. Item blocked.' : 'Matched to nearby demand based on AI engine.'
        });
        setIsScanning(false);
        setScanComplete(true);
        fetchData(); // refresh donations list

      } catch (err) {
        setIsScanning(false);
        setScanComplete(true);
        const msg = err.response?.data?.error || 'Failed to submit donation.';
        setAiError(msg);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSendNotification = async (post) => {
    if (!currentDonationId) {
      alert("No active donation found. Please scan an item first.");
      return;
    }
    try {
      await axios.put(`${API}/api/donations/${currentDonationId}/dispatch`, {
        receiverId: post.receiverId._id || post.receiverId
      }, { headers: { 'x-auth-token': localStorage.getItem('token') } });
      alert(`Success! Dispatch Notification sent to ${post.receiverId?.name || 'the NGO'}. They will contact you shortly to coordinate.`);
      setSelectedPost(null);
      setActiveTab('my_donations');
      setFile(null); setCategory(''); setLocation(''); setScanComplete(false);
      setCurrentDonationId(null);
      setAiKeywords([]);
      fetchData(); // refresh
    } catch (err) {
      alert('Failed to send donation request. Please try again.');
      console.error(err);
    }
  };

  // Filter Orgs safely
  const filteredOrgs = (verifiedOrgs || []).filter(org => {
    if (!org || !org.name || typeof org.name !== 'string') return false;
    const q = (searchQuery || '').toLowerCase();
    return org.name.toLowerCase().includes(q);
  });

  return (
    <div className="portal-layout" onClick={(e) => {
      const menu = document.getElementById('lang-menu');
      if (menu && !e.target.closest('.lang-dropdown-wrapper')) {
        menu.classList.remove('open');
      }
    }}>
      {/* Portal Custom Header */}
      <header className="portal-header">
        <div className="portal-logo" onClick={() => navigate('/')}>
          <img src="/logo.png" alt="SpareShare" />
          <span>Donor Portal</span>
        </div>

        <nav className="portal-nav">
          <button className={`nav-tab ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
            <Home size={18} /> {lang === 'Eng' ? 'Dashboard Home' : 'ڈیش بورڈ'}
          </button>
          <button className={`nav-tab ${activeTab === 'ai_dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('ai_dashboard')}>
            <Activity size={18} /> {lang === 'Eng' ? 'AI Dashboard' : 'اے آئی ڈیش بورڈ'}
          </button>
          <button className={`nav-tab ${activeTab === 'zakat' ? 'active' : ''}`} onClick={() => setActiveTab('zakat')}>
            <Calculator size={18} /> {lang === 'Eng' ? 'Zakat Calculator' : 'زکوٰۃ کیلکولیٹر'}
          </button>
          <button className={`nav-tab ${activeTab === 'my_donations' ? 'active' : ''}`} onClick={() => setActiveTab('my_donations')}>
            <History size={18} /> {lang === 'Eng' ? 'My Donations' : 'میرے عطیات'}
            {myDonations.length > 0 && (
              <span style={{ marginLeft: 4, background: '#10b981', color: 'white', borderRadius: 99, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 800 }}>{myDonations.length}</span>
            )}
          </button>
        </nav>

        <div className="portal-actions">
          <div className="portal-search">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder={lang === 'Eng' ? "Search nonprofits..." : "تلاش کریں..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="lang-dropdown-wrapper" style={{ position: 'relative' }}>
            <button
              className="lang-btn"
              onClick={() => document.getElementById('lang-menu').classList.toggle('open')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Globe size={16} />
              {lang === 'Eng' ? 'English' : 'اردو'}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 2 }}>
                <path d="M1 3L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <div
              id="lang-menu"
              style={{
                position: 'absolute', top: '110%', right: 0, zIndex: 999,
                background: 'white', borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                minWidth: '130px', overflow: 'hidden', display: 'none'
              }}
              className="lang-menu"
            >
              <button
                onClick={() => { setLang('Eng'); document.getElementById('lang-menu').classList.remove('open'); }}
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
                onClick={() => { setLang('اردو'); document.getElementById('lang-menu').classList.remove('open'); }}
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
          <button className="profile-icon-btn" onClick={() => setShowProfile(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
            <UserCircle size={20} /> {user?.name?.split(' ')[0]}
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={16} /> {lang === 'Eng' ? 'Logout' : 'لاگ آؤٹ'}
          </button>
        </div>
      </header>

      {/* Profile Slide-in Panel */}
      {showProfile && <ProfilePage onClose={() => setShowProfile(false)} />}

      {/* Main Content Area */}
      <main className="portal-main" style={{ paddingTop: '1rem' }}>

        {/* ======================= HOME TAB ======================= */}
        {activeTab === 'home' && (
          <div className="portal-home animate-fade-in">
            <h1 className="portal-title" style={{ marginBottom: '1.5rem' }}>{lang === 'Eng' ? `Welcome back, ${user?.name || 'Donor'}` : `خوش آمدید, ${user?.name || 'Donor'}`}</h1>

            {/* Donate With Us (Carousel) */}
            <section className="portal-section">
              <div className="section-header-flex">
                <h2 className="section-title">{lang === 'Eng' ? 'Donate with us' : 'ہمارے ساتھ عطیہ کریں'}</h2>
                <div className="carousel-controls">
                  <button className="c-btn" onClick={scrollLeft}><ChevronLeft size={24} /></button>
                  <button className="c-btn" onClick={scrollRight}><ChevronRight size={24} /></button>
                </div>
              </div>

              <div className="org-carousel-container" ref={carouselRef}>
                {filteredOrgs.length > 0 ? filteredOrgs.map(org => (
                  <div key={org._id} className="org-card" onClick={() => navigate(`/organization/${org._id}`)}>
                    <div className="org-card-image">
                      <img src="https://images.pexels.com/photos/6995136/pexels-photo-6995136.jpeg?auto=compress&cs=tinysrgb&w=800" alt={org.name} loading="lazy" />
                      <span className="org-type-badge">{org.orgType || 'NGO'}</span>
                    </div>
                    <div className="org-card-content">
                      <h3>{org.name}</h3>
                      <p className="org-location"><MapPin size={12} /> Pakistan</p>
                      <p className="org-desc">{org.email}</p>
                      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
                        <ShieldCheck size={13} /> Verified
                      </div>
                    </div>
                  </div>
                )) : (
                  <p>No organizations found matching your search.</p>
                )}
              </div>
            </section>

            {/* Charity in Islam */}
            <section className="portal-section">
              <h2 className="section-title">Charity in Islam</h2>
              <div className="islamic-cards-grid">
                <div className="islamic-card green-card">
                  <div className="arabic-text">وَمَا أَنفَقْتُم مِّن شَيْءٍ فَهُوَ يُخْلِفُهُ</div>
                  <p className="translation-text">"And whatever you spend of good, He will replace it."</p>
                  <span className="reference">- Surah Saba (34:39)</span>
                </div>
                <div className="islamic-card white-card">
                  <div className="arabic-text">خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ</div>
                  <p className="translation-text">"The best of people are those that bring most benefit to the rest of mankind."</p>
                  <span className="reference">- Hadith (Daraqutni)</span>
                </div>
              </div>
            </section>

            {/* AI Suggestion Banner */}
            {aiSuggestion && (
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Sparkles size={24} color="#10b981" />
                <div>
                  <h4 style={{ margin: 0, color: '#10b981', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Smart Suggestion</h4>
                  <p style={{ margin: '4px 0 0', fontSize: '1.05rem', color: '#e2e8f0' }}>{aiSuggestion}</p>
                </div>
              </div>
            )}

            {/* Full Donation Upload Form */}
            <section className="portal-section upload-section">
              <h2 className="section-title">{t(lang, 'Post a New Donation', 'نیا عطیہ پوسٹ کریں')}</h2>
              <form className="donation-form glass-panel" onSubmit={handleDonateSubmit}>
                <div className="form-grid">
                  {/* Left col: image */}
                  <div className="form-col">
                    <label>{t(lang, 'Upload Item Image', 'آئٹم کی تصویر اپ لوڈ کریں')} <span style={{ color: '#ef4444' }}>*</span></label>
                    <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
                      <input {...getInputProps()} />
                      {file ? (
                        <img src={file.preview} alt="Upload" className="drop-preview" />
                      ) : (
                        <div className="drop-placeholder">
                          <UploadCloud size={40} className="text-primary" />
                          <p>{t(lang, 'Drag & drop image here, or click to select', 'تصویر یہاں ڈریگ کریں یا منتخب کرنے کے لیے کلک کریں')}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right col: fields */}
                  <div className="form-col flex-col-gap">
                    <div className="form-group">
                      <label>{t(lang, 'Donation Title', 'عطیہ کا عنوان')} <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        type="text"
                        className="custom-input"
                        placeholder="e.g. Fresh Biryani for 20 people"
                        value={donTitle}
                        onChange={e => setDonTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>{t(lang, 'Category', 'زمرہ')} <span style={{ color: '#ef4444' }}>*</span></label>
                      <select className="custom-select" value={category} onChange={e => {
                        setCategory(e.target.value);
                        setExpiryTime('');
                        setCondition('');
                      }} required>
                        <option value="" disabled>Select category...</option>
                        <option value="Food">🍛 Food</option>
                        <option value="Medicine">💊 Medicine</option>
                        <option value="Clothes">👕 Clothes</option>
                        <option value="Household">🏠 Household Items</option>
                        <option value="Grocery">🛒 Grocery</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>{t(lang, 'Specific Item Type', 'مخصوص آئٹم کی قسم')} <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        type="text"
                        className="custom-input"
                        placeholder="e.g. Rice, Blanket, Chair"
                        value={itemType}
                        onChange={e => setItemType(e.target.value)}
                        required
                      />
                    </div>

                    {(category === 'Clothes' || category === 'Household') && (
                      <div className="form-group">
                        <label>{t(lang, 'Condition', 'حالت')} <span style={{ color: '#ef4444' }}>*</span></label>
                        <select className="custom-select" value={condition} onChange={e => setCondition(e.target.value)} required>
                          <option value="" disabled>Select condition...</option>
                          <option value="New">New / Unused</option>
                          <option value="Good">Good / Usable</option>
                          <option value="Used">Used / Worn</option>
                        </select>
                      </div>
                    )}

                    <div className="form-group">
                      <label>{t(lang, 'Quantity', 'مقدار')}</label>
                      <input
                        type="text"
                        className="custom-input"
                        placeholder="e.g. 10 kg, 5 boxes, 3 bags"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ margin: 0 }}>{t(lang, 'Description', 'تفصیل')}</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={handleTranslateDesc}
                            disabled={!description || isTranslatingDesc}
                            style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                          >
                            {isTranslatingDesc ? 'Translating...' : `Translate to ${lang === 'Eng' ? 'Urdu' : 'English'}`}
                          </button>
                          {translationError && <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>{translationError}</span>}
                        </div>
                      </div>
                      <textarea
                        className="custom-input"
                        placeholder="Describe the donation item..."
                        rows={3}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        style={{ resize: 'vertical' }}
                      />
                    </div>

                    {category === 'Food' && (
                      <div className="form-group">
                        <label>
                          {t(lang, 'Time Food Was Prepared', 'کھانا تیار کرنے کا وقت')} <span style={{ color: '#ef4444' }}>*</span>
                          <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>
                            ⚠️ {isSummerMonth ? 'Summer: max 2 hours from now' : 'Winter: max 4 hours from now'}
                          </span>
                        </label>
                        <input
                          type="datetime-local"
                          className="custom-input"
                          value={foodPreparedTime}
                          onChange={e => setFoodPreparedTime(e.target.value)}
                          max="9999-12-31T23:59"
                          required
                        />
                      </div>
                    )}

                    {(category === 'Medicine' || category === 'Grocery') && (
                      <div className="form-group">
                        <label>
                          {t(lang, 'Expiry Date & Time', 'ختم ہونے کی تاریخ اور وقت')} {category === 'Medicine' && <span style={{ color: '#ef4444' }}>*</span>}
                          {category === 'Medicine' && (
                            <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#3b82f6', fontWeight: 600 }}>
                              💊 Must be 30+ days until expiry
                            </span>
                          )}
                        </label>
                        <input
                          type="datetime-local"
                          className="custom-input"
                          value={expiryTime}
                          onChange={e => setExpiryTime(e.target.value)}
                          max="9999-12-31T23:59"
                          required={category === 'Medicine'}
                        />
                      </div>
                    )}

                    {category === 'Medicine' && (
                      <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isSealed}
                            onChange={e => setIsSealed(e.target.checked)}
                            style={{ accentColor: '#10b981', width: 18, height: 18 }}
                          />
                          <span>Medicine is <strong>sealed / unopened</strong> (required)</span>
                        </label>
                      </div>
                    )}

                    <div className="form-group">
                      <label>{t(lang, 'Location (City)', 'مقام (شہر)')} <span style={{ color: '#ef4444' }}>*</span></label>
                      <select className="custom-select" value={location} onChange={e => { setLocation(e.target.value); setLatLng(e.target.value); }} required>
                        <option value="" disabled>Select your city...</option>
                        <option value="Karachi">Karachi</option>
                        <option value="Lahore">Lahore</option>
                        <option value="Islamabad">Islamabad</option>
                        <option value="Peshawar">Peshawar</option>
                        <option value="Quetta">Quetta</option>
                        <option value="Multan">Multan</option>
                      </select>
                    </div>

                    {validationError && (
                      <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Sun size={15} /> {validationError}
                      </div>
                    )}

                    <button type="submit" className="btn btn-primary submit-donate-btn" disabled={!file || !location || !category || !donTitle || !itemType}>
                      {t(lang, 'Start AI Scan', 'اے آئی اسکین شروع کریں')} <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              </form>
            </section>
          </div>
        )}

        {/* ======================= AI DASHBOARD TAB ======================= */}
        {activeTab === 'ai_dashboard' && (
          <div className="animate-fade-in" style={{ paddingBottom: '2rem' }}>

            <div style={{ marginBottom: '2rem' }}>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 900, background: 'linear-gradient(135deg,#fff,#10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                <Activity size={26} style={{ color: '#10b981', WebkitTextFillColor: '#10b981' }} /> SpareShare AI Scanner
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>SpareShare AI analyzes your item for safety, condition, and best-match receivers.</p>
            </div>

            {/* SCANNING STATE */}
            {isScanning && (
              <div style={{ textAlign: 'center', padding: '5rem 2rem', background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 'var(--radius-xl)' }}>
                <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 2rem' }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(16,185,129,0.15)', animation: 'none' }} />
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid transparent', borderTopColor: '#10b981', animation: 'spin 1s linear infinite' }} />
                  <div style={{ position: 'absolute', inset: '15px', borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'rgba(16,185,129,0.5)', animation: 'spin 1.5s linear infinite reverse' }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ScanLine size={40} color="#10b981" />
                  </div>
                </div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem' }}>{t(lang, 'SpareShare AI Analyzing...', 'سپیئر شیئر اے آئی تجزیہ کر رہا ہے...')}</h2>
                <p style={{ color: 'var(--text-muted)', maxWidth: 380, margin: '0 auto', lineHeight: 1.7 }}>{t(lang, 'Running computer vision, safety assessment, and demand matching for', 'کمپیوٹر وژن، سیفٹی اسسمنٹ اور طلب کی مطابقت کا جائزہ لیا جا رہا ہے برائے')} <strong style={{ color: 'var(--primary)' }}>{category}</strong> {t(lang, 'in', 'میں')} <strong style={{ color: 'var(--primary)' }}>{location}</strong>.</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '2rem' }}>
                  {[t(lang, 'Scanning image...', 'تصویر اسکین ہو رہی ہے...'), t(lang, 'Checking safety...', 'حفاظت کی جانچ...'), t(lang, 'Matching demands...', 'مطالبات ملائے جا رہے...')].map((s, i) => (
                    <span key={i} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', padding: '4px 12px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600 }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* ERROR STATE */}
            {!isScanning && scanComplete && aiError && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-xl)', padding: '2rem', textAlign: 'center', color: '#f87171' }}>
                <p style={{ fontSize: '1rem', fontWeight: 600 }}>⚠️ {aiError}</p>
                <button className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={() => { setScanComplete(false); setAiError(''); setActiveTab('home'); }}>Try Again</button>
              </div>
            )}

            {/* RESULTS STATE */}
            {!isScanning && scanComplete && aiResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Status Hero Card */}
                <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-xl)', padding: '2rem', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}>
                  <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: 200, height: 200, background: 'radial-gradient(circle, rgba(255,255,255,0.07), transparent 70%)', pointerEvents: 'none' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <span style={{ background: 'rgba(255,255,255,0.15)', color: 'white', padding: '4px 12px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700 }}>✦ {t(lang, 'System Check', 'سسٹم چیک')}</span>
                        <span style={{ background: aiResult.recommendation === 'Accept' ? 'rgba(16,185,129,0.25)' : aiResult.recommendation === 'Review' ? 'rgba(234,179,8,0.25)' : 'rgba(239,68,68,0.25)', color: aiResult.recommendation === 'Accept' ? '#6ee7b7' : aiResult.recommendation === 'Review' ? '#fde047' : '#fca5a5', padding: '4px 12px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700, border: `1px solid ${aiResult.recommendation === 'Accept' ? 'rgba(16,185,129,0.4)' : aiResult.recommendation === 'Review' ? 'rgba(234,179,8,0.4)' : 'rgba(239,68,68,0.4)'}` }}>
                          {aiResult.recommendation === 'Accept' ? '✅' : aiResult.recommendation === 'Review' ? '⚠️' : '❌'} {aiResult.recommendation === 'Accept' ? t(lang, 'Approved', 'منظور شدہ') : aiResult.recommendation === 'Review' ? t(lang, 'Needs Review', 'جائزہ طلب') : t(lang, 'Rejected', 'مسترد')}
                        </span>
                        <span style={{ background: 'rgba(255,255,255,0.15)', color: 'white', padding: '4px 12px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700 }}>🎯 {t(lang, 'Score:', 'سکور:')} {aiResult.safetyScore}%</span>
                      </div>
                      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 900, color: 'white', marginBottom: '12px' }}>{aiResult.itemName}</h2>

                      <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '12px', marginTop: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '0.8rem', fontWeight: 700, color: '#6ee7b7' }}>
                          <ShieldCheck size={16} /> {t(lang, 'AI Analysis Report', 'اے آئی تجزیاتی رپورٹ')}
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>{aiResult.safetyNotes}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detail Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                  {[
                    { label: t(lang, 'Category', 'زمرہ'), value: aiResult.detectedCategory, icon: '📦' },
                    { label: t(lang, 'Condition', 'حالت'), value: aiResult.condition, icon: '🔍' },
                    { label: t(lang, 'Freshness', 'تازگی'), value: aiResult.freshness, icon: '🌿' },
                    { label: t(lang, 'Est. Quantity', 'تخمینہ مقدار'), value: aiResult.estimatedItems, icon: '📊' },
                  ].map(m => (
                    <div key={m.label} style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.75rem', marginBottom: '8px' }}>{m.icon}</div>
                      <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-dim)', fontWeight: 700, marginBottom: '4px' }}>{m.label}</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* AI Match Reason */}
                <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>🤖</span>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{t(lang, 'AI Recommendation', 'اے آئی تجویز')}</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>{t(lang, aiResult.matchReason, aiResult.matchReason)}</p>
                  </div>
                </div>

                {/* Item image preview */}
                {file?.preview && (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
                    <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-muted)' }}>📷 {t(lang, 'Scanned Image', 'اسکین شدہ تصویر')}</div>
                    <img src={file.preview} alt="Donated item" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }} />
                  </div>
                )}

                {/* Matched Demand Posts */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 'var(--radius-xl)', padding: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🎯 {t(lang, 'AI-Matched Receiver Demands', 'اے آئی سے مماثل وصول کنندگان کی مانگ')}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>{t(lang, 'Based on your', 'آپ کے')} <strong style={{ color: 'var(--primary)' }}>{category}</strong> {t(lang, 'donation, these receivers need your help most:', 'عطیے کی بنیاد پر، ان وصول کنندگان کو آپ کی سب سے زیادہ ضرورت ہے:')}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {(() => {
                      // Smart Matching Logic
                      let allPosts = receiverDemands || [];

                      // 1. FRONTEND SAFETY FILTER (MANDATORY CATEGORY MATCH)
                      let matchedPosts = allPosts.filter(post =>
                        (post.category || '').toLowerCase() === category.toLowerCase()
                      );

                      // 2. KEYWORD-BASED SMART MATCHING
                      if (aiKeywords && aiKeywords.length > 0) {
                        const keywordMatched = matchedPosts.filter(post => {
                          const titleStr = (post.title || '').toLowerCase();
                          const descStr = (post.desc || '').toLowerCase();
                          return aiKeywords.some(kw => {
                            const k = kw.toLowerCase();
                            return titleStr.includes(k) || descStr.includes(k);
                          });
                        });

                        // 3. Fallback: If keywords found matches, use them. Else, keep category-matched posts.
                        if (keywordMatched.length > 0) {
                          matchedPosts = keywordMatched;
                        }
                      }

                      if (matchedPosts.length === 0) {
                        return (
                          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 'var(--radius-lg)' }}>
                            {t(lang, 'No relevant receiver requests found for this item', 'اس آئٹم کے لیے کوئی متعلقہ وصول کنندہ کی درخواست نہیں ملی')}
                          </div>
                        );
                      }

                      return matchedPosts.slice(0, 5).map(post => (
                        <div key={post._id}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'all 0.2s', flexWrap: 'wrap' }}
                          onClick={() => setSelectedPost(post)}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)'; e.currentTarget.style.transform = 'translateX(4px)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateX(0)'; }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 200 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <UserCircle size={22} color="#10b981" />
                            </div>
                            <div>
                              <p style={{ fontWeight: 700, color: 'var(--text-main)', margin: 0, fontSize: '0.93rem' }}>{post.title}</p>
                              <p style={{ color: 'var(--text-dim)', margin: 0, fontSize: '0.78rem', marginTop: '2px' }}>{post.receiverId?.name || 'Verified NGO'} • {new Date(post.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <button className="btn btn-primary" style={{ padding: '7px 16px', fontSize: '0.82rem', flexShrink: 0 }}>
                            <Send size={13} /> {t(lang, 'Donate', 'عطیہ کریں')}
                          </button>
                        </div>
                      ));
                    })()}
                    {/* Empty state handled inside the IIFE above */}
                  </div>
                </div>

                {/* AI Smart Map Embedded Section */}
                <SmartMap
                  category={category}
                  userLat={donLat}
                  userLng={donLng}
                  aiStatus={aiResult.safetyScore >= 50 ? 'active' : 'rejected'}
                  onSelectReceiver={(rec) => setSelectedPost(rec)}
                />

                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setFile(null);
                      setScanComplete(false);
                      setAiResult(null);
                      setDonTitle('');
                      setActiveTab('home');
                    }}
                    style={{ padding: '12px 24px', fontWeight: 600 }}
                  >
                    <RefreshCw size={18} style={{ marginRight: '8px' }} /> {t(lang, 'Scan New Item', 'نئی آئٹم اسکین کریں')}
                  </button>
                </div>

              </div>
            )}

            {/* Default empty state (nothing scanned yet) */}
            {!isScanning && !scanComplete && (
              <div style={{ textAlign: 'center', padding: '5rem 2rem', background: 'var(--bg-card)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 'var(--radius-xl)', color: 'var(--text-muted)' }}>
                <ScanLine size={60} color="rgba(16,185,129,0.3)" style={{ margin: '0 auto 1.5rem', display: 'block' }} />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem' }}>{t(lang, 'No Scan Yet', 'ابھی تک کوئی اسکین نہیں')}</h3>
                <p style={{ maxWidth: 340, margin: '0 auto 1.5rem', lineHeight: 1.7 }}>{t(lang, 'Upload an item image from the Dashboard Home tab to run the AI safety scan.', 'اے آئی سیفٹی اسکین چلانے کے لیے ڈیش بورڈ ہوم ٹیب سے آئٹم کی تصویر اپ لوڈ کریں۔')}</p>
                <button className="btn btn-primary" onClick={() => setActiveTab('home')}>← {t(lang, 'Go to Dashboard', 'ڈیش بورڈ پر جائیں')}</button>
              </div>
            )}

          </div>
        )}

        {/* ======================= ZAKAT TAB ======================= */}
        {activeTab === 'zakat' && (
          <div className="zakat-tab-wrapper animate-fade-in" style={{ background: 'white', padding: '2rem', borderRadius: '16px' }}>
            <ZakatCalculator onDonate={() => setActiveTab('home')} />
          </div>
        )}

        {/* ======================= MY DONATIONS TAB ======================= */}
        {activeTab === 'my_donations' && (
          <div className="animate-fade-in" style={{ padding: '0.5rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h2 style={{ margin: 0 }}>{t(lang, 'My Donation History', 'میری عطیات کی تاریخ')}</h2>
                <span style={{ background: '#f0fdf4', color: '#065f46', borderRadius: 99, padding: '3px 12px', fontSize: '0.8rem', fontWeight: 700 }}>
                  {myDonations.length} total
                </span>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => { setActiveTab('home'); setFile(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <UploadCloud size={16} /> {t(lang, 'New Donation', 'نیا عطیہ')}
              </button>
            </div>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>{t(lang, "Track all donation requests you've submitted and their current status.", 'آپ کی جمع کرائی گئی تمام عطیات کی درخواستوں اور ان کی موجودہ حیثیت کو ٹریک کریں۔')}</p>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <button
                style={{ background: historyTab === 'active' ? '#10b981' : 'transparent', color: historyTab === 'active' ? 'white' : '#64748b', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => setHistoryTab('active')}
              >
                {t(lang, 'Active / Pending', 'زیر التوا')}
              </button>
              <button
                style={{ background: historyTab === 'completed' ? '#3b82f6' : 'transparent', color: historyTab === 'completed' ? 'white' : '#64748b', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => setHistoryTab('completed')}
              >
                {t(lang, 'Completed', 'مکمل شدہ')}
              </button>
              <button
                style={{ background: historyTab === 'rejected' ? '#ef4444' : 'transparent', color: historyTab === 'rejected' ? 'white' : '#64748b', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => setHistoryTab('rejected')}
              >
                {t(lang, 'Rejected', 'مسترد شدہ')}
              </button>
            </div>

            {myDonations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#f8fafc', borderRadius: 16, border: '1px dashed #e2e8f0' }}>
                <Heart size={48} color="#cbd5e1" style={{ margin: '0 auto 1rem', display: 'block' }} />
                <h3 style={{ color: '#94a3b8', marginBottom: '0.5rem' }}>No Donations Yet</h3>
                <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Start donating to help organizations in need.</p>
                <button className="btn btn-primary" onClick={() => setActiveTab('home')}>New Donation →</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {myDonations.filter(d => {
                  if (historyTab === 'rejected') return d.status === 'rejected';
                  if (historyTab === 'completed') return d.status === 'completed' || d.status === 'delivered';
                  return d.status !== 'rejected' && d.status !== 'completed' && d.status !== 'delivered';
                }).map(don => {
                  const status = don.status;
                  const statusConfig = {
                    pending_receiver: { label: '⏳ Pending Review', bg: '#fef9c3', color: '#713f12' },
                    accepted: { label: '✅ Accepted', bg: '#d1fae5', color: '#065f46' },
                    rejected: { label: '❌ Rejected', bg: '#fee2e2', color: '#991b1b' },
                    delivered: { label: '🚚 Delivered', bg: '#dbeafe', color: '#1e40af' },
                    completed: { label: '🎉 Completed', bg: '#dcfce3', color: '#166534' },
                  }[status] || { label: status, bg: '#f1f5f9', color: '#475569' };

                  return (
                    <div key={don._id} style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => setSelectedHistoryDonation(don)} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                      {/* Status bar */}
                      <div style={{ background: statusConfig.bg, padding: '8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: statusConfig.color, fontWeight: 700, fontSize: '0.85rem' }}>{statusConfig.label}</span>
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{new Date(don.createdAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div style={{ padding: '1.25rem 1.5rem' }}>
                        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          {/* Donation image */}
                          {don.imageUrl ? (
                            <img src={don.imageUrl} alt="Donation" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 10, border: '2px solid #e2e8f0', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
                          ) : (
                            <div style={{ width: 90, height: 90, borderRadius: 10, background: '#f0fdf4', border: '2px solid #d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Heart size={36} color="#10b981" />
                            </div>
                          )}

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 180 }}>
                            <p style={{ fontWeight: 700, color: '#0f172a', margin: '0 0 6px', fontSize: '1.1rem' }}>{don.title}</p>
                            <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#64748b' }}>Category: <strong style={{ color: '#10b981' }}>{don.category || 'General'}</strong></p>
                            <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#64748b' }}>AI Safety Score: <strong style={{ color: don.status === 'rejected' ? '#ef4444' : '#10b981' }}>{don.aiSafetyScore}%</strong></p>

                            {don.status === 'rejected' && (
                              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', display: 'inline-block' }}>
                                <p style={{ margin: 0, color: '#991b1b', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.4 }}>{don.aiAnalysisReason}</p>
                              </div>
                            )}

                            {/* Action Buttons */}
                            {(historyTab === 'active') && (
                              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                                <button onClick={(e) => handleUpdateStatus(don._id, 'completed', e)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Mark Completed</button>
                                <button onClick={(e) => handleDeleteDonation(don._id, e)} style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '6px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                              </div>
                            )}
                            {(historyTab === 'rejected') && (
                              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                                <button onClick={(e) => handleDeleteDonation(don._id, e)} style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '6px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Delete Record</button>
                              </div>
                            )}
                          </div>

                          {/* Receiver info */}
                          {don.status === 'completed' && don.receiverId ? (
                            <div
                              style={{ background: '#f0fdf4', borderRadius: 12, padding: '1.2rem', minWidth: 240, border: '2px solid #10b981', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(16,185,129,0.1)' }}
                              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                              onClick={(e) => { e.stopPropagation(); navigate(`/organization/${don.receiverId._id}`); }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <p style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>🎉 Donated To</p>
                                <ArrowRight size={14} color="#10b981" />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                {don.receiverId.profilePic ? (
                                  <img src={don.receiverId.profilePic} alt="org" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#064e3b,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Building2 size={20} color="white" />
                                  </div>
                                )}
                                <div>
                                  <p style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{don.receiverId.name}</p>
                                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{don.receiverId.city || 'Verified NGO'}</p>
                                </div>
                              </div>
                              <div style={{ borderTop: '1px solid #d1fae5', paddingTop: '10px', marginTop: '6px' }}>
                                <button style={{ width: '100%', background: '#10b981', color: 'white', border: 'none', padding: '8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                                  👉 View Organization Details
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {myDonations.filter(d => {
                  if (historyTab === 'rejected') return d.status === 'rejected';
                  if (historyTab === 'completed') return d.status === 'completed' || d.status === 'delivered';
                  return d.status !== 'rejected' && d.status !== 'completed' && d.status !== 'delivered';
                }).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>No {historyTab} donations found.</div>
                  )}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Receiver Post Details Modal */}
      {selectedPost && (
        <div className="modal-overlay" onClick={() => setSelectedPost(null)}>
          <div className="modal-content post-modal" onClick={e => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setSelectedPost(null)}><X size={20} /></button>
            <div className="post-modal-header">
              <UserCircle size={48} color="#0f172a" />
              <div>
                <h2>{selectedPost.receiverId?.name || 'Verified NGO'}</h2>
                <p className="badge-verified"><ShieldCheck size={14} /> SpareShare AI Verified</p>
              </div>
            </div>

            <div className="post-modal-body">
              <div className="pm-demand-box" style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', marginBottom: '15px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '1rem', color: '#1e293b' }}>Receiver Details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.9rem', color: '#475569' }}>
                  <div><strong style={{ color: '#1e293b' }}>Name:</strong> {selectedPost.receiverId?.name || 'NGO'}</div>
                  <div><strong style={{ color: '#1e293b' }}>City:</strong> {selectedPost.receiverId?.city || 'Pakistan'}</div>
                  <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: '#1e293b' }}>Email:</strong> {selectedPost.receiverId?.email || 'N/A'}</div>
                </div>
              </div>

              <div className="pm-demand-box">
                <h3>{t(lang, "Receiver's Demand", 'وصول کنندہ کی مانگ')}</h3>
                <p className="pm-demand-text">"{selectedPost.title}"</p>
                <div className="pm-meta">
                  <span><Clock size={14} /> {new Date(selectedPost.createdAt).toLocaleDateString()}</span>
                  <span className="urgency-badge">{selectedPost.urgency} Urgency</span>
                </div>
              </div>

              <div className="pm-proof">
                <h3><ImageIcon size={18} /> {t(lang, 'Description', 'تفصیل')}</h3>
                <p className="pm-proof-desc" style={{ fontSize: '1rem', color: '#334155' }}>{selectedPost.desc}</p>
              </div>

              <div className="pm-actions">
                <button className="btn btn-outline" onClick={() => setSelectedPost(null)}>{t(lang, 'Cancel', 'منسوخ کریں')}</button>
                <button className="btn btn-primary" onClick={() => handleSendNotification(selectedPost)}>
                  <Send size={18} /> {t(lang, 'Dispatch My Donation Here', 'میرا عطیہ یہاں بھیجیں')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Donation Details Modal */}
      {selectedHistoryDonation && (
        <div className="modal-overlay" onClick={() => setSelectedHistoryDonation(null)}>
          <div className="modal-content post-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, padding: 0, overflow: 'hidden' }}>
            <div style={{ position: 'relative' }}>
              {selectedHistoryDonation.imageUrl ? (
                <img src={selectedHistoryDonation.imageUrl} alt="Donation" style={{ width: '100%', height: 200, objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
              ) : (
                <div style={{ width: '100%', height: 200, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={48} color="#94a3b8" />
                </div>
              )}
              <button className="close-modal" onClick={() => setSelectedHistoryDonation(null)} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', padding: 6, cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <h2 style={{ margin: '0 0 8px', fontSize: '1.4rem', color: '#0f172a' }}>{selectedHistoryDonation.title}</h2>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: 99, fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>{selectedHistoryDonation.category}</span>
                <span style={{ background: selectedHistoryDonation.status === 'rejected' ? '#fef2f2' : selectedHistoryDonation.status === 'completed' ? '#f0fdf4' : '#e0f2fe', padding: '4px 10px', borderRadius: 99, fontSize: '0.8rem', color: selectedHistoryDonation.status === 'rejected' ? '#ef4444' : selectedHistoryDonation.status === 'completed' ? '#10b981' : '#0ea5e9', fontWeight: 600 }}>
                  {selectedHistoryDonation.status.toUpperCase()}
                </span>
              </div>

              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', marginBottom: '15px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '1rem', color: '#1e293b' }}>Donation Details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.9rem', color: '#475569' }}>
                  <div><strong style={{ color: '#1e293b' }}>Condition:</strong> {selectedHistoryDonation.condition || 'N/A'}</div>
                  <div><strong style={{ color: '#1e293b' }}>Quantity:</strong> {selectedHistoryDonation.quantity || 'N/A'}</div>
                  <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: '#1e293b' }}>Description:</strong> {selectedHistoryDonation.description || 'N/A'}</div>
                </div>
              </div>

              <div style={{ background: selectedHistoryDonation.status === 'rejected' ? '#fef2f2' : '#f0fdf4', border: `1px solid ${selectedHistoryDonation.status === 'rejected' ? '#fecaca' : '#a7f3d0'}`, borderRadius: '10px', padding: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <ShieldCheck size={18} color={selectedHistoryDonation.status === 'rejected' ? '#ef4444' : '#10b981'} />
                  <strong style={{ color: selectedHistoryDonation.status === 'rejected' ? '#ef4444' : '#10b981' }}>AI Safety Report (Score: {selectedHistoryDonation.aiSafetyScore}%)</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
                  {selectedHistoryDonation.aiAnalysisReason}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// Quick helper

export default ContributorPortal;
