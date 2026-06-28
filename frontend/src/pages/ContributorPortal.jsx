import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useLang } from '../context/AuthContext';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import {
  RefreshCw, ArrowRight,
  LogOut, Search, Globe, Home, Activity, Calculator,
  UploadCloud, MapPin, ScanLine, Sun, Clock, Send, ShieldCheck,
  ChevronLeft, ChevronRight, UserCircle, X, Heart, History, Building2, Sparkles, Zap, Image as ImageIcon, Bell, Trash2, Star, Camera, Menu,
  TrendingUp, Package, MessageSquare, Minus, ChevronUp
} from "lucide-react";
import { organizations } from './Home';
import ZakatCalculator from './ZakatCalculator';
import ProfilePage from '../components/ProfilePage';
import SmartMap from '../components/SmartMap';
import CustomDropdown from '../components/CustomDropdown';
import './ContributorPortal.css';

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : (import.meta.env.VITE_API_URL || 'https://spareshare-ai.up.railway.app');

const playChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.1, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.8);
    
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.15);
    gain2.gain.setValueAtTime(0.08, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.95);
  } catch (err) {
    console.error('Audio chime failed:', err);
  }
};

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

// Mock Data for Charts
const monthlyData = [
  { name: 'Week 1', scans: 45 },
  { name: 'Week 2', scans: 52 },
  { name: 'Week 3', scans: 38 },
  { name: 'Week 4', scans: 65 },
];

// Removed mock receiverDemands, will fetch from API

