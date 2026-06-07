import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, MapPin } from 'lucide-react';

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

function loadGoogleMaps(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve(window.google.maps);
      return;
    }
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

export default function DirectionMap({ donorLat, donorLng, receiverLat, receiverLng, receiverName, donorCity, receiverCity }) {
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState('');
  const [loading, setLoading] = useState(true);
  const [useLeaflet, setUseLeaflet] = useState(false);
  const [distance, setDistance] = useState(null);
  const [isEstimated, setIsEstimated] = useState(false);

  // Helper for distance calculation client-side
  const haversineKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Coordinates resolver with fallback
  const resolveCoords = (lat, lng, cityName) => {
    const pLat = parseFloat(lat);
    const pLng = parseFloat(lng);
    if (lat !== null && lat !== undefined && lat !== '' && !isNaN(pLat) && pLat !== 0) {
      return { lat: pLat, lng: pLng, fallback: false };
    }
    // Fallback coordinates based on city
    const city = String(cityName || '').toLowerCase();
    if (city.includes('karachi')) return { lat: 24.8607, lng: 67.0011, fallback: true };
    if (city.includes('islamabad')) return { lat: 33.6844, lng: 73.0479, fallback: true };
    // Default to Lahore
    return { lat: 31.5204, lng: 74.3587, fallback: true };
  };

  useEffect(() => {
    const donorCoords = resolveCoords(donorLat, donorLng, donorCity || 'Lahore');
    const receiverCoords = resolveCoords(receiverLat, receiverLng, receiverCity || 'Lahore');

    const dLat = donorCoords.lat;
    const dLng = donorCoords.lng;
    const rLat = receiverCoords.lat;
    const rLng = receiverCoords.lng;
    const isFallbackUsed = donorCoords.fallback || receiverCoords.fallback;

    setIsEstimated(isFallbackUsed);

    const calculatedDist = haversineKm(dLat, dLng, rLat, rLng);
    setDistance(Math.round(calculatedDist * 10) / 10);

    const initMap = async () => {
      setLoading(true);
      try {
        if (!GMAPS_KEY || GMAPS_KEY === 'YOUR_GOOGLE_MAPS_API_KEY_HERE' || GMAPS_KEY === '') {
          setUseLeaflet(true);
          const L = await loadLeaflet();
          if (!mapRef.current) return;

          const map = L.map(mapRef.current).setView([dLat, dLng], 12);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(map);

          // Donor marker
          const donorIcon = L.divIcon({
            html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="#3b82f6" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="white" stroke-width="1.5"/></svg>`,
            className: 'custom-leaflet-pin',
            iconSize: [36, 36],
            iconAnchor: [18, 36],
            popupAnchor: [0, -36]
          });
          L.marker([dLat, dLng], { icon: donorIcon }).addTo(map).bindPopup('Donor Location' + (donorCoords.fallback ? ' (City Center Fallback)' : ''));

          // Receiver marker
          const recIcon = L.divIcon({
            html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="#10b981" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="white" stroke-width="1.5"/></svg>`,
            className: 'custom-leaflet-pin',
            iconSize: [36, 36],
            iconAnchor: [18, 36],
            popupAnchor: [0, -36]
          });
          L.marker([rLat, rLng], { icon: recIcon }).addTo(map).bindPopup((receiverName || 'Receiver') + (receiverCoords.fallback ? ' (City Center Fallback)' : ''));

          // Route Polyline
          L.polyline([[dLat, dLng], [rLat, rLng]], {
            color: '#10b981',
            weight: 4,
            opacity: 0.8,
            dashArray: '5, 10'
          }).addTo(map);

          // Fit bounds
          const bounds = L.latLngBounds([[dLat, dLng], [rLat, rLng]]);
          map.fitBounds(bounds, { padding: [40, 40] });

          setMapLoaded(true);
        } else {
          setUseLeaflet(false);
          const maps = await loadGoogleMaps(GMAPS_KEY);
          if (!mapRef.current) return;

          const map = new maps.Map(mapRef.current, {
            center: { lat: dLat, lng: dLng },
            zoom: 12,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });

          // Donor marker
          new maps.Marker({
            position: { lat: dLat, lng: dLng },
            map,
            title: 'Donor Location' + (donorCoords.fallback ? ' (City Center Fallback)' : ''),
            icon: {
              path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
              fillColor: '#3b82f6',
              fillOpacity: 1,
              strokeWeight: 1.5,
              strokeColor: 'white',
              scale: 1.8,
              anchor: new maps.Point(12, 22),
            }
          });

          // Receiver marker
          new maps.Marker({
            position: { lat: rLat, lng: rLng },
            map,
            title: (receiverName || 'Receiver') + (receiverCoords.fallback ? ' (City Center Fallback)' : ''),
            icon: {
              path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
              fillColor: '#10b981',
              fillOpacity: 1,
              strokeWeight: 1.5,
              strokeColor: 'white',
              scale: 1.8,
              anchor: new maps.Point(12, 22),
            }
          });

          // Polyline path
          const polyline = new maps.Polyline({
            path: [
              { lat: dLat, lng: dLng },
              { lat: rLat, lng: rLng }
            ],
            geodesic: true,
            strokeColor: '#10b981',
            strokeOpacity: 0.8,
            strokeWeight: 4
          });
          polyline.setMap(map);

          // Fit bounds
          const bounds = new maps.LatLngBounds();
          bounds.extend({ lat: dLat, lng: dLng });
          bounds.extend({ lat: rLat, lng: rLng });
          map.fitBounds(bounds);

          setMapLoaded(true);
        }
      } catch (err) {
        setMapError('Failed to load map: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    initMap();
  }, [donorLat, donorLng, receiverLat, receiverLng, receiverName, donorCity, receiverCity]);

  return (
    <div style={{ background: '#1e293b', borderRadius: 12, overflow: 'hidden', border: '1px solid #334155', marginTop: 16 }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={16} color="#10b981" /> Route to Donor
        </span>
        {distance != null && (
          <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 600, background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 6 }}>
            {isEstimated ? 'Est. ' : ''}{distance} km away
          </span>
        )}
      </div>

      <div style={{ position: 'relative', height: 250, width: '100%' }}>
        {mapError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#0f172a', color: '#94a3b8', padding: 20 }}>
            <AlertCircle size={28} color="#ef4444" />
            <p style={{ marginTop: 8, fontSize: '0.85rem', textAlign: 'center' }}>{mapError}</p>
          </div>
        ) : (
          <>
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
            {loading && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                <Loader2 size={24} className="spin" color="#10b981" />
                <p style={{ marginTop: 8, fontSize: '0.8rem', color: '#94a3b8' }}>Plotting route map...</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
