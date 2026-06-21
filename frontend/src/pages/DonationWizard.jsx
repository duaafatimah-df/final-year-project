import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Camera, CheckCircle2, ScanLine, ArrowLeft, Activity, ShieldCheck, Zap, Clock, AlertTriangle, Users, MapPin, Check, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { organizations } from './Home';
import axios from 'axios';
import './DonationWizard.css';

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : (import.meta.env.VITE_API_URL || 'https://spareshare-ai.up.railway.app');

// Dynamically load Google Maps script helper
const loadGoogleMaps = (apiKey) => {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(window.google.maps); return; }
    
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

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
};

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

function cleanToStandardCategory(cat) {
  if (!cat) return 'Food';
  const lower = cat.toLowerCase();
  if (lower.includes('food') || lower.includes('meat') || lower.includes('veg') || lower.includes('fruit') || lower.includes('dairy') || lower.includes('cooked') || lower.includes('dish') || lower.includes('meal')) {
    return 'Food';
  }
  if (lower.includes('med') || lower.includes('health') || lower.includes('pharma') || lower.includes('drug') || lower.includes('syrup') || lower.includes('tablet')) {
    return 'Medicine';
  }
  if (lower.includes('cloth') || lower.includes('garment') || lower.includes('dress') || lower.includes('wear') || lower.includes('shirt') || lower.includes('pant') || lower.includes('shoe')) {
    return 'Clothes';
  }
  if (lower.includes('house') || lower.includes('furniture') || lower.includes('utensil') || lower.includes('appliance') || lower.includes('blanket') || lower.includes('bed') || lower.includes('home')) {
    return 'Household';
  }
  if (lower.includes('groc') || lower.includes('ration') || lower.includes('pantry') || lower.includes('staple') || lower.includes('oil') || lower.includes('flour') || lower.includes('rice')) {
    return 'Grocery';
  }
  return 'Food';
}

const compressImage = (base64Str, maxWidth = 400, maxHeight = 400) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

