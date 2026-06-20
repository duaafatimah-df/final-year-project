import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Loader2, AlertCircle, MapPin, CheckCircle } from 'lucide-react';

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : (import.meta.env.VITE_API_URL || 'https://spareshare-ai.up.railway.app');
const GMAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) { resolve(window.L); return; }
    
    // Load CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    
    // Load JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      if (window.L) {
        resolve(window.L);
      } else {
        reject(new Error('Leaflet loaded but L is not defined'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Leaflet script'));
    document.head.appendChild(script);
  });
}
// Ye function loadLeaflet ke bilkul neechay add karo
function loadGoogleMaps(apiKey) {
  return new Promise((resolve, reject) => {
    // Agar pehle se load hai toh wahi return kar do
    if (window.google && window.google.maps) {
      resolve(window.google.maps);
      return;
    }
    
    // Check if script is already present in DOM (i.e. currently loading)
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkInterval);
          resolve(window.google.maps);
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        if (window.google && window.google.maps) {
          resolve(window.google.maps);
        } else {
          reject(new Error('Google Maps script loading timed out'));
        }
      }, 10000);
      return;
    }
    
    // Naya script tag banao Google Maps ke liye
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error('Google Maps loaded but google.maps is undefined'));
      }
    };
    
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });
}

export default function SmartMap({ category, userLat, userLng, aiStatus, onSelectReceiver, receiverList }) {
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);

  // Leaflet references
  const leafletMapRef = useRef(null);
  const leafletMarkersRef = useRef([]);

  const [receivers, setReceivers] = useState([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiStats, setAiStats] = useState(null);
  const [useLeaflet, setUseLeaflet] = useState(false);
  const [weatherCondition, setWeatherCondition] = useState('Rainy');

  const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };

  // Filter based on status
  const isRejected = aiStatus === 'rejected';

  useEffect(() => {
    if (receiverList) {
      setReceivers(receiverList);
      setLoading(false);
      return;
    }
    const fetchNearby = async () => {
      setLoading(true);
      try {
        const rad = isRejected ? 5 : 50; // default max radius
        const res = await axios.get(`${API}/api/posts/nearby?lat=${userLat}&lng=${userLng}&radius=${rad}&category=${category}`);
        setReceivers(res.data.receivers || []);
        if (res.data.aiStats) {
          setAiStats(res.data.aiStats);
        }
      } catch (err) {
        console.error(rec => rec, err);
      } finally {
        setLoading(false);
      }
    };
    if (userLat && userLng) {
      fetchNearby();
    }
  }, [userLat, userLng, category, isRejected, receiverList]);

  // Handle Google Maps authentication failures globally
  useEffect(() => {
    const prevAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
      console.warn("Google Maps Auth failure detected. Falling back to Leaflet.");
      setUseLeaflet(true);
      if (prevAuthFailure) prevAuthFailure();
    };
    return () => {
      window.gm_authFailure = prevAuthFailure;
    };
  }, []);

  useEffect(() => {
    if (!userLat || !userLng) return;

    if (!GMAPS_KEY || GMAPS_KEY === 'YOUR_GOOGLE_MAPS_API_KEY_HERE' || GMAPS_KEY === '' || useLeaflet) {
      setUseLeaflet(true);
      loadLeaflet()
        .then(L => {
          if (!mapRef.current) return;
          if (leafletMapRef.current) {
            leafletMapRef.current.remove();
          }
          mapRef.current.innerHTML = ''; // Clear existing DOM content (e.g. GMaps elements)
          const map = L.map(mapRef.current).setView([userLat, userLng], isRejected ? 14 : 12);
          L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
          }).addTo(map);
          leafletMapRef.current = map;
          setMapLoaded(true);
        })
        .catch(err => setMapError('Failed to load map: ' + err.message));
    } else {
      setUseLeaflet(false);
      loadGoogleMaps(GMAPS_KEY)
        .then(maps => {
          if (!mapRef.current) return;
          mapRef.current.innerHTML = ''; // Clear Leaflet elements if any
          const map = new maps.Map(mapRef.current, {
            center: { lat: userLat, lng: userLng },
            zoom: isRejected ? 14 : 12,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            styles: [
              { elementType: 'geometry', stylers: [{ color: '#111827' }] },
              { elementType: 'labels.text.stroke', stylers: [{ color: '#111827' }] },
              { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
              { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
              { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#10b981' }] },
              { featureType: 'poi', stylers: [{ visibility: 'off' }] },
              { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
              { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#111827' }] },
              { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#4b5563' }] },
              { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
              { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#030712' }] }
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
            title: 'You are here',
            zIndex: 999,
          });

          setMapLoaded(true);
        })
        .catch(err => setMapError(err.message));
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [userLat, userLng, isRejected, useLeaflet]);

  useEffect(() => {
    if (!mapLoaded) return;

    // Group receivers by unique receiver ID
    const uniqueReceiversMap = new Map();
    receivers.forEach(rec => {
      const actualPost = rec.post || (rec.title ? rec : null);
      const userObj = rec.ngo || rec.receiverId || actualPost?.receiverId;
      const recId = userObj?._id || userObj;
      if (!recId) return;
      const recIdStr = recId.toString();

      if (!uniqueReceiversMap.has(recIdStr)) {
        uniqueReceiversMap.set(recIdStr, {
          receiverId: userObj,
          distanceKm: rec.distanceKm,
          travelTimeMin: rec.travelTimeMin,
          location: userObj?.location || rec.location || {},
          posts: []
        });
      }
      uniqueReceiversMap.get(recIdStr).posts.push(actualPost || rec);
    });
    const uniqueReceiversList = Array.from(uniqueReceiversMap.values());

    if (useLeaflet && window.L && leafletMapRef.current) {
      const L = window.L;
      const map = leafletMapRef.current;

      leafletMarkersRef.current.forEach(m => m.remove());
      leafletMarkersRef.current = [];

      // User location marker
      const userIcon = L.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="#3b82f6" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="white" stroke-width="1.5"/></svg>`,
        className: 'custom-leaflet-pin',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
      });
      const userMarker = L.marker([userLat, userLng], { icon: userIcon }).addTo(map).bindPopup('You are here (Donor Location)');
      leafletMarkersRef.current.push(userMarker);

      // Create LatLngBounds
      const bounds = L.latLngBounds([userLat, userLng]);

      uniqueReceiversList.forEach(item => {
        const rLat = item.location?.lat;
        const rLng = item.location?.lng;
        if (!rLat || !rLng) return;

        const color = isRejected ? '#9ca3af' : '#10b981';

        const recIcon = L.divIcon({
          html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="${color}" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="white" stroke-width="1.5"/></svg>`,
          className: 'custom-leaflet-pin',
          iconSize: [36, 36],
          iconAnchor: [18, 36],
          popupAnchor: [0, -36]
        });

        const marker = L.marker([rLat, rLng], { icon: recIcon }).addTo(map);

        bounds.extend([rLat, rLng]);

        const recName = item.receiverId?.name || 'Receiver';
        const address = item.location?.address || '';
        const requestsHtml = item.posts.map(p => `<li>"${p.title}"</li>`).join('');

        let distance = item.distanceKm;
        if (distance === undefined || distance === null || distance === 999999) {
          distance = haversineDistance(userLat, userLng, rLat, rLng);
        }
        let travelTime = distance * 1.5;
        if (weatherCondition === 'Rainy') {
          travelTime = travelTime * 1.15;
        }
        travelTime = Math.max(2, Math.round(travelTime));

        const popupContent = `
          <div style="font-family:Inter,sans-serif;padding:8px;color:#0f172a;min-width:160px;">
            <strong style="color:#0f172a;font-size:0.92rem;display:block;margin-bottom:6px">${recName}</strong>
            <div style="color:#10b981;font-size:0.82rem;font-weight:700;margin-bottom:4px;">📍 ${distance} km away</div>
            <div style="color:#2563eb;font-size:0.82rem;font-weight:700;">🚗 ${travelTime} mins travel</div>
          </div>
        `;
        marker.bindPopup(popupContent);
        marker.on('click', () => {
          if (!isRejected && onSelectReceiver && item.posts.length > 0) {
            onSelectReceiver(item.posts[0]);
          }
        });

        leafletMarkersRef.current.push(marker);

        // Draw green route line from donor to receiver
        if (!isRejected) {
          const polyline = L.polyline([[userLat, userLng], [rLat, rLng]], {
            color: '#10b981',
            weight: 3,
            opacity: 0.7,
            dashArray: '5, 10'
          }).addTo(map);
          leafletMarkersRef.current.push(polyline);
        }
      });

      if (uniqueReceiversList.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }

    } else if (!useLeaflet && googleMapRef.current && window.google?.maps) {
      const maps = window.google.maps;

      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];

      // Add Donor User location marker on Google Map
      const userMarker = new maps.Marker({
        position: { lat: userLat, lng: userLng },
        map: googleMapRef.current,
        title: 'You are here (Donor Location)',
        icon: {
          path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
          fillColor: '#3b82f6', // Blue for donor location
          fillOpacity: 1,
          strokeWeight: 1.5,
          strokeColor: 'white',
          scale: 1.8,
          anchor: new maps.Point(12, 22),
        }
      });
      markersRef.current.push(userMarker);

      // Create LatLngBounds
      const bounds = new maps.LatLngBounds();
      bounds.extend({ lat: userLat, lng: userLng });

      uniqueReceiversList.forEach(item => {
        const rLat = item.location?.lat;
        const rLng = item.location?.lng;
        if (!rLat || !rLng) return;

        const color = isRejected ? '#9ca3af' : '#10b981';

        const marker = new maps.Marker({
          position: { lat: rLat, lng: rLng },
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
          title: item.receiverId?.name || 'Receiver',
          opacity: isRejected ? 0.5 : 1,
        });

        bounds.extend({ lat: rLat, lng: rLng });

        marker.addListener('click', () => {
          if (!isRejected && onSelectReceiver && item.posts.length > 0) {
            onSelectReceiver(item.posts[0]);
          }
          const recName = item.receiverId?.name || 'Receiver';
          const address = item.location?.address || '';
          const requestsHtml = item.posts.map(p => `<li>"${p.title}"</li>`).join('');

          let distance = item.distanceKm;
          if (distance === undefined || distance === null || distance === 999999) {
            distance = haversineDistance(userLat, userLng, rLat, rLng);
          }
          let travelTime = distance * 1.5;
          if (weatherCondition === 'Rainy') {
            travelTime = travelTime * 1.15;
          }
          travelTime = Math.max(2, Math.round(travelTime));

          infoWindowRef.current.setContent(`
            <div style="font-family:Inter,sans-serif;padding:8px;color:#0f172a;min-width:160px;">
              <strong style="color:#0f172a;font-size:0.92rem;display:block;margin-bottom:6px">${recName}</strong>
              <div style="color:#10b981;font-size:0.82rem;font-weight:700;margin-bottom:4px;">📍 ${distance} km away</div>
              <div style="color:#2563eb;font-size:0.82rem;font-weight:700;">🚗 ${travelTime} mins travel</div>
            </div>
          `);
          infoWindowRef.current.open(googleMapRef.current, marker);
        });

        markersRef.current.push(marker);

        // Draw green route line from donor to receiver on Google Maps
        if (!isRejected) {
          const polyline = new maps.Polyline({
            path: [
              { lat: userLat, lng: userLng },
              { lat: rLat, lng: rLng }
            ],
            geodesic: true,
            strokeColor: '#10b981',
            strokeOpacity: 0.7,
            strokeWeight: 3
          });
          polyline.setMap(googleMapRef.current);
          markersRef.current.push(polyline);
        }
      });

      if (uniqueReceiversList.length > 0) {
        googleMapRef.current.fitBounds(bounds);
      }
    }
  }, [receivers, mapLoaded, isRejected, useLeaflet, userLat, userLng, onSelectReceiver, weatherCondition]);

  // Helper to count unique receivers for displaying header count
  const getUniqueReceiverCount = () => {
    const ids = new Set();
    receivers.forEach(r => {
      const id = r.receiverId?._id || r.receiverId;
      if (id) ids.add(id.toString());
    });
    return ids.size;
  };
  const uniqueReceiverCount = getUniqueReceiverCount();

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', marginTop: 24 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={18} color="#10b981" /> Smart Donation Map
        </h3>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {uniqueReceiverCount} suggested receiver{uniqueReceiverCount !== 1 ? 's' : ''}
        </span>
      </div>
      {category === 'Food' && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.15)',
          padding: '12px 20px',
          color: '#ef4444',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
          <div>
            <strong>AI Weather Restriction Enforced:</strong> High summer temperature (&gt;30°C) active. Prepared foods are strictly restricted to a <strong>2-hour delivery window</strong> and a <strong>20-minute safe travel limit</strong> to prevent spoilage.
          </div>
        </div>
      )}

      {/* Simulated Weather Controller */}
      <div style={{ display: 'flex', gap: '8px', padding: '10px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.07)', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Simulated Weather:</span>
        {[
          { key: 'Sunny', label: '☀️ Sunny' },
          { key: 'Rainy', label: '🌧️ Rainy / Delay (+15%)' }
        ].map(cond => (
          <button
            key={cond.key}
            onClick={() => setWeatherCondition(cond.key)}
            style={{
              padding: '4px 10px',
              borderRadius: '8px',
              border: '1px solid ' + (weatherCondition === cond.key ? '#10b981' : 'rgba(255,255,255,0.1)'),
              background: weatherCondition === cond.key ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)',
              color: weatherCondition === cond.key ? '#34d399' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            {cond.label}
          </button>
        ))}
      </div>

      {aiStats && aiStats.temperature > 30 && category === 'Food' && (
        <div style={{ background: '#fef3c7', padding: '10px 20px', color: '#b45309', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          <strong>AI Weather Alert ({aiStats.temperature}°C):</strong> {aiStats.message}
        </div>
      )}

      {isRejected && (
        <div style={{ background: '#fef2f2', padding: '10px 20px', color: '#b91c1c', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          <strong>Donation Rejected:</strong> Map restricted to 5km. You cannot fulfill active demands with this item.
        </div>
      )}

      <div style={{ position: 'relative', height: 400, width: '100%' }}>
        {mapError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#111827', color: 'var(--text-muted)' }}>
            <AlertCircle size={32} />
            <p style={{ marginTop: 12 }}>{mapError}</p>
          </div>
        ) : (
          <>
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
            {loading && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(17,24,39,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                <Loader2 size={32} className="spin" color="#10b981" />
                <p style={{ marginTop: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Finding nearby receivers...</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