const ContributorPortal = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('home');
  const { lang, setLang, t } = useLang(); // Global language context 
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedMapPost, setSelectedMapPost] = useState(null);
  const [receiverDemands, setReceiverDemands] = useState([]);
  const [aiMatches, setAiMatches] = useState([]);
  const [fallbackNGOs, setFallbackNGOs] = useState([]);
  const [verifiedOrgs, setVerifiedOrgs] = useState([]);
  const [myDonations, setMyDonations] = useState([]);
  const [selectedDonation, setSelectedDonation] = useState(null);
  const [historyTab, setHistoryTab] = useState('active'); // active, completed, rejected
  const [selectedHistoryCategory, setSelectedHistoryCategory] = useState('Grocery');
  const [donorNotifications, setDonorNotifications] = useState([]);
  const [notifFilter, setNotifFilter] = useState('pending'); // pending, fulfilled
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [ratingComment, setRatingComment] = useState('');
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Donation Form State & Chat States
  const [files, setFiles] = useState([]);
  const [activeHistoryImgIdx, setActiveHistoryImgIdx] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [isFetchingChat, setIsFetchingChat] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [activeChatDonationId, setActiveChatDonationId] = useState(null);
  const [activeChatDonation, setActiveChatDonation] = useState(null);
  const [chatNotification, setChatNotification] = useState(null);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [chatPosition, setChatPosition] = useState(null); // { x, y }
  const [notifTypeFilter, setNotifTypeFilter] = useState('donations'); // 'donations' | 'messages'
  const [recentChatMessages, setRecentChatMessages] = useState([]);
  const [readMessageIds, setReadMessageIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('readMessageIds') || '[]');
    } catch {
      return [];
    }
  });
  const isFirstPoll = useRef(true);
  
  useEffect(() => {
    if (activeChatDonationId) {
      setIsChatMinimized(false);
      setChatPosition(null);
    }
  }, [activeChatDonationId]);

  const processedMessageIds = useRef(new Set());
  const [donTitle, setDonTitle] = useState('');
  const [category, setCategory] = useState('');
  const [itemType, setItemType] = useState('');
  const [condition, setCondition] = useState('');
  const [quantity, setQuantity] = useState('');
  const [description, setDescription] = useState('');
  const [expiryTime, setExpiryTime] = useState('');
  const [foodPreparedTime, setFoodPreparedTime] = useState('');
  const [isSealed, setIsSealed] = useState(false);
  const [donLat, setDonLat] = useState(() => user?.location?.lat ?? 0);
  const [donLng, setDonLng] = useState(() => user?.location?.lng ?? 0);
  const [location, setLocation] = useState('');
  const [validationError, setValidationError] = useState('');

  const [isTranslatingDesc, setIsTranslatingDesc] = useState(false);
  const [translationError, setTranslationError] = useState('');
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [isDescriptionTranslated, setIsDescriptionTranslated] = useState(false);
  const originalDescriptionRef = useRef('');

  const handleTranslateDesc = async () => {
    if (!description) return;
    if (isDescriptionTranslated) {
      setDescription(originalDescriptionRef.current);
      setIsDescriptionTranslated(false);
      return;
    }

    originalDescriptionRef.current = description;
    setIsTranslatingDesc(true);
    setTranslationError('');
    try {
      const res = await axios.post(`${API}/api/ai/translate`, {
        text: description,
        targetLang: 'ur'
      });
      if (res.data.translatedText) {
        setDescription(res.data.translatedText);
        setIsDescriptionTranslated(true);
      } else {
        setTranslationError('❌ Translation failed');
      }
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

  // AI Demand Forecasting State
  const [forecastData, setForecastData] = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [forecastError, setForecastError] = useState('');

  const fetchForecastData = async () => {
    setLoadingForecast(true);
    setForecastError('');
    try {
      const res = await axios.get(`${API}/api/ai/demand-forecast`);
      setForecastData(res.data);
    } catch (err) {
      console.error('Forecast error:', err);
      setForecastError(err.response?.data?.error || 'Failed to load demand forecast.');
    } finally {
      setLoadingForecast(false);
    }
  };
  const [selectedHistoryDonation, setSelectedHistoryDonation] = useState(null);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Carousel Ref
  const carouselRef = useRef(null);

  // Camera Integration
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
      if (files.length >= 3) {
        alert("You can scan a maximum of 3 images.");
        return;
      }
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
          const capturedFile = new File([blob], `camera_capture_${Date.now()}.jpg`, { type: "image/jpeg" });
          Object.assign(capturedFile, {
            preview: dataUrl
          });
          setFiles(prev => {
            const newFiles = [...prev, capturedFile];
            if (newFiles.length >= 3) {
              // Stop camera when we hit 3 images
              if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
              }
              setIsCameraActive(false);
            }
            return newFiles;
          });
        });
    }
  };

  const scrollLeft = () => carouselRef.current?.scrollBy({ left: -400, behavior: 'smooth' });
  const scrollRight = () => carouselRef.current?.scrollBy({ left: 400, behavior: 'smooth' });

  // Location setup
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

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
  const fetchData = async (showNotification = false) => {
    const langParam = lang === 'Eng' ? 'en' : 'ur';
    let successCount = 0;
    let failCount = 0;
    const token = localStorage.getItem('token');

    const [postsRes, orgsRes, donRes, notifRes] = await Promise.allSettled([
      axios.get(`${API}/api/posts/active?lang=${langParam}`),
      axios.get(`${API}/api/users/receivers?lang=${langParam}`),
      axios.get(`${API}/api/donations/my-donations?lang=${langParam}`, {
        headers: { 'x-auth-token': token }
      }),
      axios.get(`${API}/api/notifications/donor?lang=${langParam}`, {
        headers: { 'x-auth-token': token }
      })
    ]);

    // 1. Fetch active receiver posts
    if (postsRes.status === 'fulfilled') {
      const data = Array.isArray(postsRes.value?.data) ? postsRes.value.data : [];
      setReceiverDemands(data);
      successCount++;
    } else {
      console.error("Failed to fetch posts:", postsRes.reason.message);
      failCount++;
    }

    // 2. Fetch verified orgs
    if (orgsRes.status === 'fulfilled') {
      const rawData = Array.isArray(orgsRes.value?.data) ? orgsRes.value.data : [];
      const dynamicOrgs = rawData.map(r => ({
        ...r,
        _id: r._id,
        orgType: r.orgType || 'NGO',
        email: r.email,
        isDynamic: true
      }));

      const formattedStaticOrgs = organizations.map(org => ({
        ...org,
        _id: org.id,
        orgType: org.type,
        email: org.desc,
        isDynamic: false
      }));

      // Re-order: Dynamic/real database receivers first!
      const staticNgos = formattedStaticOrgs.filter(o => o.orgType === 'NGO' || o.orgType === 'Foundation').slice(0, 5);
      const staticSocials = formattedStaticOrgs.filter(o => o.orgType === 'Social' || o.orgType === 'Instagram Page' || o.orgType === 'Community Group').slice(0, 5);

      const dynamicNgos = dynamicOrgs.filter(o => o.orgType === 'NGO' || o.orgType === 'Foundation');
      const dynamicSocials = dynamicOrgs.filter(o => o.orgType === 'Social' || o.orgType === 'Instagram Page' || o.orgType === 'Community Group');

      setVerifiedOrgs([...dynamicNgos, ...staticNgos, ...dynamicSocials, ...staticSocials]);
      successCount++;
    } else {
      console.error("Failed to fetch receivers:", orgsRes.reason.message);
      failCount++;
    }

    // 3. Fetch donor's own donations
    if (donRes.status === 'fulfilled') {
      const data = Array.isArray(donRes.value?.data) ? donRes.value.data : [];
      setMyDonations(data);
      successCount++;
    } else {
      console.error("Failed to fetch my donations:", donRes.reason.message);
      failCount++;
    }

    // 4. Fetch donor notifications
    if (notifRes.status === 'fulfilled') {
      const data = Array.isArray(notifRes.value?.data) ? notifRes.value.data : [];
      setDonorNotifications(data);
      successCount++;
    } else {
      console.error("Failed to fetch notifications:", notifRes.reason.message);
      failCount++;
    }

    if (showNotification) {
      if (failCount === 0) {
        showToast(lang === 'Eng' ? 'Data Refreshed Successfully!' : 'ڈیٹا کامیابی سے تازہ ہو گیا!', 'success');
      } else if (successCount > 0) {
        showToast(lang === 'Eng' ? `Refreshed ${successCount} feeds, ${failCount} failed.` : `دوبارہ لوڈ کیا گیا: ${successCount}، ناکام: ${failCount}`, 'warning');
      } else {
        showToast(lang === 'Eng' ? 'Failed to refresh data.' : 'ڈیٹا تازہ کرنے میں ناکام۔', 'error');
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [lang]);

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

  const submitRating = async (donationId) => {
    if (selectedRating === 0) return;
    setIsSubmittingRating(true);
    try {
      await axios.post(`${API}/api/ratings`, {
        donationId,
        rating: selectedRating,
        comment: ratingComment
      }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      alert('⭐⭐⭐⭐⭐ Thank you! Your review has been submitted successfully.');
      
      // Update local state for the completed donation
      setMyDonations(prev => prev.map(don => 
        don._id === donationId ? { ...don, donorRating: selectedRating } : don
      ));
      
      // Update selectedHistoryDonation rating so it updates in real-time in the open modal
      setSelectedHistoryDonation(prev => ({ ...prev, donorRating: selectedRating }));
      
      // Reset rating selection
      setSelectedRating(0);
      setHoveredRating(0);
      setRatingComment('');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to submit rating. Please try again.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  // Dropzone setup
  const onDrop = useCallback(acceptedFiles => {
    setFiles(prev => {
      const updated = [...prev];
      for (const f of acceptedFiles) {
        if (updated.length < 3) {
          updated.push(Object.assign(f, { preview: URL.createObjectURL(f) }));
        }
      }
      return updated;
    });
  }, []);
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({ onDrop, accept: { 'image/*': [] }, maxFiles: 3 });

  const handleChatDragStart = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button')) return;

    const chatElem = e.currentTarget.closest('.chat-drawer-container');
    if (!chatElem) return;

    const rect = chatElem.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = rect.left;
    const initialY = rect.top;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const chatWidth = 380;
      const chatHeight = isChatMinimized ? 60 : 480;
      const newX = Math.max(0, Math.min(window.innerWidth - chatWidth, initialX + deltaX));
      const newY = Math.max(0, Math.min(window.innerHeight - chatHeight, initialY + deltaY));

      setChatPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const fetchChatMessages = useCallback(async (donationId) => {
    if (!donationId) return;
    try {
      const res = await axios.get(`${API}/api/chats/${donationId}`, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setChatMessages(prev => {
        if (res.data.length > prev.length) {
          const lastMsg = res.data[res.data.length - 1];
          const prevLastMsg = prev[prev.length - 1];
          if (lastMsg && (!prevLastMsg || prevLastMsg._id !== lastMsg._id) && !lastMsg._id.startsWith('temp-')) {
            const currentUserId = user?.id || user?._id;
            const senderIdStr = lastMsg.senderId?._id || lastMsg.senderId;
            if (senderIdStr && senderIdStr !== currentUserId) {
              playChime();
              setChatNotification({
                senderName: lastMsg.senderId?.name || 'Receiver',
                text: lastMsg.text
              });
              setTimeout(() => setChatNotification(null), 5000);
            }
          }
        }
        return res.data;
      });
    } catch (err) {
      console.error('Failed to fetch chat messages:', err);
    }
  }, [user]);

  const sendChatMessage = async (e) => {
    if (e) e.preventDefault();
    const messageText = chatText.trim();
    if (!messageText || !activeChatDonationId) return;

    setChatText('');

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      _id: tempId,
      text: messageText,
      senderId: { _id: user?.id || user?._id, name: user?.name || 'Me' },
      createdAt: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, optimisticMsg]);

    try {
      const res = await axios.post(`${API}/api/chats/${activeChatDonationId}`, {
        text: messageText
      }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setChatMessages(prev => prev.map(msg => msg._id === tempId ? res.data : msg));
    } catch (err) {
      console.error('Failed to send chat message:', err);
      setChatMessages(prev => prev.filter(msg => msg._id !== tempId));
      alert('Failed to send message. Please try again.');
    }
  };

  useEffect(() => {
    if (!activeChatDonationId) return;
    fetchChatMessages(activeChatDonationId);
    const interval = setInterval(() => {
      fetchChatMessages(activeChatDonationId);
    }, 1500);
    return () => clearInterval(interval);
  }, [activeChatDonationId, fetchChatMessages]);

  useEffect(() => {
    const pollAllRecent = async () => {
      try {
        const res = await axios.get(`${API}/api/chats/all/recent`, {
          headers: { 'x-auth-token': localStorage.getItem('token') }
        });
        const fetchedMessages = Array.isArray(res.data) ? res.data : [];
        setRecentChatMessages(fetchedMessages);

        fetchedMessages.forEach(msg => {
          const msgId = msg._id;
          const isMe = (msg.senderId?._id || msg.senderId) === (user?.id || user?._id);
          
          if (!processedMessageIds.current.has(msgId)) {
            processedMessageIds.current.add(msgId);
            if (!isFirstPoll.current && !isMe) {
              playChime();
              setChatNotification({
                senderName: msg.senderId?.name || 'Partner',
                donationTitle: msg.donationId?.title || 'Donation Item',
                text: msg.text,
                donationId: msg.donationId?._id || msg.donationId
              });
              setTimeout(() => setChatNotification(null), 5000);
            }
          }
        });

        // Also if we have active chat open, trigger message fetch immediately if there are new messages for it
        const hasNewForActive = fetchedMessages.some(msg => {
          const msgDonationId = msg.donationId?._id || msg.donationId;
          return activeChatDonationId && activeChatDonationId === msgDonationId && (msg.senderId?._id || msg.senderId) !== (user?.id || user?._id);
        });
        if (hasNewForActive) {
          fetchChatMessages(activeChatDonationId);
        }

        isFirstPoll.current = false;
      } catch (err) {
        console.error('Failed to poll recent messages:', err);
      }
    };
    pollAllRecent();
    const interval = setInterval(pollAllRecent, 2000);
    return () => clearInterval(interval);
  }, [activeChatDonationId, fetchChatMessages, user]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleDonateSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    if (files.length === 0) { setValidationError('An image is required.'); return; }
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
    setAiError(null);
    setAiResult(null);
    setAiMatches([]);
    setFallbackNGOs([]);
    setScanComplete(false);

    try {
      const fileToBase64 = (f) => new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = (err) => reject(err);
        r.readAsDataURL(f);
      });

      const base64Promises = files.map(async (f) => {
        const raw = await fileToBase64(f);
        return await compressImage(raw);
      });
      const imageUrls = await Promise.all(base64Promises);

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
        imageUrl: imageUrls,
      }, { headers: { 'x-auth-token': localStorage.getItem('token') } });

      // Success
      setCurrentDonationId(res.data._id);
      setAiKeywords(res.data.aiKeywords || []);
      const detectedCat = res.data.aiDetectedItems || res.data.category;
      setAiResult({
        safetyScore: res.data.aiSafetyScore || 90,
        recommendation: res.data.status === 'rejected' ? 'Rejected' : res.data.isVerifiedSafe ? 'Accept' : 'Review',
        itemName: res.data.title || 'Donation Item',
        safetyNotes: res.data.aiAnalysisReason || 'Safe for distribution.',
        detectedCategory: detectedCat,
        condition: condition || (res.data.isSealed ? 'Sealed/New' : 'Open/Used'),
        freshness: res.data.status === 'rejected' ? 'Spoiled/Unsafe' : 'Verified',
        estimatedItems: res.data.quantity || 'Unknown',
        matchReason: res.data.status === 'rejected' ? 'Safety limits exceeded. Item blocked.' : 'Matched to nearby demand based on AI engine.',
        imageUrl: res.data.imageUrl?.[0] || (files[0] ? files[0].preview : null)
      });

      // Query backend database matching suggestions for the AI classified category
      if (res.data.status !== 'rejected') {
        try {
          const suggestionsRes = await axios.post(`${API}/api/donations/match-suggestions`, {
            category: detectedCat,
            lat: donLat,
            lng: donLng,
            title: donTitle,
            description: description,
            keywords: res.data.aiKeywords || []
          }, { headers: { 'x-auth-token': localStorage.getItem('token') } });

          const response = suggestionsRes;
          const aiMatches = response.data.matches || [];
          console.log("MATCH API RESPONSE", response.data);
          console.log("MATCHES STATE", aiMatches);

          setAiMatches(aiMatches);
          setFallbackNGOs(response.data.fallbackNGOs || []);
        } catch (suggestErr) {
          console.error("Failed to load match suggestions:", suggestErr);
          setAiMatches([]);
          setFallbackNGOs([]);
        }
      } else {
        setAiMatches([]);
        setFallbackNGOs([]);
      }

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
      setSelectedMapPost(null);
      setActiveTab('my_donations');
      setFiles([]); setCategory(''); setLocation(''); setScanComplete(false);
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
      {/* Toast notifications */}
      {toast && (
        <div className={`pp-toast ${toast.type}`} style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000, background: toast.type === 'success' ? '#10b981' : '#ef4444', color: 'white', padding: '12px 24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontWeight: 600 }}>
          {toast.msg}
        </div>
      )}

      {chatNotification && (
        <div className="pp-toast info" style={{ 
          position: 'fixed', 
          bottom: '80px', 
          right: '20px', 
          zIndex: 100000, 
          background: 'rgba(15, 23, 42, 0.95)', 
          color: 'white', 
          padding: '16px', 
          borderRadius: '16px', 
          boxShadow: '0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)', 
          maxWidth: '320px', 
          borderLeft: '5px solid #10b981',
          backdropFilter: 'blur(8px)',
          fontFamily: 'sans-serif'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <div>
              <span style={{ fontWeight: 800, fontSize: '0.8rem', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💬 New Message</span>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                Re: <strong style={{ color: '#cbd5e1' }}>{chatNotification.donationTitle}</strong>
              </div>
            </div>
            <button 
              onClick={() => setChatNotification(null)} 
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#f1f5f9', fontWeight: 600, marginBottom: '4px' }}>
            {chatNotification.senderName}:
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>
            {chatNotification.text}
          </p>
        </div>
      )}

      {/* Portal Custom Header */}
      {/* Portal Custom Header */}
      <header className="portal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="portal-logo" onClick={() => navigate('/')}>
          <img src="/logo.png" alt="SpareShare" />
          <span>Donor Portal</span>
        </div>

        <nav className="portal-nav">
          <button className={`nav-tab ${activeTab === 'home' ? 'active' : ''}`} onClick={() => { setActiveTab('home'); fetchData(); }}>
            <Home size={18} /> {lang === 'Eng' ? 'Dashboard Home' : 'ڈیش بورڈ'}
          </button>
          <button className={`nav-tab ${activeTab === 'ai_dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('ai_dashboard'); fetchData(); }}>
            <Activity size={18} /> {lang === 'Eng' ? 'AI Dashboard' : 'اے آئی ڈیش بورڈ'}
          </button>
          <button className={`nav-tab ${activeTab === 'ai_forecast' ? 'active' : ''}`} onClick={() => { setActiveTab('ai_forecast'); fetchForecastData(); }}>
            <TrendingUp size={18} /> {lang === 'Eng' ? 'AI Forecast' : 'اے آئی پیشن گوئی'}
          </button>
          <button className={`nav-tab ${activeTab === 'zakat' ? 'active' : ''}`} onClick={() => setActiveTab('zakat')}>
            <Calculator size={18} /> {lang === 'Eng' ? 'Zakat Calculator' : 'زکوٰۃ کیلکولیٹر'}
          </button>
          <button className={`nav-tab ${activeTab === 'my_donations' ? 'active' : ''}`} onClick={() => { setActiveTab('my_donations'); fetchData(); }}>
            <History size={18} /> {lang === 'Eng' ? 'My Donations' : 'میرے عطیات'}
            {myDonations.filter(d => d.status !== 'pending_receiver').length > 0 && (
              <span style={{ marginLeft: 4, background: '#10b981', color: 'white', borderRadius: 99, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 800 }}>
                {myDonations.filter(d => d.status !== 'pending_receiver').length}
              </span>
            )}
          </button>
          <button className={`nav-tab ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => { setActiveTab('notifications'); fetchData(); }}>
            <Bell size={18} /> {lang === 'Eng' ? 'Notifications' : 'اطلاعات'}
            {(() => {
              const systemNotifsCount = donorNotifications.filter(n => n.status === 'accepted' || n.status === 'rejected').length;
              const unreadMessagesCount = recentChatMessages.filter(msg => (msg.senderId?._id || msg.senderId) !== (user?.id || user?._id) && !readMessageIds.includes(msg._id)).length;
              const totalNotificationsBadgeCount = systemNotifsCount + unreadMessagesCount;
              if (totalNotificationsBadgeCount > 0) {
                return (
                  <span style={{ marginLeft: 4, background: '#ef4444', color: 'white', borderRadius: 99, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 800 }}>
                    {totalNotificationsBadgeCount}
                  </span>
                );
              }
              return null;
            })()}
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
              style={{ paddingRight: searchQuery ? '30px' : '12px' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="lang-dropdown-wrapper" style={{ position: 'relative' }}>
            <button
              className="lang-btn"
              onClick={() => document.getElementById('lang-menu').classList.toggle('open')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Globe size={16} />
              <span className="hide-mobile">{lang === 'Eng' ? 'English' : 'اردو'}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 2 }} className="hide-mobile">
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
                🇵🇰 Urdu (اردو)
              </button>
            </div>
          </div>
          <button className="profile-icon-btn" onClick={() => setShowProfile(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
            {user?.profilePic ? (
              <img 
                src={user.profilePic} 
                alt={user.name} 
                style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} 
              />
            ) : (
              <UserCircle size={20} />
            )}
            <span className="hide-mobile">{user?.name?.split(' ')[0]}</span>
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={16} /> <span className="hide-mobile">{lang === 'Eng' ? 'Logout' : 'لاگ آؤٹ'}</span>
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
                      <img src={org.profileBanner || org.image || "https://images.pexels.com/photos/6995136/pexels-photo-6995136.jpeg?auto=compress&cs=tinysrgb&w=800"} alt={org.name} loading="lazy" />
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
                  <p>{t(lang, 'No organizations found matching your search.', 'آپ کی تلاش کے مطابق کوئی تنظیم نہیں ملی۔')}</p>
                )}
              </div>
            </section>

            {/* Charity in Islam */}
            <section className="portal-section">
              <h2 className="section-title">{t(lang, 'Charity in Islam', 'اسلام میں صدقہ و خیرات')}</h2>
              <div className="islamic-cards-grid">
                <div className="islamic-card green-card">
                  <div className="arabic-text">وَمَا أَنفَقْتُم مِّن شَيْءٍ فَهُوَ يُخْلِفُهُ</div>
                  <p className="translation-text">{t(lang, '"And whatever you spend of good, He will replace it."', '"اور جو کچھ بھی تم (بھلائی میں) خرچ کرو گے، وہ اس کا نعم البدل دے گا۔"')}</p>
                  <span className="reference">- Surah Saba (34:39)</span>
                </div>
                <div className="islamic-card white-card">
                  <div className="arabic-text">خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ</div>
                  <p className="translation-text">{t(lang, '"The best of people are those that bring most benefit to the rest of mankind."', '"لوگوں میں سب سے بہتر وہ ہے جو دوسروں کو سب سے زیادہ فائدہ پہنچاتا ہے۔"')}</p>
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
                    {isCameraActive ? (
                      <div className="camera-container" style={{ position: 'relative', width: '100%', minHeight: '340px', backgroundColor: '#000', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '10px', marginBottom: '1rem' }}>
                        {/* Previews of already captured images */}
                        {files.length > 0 && (
                          <div className="captured-previews" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', width: '100%', zIndex: 10, background: 'rgba(0,0,0,0.5)', padding: '8px', borderRadius: '12px' }}>
                            {files.map((f, idx) => (
                              <div key={idx} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid #10b981' }}>
                                <img src={f.preview} alt="Captured Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <button
                                  type="button"
                                  onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                                  style={{
                                    position: 'absolute', top: '2px', right: '2px',
                                    background: 'rgba(239, 68, 68, 0.85)', color: 'white',
                                    border: 'none', borderRadius: '50%', width: '16px', height: '16px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '9px', cursor: 'pointer'
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: '12px' }} />
                        <div style={{ position: 'absolute', bottom: '15px', left: '0', right: '0', display: 'flex', justifyContent: 'center', gap: '15px' }}>
                          <button 
                            type="button"
                            onClick={capturePhoto} 
                            style={{ padding: '8px 16px', borderRadius: '30px', backgroundColor: '#10b981', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                          >
                            <Camera size={14} /> Capture Photo
                          </button>
                          <button 
                            type="button"
                            onClick={stopCamera} 
                            style={{ padding: '8px 16px', borderRadius: '30px', backgroundColor: '#ef4444', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.3)', fontSize: '0.85rem' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`} style={{ cursor: files.length >= 3 ? 'not-allowed' : 'pointer' }}>
                          <input {...getInputProps()} disabled={files.length >= 3} />
                          {files.length > 0 ? (
                            <div className="thumbnails-container" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }} onClick={e => e.stopPropagation()}>
                              {files.map((f, idx) => (
                                <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                                  <img src={f.preview} alt="Upload Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  <button
                                    type="button"
                                    onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                                    style={{
                                      position: 'absolute', top: '2px', right: '2px',
                                      background: 'rgba(239, 68, 68, 0.85)', color: 'white',
                                      border: 'none', borderRadius: '50%', width: '18px', height: '18px',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: '10px', cursor: 'pointer'
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                              {files.length < 3 && (
                                <div 
                                  onClick={(e) => { e.stopPropagation(); open(); }}
                                  style={{ width: '80px', height: '80px', border: '2px dashed rgba(255,255,255,0.15)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '20px', cursor: 'pointer' }}
                                >
                                  +
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="drop-placeholder">
                              <UploadCloud size={40} className="text-primary" />
                              <p>{t(lang, 'Drag & drop images here (Max 3), or click to select', 'تصاویر یہاں ڈریگ کریں (زیادہ سے زیادہ 3) یا کلک کریں')}</p>
                            </div>
                          )}
                        </div>
                        {files.length < 3 && (
                          <button 
                            type="button"
                            onClick={startCamera} 
                            style={{ marginTop: '12px', width: '100%', padding: '10px 16px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem' }}
                          >
                            <Camera size={16} /> Use Live Camera Instead
                          </button>
                        )}
                      </>
                    )}
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
                      <CustomDropdown
                        value={category}
                        onChange={val => {
                          setCategory(val);
                          setExpiryTime('');
                          setCondition('');
                        }}
                        options={[
                          { value: 'Food', label: '🍛 Food' },
                          { value: 'Medicine', label: '💊 Medicine' },
                          { value: 'Clothes', label: '👕 Clothes' },
                          { value: 'Household', label: '🏠 Household Items' },
                          { value: 'Grocery', label: '🛒 Grocery' }
                        ]}
                        placeholder="Select category..."
                        required
                      />
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
                        <CustomDropdown
                          value={condition}
                          onChange={setCondition}
                          options={[
                            { value: 'New', label: 'New / Unused' },
                            { value: 'Good', label: 'Good / Usable' },
                            { value: 'Used', label: 'Used / Worn' }
                          ]}
                          placeholder="Select condition..."
                          required
                        />
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
                            {isTranslatingDesc ? 'Translating...' : (isDescriptionTranslated ? 'Translate to English' : 'Translate to Urdu')}
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
                      <CustomDropdown
                        value={location}
                        onChange={val => { setLocation(val); setLatLng(val); }}
                        options={[
                          { value: 'Karachi', label: 'Karachi' },
                          { value: 'Lahore', label: 'Lahore' },
                          { value: 'Islamabad', label: 'Islamabad' },
                          { value: 'Peshawar', label: 'Peshawar' },
                          { value: 'Quetta', label: 'Quetta' },
                          { value: 'Multan', label: 'Multan' }
                        ]}
                        placeholder="Select your city..."
                        required
                      />
                    </div>

                    {validationError && (
                      <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Sun size={15} /> {validationError}
                      </div>
                    )}

                    <button type="submit" className="btn btn-primary submit-donate-btn" disabled={files.length === 0 || !location || !category || !donTitle || !itemType}>
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

                {/* Side-by-Side Unified Top Section */}
                <div className="rp-dashboard-top-row">
                  
                  {/* Left Column: Visual Scan Results */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    
                    {/* Status Hero Card (Scanned Image, Title, Score gauge) */}
                    <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-xl)', padding: '1.75rem', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {(aiResult?.imageUrl || files[0]?.preview) && (
                        <div style={{ width: '130px', height: '130px', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.15)', cursor: 'pointer', position: 'relative', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)', flexShrink: 0 }} onClick={() => setIsImageZoomed(true)}>
                          <img src={aiResult.imageUrl || files[0].preview} alt="Scanned preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'all 0.3s ease', color: 'white', fontWeight: 700, fontSize: '0.75rem' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>🔍 Zoom</div>
                        </div>
                      )}
                      
                      <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ background: 'rgba(255,255,255,0.15)', color: 'white', padding: '2px 8px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700 }}>✦ SYSTEM CHECK</span>
                            <span style={{ background: aiResult.recommendation === 'Accept' ? 'rgba(16,185,129,0.25)' : aiResult.recommendation === 'Review' ? 'rgba(234,179,8,0.25)' : 'rgba(239,68,68,0.25)', color: aiResult.recommendation === 'Accept' ? '#6ee7b7' : aiResult.recommendation === 'Review' ? '#fde047' : '#fca5a5', padding: '2px 8px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700, border: `1px solid ${aiResult.recommendation === 'Accept' ? 'rgba(16,185,129,0.4)' : aiResult.recommendation === 'Review' ? 'rgba(234,179,8,0.4)' : 'rgba(239,68,68,0.4)'}` }}>
                              {aiResult.recommendation === 'Accept' ? 'Approved' : aiResult.recommendation === 'Review' ? 'Needs Review' : 'Rejected'}
                            </span>
                          </div>
                          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', margin: 0 }}>{aiResult.itemName}</h2>
                        </div>

                        {/* Dial */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
                            <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                              <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.08)" strokeWidth="4" fill="transparent" />
                              <circle cx="24" cy="24" r="20" stroke={aiResult.recommendation === 'Rejected' ? '#ef4444' : aiResult.recommendation === 'Review' ? '#f59e0b' : '#10b981'} strokeWidth="4" fill="transparent" strokeDasharray={`${2 * Math.PI * 20}`} strokeDashoffset={`${2 * Math.PI * 20 * (1 - aiResult.safetyScore / 100)}`} style={{ strokeLinecap: 'round' }} />
                            </svg>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 900, color: 'white' }}>
                              {aiResult.safetyScore}%
                            </div>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>Safety Index</span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: aiResult.recommendation === 'Rejected' ? '#fca5a5' : aiResult.recommendation === 'Review' ? '#fde047' : '#6ee7b7', display: 'block' }}>
                              {aiResult.recommendation === 'Rejected' ? 'System Blocked' : aiResult.recommendation === 'Review' ? 'Attention Needed' : 'Fully Verified'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metric Cards Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                      {[
                        { label: t(lang, 'Category', 'زمرہ'), value: aiResult.detectedCategory, icon: '📦' },
                        { label: t(lang, 'Condition', 'حالت'), value: aiResult.condition, icon: '🔍' },
                        { label: t(lang, 'Freshness', 'تازگی'), value: aiResult.freshness, icon: '🌿' },
                        { label: t(lang, 'Est. Quantity', 'تخمینہ مقدار'), value: aiResult.estimatedItems, icon: '📊' },
                      ].map(m => (
                        <div key={m.label} style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 'var(--radius-lg)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '1.75rem' }}>{m.icon}</span>
                          <div>
                            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>{m.label}</div>
                            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--primary)', fontSize: '0.9rem' }}>{m.value}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: AI Analysis, Description & Recommendations */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    
                    {/* AI Analysis Report */}
                    <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6ee7b7', fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
                        <ShieldCheck size={16} /> {t(lang, 'AI Analysis Report', 'اے آئی تجزیاتی رپورٹ')}
                      </div>
                      <p style={{ color: 'var(--text-main)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>
                        "{aiResult.safetyNotes}"
                      </p>
                    </div>

                    {/* Item Description side card */}
                    <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
                        ✍️ {t(lang, 'Item Description', 'آئٹم کی تفصیل')}
                      </div>
                      {description ? (
                        <p style={{ color: 'var(--text-main)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
                          {description}
                        </p>
                      ) : (
                        <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', margin: 0, fontStyle: 'italic' }}>
                          No description provided for this item.
                        </p>
                      )}
                    </div>

                    {/* AI Recommendation */}
                    <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 'var(--radius-lg)', padding: '1rem', display: 'flex', gap: '10px' }}>
                      <span style={{ fontSize: '1.25rem' }}>🤖</span>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t(lang, 'AI Recommendation', 'اے آئی تجویز')}</div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.4, margin: '2px 0 0' }}>{t(lang, aiResult.matchReason, aiResult.matchReason)}</p>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Suggestions and Map side-by-side Row */}
                <div className="rp-dashboard-map-row">
                  
                  {/* Left Column: Matched Demand Suggestions list */}
                  <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      🎯 {t(lang, 'AI-Matched Receiver Demands', 'اے آئی سے مماثل وصول کنندگان کی مانگ')}
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
                      {t(lang, 'Based on your', 'آپ کے')} <strong style={{ color: 'var(--primary)' }}>{aiResult.detectedCategory}</strong> {t(lang, 'donation, these receivers need your help most:', 'عطیے ki buniyad par, in receivers ko aapki sabse zyada zaroorat hai:')}
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxH: '420px', flex: 1, paddingRight: '4px' }}>
                      {aiMatches.length > 0 ? (
                        aiMatches.slice(0, 5).map(match => (
                          <div key={match._id}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.85rem 1rem', background: selectedPost?._id === match._id ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${selectedPost?._id === match._id ? '#10b981' : 'rgba(255,255,255,0.06)'}`, borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'all 0.2s' }}
                            onClick={() => setSelectedPost(match)}
                            onMouseEnter={e => { if (selectedPost?._id !== match._id) e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)'; }}
                            onMouseLeave={e => { if (selectedPost?._id !== match._id) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                {match.receiverId?.profilePic ? (
                                  <img src={match.receiverId.profilePic} alt={match.receiverId.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <UserCircle size={18} color="#10b981" />
                                )}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <p style={{ fontWeight: 700, color: 'var(--text-main)', margin: 0, fontSize: '0.85rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{match.title}</p>
                                </div>
                                <p style={{ color: 'var(--text-dim)', margin: 0, fontSize: '0.75rem', marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                  {match.receiverId?.name || 'Verified NGO'} • {match.travelTimeMin}m ({match.distanceKm} km)
                                </p>
                              </div>
                            </div>
                            <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '99px', background: match.priority === 1 ? 'rgba(16,185,129,0.15)' : 'rgba(234,179,8,0.15)', color: match.priority === 1 ? '#10b981' : '#eab308', fontWeight: 700, flexShrink: 0 }}>
                              {match.priority === 1 ? 'Exact' : 'Category'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-dim)', border: '1px dashed rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-lg)', background: 'rgba(239,68,68,0.02)', fontSize: '0.82rem' }}>
                            ⚠️ {t(lang, 'No matching receiver requests found.', 'کوئی مماثل وصول کنندہ کی درخواست نہیں ملی۔')}
                          </div>
                          
                          {fallbackNGOs.length > 0 && (
                            <>
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '4px 0', fontWeight: 700 }}>
                                💡 {t(lang, 'Approved Fallback NGOs nearby:', 'قریبی منظور شدہ این جی اوز:')}
                              </p>
                              {fallbackNGOs.map(ngoItem => {
                                const mockPost = {
                                  _id: `ngo_${ngoItem.ngo?._id}`,
                                  receiverId: ngoItem.ngo,
                                  title: `Direct Donation to ${ngoItem.ngo?.name}`,
                                  desc: `Offering direct donation of ${aiResult?.itemName || 'items'}.`,
                                  urgency: 'Medium',
                                  createdAt: new Date().toISOString()
                                };
                                return (
                                  <div key={ngoItem.ngo?._id}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.85rem 1rem', background: selectedPost?.receiverId?._id === ngoItem.ngo?._id ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${selectedPost?.receiverId?._id === ngoItem.ngo?._id ? '#10b981' : 'rgba(255,255,255,0.06)'}`, borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'all 0.2s' }}
                                    onClick={() => setSelectedPost(mockPost)}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                      <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                        {ngoItem.ngo?.profilePic ? (
                                          <img src={ngoItem.ngo.profilePic} alt={ngoItem.ngo.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                          <Building2 size={18} color="#10b981" />
                                        )}
                                      </div>
                                      <div style={{ minWidth: 0 }}>
                                        <p style={{ fontWeight: 700, color: 'var(--text-main)', margin: 0, fontSize: '0.85rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{ngoItem.ngo?.name}</p>
                                        <p style={{ color: 'var(--text-dim)', margin: 0, fontSize: '0.75rem', marginTop: '2px' }}>
                                          {ngoItem.travelTimeMin}m ({ngoItem.distanceKm} km)
                                        </p>
                                      </div>
                                    </div>
                                    <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '99px', background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 700, flexShrink: 0 }}>NGO</span>
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
 
                  {/* Right Column: Smart Map & Selected NGO Details inline */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    
                    <SmartMap
                      category={aiResult.detectedCategory}
                      userLat={donLat}
                      userLng={donLng}
                      aiStatus={aiResult.safetyScore >= 50 ? 'active' : 'rejected'}
                      onSelectReceiver={(rec) => setSelectedMapPost(rec)}
                      receiverList={
                        aiMatches.length > 0
                           ? aiMatches
                          : fallbackNGOs.map(f => ({
                              _id: f.ngo?._id,
                              title: `Approved NGO: ${f.ngo?.name}`,
                              receiverId: f.ngo,
                              distanceKm: f.distanceKm,
                              travelTimeMin: f.travelTimeMin
                            }))
                      }
                    />
 
                    {/* Selected NGO Details Panel inline (Picture 5 layout) */}
                    {selectedMapPost && (
                      <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '18px', padding: '1.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
                          <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#6ee7b7', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Building2 size={18} /> Selected NGO Receiver:
                          </h4>
                          <button onClick={() => setSelectedMapPost(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={16} /></button>
                        </div>
 
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', fontSize: '0.9rem', color: '#cbd5e1' }}>
                          <p style={{ margin: 0 }}><strong style={{ color: 'white' }}>Name:</strong> {selectedMapPost.receiverId?.name || selectedMapPost.title}</p>
                          <p style={{ margin: 0 }}><strong style={{ color: 'white' }}>Email:</strong> {selectedMapPost.receiverId?.email || 'N/A'}</p>
                          <p style={{ margin: 0 }}><strong style={{ color: 'white' }}>Phone:</strong> {selectedMapPost.receiverId?.phone || 'N/A'}</p>
                          {selectedMapPost.receiverId?.location?.address && (
                            <p style={{ margin: 0 }}><strong style={{ color: 'white' }}>Address:</strong> {selectedMapPost.receiverId.location.address}</p>
                          )}
                          {selectedMapPost.title && selectedMapPost.title.indexOf('Direct Donation') === -1 && (
                            <p style={{ margin: 0, fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                              <strong style={{ color: 'white' }}>Requested Items:</strong> "{selectedMapPost.title}"
                            </p>
                          )}
                        </div>
 
                        <div className="pm-actions-row" style={{ marginTop: '1.25rem' }}>
                          <button className="btn btn-outline" onClick={() => setSelectedMapPost(null)}>
                            Cancel
                          </button>
                          <button className="btn btn-primary" onClick={() => handleSendNotification(selectedMapPost)}>
                            <Send size={14} /> Dispatch My Donation Here
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setFiles([]);
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

        {activeTab === 'zakat' && (
          <div className="zakat-tab-wrapper animate-fade-in" style={{ background: 'transparent', padding: '1rem 0' }}>
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
                  {myDonations.filter(d => d.status !== 'pending_receiver').length} total
                </span>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => { setActiveTab('home'); setFiles([]); }}
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
              <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
                <Heart size={48} color="rgba(255,255,255,0.15)" style={{ margin: '0 auto 1rem', display: 'block' }} />
                <h3 style={{ color: '#f1f5f9', marginBottom: '0.5rem' }}>{t(lang, 'No Donations Yet', 'کوئی عطیہ نہیں')}</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{t(lang, 'Start donating to help organizations in need.', 'ضرورت مند تنظیموں کی مدد کے لیے عطیہ کرنا شروع کریں۔')}</p>
                <button className="btn btn-primary" onClick={() => setActiveTab('home')}>{t(lang, 'New Donation →', 'نیا عطیہ ←')}</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {(() => {
                  const filtered = myDonations.filter(d => {
                    if (historyTab === 'rejected') return d.status === 'rejected';
                    if (historyTab === 'completed') return d.status === 'completed' || d.status === 'delivered';
                    return d.status !== 'rejected' && d.status !== 'completed' && d.status !== 'delivered' && d.status !== 'pending_receiver';
                  });

                  if (filtered.length === 0) {
                    return <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>No {historyTab} donations found.</div>;
                  }

                  // Define official 5 categories
                  const OFFICIAL_CATEGORIES = ['Grocery', 'Food', 'Household', 'Medicine', 'Clothes'];

                  // Group filtered donations by category (forcing Other/Meat into standard ones)
                  const groups = {
                    Grocery: [],
                    Food: [],
                    Household: [],
                    Medicine: [],
                    Clothes: []
                  };

                  filtered.forEach(d => {
                    let cat = d.category || 'Grocery';
                    if (cat === 'Meat') cat = 'Food';
                    if (!OFFICIAL_CATEGORIES.includes(cat)) {
                      cat = 'Grocery';
                    }
                    groups[cat].push(d);
                  });

                  const catIcons = {
                    Food: '🍔',
                    Medicine: '💊',
                    Clothes: '👕',
                    Household: '🏠',
                    Grocery: '🛒'
                  };

                  const countInSelected = groups[selectedHistoryCategory]?.length || 0;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {/* Category cards grid - 5 boxes exactly */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '0.5rem' }}>
                        {OFFICIAL_CATEGORIES.map(cat => {
                          const donsInCat = groups[cat] || [];
                          const count = donsInCat.length;
                          const icon = catIcons[cat] || '📦';
                          const isSelected = selectedHistoryCategory === cat;

                          return (
                            <div 
                              key={cat}
                              onClick={() => setSelectedHistoryCategory(cat)}
                              style={{ 
                                padding: '1.25rem 1rem', 
                                display: 'flex', 
                                flexDirection: 'column',
                                alignItems: 'center', 
                                justifyContent: 'center',
                                cursor: 'pointer', 
                                background: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.02)',
                                border: `1.5px solid ${isSelected ? '#10b981' : 'rgba(255,255,255,0.07)'}`,
                                borderRadius: '18px',
                                boxShadow: isSelected ? '0 8px 24px rgba(16,185,129,0.15)' : '0 4px 12px rgba(0,0,0,0.15)',
                                transition: 'all 0.25s ease',
                                transform: isSelected ? 'translateY(-2px)' : 'none'
                              }}
                              onMouseEnter={e => { 
                                if (!isSelected) {
                                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; 
                                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; 
                                }
                              }}
                              onMouseLeave={e => { 
                                if (!isSelected) {
                                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; 
                                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; 
                                }
                              }}
                            >
                              <span style={{ fontSize: '2rem', marginBottom: '8px' }}>{icon}</span>
                              <h3 style={{ margin: 0, fontWeight: 800, color: isSelected ? '#34d399' : '#f1f5f9', fontSize: '1rem' }}>{t(lang, cat, cat)}</h3>
                              <span style={{ 
                                background: count > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', 
                                color: count > 0 ? '#6ee7b7' : '#94a3b8', 
                                fontSize: '0.72rem', 
                                fontWeight: 800, 
                                padding: '2px 8px', 
                                borderRadius: 99, 
                                display: 'inline-block', 
                                marginTop: '6px' 
                              }}>
                                {count} {count === 1 ? 'Item' : 'Items'}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Expanded selected category items list */}
                      <div style={{ marginTop: '0.5rem' }}>
                        <h4 style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.2rem' }}>{catIcons[selectedHistoryCategory]}</span>
                          <span>{t(lang, selectedHistoryCategory, selectedHistoryCategory)} {t(lang, 'Donations', 'عطیات')}</span>
                        </h4>

                        {countInSelected === 0 ? (
                          <div style={{ textAlign: 'center', padding: '3.5rem 2rem', color: '#64748b', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.06)' }}>
                            No {historyTab} {selectedHistoryCategory} donations found.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {(groups[selectedHistoryCategory] || []).map(don => {
                              const status = don.status;
                              const statusConfig = {
                                pending_receiver: { label: '⏳ Pending Review', bg: '#fef9c3', color: '#713f12' },
                                accepted: { label: '✅ Accepted', bg: '#d1fae5', color: '#065f46' },
                                rejected: { label: '❌ Rejected', bg: '#fee2e2', color: '#991b1b' },
                                delivered: { label: '🚚 Delivered', bg: '#dbeafe', color: '#1e40af' },
                                completed: { label: '🎉 Completed', bg: '#dcfce3', color: '#166534' },
                              }[status] || { label: status, bg: '#f1f5f9', color: '#475569' };

                              return (
                                <div 
                                  key={don._id} 
                                  style={{ 
                                    background: 'rgba(255,255,255,0.02)', 
                                    borderRadius: '16px', 
                                    border: '1px solid rgba(255,255,255,0.07)', 
                                    overflow: 'hidden', 
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    cursor: 'pointer', 
                                    transition: 'all 0.2s' 
                                  }} 
                                  onClick={() => { setSelectedHistoryDonation(don); setActiveHistoryImgIdx(0); }} 
                                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} 
                                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                  {/* Status bar */}
                                  <div style={{ background: statusConfig.bg, padding: '8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: statusConfig.color, fontWeight: 700, fontSize: '0.85rem' }}>{statusConfig.label}</span>
                                    <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{new Date(don.createdAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>

                                  <div style={{ padding: '1.25rem 1.5rem' }}>
                                    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                      {/* Donation image */}
                                      {don.imageUrl ? (
                                        <img src={Array.isArray(don.imageUrl) ? don.imageUrl[0] : don.imageUrl} alt="Donation" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 10, border: '2px solid rgba(255,255,255,0.08)', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
                                      ) : (
                                        <div style={{ width: 90, height: 90, borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '2px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                          <Heart size={36} color="#10b981" />
                                        </div>
                                      )}

                                      {/* Info */}
                                      <div style={{ flex: 1, minWidth: 180 }}>
                                        <p style={{ fontWeight: 700, color: '#f1f5f9', margin: '0 0 6px', fontSize: '1.1rem' }}>{don.title}</p>
                                        <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#94a3b8' }}>Category: <strong style={{ color: '#10b981' }}>{don.category || 'General'}</strong></p>
                                        <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#94a3b8' }}>AI Safety Score: <strong style={{ color: don.status === 'rejected' ? '#ef4444' : '#10b981' }}>{don.aiSafetyScore}%</strong></p>

                                        {don.status === 'rejected' && (
                                          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '10px 14px', borderRadius: '8px', display: 'inline-block' }}>
                                            <p style={{ margin: 0, color: '#fca5a5', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.4 }}>{don.aiAnalysisReason}</p>
                                          </div>
                                        )}

                                        {/* Action Buttons */}
                                        {(historyTab === 'active') && (
                                          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                                            <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(don._id, 'completed'); }} style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Mark Completed</button>
                                            <button onClick={(e) => handleDeleteDonation(don._id, e)} style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                                          </div>
                                        )}
                                        {(historyTab === 'rejected') && (
                                          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                                            <button onClick={(e) => handleDeleteDonation(don._id, e)} style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '6px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Delete Record</button>
                                          </div>
                                        )}
                                      </div>

                                      {/* Receiver info */}
                                      {don.status === 'completed' && don.receiverId ? (
                                        <div
                                          style={{ background: 'rgba(16,185,129,0.08)', borderRadius: 12, padding: '1.2rem', minWidth: 240, border: '1px solid rgba(16,185,129,0.25)', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
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
                                              <p style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', color: '#f1f5f9' }}>{don.receiverId.name}</p>
                                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>{don.receiverId.city || 'Verified NGO'}</p>
                                            </div>
                                          </div>
                                          <div style={{ borderTop: '1px solid rgba(16,185,129,0.1)', paddingTop: '10px', marginTop: '6px' }}>
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
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ======================= NOTIFICATIONS TAB ======================= */}
        {activeTab === 'notifications' && (
          <div className="animate-fade-in" style={{ padding: '0.5rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h2 style={{ margin: 0 }}>{t(lang, 'Notification Center', 'اطلاعات کا مرکز')}</h2>
              </div>
              <button
                className="btn btn-outline"
                onClick={() => fetchData(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600 }}
              >
                <RefreshCw size={16} /> {t(lang, 'Refresh', 'تازہ کریں')}
              </button>
            </div>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              {t(lang, 'Track your matched donation statuses and coordinator messages.', 'اپنے مماثل عطیات اور رابطہ کار کے پیغامات کو ٹریک کریں۔')}
            </p>

            {/* Sub-tabs to filter Donation updates vs Messages */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '12px', width: 'fit-content' }}>
              <button
                style={{
                  background: notifTypeFilter === 'donations' ? 'var(--primary)' : 'transparent',
                  color: 'white',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onClick={() => setNotifTypeFilter('donations')}
              >
                <Package size={16} />
                {t(lang, 'Donation Activity', 'عطیات کی سرگرمی')}
                {donorNotifications.filter(n => n.status === 'accepted' || n.status === 'rejected').length > 0 && (
                  <span style={{ background: '#ef4444', color: 'white', borderRadius: 99, padding: '1px 6px', fontSize: '0.65rem' }}>
                    {donorNotifications.filter(n => n.status === 'accepted' || n.status === 'rejected').length}
                  </span>
                )}
              </button>
              <button
                style={{
                  background: notifTypeFilter === 'messages' ? 'var(--primary)' : 'transparent',
                  color: 'white',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onClick={() => setNotifTypeFilter('messages')}
              >
                <MessageSquare size={16} />
                {t(lang, 'Coordination Chats', 'رابطہ پیغامات')}
                 {recentChatMessages.filter(msg => (msg.senderId?._id || msg.senderId) !== (user?.id || user?._id) && !readMessageIds.includes(msg._id)).length > 0 && (
                  <span style={{ background: '#ef4444', color: 'white', borderRadius: 99, padding: '1px 6px', fontSize: '0.65rem' }}>
                    {recentChatMessages.filter(msg => (msg.senderId?._id || msg.senderId) !== (user?.id || user?._id) && !readMessageIds.includes(msg._id)).length}
                  </span>
                )}
              </button>
            </div>

            {notifTypeFilter === 'donations' && (
              <>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
                  <button
                    style={{
                      background: notifFilter === 'pending' ? '#10b981' : 'transparent',
                      color: notifFilter === 'pending' ? 'white' : '#64748b',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => setNotifFilter('pending')}
                  >
                    {t(lang, 'Pending Review', 'زیر جائزہ')}
                  </button>
                  <button
                    style={{
                      background: notifFilter === 'fulfilled' ? '#3b82f6' : 'transparent',
                      color: notifFilter === 'fulfilled' ? 'white' : '#64748b',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => setNotifFilter('fulfilled')}
                  >
                    {t(lang, 'Fulfilled / Resolved', 'تکمیل شدہ')}
                  </button>
                </div>

                {(() => {
                  const filteredNotifs = donorNotifications.filter(notif => {
                    if (notifFilter === 'fulfilled') {
                      return notif.status === 'accepted' || notif.status === 'completed' || notif.status === 'rejected';
                    }
                    return notif.status === 'pending';
                  });

                  if (filteredNotifs.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
                        <Bell size={48} color="rgba(255,255,255,0.15)" style={{ margin: '0 auto 1rem', display: 'block' }} />
                        <h3 style={{ color: '#f1f5f9', marginBottom: '0.5rem' }}>
                          {notifFilter === 'pending' ? t(lang, 'No Pending Notifications', 'کوئی زیر التوا اطلاع نہیں ہے') : t(lang, 'No Fulfilled Notifications', 'کوئی مکمل شدہ اطلاع نہیں ہے')}
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{t(lang, 'Your status updates will appear here.', 'آپ کے عطیہ کی حیثیت کی اپ ڈیٹس یہاں ظاہر ہوں گی۔')}</p>
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {filteredNotifs.map(notif => {
                        const isAccepted = notif.status === 'accepted';
                        const isRejected = notif.status === 'rejected';
                        const isPending = notif.status === 'pending';
                        const isCompleted = notif.status === 'completed';

                        let borderLeftColor = '#64748b';
                        let statusBg = '#f1f5f9';
                        let statusColor = '#475569';
                        let statusLabel = t(lang, 'Notification', 'اطلاع');

                        if (isAccepted) {
                          borderLeftColor = '#10b981';
                          statusBg = '#e0f2fe';
                          statusColor = '#0369a1';
                          statusLabel = t(lang, 'Fulfillment Accepted', 'قبول کر لیا گیا');
                        } else if (isRejected) {
                          borderLeftColor = '#ef4444';
                          statusBg = '#fee2e2';
                          statusColor = '#991b1b';
                          statusLabel = t(lang, 'Fulfillment Declined', 'مسترد کر دیا گیا');
                        } else if (isPending) {
                          borderLeftColor = '#f59e0b';
                          statusBg = '#fef9c3';
                          statusColor = '#713f12';
                          statusLabel = t(lang, 'Pending Review', 'زیر التوا');
                        } else if (isCompleted) {
                          borderLeftColor = '#3b82f6';
                          statusBg = '#dcfce3';
                          statusColor = '#166534';
                          statusLabel = t(lang, 'Fulfillment Completed', 'تکمیل شدہ');
                        }

                        return (
                          <div
                            key={notif._id}
                            style={{
                              background: 'rgba(255,255,255,0.02)',
                              borderRadius: '16px',
                              border: '1px solid rgba(255,255,255,0.07)',
                              borderLeft: `5px solid ${borderLeftColor}`,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                              overflow: 'hidden',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                              <span style={{ background: statusBg, color: statusColor, padding: '2px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 800 }}>
                                {statusLabel}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                                  {new Date(notif.updatedAt || notif.createdAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (window.confirm("Are you sure you want to delete this notification?")) {
                                      try {
                                        await axios.delete(`${API}/api/notifications/${notif._id}`, {
                                          headers: { 'x-auth-token': localStorage.getItem('token') }
                                        });
                                        fetchData();
                                      } catch (err) {
                                        console.error("Failed to delete notification:", err);
                                        alert("Failed to delete notification.");
                                      }
                                    }
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'background 0.2s'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  title="Delete Notification"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            <div style={{ padding: '1.25rem 1.5rem' }}>
                              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1.2, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <h4 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                                    {notif.donationId?.title || t(lang, 'Donation Item', 'عطیہ کی چیز')}
                                  </h4>
                                  <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                                    {isAccepted && (
                                      <>
                                        🎉 {t(lang, 'Your donation of', 'آپ کا عطیہ')} <strong>{notif.donationId?.title}</strong> ({t(lang, notif.donationId?.category || '', notif.donationId?.category || '')}) {t(lang, 'has been accepted by', 'قبول کر لیا گیا ہے بذریعہ')} <strong>{notif.receiverId?.name}</strong>. {t(lang, 'Please coordinate with them for pickup using the contact details below.', 'برائے مہربانی نیچے دیئے گئے رابطے کی تفصیلات کا استعمال کرتے ہوئے پک اپ کے لیے ان سے رابطہ کریں۔')}
                                      </>
                                    )}
                                    {isRejected && (
                                      <>
                                        ❌ {t(lang, 'Your matching request for', 'آپ کی عطیہ کی درخواست برائے')} <strong>{notif.donationId?.title}</strong> {t(lang, 'was declined by', 'مسترد کر دی گئی تھی بذریعہ')} <strong>{notif.receiverId?.name}</strong>. {t(lang, 'The donation has been returned to the pool and is now available for other organizations to match.', 'عطیہ کو دوبارہ پول میں واپس کر دیا گیا ہے اور اب یہ دیگر تنظیموں کے لیے دستیاب ہے۔')}
                                      </>
                                    )}
                                    {isPending && (
                                      <>
                                        ⏳ {t(lang, 'Your matched donation of', 'آپ کا عطیہ')} <strong>{notif.donationId?.title}</strong> {t(lang, 'is currently pending review by', 'زیر جائزہ ہے بذریعہ')} <strong>{notif.receiverId?.name}</strong>.
                                      </>
                                    )}
                                    {isCompleted && (
                                      <>
                                        🎉 {t(lang, 'Your donation of', 'آپ کا عطیہ')} <strong>{notif.donationId?.title}</strong> {t(lang, 'has been successfully completed by', 'کامیابی کے ساتھ مکمل کر لیا گیا ہے بذریعہ')} <strong>{notif.receiverId?.name}</strong>. {t(lang, 'Thank you for your generous contribution!', 'آپ کے سخاوت مندانہ تعاون کا شکریہ!')}
                                      </>
                                    )}
                                    {!isAccepted && !isRejected && !isPending && !isCompleted && notif.message}
                                  </p>
                                </div>

                                {notif.receiverId && (isAccepted || isCompleted || isPending) && (
                                  <div
                                    style={{
                                      flex: 1,
                                      minWidth: '280px',
                                      background: 'rgba(16, 185, 129, 0.04)',
                                      border: '1px solid rgba(16, 185, 129, 0.15)',
                                      borderRadius: '12px',
                                      padding: '1.25rem',
                                      boxShadow: '0 2px 8px rgba(0,0,0,0.01)'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                      <Building2 size={16} color="#10b981" />
                                      <strong style={{ color: '#34d399', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {t(lang, 'Receiver Profile Details', 'وصول کنندہ کے پروفائل کی تفصیلات')}
                                      </strong>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #064e3b, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                        {notif.receiverId.profilePic ? (
                                          <img src={notif.receiverId.profilePic} alt="Receiver" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                          <Building2 size={22} color="white" />
                                        )}
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: 800, color: '#f1f5f9', fontSize: '0.95rem' }}>{notif.receiverId.name}</div>
                                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>📍 {notif.receiverId.city || 'Verified NGO'}</div>
                                      </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.85rem' }}>
                                      <div>
                                        <span style={{ color: '#cbd5e1', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>
                                          {t(lang, 'Email Address', 'ای میل ایڈریس')}
                                        </span>
                                        <a href={`mailto:${notif.receiverId.email}`} style={{ color: '#10b981', fontWeight: 600, textDecoration: 'none' }}>
                                          {notif.receiverId.email}
                                        </a>
                                      </div>
                                      <div>
                                        <span style={{ color: '#cbd5e1', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>
                                          {t(lang, 'Contact Number', 'رابطہ نمبر')}
                                        </span>
                                        <a href={`tel:${notif.receiverId.phone}`} style={{ color: '#10b981', fontWeight: 600, textDecoration: 'none' }}>
                                          {notif.receiverId.phone}
                                        </a>
                                      </div>

                                      {notif.receiverId.location?.address && (
                                        <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(16, 185, 129, 0.1)', paddingTop: '8px' }}>
                                          <span style={{ color: '#cbd5e1', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>
                                            {t(lang, 'Street Address', 'گلی کا پتہ')}
                                          </span>
                                          <div style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: '10px' }}>
                                            {notif.receiverId.location.address}
                                          </div>
                                          {notif.receiverId.location.coordinates && (
                                            <a
                                              href={`https://www.google.com/maps/search/?api=1&query=${notif.receiverId.location.coordinates[1]},${notif.receiverId.location.coordinates[0]}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              style={{
                                                background: '#10b981',
                                                color: 'white',
                                                textDecoration: 'none',
                                                padding: '6px 12px',
                                                borderRadius: '6px',
                                                fontSize: '0.78rem',
                                                fontWeight: 700,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                boxShadow: '0 2px 4px rgba(16,185,129,0.2)'
                                              }}
                                            >
                                              <MapPin size={12} /> {t(lang, 'Open in Google Maps', 'گوگل میپس میں کھولیں')}
                                            </a>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}

            {notifTypeFilter === 'messages' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {recentChatMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <MessageSquare size={48} color="rgba(255,255,255,0.15)" style={{ margin: '0 auto 1rem', display: 'block' }} />
                    <h3 style={{ color: '#f1f5f9', marginBottom: '0.5rem' }}>
                      {t(lang, 'No Messages Yet', 'ابھی تک کوئی پیغام نہیں ہے')}
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{t(lang, 'Coordination chats with receivers will appear here.', 'پیغامات یہاں ظاہر ہوں گے۔')}</p>
                  </div>
                ) : (
                  recentChatMessages.map(msg => {
                    const donationItem = msg.donationId;
                    const donationTitle = donationItem?.title || 'Donated Item';
                    const partner = (msg.senderId?._id || msg.senderId) === (user?.id || user?._id) ? msg.receiverId : msg.senderId;
                    const partnerName = partner?.name || 'Verified Partner';
                    const isMe = (msg.senderId?._id || msg.senderId) === (user?.id || user?._id);
                    const isUnread = !isMe && !readMessageIds.includes(msg._id);
                    const formattedTime = new Date(msg.createdAt).toLocaleString('en-PK', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    });

                    return (
                      <div
                        key={msg._id}
                        onClick={() => {
                          if (donationItem) {
                            setActiveChatDonationId(donationItem._id || donationItem);
                            setActiveChatDonation(donationItem);
                            if (isUnread) {
                              const updatedRead = [...readMessageIds, msg._id];
                              setReadMessageIds(updatedRead);
                              localStorage.setItem('readMessageIds', JSON.stringify(updatedRead));
                            }
                          }
                        }}
                        style={{
                          background: isUnread ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                          border: isUnread ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '16px',
                          padding: '1.25rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '1rem'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.borderColor = 'var(--primary)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.borderColor = isUnread ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)';
                        }}
                      >
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <div style={{
                            width: '48px', height: '48px', borderRadius: '50%',
                            background: isUnread ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: isUnread ? '#10b981' : '#94a3b8'
                          }}>
                            <MessageSquare size={24} />
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontWeight: 700, color: 'white' }}>{partnerName}</span>
                              <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '12px', color: '#94a3b8' }}>
                                {donationTitle}
                              </span>
                              {isUnread && (
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                              )}
                            </div>
                            <p style={{ color: '#cbd5e1', margin: 0, fontSize: '0.9rem', maxWidth: '500px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {isMe ? `${t(lang, 'You: ', 'آپ: ')}` : ''}{msg.text}
                            </p>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b' }}>
                          <div>{formattedTime}</div>
                          <div style={{ color: '#10b981', marginTop: '4px', fontWeight: 600 }}>
                            {t(lang, 'Click to Reply', 'جواب دینے کے لیے کلک کریں')} →
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* ======================= AI FORECAST TAB ======================= */}
        {activeTab === 'ai_forecast' && (
          <div className="animate-fade-in" style={{ padding: '0.5rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '1rem' }} className="rp-notif-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={24} color="#10b981" /> {t(lang, 'AI Demand & Need Forecasting', 'اے آئی مانگ اور ضرورت کی پیشن گوئی')}
                </h2>
                <span style={{ background: '#f0fdf4', color: '#065f46', borderRadius: 99, padding: '3px 12px', fontSize: '0.8rem', fontWeight: 700 }}>
                  Live Insights
                </span>
              </div>
              <button
                className="btn btn-outline"
                onClick={fetchForecastData}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600 }}
              >
                <RefreshCw size={16} /> {t(lang, 'Refresh Forecast', 'پیشن گوئی تازہ کریں')}
              </button>
            </div>
            <p style={{ color: '#64748b', marginBottom: '2rem' }}>
              {t(lang, 'SpareShare AI analyzes historical donation postings, live receiver requests, and seasonal weather patterns to predict community requirements in advance.', 'سپیئر شیئر اے آئی تاریخی عطیات کی پوسٹنگ، براہ راست وصول کنندگان کی درخواستوں، اور موسمی حالات کا تجزیہ کر کے پیشگی کمیونٹی کی ضروریات کی پیشن گوئی کرتا ہے۔')}
            </p>

            {loadingForecast ? (
              <div style={{ textAlign: 'center', padding: '6rem 2rem' }}>
                <div style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,0.06)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1.5rem' }} />
                <p style={{ color: '#94a3b8', fontWeight: 600 }}>Analyzing database trends & running predictive modeling...</p>
              </div>
            ) : forecastError ? (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px', padding: '2rem', textAlign: 'center', color: '#f87171' }}>
                <p style={{ fontSize: '1rem', fontWeight: 600 }}>⚠️ {forecastError}</p>
                <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={fetchForecastData}>Retry Fetch</button>
              </div>
            ) : forecastData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* AI Coordinator Summary Card */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.4) 0%, rgba(4, 120, 87, 0.1) 100%)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '24px',
                  padding: '2rem',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.3)'
                }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, padding: '12px 20px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '0.75rem', fontWeight: 800, borderBottomLeftRadius: 16 }}>
                    🧠 SPARESHARE AI COORDINATOR
                  </div>
                  <h3 style={{ margin: '0 0 12px', fontSize: '1.25rem', color: '#34d399', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={20} /> AI Analytical Outlook
                  </h3>
                  <p style={{ color: '#e2e8f0', fontSize: '1.05rem', lineHeight: 1.7, margin: 0 }}>
                    {forecastData.aiSummary}
                  </p>
                  <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.8rem' }}>
                    <Clock size={14} /> Last updated: {new Date(forecastData.lastUpdated).toLocaleString()}
                  </div>
                </div>

                {/* Category Forecasts and Hotspots Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
                  
                  {/* Category Demand Scores */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '1.5rem 2rem' }}>
                    <h3 style={{ color: 'white', fontSize: '1.15rem', fontWeight: 800, marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
                      Category Demand Probability
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {forecastData.forecasts.map(f => {
                        const isHigh = f.demandScore >= 70;
                        const isMod = f.demandScore >= 40;
                        const barColor = isHigh ? 'linear-gradient(90deg, #ef4444, #f59e0b)' : isMod ? 'linear-gradient(90deg, #f59e0b, #eab308)' : 'linear-gradient(90deg, #10b981, #34d399)';
                        const iconMap = { Food: '🍔', Medicine: '💊', Clothes: '👕', Grocery: '🛒', Household: '🏠' };
                        
                        return (
                          <div key={f.category}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9' }}>
                                {iconMap[f.category] || '📦'} {f.category}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '0.78rem', background: f.trend === 'Increasing' ? 'rgba(239,68,68,0.1)' : f.trend === 'Decreasing' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)', color: f.trend === 'Increasing' ? '#ef4444' : f.trend === 'Decreasing' ? '#10b981' : '#94a3b8', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                                  {f.trend === 'Increasing' ? '📈 Rising' : f.trend === 'Decreasing' ? '📉 Falling' : '➡️ Stable'}
                                </span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f1f5f9' }}>{f.demandScore}%</span>
                              </div>
                            </div>
                            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                              <div style={{ width: `${f.demandScore}%`, height: '100%', background: barColor, borderRadius: '99px' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', marginTop: '6px' }}>
                              <span>Requests: {f.activeRequests}</span>
                              <span>Available Supply: {f.activeDonations}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hotspots Section */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '1.5rem 2rem' }}>
                    <h3 style={{ color: 'white', fontSize: '1.15rem', fontWeight: 800, marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
                      Regional Demand Hotspots
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {forecastData.hotspots.map((h, i) => {
                        const isCritical = h.urgency === 'Critical';
                        const badgeColor = isCritical ? '#fee2e2' : h.urgency === 'High' ? '#fef3c7' : '#e0f2fe';
                        const badgeTextColor = isCritical ? '#991b1b' : h.urgency === 'High' ? '#92400e' : '#0369a1';
                        
                        return (
                          <div 
                            key={i} 
                            style={{ 
                              background: 'rgba(255,255,255,0.01)', 
                              border: '1px solid rgba(255,255,255,0.04)', 
                              borderRadius: '16px', 
                              padding: '1rem', 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center' 
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <MapPin size={18} />
                              </div>
                              <div>
                                <h4 style={{ margin: 0, color: 'white', fontWeight: 700, fontSize: '0.95rem' }}>{h.area}</h4>
                                <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '0.78rem' }}>
                                  Primary Need: <strong style={{ color: '#cbd5e1' }}>{h.primaryDemand}</strong>
                                </p>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ background: badgeColor, color: badgeTextColor, padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-block' }}>
                                {h.urgency}
                              </span>
                              <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                                {h.totalRequests} active request{h.totalRequests !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* Direct Action Suggestion Panel */}
                <div style={{
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px dashed rgba(16, 185, 129, 0.3)',
                  borderRadius: '20px',
                  padding: '1.5rem 2rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5rem',
                  flexWrap: 'wrap',
                  marginTop: '1rem'
                }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
                    <Zap size={24} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 4px', color: 'white', fontWeight: 800, fontSize: '1.05rem' }}>Actionable Recommendation for You</h4>
                    <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.5 }}>
                      We recommend donating <strong style={{ color: '#10b981' }}>{forecastData.forecasts.sort((a,b) => b.demandScore - a.demandScore)[0]?.category}</strong> items located around <strong style={{ color: '#10b981' }}>{forecastData.hotspots[0]?.area || 'Lahore'}</strong> to address the most critical current shortage.
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      const mostDemandedCat = forecastData.forecasts.sort((a,b) => b.demandScore - a.demandScore)[0]?.category || 'Food';
                      setCategory(mostDemandedCat);
                      setActiveTab('home');
                    }}
                    className="btn btn-primary" 
                    style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}
                  >
                    Donate Now
                  </button>
                </div>

              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255,255,255,0.02)', borderRadius: 16 }}>
                <p style={{ color: '#94a3b8' }}>Failed to retrieve community forecasting reports.</p>
                <button className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={fetchForecastData}>Load Dashboard</button>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Receiver Post Details Modal */}
      {selectedPost && (
        <div className="modal-overlay" onClick={() => setSelectedPost(null)} style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0, 0, 0, 0.75)' }}>
          <div className="modal-content post-modal pm-card-padded" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, width: '95%', background: 'rgba(8, 15, 30, 0.98)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '24px', boxShadow: '0 25px 60px rgba(0,0,0,0.65)', color: 'white', position: 'relative' }}>
            <button className="close-modal" onClick={() => setSelectedPost(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}><X size={16} /></button>
            
            <div className="post-modal-header" style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', border: '2px solid rgba(16, 185, 129, 0.3)', flexShrink: 0 }}>
                {selectedPost.receiverId?.profilePic ? (
                  <img src={selectedPost.receiverId.profilePic} alt={selectedPost.receiverId.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <UserCircle size={32} color="#10b981" />
                )}
              </div>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'white' }}>{selectedPost.receiverId?.name || 'Verified NGO'}</h2>
                <p className="badge-verified" style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.8rem', fontWeight: 700 }}><ShieldCheck size={14} /> SpareShare AI Verified</p>
              </div>
            </div>

            <div className="post-modal-body">
              <div className="pm-demand-box" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', borderRadius: '16px', marginBottom: '15px' }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '0.92rem', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 800 }}>Receiver Details</h3>
                <div className="pm-details-grid">
                  <div><strong style={{ color: 'white' }}>Name:</strong> {selectedPost.receiverId?.name || 'NGO'}</div>
                  <div><strong style={{ color: 'white' }}>City:</strong> {selectedPost.receiverId?.city || 'Pakistan'}</div>
                  <div className="pm-details-email"><strong style={{ color: 'white' }}>Email:</strong> {selectedPost.receiverId?.email || 'N/A'}</div>
                </div>
              </div>

              <div className="pm-demand-box" style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '16px', borderRadius: '16px', marginBottom: '15px' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '0.92rem', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 800 }}>{t(lang, "Receiver's Demand", 'وصول کنندہ کی مانگ')}</h3>
                <p className="pm-demand-text" style={{ fontSize: '1.15rem', fontWeight: 800, margin: '8px 0 12px', color: 'white', fontStyle: 'italic' }}>"{selectedPost.title}"</p>
                <div className="pm-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: '#9ca3af' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={13} /> {new Date(selectedPost.createdAt).toLocaleDateString()}</span>
                  <span className="urgency-badge" style={{ background: selectedPost.urgency === 'Critical' || selectedPost.urgency === 'High' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)', color: selectedPost.urgency === 'Critical' || selectedPost.urgency === 'High' ? '#ef4444' : '#f59e0b', padding: '3px 10px', borderRadius: 99, fontWeight: 700, fontSize: '0.75rem' }}>{selectedPost.urgency} Urgency</span>
                </div>
              </div>

              <div className="pm-proof" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', borderRadius: '16px', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '0.92rem', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}><ImageIcon size={16} /> {t(lang, 'Description', 'تفصیل')}</h3>
                <p className="pm-proof-desc" style={{ fontSize: '0.92rem', color: '#9ca3af', margin: 0, lineHeight: 1.6 }}>{selectedPost.desc || 'No description provided.'}</p>
              </div>

              <div className="pm-actions-row">
                <button className="btn btn-outline" onClick={() => setSelectedPost(null)}>{t(lang, 'Cancel', 'منسوخ کریں')}</button>
                <button className="btn btn-primary" onClick={() => handleSendNotification(selectedPost)}>
                  <Send size={16} /> {t(lang, 'Dispatch My Donation Here', 'میرا عطیہ یہاں بھیجیں')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedHistoryDonation && (
        <div className="modal-overlay" onClick={() => { setSelectedHistoryDonation(null); setActiveHistoryImgIdx(0); }} style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0, 0, 0, 0.75)' }}>
          <div className="modal-content post-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, padding: 0, overflowY: 'auto', maxHeight: '85vh', background: 'rgba(10, 18, 36, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '24px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', color: 'white' }}>
            <div style={{ position: 'relative', height: 260, overflow: 'hidden', background: '#070f1e' }}>
              {selectedHistoryDonation.imageUrl ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                   {(() => {
                    const imgs = Array.isArray(selectedHistoryDonation.imageUrl) 
                      ? selectedHistoryDonation.imageUrl 
                      : [selectedHistoryDonation.imageUrl];
                    const activeImg = imgs[activeHistoryImgIdx] || imgs[0];
                    return (
                      <>
                        <img src={activeImg} alt="Donation" style={{ width: '100%', height: imgs.length > 1 ? '190px' : '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                        {imgs.length > 1 && (
                          <div style={{ display: 'flex', gap: '8px', padding: '6px', overflowX: 'auto', background: 'rgba(0,0,0,0.4)', height: '70px', justifyContent: 'center', alignItems: 'center' }}>
                            {imgs.map((im, idx) => (
                              <img
                                key={idx}
                                src={im}
                                alt="Thumbnail"
                                onClick={() => setActiveHistoryImgIdx(idx)}
                                style={{
                                  width: '45px', height: '45px', objectFit: 'cover', borderRadius: '6px',
                                  border: activeHistoryImgIdx === idx ? '2px solid #10b981' : '2px solid rgba(255,255,255,0.1)',
                                  cursor: 'pointer', transition: 'all 0.2s'
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #0f172a, #1e293b)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={56} color="#475569" />
                </div>
              )}
              {/* Glowing overlay shadow on header image */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(10,18,36,0.95) 100%)', pointerEvents: 'none' }} />
              <button className="close-modal" onClick={() => { setSelectedHistoryDonation(null); setActiveHistoryImgIdx(0); }} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', zIndex: 10 }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.85)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.6)'}><X size={16} /></button>
            </div>

            <div style={{ padding: '1.75rem', marginTop: '-20px', position: 'relative', zIndex: 2 }}>
              <h2 style={{ margin: '0 0 10px', fontSize: '1.75rem', fontWeight: 900, color: 'white', fontFamily: 'var(--font-heading)', letterSpacing: '-0.5px' }}>{selectedHistoryDonation.title}</h2>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <span style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '4px 12px', borderRadius: 99, fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 700, border: '1px solid rgba(255,255,255,0.06)' }}>{selectedHistoryDonation.category}</span>
                <span style={{ background: selectedHistoryDonation.status === 'rejected' ? 'rgba(239,68,68,0.15)' : selectedHistoryDonation.status === 'completed' ? 'rgba(16,185,129,0.15)' : 'rgba(14,165,233,0.15)', padding: '4px 12px', borderRadius: 99, fontSize: '0.75rem', color: selectedHistoryDonation.status === 'rejected' ? '#fca5a5' : selectedHistoryDonation.status === 'completed' ? '#6ee7b7' : '#7dd3fc', fontWeight: 700, border: `1px solid ${selectedHistoryDonation.status === 'rejected' ? 'rgba(239,68,68,0.25)' : selectedHistoryDonation.status === 'completed' ? 'rgba(16,185,129,0.25)' : 'rgba(14,165,233,0.25)'}` }}>
                  {selectedHistoryDonation.status.toUpperCase()}
                </span>
              </div>

              {/* Obsidian-glass Details Panel */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1.25rem', borderRadius: '16px', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.06)', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)' }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Donation Parameters</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.88rem', color: 'rgba(255, 255, 255, 0.85)' }}>
                  <div><strong style={{ color: 'rgba(255,255,255,0.5)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '2px' }}>Condition</strong> {selectedHistoryDonation.condition || 'Good'}</div>
                  <div><strong style={{ color: 'rgba(255,255,255,0.5)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '2px' }}>Quantity</strong> {selectedHistoryDonation.quantity || 'N/A'}</div>
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', marginTop: '4px' }}>
                    <strong style={{ color: 'rgba(255,255,255,0.5)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '2px' }}>Description</strong>
                    <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.4, color: 'white' }}>{selectedHistoryDonation.description || 'No description provided.'}</p>
                  </div>
                </div>
              </div>

              {/* Glowing Safety Report */}
              <div style={{ background: selectedHistoryDonation.status === 'rejected' ? 'rgba(239, 68, 68, 0.07)' : 'rgba(16, 185, 129, 0.07)', border: `1px solid ${selectedHistoryDonation.status === 'rejected' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`, borderRadius: '16px', padding: '1.25rem', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <ShieldCheck size={18} color={selectedHistoryDonation.status === 'rejected' ? '#f87171' : '#34d399'} />
                  <strong style={{ color: selectedHistoryDonation.status === 'rejected' ? '#f87171' : '#34d399', fontSize: '0.9rem', fontWeight: 800 }}>AI Safety Report (Score: {selectedHistoryDonation.aiSafetyScore}%)</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.55 }}>
                  {selectedHistoryDonation.aiAnalysisReason}
                </p>
              </div>

              {/* Receiver Organization Details (Attribution Modal Box) */}
              {(selectedHistoryDonation.status === 'completed' || selectedHistoryDonation.receiverId) && (
                <div style={{ 
                  marginTop: '1.25rem', 
                  background: 'rgba(59, 130, 246, 0.05)', 
                  border: '1px solid rgba(59, 130, 246, 0.2)', 
                  borderRadius: '16px', 
                  padding: '1.25rem', 
                  boxShadow: '0 8px 32px rgba(0,0,0,0.15)' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '1.25rem' }}>🏢</span>
                    <strong style={{ color: '#60a5fa', fontSize: '0.9rem', fontWeight: 800 }}>Fulfillment NGO</strong>
                  </div>
                  {selectedHistoryDonation.receiverId ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {selectedHistoryDonation.receiverId.profilePic ? (
                          <img src={selectedHistoryDonation.receiverId.profilePic} alt="Receiver" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>🏢</span>
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: 'white', fontSize: '0.95rem' }}>{selectedHistoryDonation.receiverId.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>
                          📍 {selectedHistoryDonation.receiverId.city || 'Karachi, Pakistan'} • 🏷️ {selectedHistoryDonation.receiverId.orgType || 'NGO'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>🏢</span>
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: 'white', fontSize: '0.95rem' }}>{selectedHistoryDonation.receiverDetails?.name || 'Verified Partner'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>
                          📍 {selectedHistoryDonation.receiverDetails?.city || 'Pakistan'} • 🏷️ Verified NGO
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Coordination Live Chat System Toggle */}
              {(selectedHistoryDonation.status === 'completed' || selectedHistoryDonation.receiverId) && (
                <div style={{ 
                  marginTop: '1.25rem', 
                  background: 'rgba(16, 185, 129, 0.03)', 
                  border: '1px solid rgba(16, 185, 129, 0.15)', 
                  borderRadius: '16px', 
                  padding: '1.25rem',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>💬</span>
                    <strong style={{ color: '#34d399', fontSize: '0.9rem', fontWeight: 800 }}>Coordination Chat</strong>
                  </div>
                  <button 
                    onClick={() => {
                      if (activeChatDonationId === selectedHistoryDonation._id) {
                        setActiveChatDonationId(null);
                        setActiveChatDonation(null);
                      } else {
                        setActiveChatDonationId(selectedHistoryDonation._id);
                        setActiveChatDonation(selectedHistoryDonation);
                      }
                    }}
                    className="btn"
                    style={{
                      padding: '8px 16px', fontSize: '0.82rem', borderRadius: '10px',
                      background: activeChatDonationId === selectedHistoryDonation._id ? 'rgba(239,68,68,0.15)' : '#10b981',
                      color: activeChatDonationId === selectedHistoryDonation._id ? '#fca5a5' : 'white',
                      border: 'none', cursor: 'pointer', fontWeight: 700
                    }}
                  >
                    {activeChatDonationId === selectedHistoryDonation._id ? 'Close Chat Drawer' : 'Open Chat Panel'}
                  </button>
                </div>
              )}

              {/* Trust Metrics Rating */}
              {selectedHistoryDonation.status === 'completed' && (
                <div style={{ background: 'rgba(245, 158, 11, 0.04)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '16px', padding: '1.25rem', marginTop: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ⭐ Rate & Review Receiver
                  </h3>
                  {selectedHistoryDonation.donorRating ? (
                    <div>
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star
                            key={star}
                            size={20}
                            fill={star <= selectedHistoryDonation.donorRating ? '#f59e0b' : 'none'}
                            color={star <= selectedHistoryDonation.donorRating ? '#f59e0b' : '#64748b'}
                          />
                        ))}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.84rem', color: 'rgba(255,255,255,0.7)' }}>
                        You rated this organization {selectedHistoryDonation.donorRating} out of 5 stars.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ margin: '0 0 10px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
                        Provide a trust score review based on your pickup or interaction experience to prevent fraud and update organization trust score.
                      </p>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star
                            key={star}
                            size={24}
                            style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                            fill={(hoveredRating || selectedRating) >= star ? '#f59e0b' : 'none'}
                            color={(hoveredRating || selectedRating) >= star ? '#f59e0b' : '#64748b'}
                            onMouseEnter={() => setHoveredRating(star)}
                            onMouseLeave={() => setHoveredRating(0)}
                            onClick={() => setSelectedRating(star)}
                          />
                        ))}
                      </div>
                      <textarea
                        value={ratingComment}
                        onChange={e => setRatingComment(e.target.value)}
                        placeholder="Write a brief review about this exchange (e.g. was there any suspicious activity?)..."
                        style={{
                          width: '100%',
                          minHeight: '60px',
                          background: 'rgba(0,0,0,0.25)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: 'white',
                          fontSize: '0.85rem',
                          marginBottom: '10px',
                          resize: 'vertical',
                          outline: 'none'
                        }}
                      />
                      <button
                        className="btn btn-primary"
                        style={{
                          background: 'linear-gradient(to right, #f59e0b, #d97706)',
                          borderColor: '#f59e0b',
                          fontSize: '0.8rem',
                          padding: '6px 14px',
                          borderRadius: '10px',
                          cursor: selectedRating === 0 || isSubmittingRating ? 'not-allowed' : 'pointer',
                          opacity: selectedRating === 0 || isSubmittingRating ? 0.6 : 1
                        }}
                        disabled={selectedRating === 0 || isSubmittingRating}
                        onClick={() => submitRating(selectedHistoryDonation._id)}
                      >
                        {isSubmittingRating ? 'Submitting...' : 'Submit Rating & Review'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isImageZoomed && (aiResult?.imageUrl || files[0]?.preview) && (
        <div className="modal-overlay" onClick={() => setIsImageZoomed(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setIsImageZoomed(false)} style={{ position: 'absolute', top: 24, right: 24, color: 'white', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 44, height: 44, cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          <img src={aiResult.imageUrl || files[0].preview} alt="Zoomed View" style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '16px' }} onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Sliding Floating Coordination Chat Drawer */}
      {activeChatDonationId && (() => {
        const donationItem = activeChatDonation || myDonations.find(d => d._id === activeChatDonationId) || selectedHistoryDonation;
        if (!donationItem) return null;

        const partnerName = donationItem.receiverId?.name || donationItem.receiverDetails?.name || 'Verified Partner';
        const partnerPic = donationItem.receiverId?.profilePic;

        return (
          <div className="chat-drawer-container" style={{
            position: 'fixed',
            bottom: chatPosition ? undefined : '20px',
            right: chatPosition ? undefined : '20px',
            left: chatPosition ? `${chatPosition.x}px` : undefined,
            top: chatPosition ? `${chatPosition.y}px` : undefined,
            width: '380px',
            height: isChatMinimized ? '60px' : '480px',
            background: 'rgba(10, 18, 36, 0.95)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '24px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(16, 185, 129, 0.1)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backdropFilter: 'blur(16px)',
            transition: chatPosition ? 'none' : 'height 0.3s ease-in-out, width 0.3s ease-in-out'
          }}>
            {/* Header with Drag Handler */}
            <div 
              onMouseDown={handleChatDragStart}
              style={{
                padding: '12px 18px',
                background: 'linear-gradient(90deg, rgba(6, 78, 59, 0.8) 0%, rgba(4, 120, 87, 0.8) 100%)',
                borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'move',
                userSelect: 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #10b981' }}>
                  {partnerPic ? (
                    <img src={partnerPic} alt={partnerName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '1rem' }}>🏢</span>
                  )}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'white', fontWeight: 800 }}>{partnerName}</h4>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                    Online Coordination
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onMouseDown={e => e.stopPropagation()}>
                <button
                  onClick={() => setIsChatMinimized(!isChatMinimized)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '0.8rem'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                >
                  {isChatMinimized ? '🗖' : '➖'}
                </button>
                <button 
                  onClick={() => { setActiveChatDonationId(null); setActiveChatDonation(null); }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '0.8rem'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                >
                  ✕
                </button>
              </div>
            </div>

            {!isChatMinimized && (
              <>
                {/* Donation Item Context Card */}
                <div style={{
                  padding: '8px 16px',
                  background: 'rgba(255,255,255,0.02)',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>Regarding: <strong>{donationItem.title}</strong></span>
                  <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', padding: '2px 8px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 700 }}>
                    {donationItem.category || 'General'}
                  </span>
                </div>

                {/* Messages List */}
                <div className="chat-messages-list" style={{
                  flex: 1,
                  padding: '16px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  background: '#070d19'
                }}>
                  {chatMessages.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center', margin: 'auto', padding: '0 20px', lineHeight: 1.5 }}>
                      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💬</div>
                      Coordinate pickup locations, timings, and delivery guidelines directly with your partner here.
                    </div>
                  ) : (
                    chatMessages.map(msg => {
                      const isMe = (msg.senderId?._id || msg.senderId) === (user?.id || user?._id);
                      return (
                        <div key={msg._id} style={{ display: 'flex', flexDirection: 'column', alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                          <div style={{ 
                            padding: '10px 14px',
                            borderRadius: isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                            fontSize: '0.82rem',
                            lineHeight: 1.45,
                            background: isMe ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)' : 'rgba(255,255,255,0.06)',
                            color: 'white',
                            border: `1px solid ${isMe ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)'}`,
                            boxShadow: isMe ? '0 4px 12px rgba(16, 185, 129, 0.15)' : 'none'
                          }}>
                            {msg.text}
                          </div>
                          <span style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '3px', alignSelf: isMe ? 'flex-end' : 'flex-start', padding: '0 4px' }}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Input Form */}
                <form onSubmit={sendChatMessage} style={{
                  display: 'flex',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  padding: '10px',
                  background: '#0a1224',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <input
                    type="text"
                    value={chatText}
                    onChange={e => setChatText(e.target.value)}
                    placeholder="Type coordination message..."
                    style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      color: 'white',
                      fontSize: '0.82rem',
                      padding: '10px 14px',
                      outline: 'none'
                    }}
                  />
                  <button 
                    type="submit" 
                    disabled={isSendingChat || !chatText.trim()}
                    style={{
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      width: '40px',
                      height: '40px',
                      cursor: !chatText.trim() ? 'not-allowed' : 'pointer',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                      transition: 'all 0.2s',
                      flexShrink: 0
                    }}
                  >
                    ➔
                  </button>
                </form>
              </>
            )}
          </div>
        );
      })()}

    </div>
  );
};

// Quick helper

export default ContributorPortal;