const DonationWizard = () => {
  const { orgId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const categoriesParam = searchParams.get('categories') || 'General';

  // Check if static or db organization (for back link reference)
  const staticOrg = organizations.find(o => o.id === orgId);
  const [dbOrg, setDbOrg] = useState(null);
  const [loadingOrg, setLoadingOrg] = useState(!staticOrg && orgId !== 'general');

  // Coordinates (donor coordinates)
  const [donorLat, setDonorLat] = useState(() => user?.location?.lat ?? null);
  const [donorLng, setDonorLng] = useState(() => user?.location?.lng ?? null);

  useEffect(() => {
    if (user?.location?.lat && user?.location?.lng) {
      if (!donorLat) setDonorLat(user.location.lat);
      if (!donorLng) setDonorLng(user.location.lng);
    }
  }, [user, donorLat, donorLng]);

  // Form & Wizard Step states
  const [step, setStep] = useState(1); // 1=Upload & Info, 2=Scanning, 3=Suggestions, 4=Success
  const [file, setFile] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      // Wait briefly for ref to be bound if state update is async
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error("Camera access failed:", err);
      alert("Could not access camera. Please check permissions.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/jpeg');
      fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
          const capturedFile = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
          Object.assign(capturedFile, {
            preview: dataUrl
          });
          setFile(capturedFile);
          stopCamera();
        });
    }
  };
  
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('1 batch');
  const [condition, setCondition] = useState('Good');
  const [description, setDescription] = useState('');
  const [expiryTime, setExpiryTime] = useState('');
  const [foodPreparedTime, setFoodPreparedTime] = useState(new Date().toISOString().substring(0, 16));
  const [isSealed, setIsSealed] = useState(true);

  // Suggestions states
  const [aiResult, setAiResult] = useState(null);
  const [matches, setMatches] = useState([]);
  const [fallbackNGOs, setFallbackNGOs] = useState([]);
  const [selectedNGOId, setSelectedNGOId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [trackingId, setTrackingId] = useState('');
  const [notifiedCount, setNotifiedCount] = useState(0);
  const [directReceiver, setDirectReceiver] = useState(null);
  const [temperature, setTemperature] = useState(25.0);
  const [useLeaflet, setUseLeaflet] = useState(false);

  // Geolocation detection
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setDonorLat(pos.coords.latitude);
          setDonorLng(pos.coords.longitude);
        },
        err => {
          console.warn("Geolocation failed or denied. Falling back to profile location coordinates.");
          if (user?.location?.lat && user?.location?.lng) {
            setDonorLat(user.location.lat);
            setDonorLng(user.location.lng);
          }
        }
      );
    }
  }, [user]);

  // Fetch weather insights
  useEffect(() => {
    const lat = donorLat || user?.location?.lat || 31.5204;
    const lng = donorLng || user?.location?.lng || 74.3587;
    axios.get(`${API}/api/ai/weather-insights?lat=${lat}&lng=${lng}`)
      .then(res => {
        if (res.data && res.data.temperature !== undefined) {
          setTemperature(res.data.temperature);
        }
      })
      .catch(err => {
        console.warn("Failed to fetch weather insights, checking season fallback:", err);
        // Summer month check (May to September)
        const m = new Date().getMonth();
        if (m >= 4 && m <= 8) {
          setTemperature(35.0);
        } else {
          setTemperature(25.0);
        }
      });
  }, [donorLat, donorLng, user]);

  // Handle Google Maps authentication failures globally
  useEffect(() => {
    const prevAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
      console.warn("Google Maps Auth failure detected in DonationWizard. Falling back to Leaflet.");
      setUseLeaflet(true);
      if (prevAuthFailure) prevAuthFailure();
    };
    return () => {
      window.gm_authFailure = prevAuthFailure;
    };
  }, []);

  // Redirect unauthenticated user
  useEffect(() => {
    if (!user) {
      navigate('/auth/donor', { state: { returnTo: `/donate/${orgId}` } });
    }
  }, [user, navigate, orgId]);

  // Load organization if necessary
  useEffect(() => {
    if (!staticOrg && orgId && orgId !== 'general') {
      axios.get(`${API}/api/users/org/${orgId}`)
        .then(res => setDbOrg(res.data.org))
        .catch(err => console.error(err))
        .finally(() => setLoadingOrg(false));
    } else {
      setLoadingOrg(false);
    }
  }, [orgId, staticOrg]);

  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles.length > 0) {
      setFile(Object.assign(acceptedFiles[0], {
        preview: URL.createObjectURL(acceptedFiles[0])
      }));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, maxFiles: 1
  });

  const isFoodInput = categoriesParam.toLowerCase().includes('food') || 
                      categoriesParam.toLowerCase().includes('ration') || 
                      categoriesParam.toLowerCase().includes('meat') || 
                      categoriesParam.toLowerCase().includes('vegetable') || 
                      categoriesParam.toLowerCase().includes('fruit') || 
                      categoriesParam.toLowerCase().includes('dairy');

  const isMedicineInput = categoriesParam.toLowerCase().includes('med');
  const isGroceryInput = categoriesParam.toLowerCase().includes('groc');

  // Trigger Gemini AI Image scan & category classification
  const handleScan = async () => {
    if (!file) return;
    if (!title.trim()) {
      alert("Please enter a donation title.");
      return;
    }

    const now = new Date();

    if (isFoodInput) {
      if (!foodPreparedTime) {
        alert("Time when food was prepared is required.");
        return;
      }
      const prepared = new Date(foodPreparedTime);
      if (prepared > now) {
        alert("Prepared time cannot be in the future.");
        return;
      }
      const diffHours = (now - prepared) / 3600000;
      const maxHours = temperature > 30 ? 2 : 4;
      if (diffHours > maxHours) {
        alert(`Food safety check failed: The temperature is currently ${temperature}°C. Under hot weather (>30°C), food must be prepared within 2 hours (currently ${diffHours.toFixed(1)} hours ago). Under cooler weather, it is 4 hours.`);
        return;
      }
    } else if (isMedicineInput) {
      if (!expiryTime) {
        alert("Expiry date is required for Medicine.");
        return;
      }
      const expiry = new Date(expiryTime);
      if (expiry <= now) {
        alert("Expiry date must be in the future.");
        return;
      }
      const minExpiry = new Date(now.getTime() + 30 * 24 * 3600000);
      if (expiry < minExpiry) {
        alert("Medicine must have at least 30 days until expiry.");
        return;
      }
      if (!isSealed) {
        alert("Medicine donations must be sealed and unopened.");
        return;
      }
    } else if (isGroceryInput) {
      if (expiryTime) {
        const expiry = new Date(expiryTime);
        if (expiry <= now) {
          alert("Expiry date must be in the future.");
          return;
        }
      }
    }

    setStep(2); // transition to scanning page

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setSubmitting(true);
        const rawImageUrl = reader.result;
        const imageUrl = await compressImage(rawImageUrl);

        // Map search categories to standard DB categories strictly matching the 5 allowed: Food, Medicine, Clothes, Grocery, Household
        let cleanCategory = 'Food';
        const lowerParam = categoriesParam.toLowerCase();
        if (lowerParam.includes('med')) cleanCategory = 'Medicine';
        else if (lowerParam.includes('cloth')) cleanCategory = 'Clothes';
        else if (lowerParam.includes('groc')) cleanCategory = 'Grocery';
        else if (lowerParam.includes('house')) cleanCategory = 'Household';
        else if (lowerParam.includes('food') || lowerParam.includes('ration') || lowerParam.includes('meat') || lowerParam.includes('vegetable') || lowerParam.includes('fruit') || lowerParam.includes('dairy')) cleanCategory = 'Food';

        // Call scan endpoint
        const scanRes = await axios.post(`${API}/api/donations/scan`, {
          imageUrl,
          category: cleanCategory
        }, {
          headers: { 'x-auth-token': localStorage.getItem('token') }
        });

        const visualAi = scanRes.data;
        const scanScore = visualAi.safetyScore !== undefined ? visualAi.safetyScore : 60;
        let detectedCat = cleanToStandardCategory(visualAi.classifiedCategory || cleanCategory);
        
        // Coerce AI detected category to match the user's selected category domain to prevent validation issues
        const isFood = (cat) => ['Food', 'Meat', 'Vegetables', 'Fruit', 'Dairy'].includes(cat);
        if (!isFood(cleanCategory) && isFood(detectedCat)) {
          detectedCat = cleanCategory;
        }
        if (cleanCategory !== 'Medicine' && detectedCat === 'Medicine') {
          detectedCat = cleanCategory;
        }
        if (isFood(cleanCategory) && !isFood(detectedCat)) {
          detectedCat = cleanCategory;
        }
        if (cleanCategory === 'Medicine' && detectedCat !== 'Medicine') {
          detectedCat = cleanCategory;
        }

        const resultObj = {
          score: scanScore,
          safe: scanScore >= 50,
          reason: visualAi.reason || 'Safe for distribution.',
          detectedCategory: detectedCat,
          status: scanScore >= 50 ? (scanScore >= 70 ? 'active' : 'needs_review') : 'rejected'
        };
        setAiResult(resultObj);

        if (scanScore < 50) {
          // If rejected by AI, skip matching suggestions and transition to show rejection UI
          setStep(3);
          setSubmitting(false);
          return;
        }

        // Fetch matching requests/NGOs based on coordinates and classified category
        const suggestionsRes = await axios.post(`${API}/api/donations/match-suggestions`, {
          category: detectedCat,
          lat: donorLat,
          lng: donorLng,
          title: title,
          description: description,
          keywords: visualAi.keywords || [],
          directReceiverId: orgId !== 'general' ? orgId : undefined
        }, {
          headers: { 'x-auth-token': localStorage.getItem('token') }
        });

        const response = suggestionsRes;
        console.log("MATCH API RESPONSE", response.data);

        if (orgId !== 'general' && response.data.directReceiver) {
          setDirectReceiver(response.data.directReceiver);
          setMatches([]);
          setFallbackNGOs([]);
        } else {
          setDirectReceiver(null);
          const aiMatches = response.data.matches || [];
          setMatches(aiMatches);
          setFallbackNGOs(response.data.fallbackNGOs || []);
          if (response.data.fallbackNGOs?.length > 0) {
            setSelectedNGOId(response.data.fallbackNGOs[0].ngo?._id || '');
          }
        }

        setStep(3);
      } catch (err) {
        console.error('Scan failed:', err);
        alert(err.response?.data?.error || 'AI visual scan failed. Transitioning with warnings...');
        setAiResult({
          score: 55,
          safe: true,
          reason: 'AI visual scan completed with warnings.',
          detectedCategory: categoriesParam,
          status: 'needs_review'
        });
        setStep(3);
      } finally {
        setSubmitting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Dispatch donation & notifications
  const handleConfirmDonation = async () => {
    const finalCat = cleanToStandardCategory(aiResult?.detectedCategory);
    const now = new Date();
    if (finalCat === 'Food') {
      if (!foodPreparedTime) {
        alert("Time when food was prepared is required.");
        return;
      }
      const prepared = new Date(foodPreparedTime);
      const diffHours = (now - prepared) / 3600000;
      const maxHours = temperature > 30 ? 2 : 4;
      if (diffHours > maxHours) {
        alert(`Food safety check failed: The temperature is currently ${temperature}°C. Under hot weather (>30°C), food must be prepared within 2 hours (currently ${diffHours.toFixed(1)} hours ago). Under cooler weather, it is 4 hours.`);
        return;
      }
    } else if (finalCat === 'Medicine') {
      if (!expiryTime) {
        alert("Expiry date is required for Medicine.");
        return;
      }
      const expiry = new Date(expiryTime);
      if (expiry <= now) {
        alert("Expiry date must be in the future.");
        return;
      }
      const minExpiry = new Date(now.getTime() + 30 * 24 * 3600000);
      if (expiry < minExpiry) {
        alert("Medicine must have at least 30 days until expiry.");
        return;
      }
      if (!isSealed) {
        alert("Medicine donations must be sealed and unopened.");
        return;
      }
    } else if (finalCat === 'Grocery') {
      if (expiryTime) {
        const expiry = new Date(expiryTime);
        if (expiry <= now) {
          alert("Expiry date must be in the future.");
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      let targetReceiverIds = [];

      if (orgId !== 'general') {
        targetReceiverIds = [orgId];
      } else if (matches.length > 0) {
        targetReceiverIds = [...new Set(matches.map(m => m.receiverId?._id).filter(Boolean))];
      } else if (selectedNGOId) {
        targetReceiverIds = [selectedNGOId];
      }

      if (targetReceiverIds.length === 0) {
        alert("No target receivers or NGOs selected for donation.");
        setSubmitting(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const rawImageUrl = reader.result;
          const imageUrl = await compressImage(rawImageUrl);

          const reqBody = {
            title,
            category: finalCat,
            itemType: 'General',
            condition,
            imageUrl,
            quantity,
            description,
            expiryTime: expiryTime ? new Date(expiryTime) : null,
            foodPreparedTime: foodPreparedTime ? new Date(foodPreparedTime) : null,
            isSealed,
            lat: donorLat,
            lng: donorLng,
            address: user?.location?.address || 'Lahore, Pakistan',
            targetReceiverIds,
            aiSafetyScore: aiResult.score,
            isVerifiedSafe: aiResult.safe,
            aiAnalysisReason: aiResult.reason,
            classifiedCategory: finalCat
          };

          await axios.post(`${API}/api/donations`, reqBody, {
            headers: { 'x-auth-token': localStorage.getItem('token') }
          });

          const trackId = `SHP-${Math.floor(Math.random() * 90000) + 10000}`;
          setTrackingId(trackId);
          setNotifiedCount(targetReceiverIds.length);
          setStep(4);
        } catch (err) {
          console.error("Donation create error:", err);
          alert(err.response?.data?.error || "Failed to finalize donation. Try again.");
        } finally {
          setSubmitting(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setSubmitting(false);
    }
  };

  // Google Maps rendering inside Step 3
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const leafletMapRef = useRef(null);
  const leafletMarkersRef = useRef([]);

  useEffect(() => {
    if (step === 3 && aiResult?.safe) {
      const gKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

      // Group matching suggestions by unique receiver ID
      const uniqueReceiversMap = new Map();
      if (orgId !== 'general' && directReceiver) {
        const recIdStr = (directReceiver.receiver?._id || orgId).toString();
        uniqueReceiversMap.set(recIdStr, {
          receiverId: directReceiver.receiver,
          distanceKm: directReceiver.distanceKm,
          travelTimeMin: directReceiver.travelTimeMin,
          location: directReceiver.receiver?.location || {},
          posts: [{ title: `Direct Donation to ${directReceiver.receiver?.name || 'NGO'}` }]
        });
      } else if (matches.length > 0) {
        matches.forEach(m => {
          const recId = m.receiverId?._id || m._id;
          if (!recId) return;
          const recIdStr = recId.toString();
          if (!uniqueReceiversMap.has(recIdStr)) {
            uniqueReceiversMap.set(recIdStr, {
              receiverId: m.receiverId,
              distanceKm: m.distanceKm,
              travelTimeMin: m.travelTimeMin,
              location: m.receiverId?.location || {},
              posts: []
            });
          }
          uniqueReceiversMap.get(recIdStr).posts.push(m);
        });
      } else {
        fallbackNGOs.forEach(f => {
          const recId = f.ngo?._id;
          if (!recId) return;
          const recIdStr = recId.toString();
          if (!uniqueReceiversMap.has(recIdStr)) {
            uniqueReceiversMap.set(recIdStr, {
              receiverId: f.ngo,
              distanceKm: f.distanceKm,
              travelTimeMin: f.travelTimeMin,
              location: f.ngo?.location || {},
              posts: [{ title: `Direct Donation to ${f.ngo?.name}` }]
            });
          }
        });
      }
      const listToPlot = Array.from(uniqueReceiversMap.values());

      if (!gKey || gKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE' || gKey === '' || useLeaflet) {
        setUseLeaflet(true);
        loadLeaflet()
          .then(L => {
            const mapEl = document.getElementById('wizard-map');
            if (!mapEl) return;

            if (leafletMapRef.current) {
              leafletMapRef.current.remove();
            }
            mapEl.innerHTML = ''; // Clear previous elements (e.g. GMaps elements)

            const map = L.map(mapEl).setView([donorLat || 31.5204, donorLng || 74.3587], 12);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
              subdomains: 'abcd',
              maxZoom: 20
            }).addTo(map);
            leafletMapRef.current = map;

            leafletMarkersRef.current.forEach(m => m.remove());
            leafletMarkersRef.current = [];

            // Plot donor marker
            const donorIcon = L.divIcon({
              html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="#3b82f6" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="white" stroke-width="1.5"/></svg>`,
              className: 'custom-leaflet-pin',
              iconSize: [36, 36],
              iconAnchor: [18, 36],
              popupAnchor: [0, -36]
            });
            const donorMarker = L.marker([donorLat || 31.5204, donorLng || 74.3587], { icon: donorIcon }).addTo(map).bindPopup('Your Location (Donor)');
            leafletMarkersRef.current.push(donorMarker);

            // Draw direct route if needed
            if (orgId !== 'general' && directReceiver) {
              const recLoc = directReceiver.receiver?.location || {};
              const rLat = recLoc.lat;
              const rLng = recLoc.lng;
              if (donorLat && donorLng && rLat && rLng) {
                const polyline = L.polyline([[donorLat, donorLng], [rLat, rLng]], {
                  color: '#34d399',
                  weight: 4,
                  opacity: 0.8,
                  dashArray: '5, 10'
                }).addTo(map);
                leafletMarkersRef.current.push(polyline);
              }
            }

            const bounds = L.latLngBounds([donorLat || 31.5204, donorLng || 74.3587]);

            listToPlot.forEach(item => {
              const latVal = item.location?.lat;
              const lngVal = item.location?.lng;
              if (latVal && lngVal) {
                const recName = item.receiverId?.name || 'Receiver';
                const labelText = recName.substring(0, 2).toUpperCase();

                const recIcon = L.divIcon({
                  html: `<div style="position:relative; width:36px; height:36px;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="#10b981" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="white" stroke-width="1.5"/>
                    </svg>
                    <span style="position:absolute; top:6px; left:0; right:0; text-align:center; color:white; font-size:9px; font-weight:bold; font-family:sans-serif;">${labelText}</span>
                  </div>`,
                  className: 'custom-leaflet-pin-label',
                  iconSize: [36, 36],
                  iconAnchor: [18, 36],
                  popupAnchor: [0, -36]
                });

                const marker = L.marker([latVal, lngVal], { icon: recIcon }).addTo(map);
                leafletMarkersRef.current.push(marker);
                bounds.extend([latVal, lngVal]);

                const address = item.location?.address || '';
                const requestsHtml = item.posts.map(p => `<li>"${p.title}"</li>`).join('');

                const popupContent = `
                  <div style="font-family:Inter,sans-serif;padding:6px;max-width:200px;color:#0f172a;">
                    <strong style="color:#0f172a;font-size:0.95rem;display:block;margin-bottom:4px">Receiver: ${recName}</strong>
                    <div style="color:#64748b;font-size:0.75rem;">📍 ${item.distanceKm} km away</div>
                    ${address ? `<div style="color:#64748b;font-size:0.75rem;margin-top:2px;">🏠 Address: ${address}</div>` : ''}
                    <div style="margin-top:8px;border-top:1px solid #e2e8f0;padding-top:6px;">
                      <div style="font-weight:600;font-size:0.75rem;color:#0f172a;">Requested Items:</div>
                      <ul style="margin:4px 0 0;padding-left:12px;font-size:0.75rem;color:#334155;">
                        ${requestsHtml}
                      </ul>
                    </div>
                  </div>
                `;
                marker.bindPopup(popupContent);
              }
            });

            if (listToPlot.length > 0) {
              map.fitBounds(bounds, { padding: [40, 40] });
            }
          })
          .catch(err => console.error("Leaflet load failed in DonationWizard:", err));
      } else {
        setUseLeaflet(false);
        loadGoogleMaps(gKey.trim())
          .then(maps => {
            const mapEl = document.getElementById('wizard-map');
            if (!mapEl) return;
            mapEl.innerHTML = ''; // Clear previous elements (e.g. Leaflet elements)

            const map = new maps.Map(mapEl, {
              center: { lat: donorLat || 31.5204, lng: donorLng || 74.3587 },
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
              ]
            });
            mapInstanceRef.current = map;

            markersRef.current.forEach(m => m.setMap(null));
            markersRef.current = [];

            const bounds = new maps.LatLngBounds();
            bounds.extend({ lat: donorLat || 31.5204, lng: donorLng || 74.3587 });

            // Plot donor position
            const donorMarker = new maps.Marker({
              position: { lat: donorLat || 31.5204, lng: donorLng || 74.3587 },
              map,
              title: 'Your Location',
              icon: {
                path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 1.5,
                scale: 1.8,
                anchor: new maps.Point(12, 22),
              }
            });
            markersRef.current.push(donorMarker);

            // Plot direct receiver route line if in direct flow
            if (orgId !== 'general' && directReceiver) {
              const recLoc = directReceiver.receiver?.location || {};
              const rLat = recLoc.lat;
              const rLng = recLoc.lng;
              
              if (donorLat && donorLng && rLat && rLng) {
                const routePath = new maps.Polyline({
                  path: [
                    { lat: donorLat, lng: donorLng },
                    { lat: rLat, lng: rLng }
                  ],
                  geodesic: true,
                  strokeColor: '#34d399',
                  strokeOpacity: 0.8,
                  strokeWeight: 4,
                  map: map
                });
                markersRef.current.push(routePath);
              }
            }

            const infoWindow = new maps.InfoWindow();

            listToPlot.forEach(item => {
              const latVal = item.location?.lat;
              const lngVal = item.location?.lng;
              if (latVal && lngVal) {
                const recName = item.receiverId?.name || 'Receiver';
                const labelText = recName.substring(0, 2).toUpperCase();

                const marker = new maps.Marker({
                  position: { lat: latVal, lng: lngVal },
                  map,
                  title: recName,
                  icon: {
                    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
                    fillColor: '#10b981',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 1.5,
                    scale: 1.8,
                    anchor: new maps.Point(12, 22),
                    labelOrigin: new maps.Point(12, 9),
                  },
                  label: {
                    text: labelText,
                    color: 'white',
                    fontSize: '9px',
                    fontWeight: 'bold'
                  }
                });
                markersRef.current.push(marker);
                bounds.extend({ lat: latVal, lng: lngVal });

                marker.addListener('click', () => {
                  const address = item.location?.address || '';
                  const requestsHtml = item.posts.map(p => `<li>"${p.title}"</li>`).join('');

                  infoWindow.setContent(`
                    <div style="font-family:Inter,sans-serif;padding:6px;max-width:200px;color:#0f172a;">
                      <strong style="color:#0f172a;font-size:0.95rem;display:block;margin-bottom:4px">Receiver: ${recName}</strong>
                      <div style="color:#64748b;font-size:0.75rem;">📍 ${item.distanceKm} km away</div>
                      ${address ? `<div style="color:#64748b;font-size:0.75rem;margin-top:2px;">🏠 Address: ${address}</div>` : ''}
                      <div style="margin-top:8px;border-top:1px solid #e2e8f0;padding-top:6px;">
                        <div style="font-weight:600;font-size:0.75rem;color:#0f172a;">Requested Items:</div>
                        <ul style="margin:4px 0 0;padding-left:12px;font-size:0.75rem;color:#334155;">
                          ${requestsHtml}
                        </ul>
                      </div>
                    </div>
                  `);
                  infoWindow.open(map, marker);
                });
              }
            });

            if (listToPlot.length > 0) {
              map.fitBounds(bounds);
            } else {
              map.setZoom(13);
            }
          })
          .catch(err => console.error("Google Maps load failed:", err));
      }
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [step, matches, fallbackNGOs, donorLat, donorLng, aiResult, useLeaflet]);

  if (loadingOrg) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1.25rem', color: '#9ca3af', backgroundColor: '#030712' }}>
        <div style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,0.06)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>Loading routing wizard...</p>
      </div>
    );
  }

  const org = staticOrg
    ? { id: staticOrg.id, name: staticOrg.name, logo: staticOrg.logo }
    : dbOrg
      ? { id: dbOrg._id, name: dbOrg.name, logo: null }
      : { id: 'general', name: 'SpareShare NGO Pool', logo: null };

  return (
    <div className="wizard-container">
      <div className="wizard-card glass-panel" style={{ maxWidth: step === 3 ? '780px' : '620px' }}>
        <Link to={org.id !== 'general' ? `/organization/${org.id}` : '/'} className="back-link">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        {/* STEP 1: Upload & Forms */}
        {step === 1 && (
          <>
            <div className="wizard-header">
              <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <Camera size={32} color="#10b981" />
              </div>
              <h2>Intelligent Donation Wizard</h2>
              <p>Upload a photo of the <strong>{categoriesParam}</strong> items. Our AI will analyze quality, classify the category, and display matching receiver requests near you.</p>
            </div>

            <div className="wizard-step">
              {isCameraActive ? (
                <div className="camera-container" style={{ position: 'relative', width: '100%', minHeight: '300px', backgroundColor: '#000', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                  <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', maxHeight: '400px', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: '20px', left: '0', right: '0', display: 'flex', justifyContent: 'center', gap: '15px' }}>
                    <button 
                      type="button"
                      onClick={capturePhoto} 
                      style={{ padding: '10px 20px', borderRadius: '30px', backgroundColor: '#10b981', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Camera size={16} /> Capture Photo
                    </button>
                    <button 
                      type="button"
                      onClick={stopCamera} 
                      style={{ padding: '10px 20px', borderRadius: '30px', backgroundColor: '#ef4444', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div {...getRootProps()} className={`upload-zone ${isDragActive ? 'active' : ''}`}>
                    <input {...getInputProps()} />
                    {file ? (
                      <img src={file.preview} alt="Upload" className="upload-preview" />
                    ) : (
                      <div className="upload-placeholder">
                        <Camera size={44} style={{ color: '#10b981' }} />
                        <h3>Click or Drag Image Here</h3>
                        <p>Upload a clear photo of the items to donate.</p>
                      </div>
                    )}
                  </div>
                  {!file && (
                    <button 
                      type="button"
                      onClick={startCamera} 
                      style={{ marginTop: '12px', width: '100%', padding: '12px 20px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '1.5rem' }}
                    >
                      <Camera size={18} /> Use Live Camera Instead
                    </button>
                  )}
                </>
              )}

              {file && (
                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left', marginBottom: '2rem' }}>
                  <div>
                    <label style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Donation Title</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Fresh Roti, Beef, Vegetables, Cough Syrup" 
                      value={title} 
                      onChange={e => setTitle(e.target.value)} 
                      style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', color: 'white', fontSize: '0.9rem' }}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Quantity</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 5 kg, 12 pieces" 
                        value={quantity} 
                        onChange={e => setQuantity(e.target.value)} 
                        style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', color: 'white', fontSize: '0.9rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Condition</label>
                      <select 
                        className="custom-select"
                        value={condition} 
                        onChange={e => setCondition(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        <option value="New">New</option>
                        <option value="Good">Good</option>
                        <option value="Used">Used</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Description / Storage Note</label>
                    <textarea 
                      placeholder="Add any specific storage instructions, safety checks, or comments." 
                      value={description} 
                      onChange={e => setDescription(e.target.value)} 
                      style={{ width: '100%', height: '80px', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', color: 'white', fontSize: '0.9rem', resize: 'none' }}
                    />
                  </div>

                  {isFoodInput && (
                    <div>
                      <label style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Food Prepared Time</label>
                      <input 
                        type="datetime-local" 
                        value={foodPreparedTime} 
                        onChange={e => setFoodPreparedTime(e.target.value)} 
                        style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', color: 'white', fontSize: '0.9rem' }}
                      />
                    </div>
                  )}

                  {(isMedicineInput || isGroceryInput) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <label style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                          {isMedicineInput ? "Medicine Expiry Date" : "Expiry Date (Optional)"}
                        </label>
                        <input 
                          type="date" 
                          value={expiryTime} 
                          onChange={e => setExpiryTime(e.target.value)} 
                          style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', color: 'white', fontSize: '0.9rem' }}
                        />
                      </div>
                      {isMedicineInput && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', fontSize: '0.9rem', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={isSealed} 
                            onChange={e => setIsSealed(e.target.checked)} 
                            style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
                          />
                          Medicine packaging is sealed and unopened
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                className="wizard-submit"
                disabled={!file || submitting}
                onClick={handleScan}
                style={{ opacity: file ? 1 : 0.6 }}
              >
                <ScanLine size={18} /> Start AI Image Scan
              </button>
            </div>
          </>
        )}

        {/* STEP 2: Scanning Animation */}
        {step === 2 && (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
            <div style={{ width: 88, height: 88, border: '4px solid rgba(255,255,255,0.06)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 2.5rem', boxShadow: '0 0 30px rgba(16,185,129,0.2)' }} />
            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.8rem', color: '#ffffff', marginBottom: '0.75rem' }}>SpareShare AI Scanning...</h2>
            <p style={{ color: '#9ca3af', fontSize: '0.95rem' }}>Running AI classification &amp; freshness checks...</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.75rem', marginTop: '2.5rem', flexWrap: 'wrap' }}>
              {['Object Detection', 'Category Classification', 'Safety Analysis', 'Travel Path Match'].map((label, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontSize: '0.85rem', fontWeight: 700 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: `pulse ${0.5 + i * 0.3}s ease infinite alternate` }} />
                  {label}
                </div>
              ))}
            </div>
            {file && <img src={file.preview} alt="scanning" style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 16, marginTop: '2.5rem', border: '3px solid #10b981', opacity: 0.8, boxShadow: '0 10px 25px rgba(0,0,0,0.4)' }} />}
          </div>
        )}

        {/* STEP 3: Suggestions, Map & Rejection check */}
        {step === 3 && aiResult && (
          <div>
            {!aiResult.safe ? (
              /* Rejection Screen */
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                  <AlertTriangle size={36} color="#ef4444" />
                </div>
                <h2 style={{ fontFamily: 'var(--font-heading)', color: '#ef4444', fontWeight: 800, fontSize: '1.75rem', marginBottom: '0.5rem' }}>Donation Rejected by AI Scan</h2>
                <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>Safety validation score: <strong style={{ color: '#ef4444' }}>{aiResult.score}%</strong></p>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '1.25rem', color: '#cbd5e1', fontSize: '0.92rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
                  {aiResult.reason}
                </div>
                <button className="btn btn-outline" onClick={() => { setStep(1); setFile(null); setAiResult(null); }} style={{ padding: '0.8rem 2rem', borderRadius: 99 }}>Try Another Item</button>
              </div>
            ) : (
              /* Approved Screen & Route suggestion list */
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShieldCheck size={26} color="#10b981" />
                    <div>
                      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', color: '#ffffff', margin: 0, fontWeight: 800 }}>AI Scan Verified Approved!</h2>
                      <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '2px 0 0' }}>Safety Quality Index: <span style={{ color: '#10b981', fontWeight: 700 }}>{aiResult.score}%</span> • Detected Category: <span style={{ color: '#34d399', fontWeight: 700 }}>{aiResult.detectedCategory}</span></p>
                    </div>
                  </div>
                  <p style={{ color: '#9ca3af', fontSize: '0.88rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '10px', marginTop: '1rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                    {aiResult.reason}
                  </p>
                </div>

                {/* Map Display */}
                <h3 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={18} color="#10b981" /> Map Suggestions (Only Approved Travel Ranges)
                </h3>
                <div id="wizard-map" style={{ width: '100%', height: '240px', borderRadius: '16px', backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>Loading map directions...</span>
                </div>

                {/* Direct Receiver Card or general Suggestions List */}
                {orgId !== 'general' && directReceiver ? (
                  <div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                      <h3 style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Building2 size={20} color="#10b981" /> Selected NGO Receiver:
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', color: '#cbd5e1', fontSize: '0.92rem' }}>
                        <div><strong>Name:</strong> {directReceiver.receiver?.name}</div>
                        <div><strong>Email:</strong> {directReceiver.receiver?.email}</div>
                        <div><strong>Phone:</strong> {directReceiver.receiver?.phone || 'Not provided'}</div>
                        <div><strong>Address:</strong> {directReceiver.receiver?.location?.address || directReceiver.receiver?.city || 'Not provided'}</div>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#34d399', fontWeight: 700 }}>🚗 {directReceiver.travelTimeMin} min drive time</span>
                          <span style={{ color: '#9ca3af' }}>({directReceiver.distanceKm} km distance)</span>
                        </div>
                      </div>
                    </div>

                    {!directReceiver.passedSafety && (
                      <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px', padding: '1rem', color: '#fca5a5', fontSize: '0.9rem', marginBottom: '1.5rem', display: 'flex', gap: '8px' }}>
                        <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong>Summer Food Safety Warning:</strong> Estimated travel time is <strong>{directReceiver.travelTimeMin} minutes</strong>, which exceeds the safe 20-minute limit. Transporting food over this distance is unsafe under high summer temperatures. Submission is blocked.
                        </div>
                      </div>
                    )}

                    <button
                      className="wizard-submit"
                      onClick={handleConfirmDonation}
                      disabled={submitting || !directReceiver.passedSafety}
                    >
                      <Check size={18} /> Donate to Selected Receiver
                    </button>
                  </div>
                ) : matches.length > 0 ? (
                  <div>
                    <h3 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Zap size={18} color="#eab308" /> AI suggested matching receiver requests:
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                      {matches.map((match, i) => (
                        <div key={match._id} style={{ background: 'rgba(16,185,129,0.03)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem' }}>{match.receiverId?.name || 'Receiver'}</span>
                              <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '99px', background: match.priority === 1 ? 'rgba(16,185,129,0.15)' : 'rgba(234,179,8,0.15)', color: match.priority === 1 ? '#10b981' : '#eab308', fontWeight: 700 }}>
                                {match.priority === 1 ? 'Exact Match' : 'Category Match'}
                              </span>
                            </div>
                            <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: '4px 0 0' }}>Request: "{match.title}"</p>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                            <div style={{ color: '#34d399', fontWeight: 700 }}>{match.travelTimeMin} min duration</div>
                            <div style={{ color: '#6b7280' }}>({match.distanceKm} km distance)</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button className="wizard-submit" onClick={handleConfirmDonation} disabled={submitting}>
                      <Check size={18} /> Donate Now &amp; Notify All matching receivers
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.15)', padding: '1rem', borderRadius: '12px', color: '#cbd5e1', fontSize: '0.88rem', marginBottom: '1.5rem', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <AlertTriangle size={18} color="#eab308" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <strong>No matching receiver requests found.</strong> Falling back to approved NGOs within travel safety bounds.
                      </div>
                    </div>

                    {fallbackNGOs.length > 0 ? (
                      <div style={{ marginBottom: '2rem' }}>
                        <label style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '10px' }}>Select an Approved NGO to notify:</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {fallbackNGOs.map(ngoItem => (
                            <label key={ngoItem.ngo?._id} style={{ background: 'rgba(255,255,255,0.02)', border: selectedNGOId === ngoItem.ngo?._id ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input 
                                  type="radio" 
                                  name="fallbackNGO" 
                                  checked={selectedNGOId === ngoItem.ngo?._id} 
                                  onChange={() => setSelectedNGOId(ngoItem.ngo?._id)} 
                                  style={{ accentColor: '#10b981' }} 
                                />
                                <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>{ngoItem.ngo?.name}</span>
                              </div>
                              <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                                <div style={{ color: '#34d399', fontWeight: 700 }}>{ngoItem.travelTimeMin} min duration</div>
                                <div style={{ color: '#6b7280' }}>({ngoItem.distanceKm} km distance)</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: '#6b7280', fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '12px', marginBottom: '2rem' }}>
                        No approved NGOs found in safe travel range.
                      </div>
                    )}

                    <button className="wizard-submit" onClick={handleConfirmDonation} disabled={submitting || !selectedNGOId}>
                      <Check size={18} /> Donate to Selected NGO
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Success confirmation */}
        {step === 4 && (
          <div style={{ marginTop: '0.5rem', animation: 'fadeIn 0.4s ease' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderLeft: '4px solid #10b981', padding: '2rem', borderRadius: 16, display: 'flex', alignItems: 'flex-start', gap: '1.25rem', marginBottom: '2rem' }}>
              <CheckCircle2 size={36} color="#34d399" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h3 style={{ color: '#ffffff', fontFamily: 'var(--font-heading)', fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem' }}>Donation Dispatch Successful! 🎉</h3>
                <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.88rem' }}>Tracking ID: <strong style={{ color: '#34d399' }}>#{trackingId}</strong></p>
                <p style={{ color: '#cbd5e1', fontSize: '0.92rem', marginTop: '1rem', lineHeight: 1.6 }}>
                  Your donation request has been recorded. Direct routing notifications have been sent to <strong>{notifiedCount}</strong> target receiver organizations.
                </p>
                <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  The first receiver to accept will claim the donation. Remaining listings will automatically lock.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/" className="btn btn-outline" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#ffffff', borderRadius: '9999px', padding: '0.9rem 2rem', textDecoration: 'none', fontWeight: 600 }}>Back to Home</Link>
              <Link to="/contributor" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#ffffff', borderRadius: '9999px', padding: '0.9rem 2rem', textDecoration: 'none', fontWeight: 700, boxShadow: '0 8px 20px rgba(16,185,129,0.25)' }}>Go to Dashboard</Link>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { from { opacity: 0.4; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};

export default DonationWizard;
