import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { X, Filter, MapPin, Clock, Package, Loader2, AlertCircle, List } from 'lucide-react';
import CustomDropdown from '../components/CustomDropdown';
import './MapPage.css';

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : (import.meta.env.VITE_API_URL || 'https://spareshare-ai.up.railway.app');
const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const CATEGORY_ICONS_EMOJI = { Food: '🍛', Medicine: '💊', Clothes: '👕', Grocery: '🛒' };
const CATEGORY_COLORS_HEX = { Food: '#10b981', Medicine: '#ef4444', Clothes: '#3b82f6', Grocery: '#f59e0b' };

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getTimeLeft(expiryTime) {
  const diff = new Date(expiryTime) - Date.now();
  if (diff <= 0) return { text: 'Expired', urgent: true };
  const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
  if (h < 1) return { text: `${m}m left`, urgent: true };
  if (h < 3) return { text: `${h}h ${m}m left`, urgent: true };
  return { text: `${h}h left`, urgent: false };
}

// Dynamically load Google Maps script
function loadGoogleMaps(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(window.google.maps); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
}

export default function MapPage() {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);

  const [donations, setDonations] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [userLat, setUserLat] = useState(24.8607);
  const [userLng, setUserLng] = useState(67.0011);
  const [locDetected, setLocDetected] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState('');
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [maxKm, setMaxKm] = useState(50);
  const [selectedDon, setSelectedDon] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [showList, setShowList] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [aiStats, setAiStats] = useState(null);

  // 1. Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
          setLocDetected(true);
        },
        () => setLocDetected(false)
      );
    }
  }, []);

  // 2. Fetch donations
  useEffect(() => {
    const fetchDonations = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/api/donations/nearby?lat=${userLat}&lng=${userLng}&radius=${maxKm}&category=${category}`);
        // Backend returns { donations, aiStats }
        setDonations(res.data.donations || res.data);
        if (res.data.aiStats) {
          setAiStats(res.data.aiStats);
        }
      } catch {
        // fallback to empty
      } finally {
        setLoading(false);
      }
    };
    fetchDonations();
  }, []);

  // 3. Filter donations client-side
  useEffect(() => {
    // Note: /nearby already filters by AI radius, we just sort and apply local maxKm for display
    let result = donations;
    if (category !== 'All') result = result.filter(d => d.category === category);
    result = result
      .map(d => ({ ...d, distanceKm: Math.round(haversineKm(userLat, userLng, d.location?.lat || 0, d.location?.lng || 0) * 10) / 10 }))
      .filter(d => {
        // If AI applied a stricter radius, it's already filtered by backend, but we enforce the local UI maxKm too
        return d.distanceKm <= maxKm;
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
    setFiltered(result);
  }, [donations, category, maxKm, userLat, userLng]);

  // 4. Load and init Google Map
  useEffect(() => {
    if (!GMAPS_KEY || GMAPS_KEY === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      setMapError('Google Maps API key not configured. Add VITE_GOOGLE_MAPS_API_KEY to frontend/.env');
      return;
    }
    loadGoogleMaps(GMAPS_KEY)
      .then(maps => {
        if (!mapRef.current) return;
        const map = new maps.Map(mapRef.current, {
          center: { lat: userLat, lng: userLng },
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [
            { elementType: 'geometry', stylers: [{ color: '#0f1b0d' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#7a8a7a' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#0f1b0d' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2e1a' }] },
            { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0d1f0d' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1628' }] },
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          ],
        });
        googleMapRef.current = map;
        infoWindowRef.current = new maps.InfoWindow();

        // User location marker
        new maps.Marker({
          position: { lat: userLat, lng: userLng },
          map,
          icon: {
            path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
            fillColor: '#3b82f6',
            fillOpacity: 1,
            strokeWeight: 1.5,
            strokeColor: 'white',
            scale: 1.8,
            anchor: new maps.Point(12, 22),
          },
          title: 'Your Location',
          zIndex: 999,
        });

        setMapLoaded(true);
      })
      .catch(err => setMapError(err.message));
  }, [userLat, userLng]);

  // 5. Place donation markers whenever filtered changes
  useEffect(() => {
    if (!googleMapRef.current || !mapLoaded) return;
    const maps = window.google.maps;

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    filtered.forEach(don => {
      if (!don.location?.lat || !don.location?.lng) return;
      const color = CATEGORY_COLORS_HEX[don.category] || '#10b981';
      const emoji = CATEGORY_ICONS_EMOJI[don.category] || '📦';
      const timeLeft = getTimeLeft(don.expiryTime);

      const marker = new maps.Marker({
        position: { lat: don.location.lat, lng: don.location.lng },
        map: googleMapRef.current,
        icon: {
          path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
          fillColor: color,
          fillOpacity: 0.9,
          strokeWeight: 1.5,
          strokeColor: 'white',
          scale: 1.8,
          anchor: new maps.Point(12, 22),
        },
        title: don.title,
      });

      marker.addListener('click', () => {
        setSelectedDon({ ...don, distanceKm: don.distanceKm });
        // InfoWindow popup
        infoWindowRef.current.setContent(`
          <div style="font-family:Inter,sans-serif;padding:8px;max-width:200px;background:#0f172a;color:white;border-radius:8px;">
            <div style="font-size:1.2rem;margin-bottom:4px">${emoji}</div>
            <strong style="color:white;font-size:0.9rem">${don.title}</strong>
            <div style="color:${color};font-size:0.75rem;margin-top:4px">${don.category}</div>
            <div style="color:#94a3b8;font-size:0.75rem;margin-top:4px">⏱ ${timeLeft.text}</div>
            <div style="color:#94a3b8;font-size:0.75rem">📍 ${don.distanceKm} km away</div>
          </div>
        `);
        infoWindowRef.current.open(googleMapRef.current, marker);
      });

      markersRef.current.push(marker);
    });
  }, [filtered, mapLoaded]);

  const handleRequest = async (donationId) => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/auth/login'); return; }
    setRequesting(true);
    try {
      await axios.post(`${API}/api/requests`, { donationId, message: 'I would like to request this donation.' }, { headers: { 'x-auth-token': token } });
      alert('✅ Request sent! The donor will be notified.');
      setSelectedDon(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send request.');
    } finally {
      setRequesting(false);
    }
  };

  const panToMarker = (don) => {
    if (!googleMapRef.current || !don.location?.lat) return;
    googleMapRef.current.panTo({ lat: don.location.lat, lng: don.location.lng });
    googleMapRef.current.setZoom(15);
    setSelectedDon(don);
  };

  return (
    <div className="map-page">
      {/* Top Controls */}
      <div className="map-controls">
        <div className="mc-left">
          <h2>🗺️ Donation Map</h2>
          <span className="mc-count">{filtered.length} active nearby</span>
        </div>
        <div className="mc-filters">
          {['All', 'Food', 'Medicine', 'Clothes', 'Grocery'].map(cat => (
            <button key={cat} className={`mc-cat ${category === cat ? 'active' : ''}`} onClick={() => setCategory(cat)}>
              {CATEGORY_ICONS_EMOJI[cat] || '🔍'} {cat}
            </button>
          ))}
          <CustomDropdown
            value={maxKm}
            onChange={setMaxKm}
            options={[
              { value: 5, label: '5 km' },
              { value: 10, label: '10 km' },
              { value: 25, label: '25 km' },
              { value: 50, label: '50 km' }
            ]}
            style={{ width: '120px', padding: '8px 12px' }}
          />
        </div>
        <button className="mc-list-toggle" onClick={() => setShowList(v => !v)}>
          <List size={16} /> {showList ? 'Hide List' : 'Show List'}
        </button>
      </div>

      {aiStats && aiStats.temperature > 30 && category !== 'Medicine' && category !== 'Clothes' && (
        <div style={{ background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.2)', padding: '10px 20px', color: '#fbbf24', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 11 }}>
          <AlertCircle size={16} />
          <strong>AI Weather Alert ({aiStats.temperature}°C):</strong> {aiStats.message}
        </div>
      )}

      <div className="map-layout">
        {/* Left: List Panel */}
        {showList && (
          <div className="map-list-panel">
            {loading ? (
              <div className="map-list-loading"><Loader2 size={28} className="spin" /><p>Loading...</p></div>
            ) : filtered.length === 0 ? (
              <div className="map-list-empty">
                <p>No donations in this area.</p>
                <button onClick={() => setMaxKm(50)}>Expand radius to 50km</button>
              </div>
            ) : (
              filtered.map(don => {
                const tl = getTimeLeft(don.expiryTime);
                const color = CATEGORY_COLORS_HEX[don.category] || '#10b981';
                return (
                  <div
                    key={don._id}
                    className={`map-list-item ${selectedDon?._id === don._id ? 'active' : ''}`}
                    onClick={() => panToMarker(don)}
                    onMouseEnter={() => setHoveredId(don._id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <div className="mli-cat-dot" style={{ background: color }} />
                    <div className="mli-info">
                      <span className="mli-title">{don.title}</span>
                      <span className="mli-meta">
                        {CATEGORY_ICONS_EMOJI[don.category]} {don.category}
                        {don.distanceKm !== undefined && <> · <MapPin size={11} /> {don.distanceKm} km</>}
                      </span>
                      <span className={`mli-expiry ${tl.urgent ? 'urgent' : ''}`}>
                        <Clock size={11} /> {tl.text}
                      </span>
                    </div>
                    {don.imageUrl && (
                      <img src={don.imageUrl} alt="" className="mli-thumb" onError={e => e.target.style.display = 'none'} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Right: Map */}
        <div className="map-container">
          {mapError ? (
            <div className="map-error-state">
              <AlertCircle size={48} color="#f59e0b" />
              <h3>Map Not Available</h3>
              <p>{mapError}</p>
              <div className="map-error-steps">
                <p><strong>To enable Google Maps:</strong></p>
                <ol>
                  <li>Visit <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer">console.cloud.google.com</a></li>
                  <li>Enable "Maps JavaScript API"</li>
                  <li>Create an API Key under Credentials</li>
                  <li>Add to <code>frontend/.env</code>: <br /><code>VITE_GOOGLE_MAPS_API_KEY=your_key</code></li>
                  <li>Restart the dev server</li>
                </ol>
              </div>
            </div>
          ) : (
            <>
              <div ref={mapRef} className="google-map" />
              {!mapLoaded && (
                <div className="map-loading-overlay">
                  <Loader2 size={40} className="spin" />
                  <p>Loading map...</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Donation Detail Drawer */}
      {selectedDon && (
        <div className="map-drawer">
          <button className="map-drawer-close" onClick={() => setSelectedDon(null)}><X size={18} /></button>
          <div className="map-drawer-inner">
            {selectedDon.imageUrl && (
              <img src={selectedDon.imageUrl} alt={selectedDon.title} className="md-img" onError={e => e.target.style.display = 'none'} />
            )}
            <div style={{ fontSize: '1.5rem', margin: '4px 0' }}>
              {CATEGORY_ICONS_EMOJI[selectedDon.category]}
            </div>
            <span className="md-cat" style={{ color: CATEGORY_COLORS_HEX[selectedDon.category] }}>
              {selectedDon.category}
            </span>
            <h3 className="md-title">{selectedDon.title}</h3>
            {selectedDon.description && <p className="md-desc">{selectedDon.description}</p>}
            <div className="md-stats">
              {selectedDon.distanceKm !== undefined && (
                <div className="md-stat"><MapPin size={14} /> {selectedDon.distanceKm} km away</div>
              )}
              <div className={`md-stat ${getTimeLeft(selectedDon.expiryTime).urgent ? 'urgent' : ''}`}>
                <Clock size={14} /> {getTimeLeft(selectedDon.expiryTime).text}
              </div>
              {selectedDon.quantity && (
                <div className="md-stat"><Package size={14} /> {selectedDon.quantity}</div>
              )}
              <div className="md-stat">🛡️ AI: {selectedDon.aiSafetyScore}%</div>
            </div>
            <button className="md-request-btn" onClick={() => handleRequest(selectedDon._id)} disabled={requesting}>
              {requesting ? <><Loader2 size={14} className="spin" /> Sending...</> : '✋ Request Donation'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
