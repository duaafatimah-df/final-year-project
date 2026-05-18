import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, Filter, MapPin, Clock, Package, AlertCircle, X, Loader2, Map } from 'lucide-react';
import './BrowsePage.css';

const API = 'http://localhost:5000';

const CATEGORY_ICONS = {
  Food:     '🍛',
  Medicine: '💊',
  Clothes:  '👕',
  Grocery:  '🛒',
};

const CATEGORY_COLORS = {
  Food:     { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', text: '#10b981' },
  Medicine: { bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.3)',  text: '#f87171' },
  Clothes:  { bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.3)', text: '#60a5fa' },
  Grocery:  { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.3)', text: '#fbbf24' },
};

function getTimeLeft(expiryTime) {
  const diff = new Date(expiryTime) - Date.now();
  if (diff <= 0) return { text: 'Expired', urgent: true };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h < 1) return { text: `${m}m left`, urgent: true };
  if (h < 3) return { text: `${h}h ${m}m left`, urgent: true };
  return { text: `${h}h left`, urgent: false };
}

export default function BrowsePage() {
  const navigate = useNavigate();
  const [donations, setDonations]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [category, setCategory]     = useState('All');
  const [expirySoon, setExpirySoon] = useState(false);
  const [maxKm, setMaxKm]           = useState(50);
  const [userLat, setUserLat]       = useState(null);
  const [userLng, setUserLng]       = useState(null);
  const [locStatus, setLocStatus]   = useState('idle'); // idle | loading | done | denied
  const [selectedDon, setSelectedDon] = useState(null);
  const [requesting, setRequesting] = useState(false);

  // Get user location
  useEffect(() => {
    setLocStatus('loading');
    if (!navigator.geolocation) {
      setLocStatus('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setLocStatus('done');
      },
      () => setLocStatus('denied')
    );
  }, []);

  const fetchDonations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const activeLang = localStorage.getItem('language') || 'en';
      const params = { category, lang: activeLang };
      if (userLat && userLng) { params.lat = userLat; params.lng = userLng; params.maxKm = maxKm; }
      if (expirySoon) params.expiringSoon = 'true';
      const res = await axios.get(`${API}/api/donations/browse`, { params });
      setDonations(res.data);
    } catch (err) {
      setError('Could not load donations. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [category, userLat, userLng, maxKm, expirySoon]);

  useEffect(() => { fetchDonations(); }, [fetchDonations]);

  // Client-side title search filter
  const filtered = donations.filter(d =>
    d.title?.toLowerCase().includes(search.toLowerCase()) ||
    d.category?.toLowerCase().includes(search.toLowerCase())
  );

  const handleRequest = async (donationId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/auth/login');
      return;
    }
    setRequesting(true);
    try {
      await axios.post(`${API}/api/requests`, {
        donationId,
        message: 'I would like to request this donation.'
      }, { headers: { 'x-auth-token': token } });
      alert('✅ Request sent successfully! The donor will be notified.');
      setSelectedDon(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send request. Please try again.');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="browse-page">
      {/* Header */}
      <div className="browse-header">
        <div className="browse-header-inner">
          <div>
            <h1>Browse Donations</h1>
            <p>Find food, medicine, clothes and more near you — for free</p>
          </div>
          <button className="browse-map-btn" onClick={() => navigate('/map')}>
            <Map size={18} /> View on Map
          </button>
        </div>
      </div>

      <div className="browse-body container">
        {/* Filters Bar */}
        <div className="browse-filters">
          {/* Search */}
          <div className="bf-search">
            <Search size={16} className="bf-search-icon" />
            <input
              type="text"
              placeholder="Search donations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="bf-clear" onClick={() => setSearch('')}><X size={14} /></button>}
          </div>

          {/* Category Tabs */}
          <div className="bf-cats">
            {['All', 'Food', 'Medicine', 'Clothes', 'Grocery'].map(cat => (
              <button
                key={cat}
                className={`bf-cat-btn ${category === cat ? 'active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {CATEGORY_ICONS[cat] || '🔍'} {cat}
              </button>
            ))}
          </div>

          {/* Distance + expiry filters */}
          <div className="bf-controls">
            <label className="bf-control">
              <MapPin size={14} /> Max Distance:
              <select value={maxKm} onChange={e => setMaxKm(Number(e.target.value))}>
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
                <option value={25}>25 km</option>
                <option value={50}>50 km</option>
              </select>
            </label>
            <label className="bf-toggle">
              <input type="checkbox" checked={expirySoon} onChange={e => setExpirySoon(e.target.checked)} />
              <Clock size={14} /> Expiring Soon
            </label>
            {locStatus === 'denied' && (
              <span className="bf-loc-warn">
                <AlertCircle size={13} /> Location denied — distance filter inactive
              </span>
            )}
            {locStatus === 'done' && (
              <span className="bf-loc-ok">
                <MapPin size={13} /> Location detected
              </span>
            )}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="browse-loading">
            <Loader2 size={40} className="spin" />
            <p>Loading donations...</p>
          </div>
        ) : error ? (
          <div className="browse-error">
            <AlertCircle size={36} />
            <p>{error}</p>
            <button onClick={fetchDonations}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="browse-empty">
            <div className="browse-empty-icon">📭</div>
            <h3>No donations found</h3>
            <p>Try changing your filters or check back soon.</p>
          </div>
        ) : (
          <>
            <div className="browse-count">
              Showing <strong>{filtered.length}</strong> donation{filtered.length !== 1 ? 's' : ''}
            </div>
            <div className="browse-grid">
              {filtered.map(don => {
                const timeLeft = getTimeLeft(don.expiryTime);
                const colors = CATEGORY_COLORS[don.category] || CATEGORY_COLORS.Grocery;
                return (
                  <div
                    key={don._id}
                    className="don-card"
                    onClick={() => setSelectedDon(don)}
                  >
                    {/* Image */}
                    <div className="don-card-img">
                      {don.imageUrl ? (
                        <img src={don.imageUrl} alt={don.title} onError={e => e.target.style.display = 'none'} />
                      ) : (
                        <div className="don-img-placeholder">
                          <span>{CATEGORY_ICONS[don.category] || '📦'}</span>
                        </div>
                      )}
                      <div className="don-cat-badge" style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}>
                        {CATEGORY_ICONS[don.category]} {don.category}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="don-card-body">
                      <h3 className="don-title">{don.title}</h3>
                      {don.description && <p className="don-desc">{don.description}</p>}

                      <div className="don-meta">
                        {don.quantity && (
                          <span className="don-meta-item">
                            <Package size={13} /> {don.quantity}
                          </span>
                        )}
                        {don.distanceKm !== undefined && (
                          <span className="don-meta-item">
                            <MapPin size={13} /> {don.distanceKm} km
                          </span>
                        )}
                        {don.location?.address && (
                          <span className="don-meta-item">
                            <MapPin size={13} /> {don.location.address}
                          </span>
                        )}
                      </div>

                      <div className="don-footer">
                        <span className={`don-expiry ${timeLeft.urgent ? 'urgent' : ''}`}>
                          <Clock size={12} /> {timeLeft.text}
                        </span>
                        <button className="don-request-btn" onClick={e => { e.stopPropagation(); setSelectedDon(don); }}>
                          Request
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedDon && (
        <div className="browse-modal-overlay" onClick={() => setSelectedDon(null)}>
          <div className="browse-modal" onClick={e => e.stopPropagation()}>
            <button className="browse-modal-close" onClick={() => setSelectedDon(null)}>
              <X size={20} />
            </button>

            {selectedDon.imageUrl && (
              <img src={selectedDon.imageUrl} alt={selectedDon.title} className="bm-img" onError={e => e.target.style.display = 'none'} />
            )}

            <div className="bm-body">
              <div className="bm-cat" style={{
                background: CATEGORY_COLORS[selectedDon.category]?.bg,
                color: CATEGORY_COLORS[selectedDon.category]?.text,
                border: `1px solid ${CATEGORY_COLORS[selectedDon.category]?.border}`
              }}>
                {CATEGORY_ICONS[selectedDon.category]} {selectedDon.category}
              </div>

              <h2 className="bm-title">{selectedDon.title}</h2>
              {selectedDon.description && <p className="bm-desc">{selectedDon.description}</p>}

              <div className="bm-details">
                {selectedDon.quantity && (
                  <div className="bm-detail-row">
                    <Package size={16} />
                    <span>Quantity: <strong>{selectedDon.quantity}</strong></span>
                  </div>
                )}
                <div className="bm-detail-row">
                  <Clock size={16} />
                  <span style={{ color: getTimeLeft(selectedDon.expiryTime).urgent ? '#f87171' : 'inherit' }}>
                    Expires: <strong>{getTimeLeft(selectedDon.expiryTime).text}</strong>
                  </span>
                </div>
                {selectedDon.distanceKm !== undefined && (
                  <div className="bm-detail-row">
                    <MapPin size={16} />
                    <span>Distance: <strong>{selectedDon.distanceKm} km away</strong></span>
                  </div>
                )}
                {selectedDon.location?.address && (
                  <div className="bm-detail-row">
                    <MapPin size={16} />
                    <span>{selectedDon.location.address}</span>
                  </div>
                )}
                {selectedDon.aiAnalysisReason && (
                  <div className="bm-detail-row">
                    <span>🛡️ <strong style={{ color: '#10b981' }}>{selectedDon.aiAnalysisReason}</strong></span>
                  </div>
                )}
              </div>

              <button
                className="bm-request-btn"
                onClick={() => handleRequest(selectedDon._id)}
                disabled={requesting}
              >
                {requesting ? <><Loader2 size={16} className="spin" /> Sending...</> : '✋ Request This Donation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
