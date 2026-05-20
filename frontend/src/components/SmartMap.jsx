import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Loader2, AlertCircle, MapPin, CheckCircle } from 'lucide-react';

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : 'https://spareshare-ai.up.railway.app';
const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

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

export default function SmartMap({ category, userLat, userLng, aiStatus, onSelectReceiver }) {
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

  // Filter based on status
  const isRejected = aiStatus === 'rejected';

  useEffect(() => {
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
  }, [userLat, userLng, category, isRejected]);

  useEffect(() => {
    if (!userLat || !userLng) return;

    if (!GMAPS_KEY || GMAPS_KEY === 'YOUR_GOOGLE_MAPS_API_KEY_HERE' || GMAPS_KEY === '') {
      setUseLeaflet(true);
      loadLeaflet()
        .then(L => {
          if (!mapRef.current) return;
          if (leafletMapRef.current) {
            leafletMapRef.current.remove();
          }
          const map = L.map(mapRef.current).setView([userLat, userLng], isRejected ? 14 : 12);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
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
          const map = new maps.Map(mapRef.current, {
            center: { lat: userLat, lng: userLng },
            zoom: isRejected ? 14 : 12,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            styles: [
              { elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
              { elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
              { elementType: 'labels.text.stroke', stylers: [{ color: '#f8fafc' }] },
              { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
              { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bae6fd' }] },
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
              path: maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: '#3b82f6',
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: 'white',
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
  }, [userLat, userLng, isRejected]);

  useEffect(() => {
    if (!mapLoaded) return;

    if (useLeaflet && window.L && leafletMapRef.current) {
      const L = window.L;
      const map = leafletMapRef.current;

      leafletMarkersRef.current.forEach(m => m.remove());
      leafletMarkersRef.current = [];

      // User location marker
      const userMarker = L.circleMarker([userLat, userLng], {
        radius: 9,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        color: 'white',
        weight: 2
      }).addTo(map).bindPopup('You are here');
      leafletMarkersRef.current.push(userMarker);

      receivers.forEach(rec => {
        const rLat = rec.receiverId?.location?.lat || userLat + (Math.random() - 0.5) * 0.05;
        const rLng = rec.receiverId?.location?.lng || userLng + (Math.random() - 0.5) * 0.05;
        const color = isRejected ? '#9ca3af' : '#10b981';

        const marker = L.circleMarker([rLat, rLng], {
          radius: 9,
          fillColor: color,
          fillOpacity: 0.9,
          color: 'white',
          weight: 2
        }).addTo(map);

        const popupContent = `
          <div style="font-family:Inter,sans-serif;padding:6px;max-width:180px;color:#0f172a;">
            <strong style="color:#0f172a;font-size:0.9rem">${rec.title}</strong>
            <div style="color:#64748b;font-size:0.75rem;margin-top:4px">${rec.receiverId?.name || 'NGO'}</div>
            <div style="color:#64748b;font-size:0.75rem;margin-top:4px">📍 ${rec.distanceKm} km away</div>
            ${isRejected ? '<div style="color:#ef4444;font-size:0.75rem;margin-top:4px">❌ Item Rejected - Cannot donate</div>' : ''}
          </div>
        `;
        marker.bindPopup(popupContent);
        marker.on('click', () => {
          if (!isRejected && onSelectReceiver) {
            onSelectReceiver(rec);
          }
        });

        leafletMarkersRef.current.push(marker);
      });

    } else if (!useLeaflet && googleMapRef.current && window.google?.maps) {
      const maps = window.google.maps;

      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];

      receivers.forEach(rec => {
        const rLat = rec.receiverId?.location?.lat || userLat + (Math.random() - 0.5) * 0.05;
        const rLng = rec.receiverId?.location?.lng || userLng + (Math.random() - 0.5) * 0.05;
        const color = isRejected ? '#9ca3af' : '#10b981';

        const marker = new maps.Marker({
          position: { lat: rLat, lng: rLng },
          map: googleMapRef.current,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: color,
            fillOpacity: 0.9,
            strokeWeight: 2,
            strokeColor: 'white',
          },
          title: rec.title,
          opacity: isRejected ? 0.5 : 1,
        });

        marker.addListener('click', () => {
          if (!isRejected && onSelectReceiver) {
            onSelectReceiver(rec);
          }
          infoWindowRef.current.setContent(`
            <div style="font-family:Inter,sans-serif;padding:6px;max-width:180px;">
              <strong style="color:#0f172a;font-size:0.9rem">${rec.title}</strong>
              <div style="color:#64748b;font-size:0.75rem;margin-top:4px">${rec.receiverId?.name || 'NGO'}</div>
              <div style="color:#64748b;font-size:0.75rem;margin-top:4px">📍 ${rec.distanceKm} km away</div>
              ${isRejected ? '<div style="color:#ef4444;font-size:0.75rem;margin-top:4px">❌ Item Rejected - Cannot donate</div>' : ''}
            </div>
          `);
          infoWindowRef.current.open(googleMapRef.current, marker);
        });

        markersRef.current.push(marker);
      });
    }
  }, [receivers, mapLoaded, isRejected, useLeaflet, userLat, userLng, onSelectReceiver]);

  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginTop: 24 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={18} color="#3b82f6" /> Smart Donation Map
        </h3>
        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>{receivers.length} Nearby Matches</span>
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f8fafc', color: '#64748b' }}>
            <AlertCircle size={32} />
            <p style={{ marginTop: 12 }}>{mapError}</p>
          </div>
        ) : (
          <>
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
            {loading && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                <Loader2 size={32} className="spin" color="#3b82f6" />
                <p style={{ marginTop: 12, fontWeight: 600, color: '#475569' }}>Finding nearby receivers...</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
