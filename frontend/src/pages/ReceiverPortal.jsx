import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useLang } from '../context/AuthContext';
import axios from 'axios';

import {
  LogOut, Search, Globe, Building2, List, BellRing,
  ShieldCheck, Phone, Mail, UserCircle, MapPin, Check, X, Camera,
  Activity, ScanLine, Clock, ArrowRight, CheckCircle2, XCircle, Trash2, Star,
  RefreshCw, Menu, MessageSquare, Package, Minus, ChevronUp
} from 'lucide-react';
import ProfilePage from '../components/ProfilePage';
import CustomDropdown from '../components/CustomDropdown';
import DirectionMap from '../components/DirectionMap';
import './ReceiverPortal.css';

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

const mockDonors = [
  { id: 'mock1', name: 'Ali Rahman', city: 'Karachi', bio: 'Individually contributing surplus food and medicines to local communities since 2024.', phone: '+92 300 1234567', email: 'ali.rahman@gmail.com', type: 'Individual', activeDonations: ['Paracetamol Packs', 'Surplus Rice (5kg)'], avgRating: 4.8, ratingCount: 15 },
  { id: 'mock2', name: 'Kababjees Restaurant', city: 'Karachi', bio: 'Premium restaurant chain dedicated to zero food waste. Partnering to share dinner packages.', phone: '+92 21 111 666 111', email: 'csr@kababjees.pk', type: 'Restaurant', activeDonations: ['25 Prepared Biryani Packages', 'Fresh Naan Bread'], avgRating: 4.9, ratingCount: 42 },
  { id: 'mock3', name: 'Dr. Fatima Zahra', city: 'Lahore', bio: 'Pediatrician collecting and donating safe, unused pharmacy samples.', phone: '+92 321 9876543', email: 'fatima.zahra@health.org', type: 'Individual', activeDonations: ['Infant Formulas', 'Multivitamin Drops'], avgRating: 4.7, ratingCount: 8 },
  { id: 'mock4', name: 'Savour Foods', city: 'Islamabad', bio: 'Committed to feeding those in need by donating freshly prepared hot lunches.', phone: '+92 51 111 728 687', email: 'info@savourfoods.com.pk', type: 'Restaurant', activeDonations: ['50 Pulao Packages', 'Safe Canned Juices'], avgRating: 4.8, ratingCount: 31 },
  { id: 'mock5', name: 'KFC Pakistan', city: 'Lahore', bio: 'Mending communities through CSR food donation campaigns.', phone: '+92 42 111 347 347', email: 'csr@kfcpakistan.com', type: 'Restaurant', activeDonations: ['Surplus Breaded Chicken', 'French Fries Packs'], avgRating: 4.9, ratingCount: 85 },
];

const mockAiMatches = [
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
];

const ReceiverPortal = () => {
  const { user, logout, updateUser } = useAuth();
  const { lang, setLang, t } = useLang();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('profile');
  const [postFilter, setPostFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfile, setShowProfile] = useState(false);

  const [myPosts, setMyPosts] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [completedDonations, setCompletedDonations] = useState([]);
  const [aiMatches, setAiMatches] = useState([]);
  const [realDonors, setRealDonors] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [avgRating, setAvgRating] = useState(user?.avgRating || null);
  const [ratingCount, setRatingCount] = useState(user?.ratingCount || 0);
  const [ignoredMatches, setIgnoredMatches] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ignored_matches') || '[]');
    } catch {
      return [];
    }
  });

  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileBio, setProfileBio] = useState(user?.bio || localStorage.getItem(`bio_${user?.id}`) || '');
  const [profileCity, setProfileCity] = useState(user?.city || localStorage.getItem(`city_${user?.id}`) || 'Pakistan');
  const [profileBanner, setProfileBanner] = useState(user?.profileBanner || localStorage.getItem(`banner_${user?.id}`) || 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=1470&auto=format&fit=crop');
  const [profileAddress, setProfileAddress] = useState(user?.location?.address || '');
  const [profileLat, setProfileLat] = useState((user?.location?.lat !== undefined && user?.location?.lat !== null) ? user.location.lat : '');
  const [profileLng, setProfileLng] = useState((user?.location?.lng !== undefined && user?.location?.lng !== null) ? user.location.lng : '');
  const [profileSaving, setProfileSaving] = useState(false);

  // Modals and Interaction State
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [acceptedDonor, setAcceptedDonor] = useState(null);
  const [selectedDonor, setSelectedDonor] = useState(null);
  const [selectedCompletedDonation, setSelectedCompletedDonation] = useState(null);
  const [activeHistoryImgIdx, setActiveHistoryImgIdx] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [activeChatDonationId, setActiveChatDonationId] = useState(null);
  const [chatNotification, setChatNotification] = useState(null);
  const [activeChatDonation, setActiveChatDonation] = useState(null);
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
  const [requestStatus, setRequestStatus] = useState({});
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [selectedMyPost, setSelectedMyPost] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostCategory, setNewPostCategory] = useState('Food');
  const [newPostUrgency, setNewPostUrgency] = useState('Low');
  const [newPostDesc, setNewPostDesc] = useState('');
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  useEffect(() => {
    if (user) {
      setProfileBio(user.bio || localStorage.getItem(`bio_${user.id}`) || '');
      setProfileCity(user.city || localStorage.getItem(`city_${user.id}`) || 'Pakistan');
      setProfileBanner(user.profileBanner || localStorage.getItem(`banner_${user.id}`) || 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=1470&auto=format&fit=crop');
      setProfileAddress(user.location?.address || '');
      setProfileLat((user.location?.lat !== undefined && user.location?.lat !== null) ? user.location.lat : '');
      setProfileLng((user.location?.lng !== undefined && user.location?.lng !== null) ? user.location.lng : '');
    }
  }, [user]);

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
        setProfileAddress(u.location?.address || '');
        setProfileLat((u.location?.lat !== undefined && u.location?.lat !== null) ? u.location.lat : '');
        setProfileLng((u.location?.lng !== undefined && u.location?.lng !== null) ? u.location.lng : '');
        setAvgRating(u.avgRating);
        setRatingCount(u.ratingCount);
      } catch (err) {
        console.error('Failed to load profile from DB', err);
      }
    };
    loadProfileData();
  }, []);

  useEffect(() => {
    fetchData();
  }, [lang]);

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      localStorage.setItem(`bio_${user?.id}`, profileBio);
      localStorage.setItem(`city_${user?.id}`, profileCity);
      localStorage.setItem(`banner_${user?.id}`, profileBanner);

      const res = await axios.put(`${API}/api/users/me`, {
        bio: profileBio,
        city: profileCity,
        profileBanner: profileBanner,
        address: profileAddress,
        lat: profileLat,
        lng: profileLng
      }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });

      updateUser(res.data);
      setIsEditingProfile(false);
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setProfileSaving(false);
    }
  };

  const fetchData = async (showNotification = false) => {
    const langParam = lang === 'Eng' ? 'en' : 'ur';
    let successCount = 0;
    let failCount = 0;
    const token = localStorage.getItem('token');

    const [postsRes, notifRes, completedRes, aiMatchedRes, donorsRes, browseRes] = await Promise.allSettled([
      axios.get(`${API}/api/posts/my-posts?lang=${langParam}`, {
        headers: { 'x-auth-token': token }
      }),
      axios.get(`${API}/api/notifications?status=pending&lang=${langParam}`, {
        headers: { 'x-auth-token': token }
      }),
      axios.get(`${API}/api/donations/completed?lang=${langParam}`, {
        headers: { 'x-auth-token': token }
      }),
      axios.get(`${API}/api/donations/ai-matched?lang=${langParam}`, {
        headers: { 'x-auth-token': token }
      }),
      axios.get(`${API}/api/users/donors?lang=${langParam}`, {
        headers: { 'x-auth-token': token }
      }),
      axios.get(`${API}/api/donations/browse?lang=${langParam}`, {
        headers: { 'x-auth-token': token }
      })
    ]);

    // 1. Fetch posts
    if (postsRes.status === 'fulfilled') {
      const data = Array.isArray(postsRes.value?.data) ? postsRes.value.data : [];
      setMyPosts(data);
      successCount++;
    } else {
      console.error('Error fetching posts', postsRes.reason.message);
      failCount++;
    }

    // 2. Fetch incoming notifications
    if (notifRes.status === 'fulfilled') {
      const data = Array.isArray(notifRes.value?.data) ? notifRes.value.data : [];
      const mapped = data.map(notif => {
        if (!notif.donationId) return null;
        return {
          ...notif.donationId,
          _id: notif.donationId._id,
          notificationId: notif._id,
          donorId: notif.donorId,
          notificationTitle: notif.title,
          notificationMessage: notif.message,
          notificationStatus: notif.status
        };
      }).filter(Boolean);
      setIncomingRequests(mapped);
      successCount++;
    } else {
      console.error('Error fetching incoming', notifRes.reason.message);
      failCount++;
    }

    // 3. Fetch completed
    if (completedRes.status === 'fulfilled') {
      const data = Array.isArray(completedRes.value?.data) ? completedRes.value.data : [];
      setCompletedDonations(data);
      successCount++;
    } else {
      console.error('Error fetching completed', completedRes.reason.message);
      failCount++;
    }

    // 4. Fetch AI matches
    if (aiMatchedRes.status === 'fulfilled') {
      const data = Array.isArray(aiMatchedRes.value?.data) ? aiMatchedRes.value.data : [];
      if (data && data.length > 0) {
        setAiMatches(data);
      } else {
        setAiMatches(mockAiMatches);
      }
      successCount++;
    } else {
      console.error('Error fetching AI matches', aiMatchedRes.reason.message);
      setAiMatches(mockAiMatches);
      failCount++;
    }

    // 5 & 6. Process donors list & active donations
    let donors = [];
    let activeDonations = [];
    if (donorsRes.status === 'fulfilled') {
      donors = Array.isArray(donorsRes.value?.data) ? donorsRes.value.data : [];
    } else {
      console.error("Failed to fetch real donors list:", donorsRes.reason?.message);
    }

    if (browseRes.status === 'fulfilled') {
      activeDonations = Array.isArray(browseRes.value?.data) ? browseRes.value.data : [];
    } else {
      console.error("Failed to fetch browse donations:", browseRes.reason?.message);
    }

    try {
      const mappedDonors = donors.map(d => {
        const dDonations = Array.isArray(activeDonations) ? activeDonations.filter(don => {
          const donorIdObj = don.donorId;
          const donorId = donorIdObj && (typeof donorIdObj === 'object' ? donorIdObj._id : donorIdObj);
          return donorId === d._id;
        }).map(don => don.title) : [];

        return {
          id: d._id,
          name: d.name,
          city: d.city || 'Pakistan',
          bio: d.bio || 'Verified SpareShare donor partner committing to zero food waste.',
          phone: d.phone || 'No phone',
          email: d.email || 'No email',
          type: d.businessType || 'Individual',
          activeDonations: dDonations,
          profilePic: d.profilePic,
          avgRating: d.avgRating,
          ratingCount: d.ratingCount,
          address: d.location?.address || d.city || 'Pakistan'
        };
      });

      setRealDonors([...mappedDonors, ...mockDonors]);
      successCount++;
    } catch (err) {
      console.error('Error processing real donors mapping', err.message);
      setRealDonors(mockDonors);
      failCount++;
    }

    if (showNotification) {
      if (failCount === 0) {
        showToast(lang === 'Eng' ? 'Refreshed!' : 'تازہ کر دیا گیا!', 'success');
      } else if (successCount > 0) {
        showToast(lang === 'Eng' ? `Refreshed ${successCount} feeds, ${failCount} failed.` : `لوڈ کیا گیا: ${successCount}، ناکام: ${failCount}`, 'warning');
      } else {
        showToast(lang === 'Eng' ? 'Failed to refresh.' : 'لوڈ کرنے میں ناکام۔', 'error');
      }
    }
  };

  const fetchMyPosts = () => fetchData();
  const fetchIncoming = () => fetchData();
  const fetchCompleted = () => fetchData();
  const fetchAiMatches = () => fetchData();
  const fetchRealDonors = () => fetchData();

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
                senderName: lastMsg.senderId?.name || 'Donor',
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

  // Background check for new coordination chat messages using fast, efficient /all/recent endpoint
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
                senderName: msg.senderId?.name || 'Donor Partner',
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

  // Active chat channel polling
  useEffect(() => {
    if (!activeChatDonationId) return;
    fetchChatMessages(activeChatDonationId);
    const interval = setInterval(() => {
      fetchChatMessages(activeChatDonationId);
    }, 1500);
    return () => clearInterval(interval);
  }, [activeChatDonationId, fetchChatMessages]);

  const handleIgnoreMatch = (matchId) => {
    const updated = [...ignoredMatches, matchId];
    setIgnoredMatches(updated);
    localStorage.setItem('ignored_matches', JSON.stringify(updated));
    setAiMatches(prev => prev.filter(m => m._id !== matchId));
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
      setCompletedDonations(prev => prev.map(don => 
        don._id === donationId ? { ...don, rating: selectedRating } : don
      ));
      
      // Update selectedCompletedDonation rating so it updates in real-time in the open modal
      setSelectedCompletedDonation(prev => ({ ...prev, rating: selectedRating }));
      
      // Reset rating selection
      setSelectedRating(0);
      setHoveredRating(0);
      setRatingComment('');
      
      // Refresh real donors list so trust scores are updated
      fetchRealDonors();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to submit rating. Please try again.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleAcceptRequest = async (reqId, donorDetails) => {
    // Client-side fallback for mock matches
    if (reqId.startsWith('match_mock') || reqId.startsWith('mock')) {
      setRequestStatus({ ...requestStatus, [reqId]: 'accepted' });
      setAcceptedDonor(donorDetails);
      
      // Add to ignoredMatches to hide from recommendations list
      const updatedIgnored = [...ignoredMatches, reqId];
      setIgnoredMatches(updatedIgnored);
      localStorage.setItem('ignored_matches', JSON.stringify(updatedIgnored));
      
      const mockList = [
        {
          _id: 'match_mock1',
          title: 'Surplus Prepared Hot Biryani Packages (25 Servings)',
          category: 'Food',
          aiSafetyScore: 98,
          aiAnalysisReason: 'Safety scan indicates freshly prepared food with perfect thermal containment and strict hygiene logs.',
          donorId: { name: 'Kababjees Restaurant', email: 'csr@kababjees.pk', phone: '+92 21 111 666 111', city: 'Karachi' }
        },
        {
          _id: 'match_mock2',
          title: 'Essential Medicines (Paracetamol, Antihistamines)',
          category: 'Medicine',
          aiSafetyScore: 95,
          aiAnalysisReason: 'Safety validation confirms uncompromised packaging seals and long shelf life expiry tracking.',
          donorId: { name: 'Dr. Fatima Zahra', email: 'fatima.zahra@health.org', phone: '+92 321 9876543', city: 'Lahore' }
        }
      ];
      const mockMatchItem = mockList.find(m => m._id === reqId);
      if (mockMatchItem) {
        const newCompleted = {
          _id: reqId,
          title: mockMatchItem.title,
          category: mockMatchItem.category,
          aiSafetyScore: mockMatchItem.aiSafetyScore,
          aiAnalysisReason: mockMatchItem.aiAnalysisReason,
          updatedAt: new Date().toISOString(),
          donorId: {
            name: mockMatchItem.donorId.name,
            phone: mockMatchItem.donorId.phone,
            email: mockMatchItem.donorId.email,
            city: mockMatchItem.donorId.city || 'Pakistan',
            profilePic: mockMatchItem.donorId.profilePic
          }
        };
        setCompletedDonations(prev => [newCompleted, ...prev]);
      }
      setAiMatches(prev => prev.filter(m => m._id !== reqId));
      return;
    }

    try {
      const reqItem = incomingRequests.find(r => r._id === reqId);
      const notifId = reqItem?.notificationId;

      if (notifId) {
        await axios.put(`${API}/api/notifications/${notifId}/accept`,
          {},
          { headers: { 'x-auth-token': localStorage.getItem('token') } }
        );
      } else {
        // Fallback for match suggestions claim flow
        await axios.put(`${API}/api/notifications/claim/${reqId}`,
          {},
          { headers: { 'x-auth-token': localStorage.getItem('token') } }
        );
      }

      setRequestStatus({ ...requestStatus, [reqId]: 'accepted' });
      setAcceptedDonor(donorDetails);
      setSelectedRequest(null);
      setAiMatches(prev => prev.filter(m => m._id !== reqId));
      fetchCompleted(); // Refresh completed list
      fetchIncoming(); // Refresh incoming list
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Claim failed. Try again.';
      alert(`⚠️ ${errMsg}`);
    }
  };

  const handleRejectRequest = async (reqId) => {
    try {
      const reqItem = incomingRequests.find(r => r._id === reqId);
      const notifId = reqItem?.notificationId;

      if (notifId) {
        await axios.put(`${API}/api/notifications/${notifId}/reject`,
          {},
          { headers: { 'x-auth-token': localStorage.getItem('token') } }
        );
      } else {
        await axios.put(`${API}/api/donations/${reqId}/status`,
          { status: 'rejected' },
          { headers: { 'x-auth-token': localStorage.getItem('token') } }
        );
      }
      setRequestStatus({ ...requestStatus, [reqId]: 'rejected' });
      setSelectedRequest(null);
      fetchIncoming(); // Refresh list
    } catch (err) {
      console.error(err);
      alert('Dismiss failed.');
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostTitle) return;
    try {
      const res = await axios.post(`${API}/api/posts`, {
        title: newPostTitle,
        category: newPostCategory,
        urgency: newPostUrgency,
        desc: newPostDesc || 'No description provided.'
      }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setMyPosts([res.data, ...myPosts]);
      setShowCreatePost(false);
      setNewPostTitle(''); setNewPostDesc(''); setNewPostCategory('Food');
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

  const handleDeletePost = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this demand post?")) return;
    try {
      await axios.delete(`${API}/api/posts/${id}`, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setMyPosts(prev => prev.filter(p => p._id !== id));
      showToast("Demand post deleted successfully.", "success");
    } catch (err) {
      console.error("Failed to delete post:", err);
      showToast("Failed to delete demand post.", "error");
    }
  };

  const filteredDonors = realDonors.filter(donor => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      donor.name?.toLowerCase().includes(query) ||
      donor.city?.toLowerCase().includes(query) ||
      donor.bio?.toLowerCase().includes(query) ||
      donor.type?.toLowerCase().includes(query) ||
      donor.activeDonations?.some(d => d.toLowerCase().includes(query))
    );
  });

  const activeMatchesList = (aiMatches.length > 0 ? aiMatches : [
    {
      _id: 'match_mock1',
      title: 'Surplus Prepared Hot Biryani Packages (25 Servings)',
      category: 'Food',
      aiSafetyScore: 98,
      aiAnalysisReason: 'Safety scan indicates freshly prepared food with perfect thermal containment and strict hygiene logs.',
      donorId: { name: 'Kababjees Restaurant', email: 'csr@kababjees.pk', phone: '+92 21 111 666 111', location: { address: 'Karachi, Pakistan' } },
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
      donorId: { name: 'Dr. Fatima Zahra', email: 'fatima.zahra@health.org', phone: '+92 321 9876543', location: { address: 'Lahore, Pakistan' } },
      matchedDemand: 'Need emergency medical camp supplies',
      matchScore: 94,
      reasoning: 'High matching score due to critical pharmaceutical compliance and prompt local courier dispatch proximity.'
    }
  ]).filter(match => !ignoredMatches.includes(match._id));

  const displayedAiMatches = activeMatchesList.filter(match => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const donorName = match.donorId?.name || (typeof match.donorId === 'object' && match.donorId ? match.donorId.name : '');
    return (
      match.title?.toLowerCase().includes(query) ||
      match.category?.toLowerCase().includes(query) ||
      match.reasoning?.toLowerCase().includes(query) ||
      donorName?.toLowerCase().includes(query)
    );
  });

  const filteredMyPosts = myPosts.filter(post => {
    if (postFilter !== 'All') {
      if (post.status.toLowerCase() !== postFilter.toLowerCase()) return false;
    }
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      post.title?.toLowerCase().includes(query) ||
      post.category?.toLowerCase().includes(query) ||
      post.description?.toLowerCase().includes(query) ||
      post.status?.toLowerCase().includes(query)
    );
  });

  const filteredIncomingRequests = incomingRequests.filter(req => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const donorName = req.donorId?.name || '';
    return (
      req.title?.toLowerCase().includes(query) ||
      req.category?.toLowerCase().includes(query) ||
      donorName.toLowerCase().includes(query) ||
      req.description?.toLowerCase().includes(query)
    );
  });

  const filteredCompletedDonations = completedDonations.filter(don => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const donorName = don.donorId?.name || don.receiverDetails?.name || '';
    return (
      don.title?.toLowerCase().includes(query) ||
      don.category?.toLowerCase().includes(query) ||
      donorName.toLowerCase().includes(query) ||
      don.description?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="portal-layout receiver-layout" onClick={(e) => {
      const menu = document.getElementById('recv-lang-menu');
      if (menu && !e.target.closest('.lang-dropdown-wrapper')) menu.classList.remove('open');
    }}>
      {/* Toast notifications */}
      {toast && (
        <div className={`pp-toast ${toast.type}`} style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000, background: toast.type === 'success' ? '#10b981' : (toast.type === 'warning' ? '#f59e0b' : '#ef4444'), color: 'white', padding: '12px 24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontWeight: 600 }}>
          {toast.msg}
        </div>
      )}

      {chatNotification && (
        <div 
          className="pp-toast info" 
          onClick={() => {
            const matched = incomingRequests.find(r => r._id === chatNotification.donationId) || completedDonations.find(c => c._id === chatNotification.donationId);
            if (matched) {
              setActiveChatDonationId(chatNotification.donationId);
              setActiveChatDonation(matched);
            } else {
              setActiveChatDonationId(chatNotification.donationId);
            }
            setChatNotification(null);
          }}
          style={{ position: 'fixed', bottom: '80px', right: '20px', zIndex: 1000, background: '#3b82f6', color: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', maxWidth: '300px', borderLeft: '5px solid #1d4ed8', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Message from {chatNotification.senderName}</span>
            <X size={16} style={{ cursor: 'pointer', opacity: 0.8 }} onClick={(e) => { e.stopPropagation(); setChatNotification(null); }} />
          </div>
          <p style={{ margin: 0, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chatNotification.text}</p>
        </div>
      )}

      <header className="portal-header">
        <div className="portal-logo" onClick={() => navigate('/')}>
          <img src="/logo.png" alt="SpareShare" />
          <span>Receiver Portal</span>
        </div>

        <nav className="portal-nav">
          <button className={`nav-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => { setActiveTab('profile'); fetchData(); }}>
            <Building2 size={18} /> {lang === 'Eng' ? 'NGO Profile' : 'این جی او پروفائل'}
          </button>
          <button className={`nav-tab ${activeTab === 'ai_matches' ? 'active' : ''}`} onClick={() => { setActiveTab('ai_matches'); fetchData(); }} style={{ position: 'relative' }}>
            <ScanLine size={18} /> {lang === 'Eng' ? 'AI Matches' : 'اے آئی میچز'}
            {aiMatches.length > 0 && (
              <span style={{ marginLeft: 4, background: '#3b82f6', color: 'white', borderRadius: 99, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 800 }}>
                {aiMatches.length}
              </span>
            )}
          </button>
          <button className={`nav-tab ${activeTab === 'my_posts' ? 'active' : ''}`} onClick={() => { setActiveTab('my_posts'); fetchData(); }}>
            <List size={18} /> {lang === 'Eng' ? 'My Demand Posts' : 'میری پوسٹس'}
          </button>
          <button className={`nav-tab ${activeTab === 'incoming' ? 'active' : ''}`} onClick={() => { setActiveTab('incoming'); fetchData(); }} style={{ position: 'relative' }}>
            <BellRing size={18} /> {lang === 'Eng' ? 'Incoming' : 'آنے والے'}
            {(() => {
              const pendingReqs = incomingRequests.filter(r => !requestStatus[r._id]).length;
              const unreadMsgs = recentChatMessages.filter(msg => (msg.senderId?._id || msg.senderId) !== (user?.id || user?._id) && !readMessageIds.includes(msg._id)).length;
              const totalBadges = pendingReqs + unreadMsgs;
              if (totalBadges > 0) {
                return (
                  <span style={{
                    position: 'absolute', top: -6, right: -6,
                    background: '#ef4444', color: 'white',
                    borderRadius: '50%', width: 18, height: 18,
                    fontSize: '0.7rem', fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {totalBadges}
                  </span>
                );
              }
              return null;
            })()}
          </button>
          <button className={`nav-tab ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => { setActiveTab('completed'); fetchData(); }} style={{ position: 'relative' }}>
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
              placeholder={
                activeTab === 'profile'
                  ? (lang === 'Eng' ? "Search donors..." : "عطیہ دہندگان تلاش کریں...")
                  : activeTab === 'my_posts'
                  ? (lang === 'Eng' ? "Search demands..." : "مطالبات تلاش کریں...")
                  : activeTab === 'incoming'
                  ? (lang === 'Eng' ? "Search incoming..." : "نوٹیفیکیشن تلاش کریں...")
                  : activeTab === 'completed'
                  ? (lang === 'Eng' ? "Search completed..." : "مکمل تلاش کریں...")
                  : (lang === 'Eng' ? "Search..." : "تلاش کریں...")
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingRight: '2rem' }}
            />
            {searchQuery && (
              <X
                size={16}
                className="clear-icon"
                style={{
                  position: 'absolute',
                  right: '10px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  transition: 'color 0.2s'
                }}
                onClick={() => setSearchQuery('')}
                onMouseEnter={e => e.target.style.color = 'white'}
                onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
              />
            )}
          </div>
          <div className="lang-dropdown-wrapper" style={{ position: 'relative' }}>
            <button
              className="lang-btn"
              onClick={() => document.getElementById('recv-lang-menu').classList.toggle('open')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Globe size={16} />
              <span className="hide-mobile">{lang === 'Eng' ? 'English' : 'اردو'}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 2 }} className="hide-mobile">
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
            <LogOut size={16} /> <span className="logout-text hide-mobile">{lang === 'Eng' ? 'Logout' : 'لاگ آؤٹ'}</span>
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
                <div className="rp-logo-container" style={{ width: 90, height: 90, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)', border: '2px solid #10b981' }}>
                  {user?.profilePic ? (
                    <img src={user.profilePic} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <UserCircle size={80} color="#fff" />
                  )}
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
                <div className="stat-number">{completedDonations.length}</div>
                <p>Items processed via SpareShare AI</p>
              </div>
              <div className="rp-stat-card glass-panel">
                <h3>My Demand Posts</h3>
                <div className="stat-number text-primary">{myPosts.length}</div>
                <p>Currently requesting items</p>
              </div>
              <div className="rp-stat-card glass-panel">
                <h3>Trust Score</h3>
                <div className="stat-number" style={{ color: '#f59e0b' }}>
                  {ratingCount > 0 && avgRating !== null && avgRating !== undefined ? `${Math.round(avgRating * 20)}%` : 'New NGO'}
                </div>
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
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', color: 'var(--text-muted)' }}>📍 Organization City</label>
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', color: 'var(--text-muted)' }}>🏠 Full Street Address</label>
                      <input
                        type="text"
                        value={profileAddress}
                        onChange={e => setProfileAddress(e.target.value)}
                        placeholder="e.g. House 4-B, Street 3, Block 6, Gul Colony"
                        style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: 'white', fontSize: '0.93rem', transition: 'all 0.2s' }}
                        onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.boxShadow = '0 0 10px rgba(16,185,129,0.2)'; }}
                        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', color: 'var(--text-muted)' }}>🧭 Latitude</label>
                      <input
                        type="number"
                        step="any"
                        value={profileLat}
                        onChange={e => setProfileLat(e.target.value)}
                        placeholder="Latitude"
                        style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: 'white', fontSize: '0.93rem', transition: 'all 0.2s' }}
                        onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.boxShadow = '0 0 10px rgba(16,185,129,0.2)'; }}
                        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', color: 'var(--text-muted)' }}>🧭 Longitude</label>
                      <input
                        type="number"
                        step="any"
                        value={profileLng}
                        onChange={e => setProfileLng(e.target.value)}
                        placeholder="Longitude"
                        style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: 'white', fontSize: '0.93rem', transition: 'all 0.2s' }}
                        onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.boxShadow = '0 0 10px rgba(16,185,129,0.2)'; }}
                        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ fontSize: '0.8rem', padding: '8px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer' }}
                      onClick={() => {
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            pos => {
                              setProfileLat(pos.coords.latitude);
                              setProfileLng(pos.coords.longitude);
                              alert("Coordinates detected: " + pos.coords.latitude + ", " + pos.coords.longitude);
                            },
                            err => alert("Error detecting coordinates. Try manually.")
                          );
                        } else {
                          alert("Geolocation not supported.");
                        }
                      }}
                    >
                      📍 Detect Organization Coordinates
                    </button>
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
                    💡 <strong>Tip:</strong> A complete profile with a custom banner, coordinates, and full address gets 3x more donations!
                  </div>
                </div>
              ) : (
                <div>
                  {profileBio ? (
                    <p style={{ lineHeight: 1.7, color: 'var(--text-muted)' }}>{profileBio}</p>
                  ) : (
                    <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', padding: '16px', color: '#fcd34d' }}>
                      ⚠️ You haven't added an "About" description yet. Click <strong>Edit Profile</strong> to add your organization's story: donors want to know who they're helping!
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      <MapPin size={16} color="#10b981" /> {profileCity}
                    </div>
                    {profileAddress && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem', width: '100%', marginTop: '6px' }}>
                        <MapPin size={16} color="#34d399" /> <strong>Full Address:</strong> {profileAddress}
                      </div>
                    )}
                    {profileLat && profileLng && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', paddingLeft: '22px' }}>
                        <span>🧭 Coordinates: ({profileLat}, {profileLng})</span>
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
                <button className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem', borderRadius: '12px' }} onClick={() => { setActiveTab('my_posts'); fetchMyPosts(); }}>
                  + Create New
                </button>
              </div>
              {filteredMyPosts.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>{searchQuery ? "No matching demands found." : "No demand posts yet. Create your first demand so donors can find and help you!"}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {filteredMyPosts.map(post => (
                    <div key={post._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', background: 'rgba(255,255,255,0.02)', transition: 'all 0.2s', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.25)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                      onClick={() => { setActiveTab('my_posts'); fetchMyPosts(); }}
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

              <div style={{ maxHeight: '460px', overflowY: 'auto', paddingRight: '8px' }} className="custom-scrollbar">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
                {filteredDonors.map(donor => (
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <Star size={13} fill="#f59e0b" color="#f59e0b" />
                      <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700 }}>
                        {donor.ratingCount > 0 && donor.avgRating !== null && donor.avgRating !== undefined ? `${Math.round(donor.avgRating * 20)}% Trust Score` : 'New Partner'}
                      </span>
                      {donor.ratingCount > 0 && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}> ({donor.ratingCount})</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', marginTop: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700 }}>{donor.activeDonations.length} Active Items</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setSelectedDonor(donor); }}>View Profile →</span>
                      </div>
                      <button
                        className="btn btn-primary"
                        style={{
                          width: '100%',
                          fontSize: '0.78rem',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          background: 'linear-gradient(to right, #10b981, #059669)',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          fontWeight: 700,
                          transition: 'all 0.2s'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setAcceptedDonor({
                            donorName: donor.name,
                            donorPhone: donor.phone || 'No phone',
                            donorEmail: donor.email || 'No email',
                            donorPic: donor.profilePic,
                            donorAddress: donor.address || donor.city || 'Pakistan',
                            isDirectContact: true
                          });
                        }}
                      >
                        📞 Contact Partner
                      </button>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'my_posts' && (
          <div className="receiver-posts-view animate-fade-in">
            <div className="section-header-flex" style={{ marginBottom: '1rem' }}>
              <h2 className="section-title">My Demand Posts</h2>
              <button className="btn btn-primary" onClick={() => setShowCreatePost(true)}>+ Create New Demand</button>
            </div>

            {/* Post Filter Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              {['All', 'Active', 'Fulfilled'].map(filterOption => (
                <button
                  key={filterOption}
                  onClick={() => setPostFilter(filterOption)}
                  style={{
                    background: postFilter === filterOption ? '#10b981' : 'rgba(255,255,255,0.06)',
                    color: postFilter === filterOption ? 'white' : '#94a3b8',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: postFilter === filterOption ? '0 4px 12px rgba(16,185,129,0.3)' : 'none'
                  }}
                >
                  {filterOption}
                </button>
              ))}
            </div>

            <div className="rp-posts-grid">
              {filteredMyPosts.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  {searchQuery ? "No demands found matching your search." : `No ${postFilter !== 'All' ? postFilter.toLowerCase() : ''} demand posts yet.`}
                </div>
              ) : (
                filteredMyPosts.map(post => (
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
                      <button
                        className="text-btn"
                        style={{ color: '#f87171', marginLeft: 'auto' }}
                        onClick={(e) => handleDeletePost(post._id, e)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'incoming' && (
          <div className="receiver-incoming-view animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h2 className="section-title" style={{ margin: 0 }}>Incoming Donation Requests & Chats</h2>
              </div>
              <button
                className="btn btn-outline"
                onClick={() => fetchData(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600 }}
              >
                <RefreshCw size={16} /> {lang === 'Eng' ? 'Refresh' : 'تازہ کریں'}
              </button>
            </div>
            <p style={{ marginBottom: '2rem', color: 'var(--text-muted)' }}>Review incoming donations sent directly to you, or chat with donors to coordinate pickup logistics.</p>

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
                {lang === 'Eng' ? 'Incoming Donations' : 'آنے والے عطیات'}
                {incomingRequests.filter(r => !requestStatus[r._id]).length > 0 && (
                  <span style={{ background: '#ef4444', color: 'white', borderRadius: 99, padding: '1px 6px', fontSize: '0.65rem' }}>
                    {incomingRequests.filter(r => !requestStatus[r._id]).length}
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
                {lang === 'Eng' ? 'Coordination Chats' : 'رابطہ پیغامات'}
                {recentChatMessages.filter(msg => (msg.senderId?._id || msg.senderId) !== (user?.id || user?._id) && !readMessageIds.includes(msg._id)).length > 0 && (
                  <span style={{ background: '#ef4444', color: 'white', borderRadius: 99, padding: '1px 6px', fontSize: '0.65rem' }}>
                    {recentChatMessages.filter(msg => (msg.senderId?._id || msg.senderId) !== (user?.id || user?._id) && !readMessageIds.includes(msg._id)).length}
                  </span>
                )}
              </button>
            </div>

            {notifTypeFilter === 'donations' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filteredIncomingRequests.filter(r => !requestStatus[r._id]).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--bg-card)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <BellRing size={48} color="#334155" style={{ margin: '0 auto 1rem' }} />
                    <h3 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{searchQuery ? "No matching donations found" : "No Incoming Donations Yet"}</h3>
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>{searchQuery ? "Try refining your search query." : "When donors send you items, their requests will appear here."}</p>
                  </div>
                )}
                {filteredIncomingRequests.map(req => {
                  if (requestStatus[req._id]) return null;
                  const timeAgo = new Date(req.createdAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={req._id}
                      style={{
                        background: 'var(--bg-card)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)',
                        overflow: 'hidden', cursor: 'pointer', transition: 'all 0.25s',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                      }}
                      onClick={() => { setSelectedRequest(req); setActiveHistoryImgIdx(0); }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      {/* Top notification banner */}
                      <div style={{ background: 'linear-gradient(135deg, #064e3b, #047857)', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <BellRing size={14} color="#a7f3d0" />
                          <span style={{ color: '#a7f3d0', fontSize: '0.8rem', fontWeight: 600 }}>New Donation Request • {timeAgo}</span>
                        </div>
                        {req.notificationId && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm("Are you sure you want to delete this notification?")) {
                                try {
                                  await axios.delete(`${API}/api/notifications/${req.notificationId}`, {
                                    headers: { 'x-auth-token': localStorage.getItem('token') }
                                  });
                                  fetchIncoming();
                                } catch (err) {
                                  console.error("Failed to delete notification:", err);
                                }
                              }
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Delete notification"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      {/* Main card body */}
                      <div className="rp-incoming-card-body" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.25rem 1.5rem', flexWrap: 'wrap' }}>
                        {/* Thumbnail */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          {req.imageUrl ? (
                            <img
                              src={Array.isArray(req.imageUrl) ? req.imageUrl[0] : req.imageUrl}
                              alt={req.title}
                              style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.08)' }}
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
                        <div className="rp-incoming-card-info">
                          <div className="rp-incoming-card-info-header">
                            {req.donorId?.profilePic ? (
                              <img src={req.donorId.profilePic} alt={req.donorId.name} style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <UserCircle size={20} color="#10b981" />
                            )}
                            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{req.donorId?.name || 'Anonymous Donor'}</span>
                            <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(16,185,129,0.2)', whiteSpace: 'nowrap' }}>Verified Donor</span>
                          </div>
                          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>{req.title}</p>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Category: <span style={{ color: '#10b981', fontWeight: 600 }}>{req.category || req.aiDetectedItems}</span></p>
                        </div>

                        {/* AI score */}
                        <div className="rp-incoming-card-score">
                          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #064e3b, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>
                            <span style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>{req.aiSafetyScore}%</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>AI Score</p>
                        </div>

                        {/* CTA */}
                        {req.status === 'completed' ? (
                          <div style={{ color: '#ef4444', fontSize: '0.82rem', fontWeight: 800, padding: '0.6rem 1rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                            Donation already accepted
                          </div>
                        ) : (
                          <button
                            className="btn btn-primary"
                            style={{ flexShrink: 0, fontSize: '0.85rem', padding: '0.6rem 1.2rem' }}
                            onClick={e => { e.stopPropagation(); setSelectedRequest(req); setActiveHistoryImgIdx(0); }}
                          >
                            Review Request →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {notifTypeFilter === 'messages' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {recentChatMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <MessageSquare size={48} color="rgba(255,255,255,0.15)" style={{ margin: '0 auto 1rem', display: 'block' }} />
                    <h3 style={{ color: '#f1f5f9', marginBottom: '0.5rem' }}>
                      {lang === 'Eng' ? 'No Messages Yet' : 'ابھی تک کوئی پیغام نہیں ہے'}
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{lang === 'Eng' ? 'Coordination chats with donors will appear here.' : 'پیغامات یہاں ظاہر ہوں گے۔'}</p>
                  </div>
                ) : (
                  recentChatMessages.map(msg => {
                    const donationItem = msg.donationId;
                    const donationTitle = donationItem?.title || 'Donated Item';
                    const partner = (msg.senderId?._id || msg.senderId) === (user?.id || user?._id) ? msg.receiverId : msg.senderId;
                    const partnerName = partner?.name || 'Verified Donor';
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
                              {isMe ? `${lang === 'Eng' ? 'You: ' : 'آپ: '}` : ''}{msg.text}
                            </p>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b' }}>
                          <div>{formattedTime}</div>
                          <div style={{ color: '#10b981', marginTop: '4px', fontWeight: 600 }}>
                            {lang === 'Eng' ? 'Click to Reply' : 'جواب دینے کے لیے کلک کریں'} →
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
        {activeTab === 'ai_matches' && (
          <div className="receiver-ai-view animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
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
              {displayedAiMatches.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <ScanLine size={48} color="#475569" style={{ margin: '0 auto 1rem', display: 'block' }} />
                  <h3 style={{ color: 'var(--text-dim)', marginBottom: '0.5rem' }}>No AI Matches Found</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Try posting a new demand or searching for another term.</p>
                </div>
              ) : (
                displayedAiMatches.map(match => (
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
                        
                        {match.matchedDemand && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0 12px' }}>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>Matching Demand:</span>
                            <span style={{ background: 'rgba(255,255,255,0.04)', padding: '2px 10px', borderRadius: '8px', fontSize: '0.8rem', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.06)' }}>
                              "{match.matchedDemand}"
                            </span>
                          </div>
                        )}

                        <div style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '12px', padding: '12px 16px', marginBottom: '1rem', marginTop: '12px' }}>
                          <p style={{ margin: 0, fontSize: '0.82rem', color: '#c084fc', fontWeight: 800 }}>🤖 AI Recommendation Verdict</p>
                          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                            {match.reasoning || match.aiAnalysisReason || 'This donation matches your demand profile with extremely high safety scores.'}
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
                      <button className="btn btn-outline" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', borderRadius: '10px' }} onClick={() => handleIgnoreMatch(match._id)}>Ignore recommendation</button>
                      <button className="btn btn-primary" style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem', borderRadius: '10px', background: 'linear-gradient(to right, #8b5cf6, #6d28d9)' }}
                        onClick={() => handleAcceptRequest(match._id, {
                          donorName: match.donorId?.name || 'Anonymous',
                          donorPhone: match.donorId?.phone || 'No Phone',
                          donorEmail: match.donorId?.email || 'No Email',
                          donorPic: match.donorId?.profilePic,
                          donorAddress: match.donorId?.location?.address || match.donorId?.city || 'Pakistan'
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
              All donations your organization has accepted, click any card to view full details, donor info, and AI safety report.
            </p>

            {filteredCompletedDonations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255,255,255,0.02)', borderRadius: 20, border: '1px dashed rgba(255,255,255,0.1)' }}>
                <CheckCircle2 size={48} color="#cbd5e1" style={{ margin: '0 auto 1rem', display: 'block' }} />
                <h3 style={{ color: 'var(--text-dim)', marginBottom: '0.5rem' }}>{searchQuery ? "No matching donations found" : "No Completed Donations Yet"}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{searchQuery ? "Try refining your search query." : "When you accept donation requests, they'll be stored here with all details."}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                {filteredCompletedDonations.map(don => (
                  <div key={don._id}
                    style={{
                      background: 'rgba(30, 41, 59, 0.4)',
                      border: '1px solid rgba(16, 185, 129, 0.15)',
                      borderRadius: '20px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.25s',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                      backdropFilter: 'blur(10px)'
                    }}
                    onClick={() => { setSelectedCompletedDonation(don); setActiveHistoryImgIdx(0); }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'rgba(16,185,129,0.45)';
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = '0 12px 40px rgba(16, 185, 129, 0.15)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'rgba(16,185,129,0.15)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.35)';
                    }}
                  >
                    <div style={{ background: 'linear-gradient(135deg, #022c22 0%, #064e3b 100%)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#6ee7b7', fontSize: '0.75rem', fontWeight: 800 }}>✅ RECEIVED</span>
                      <span style={{ color: '#a7f3d0', fontSize: '0.72rem' }}>
                        {new Date(don.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      {don.imageUrl ? (
                        <img src={Array.isArray(don.imageUrl) ? don.imageUrl[0] : don.imageUrl} alt="Donation" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }} onError={e => e.target.style.display = 'none'} />
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
      </main>

      {/* ============ DONATION DETAIL MODAL ============ */}
      {selectedRequest && (
        <div className="modal-overlay" onClick={() => { setSelectedRequest(null); setActiveHistoryImgIdx(0); }} style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0, 0, 0, 0.75)' }}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 600, width: '95%', padding: 0, borderRadius: 20, background: 'rgba(10, 18, 36, 0.98)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}
          >
            {/* Modal Header */}
            <div style={{ background: 'linear-gradient(135deg, #064e3b, #047857)', padding: '1.25rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h2 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>📦 Donation Request Review</h2>
                <p style={{ color: '#a7f3d0', margin: 0, fontSize: '0.85rem' }}>Received {new Date(selectedRequest.createdAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <button onClick={() => { setSelectedRequest(null); setActiveHistoryImgIdx(0); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem 2rem', overflowY: 'auto', flex: 1 }}>

              {/* Donor Details Card */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem', border: '1px solid rgba(255, 255, 255, 0.08)', color: 'white' }}>
                <p style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 1rem' }}>Donor Information</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #064e3b, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {selectedRequest.donorId?.profilePic ? (
                      <img src={selectedRequest.donorId.profilePic} alt={selectedRequest.donorId.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <UserCircle size={32} color="white" />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'white' }}>{selectedRequest.donorId?.name || 'Anonymous Donor'}</h3>
                    <span style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(16,185,129,0.2)', whiteSpace: 'nowrap' }}>✓ SpareShare Verified</span>
                  </div>
                </div>
                <div className="modal-donor-grid" style={{ gap: '0.75rem', marginTop: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                    <Mail size={16} color="#10b981" /> {selectedRequest.donorId?.email || 'N/A'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                    <Phone size={16} color="#10b981" /> {selectedRequest.donorId?.phone || 'Not provided'}
                  </div>
                  <div className="grid-span-2" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem' }}>
                    <MapPin size={16} color="#10b981" /> <span><strong>Address:</strong> {selectedRequest.donorId?.location?.address || selectedRequest.donorId?.city || 'Not provided'}</span>
                  </div>
                </div>
              </div>

              <DirectionMap 
                donorLat={selectedRequest.donorId?.location?.lat} 
                donorLng={selectedRequest.donorId?.location?.lng} 
                receiverLat={profileLat || user?.location?.lat} 
                receiverLng={profileLng || user?.location?.lng} 
                receiverName={user?.name} 
                donorCity={selectedRequest.donorId?.city}
                receiverCity={profileCity || user?.city}
              />

              {/* Donation Image */}
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 0.75rem' }}>Donation Items Photo</p>
                {selectedRequest.imageUrl ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(() => {
                      const imgs = Array.isArray(selectedRequest.imageUrl) 
                        ? selectedRequest.imageUrl 
                        : [selectedRequest.imageUrl];
                      const activeImg = imgs[activeHistoryImgIdx] || imgs[0];
                      return (
                        <>
                          <img
                            src={activeImg}
                            alt="Donated items"
                            style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.1)', cursor: 'zoom-in' }}
                            onClick={() => setPreviewImage(activeImg)}
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                          {imgs.length > 1 && (
                            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '4px 0' }}>
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
                  <div style={{ width: '100%', height: 160, background: 'rgba(255,255,255,0.02)', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <Camera size={36} />
                    <p style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>No image uploaded</p>
                  </div>
                )}
              </div>

              {/* AI Analysis */}
              <div style={{ background: '#0f172a', borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                  <Activity size={18} color="#10b981" />
                  <p style={{ color: 'white', margin: 0, fontWeight: 700 }}>SpareShare AI Analysis</p>
                </div>
                <div className="modal-ai-grid">
                  <div style={{ background: '#1e293b', borderRadius: 10, padding: '0.9rem', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.7rem', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Safety Score</p>
                    <p style={{ color: '#10b981', fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{selectedRequest.aiSafetyScore}%</p>
                    <p style={{ color: '#10b981', fontSize: '0.7rem', margin: 0 }}>✅ Safe</p>
                  </div>
                  <div style={{ background: '#1e293b', borderRadius: 10, padding: '0.9rem', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.7rem', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Category</p>
                    <p style={{ color: 'white', fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>{selectedRequest.category || 'General'}</p>
                    <p style={{ color: '#94a3b8', fontSize: '0.7rem', margin: 0 }}>Detected</p>
                  </div>
                  <div style={{ background: '#1e293b', borderRadius: 10, padding: '0.9rem', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.7rem', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Verdict</p>
                    <p style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>Approved</p>
                    <p style={{ color: '#94a3b8', fontSize: '0.7rem', margin: 0 }}>AI verified</p>
                  </div>
                </div>
                <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.75rem', margin: '0.75rem 0 0' }}>
                  💡 {selectedRequest.aiAnalysisReason || 'Items appear fresh and safe for distribution.'}
                </p>
              </div>

            </div>

            {/* Modal Footer (Fixed at the bottom) */}
            <div style={{ padding: '1.25rem 2rem', background: 'rgba(10, 18, 36, 0.95)', borderTop: '1px solid rgba(255, 255, 255, 0.08)', flexShrink: 0 }}>
              {/* Actions */}
              {selectedRequest.status === 'completed' ? (
                <div style={{ color: '#ef4444', fontSize: '1rem', fontWeight: 'bold', padding: '1rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                  Donation already accepted by another receiver.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
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
                      donorEmail: selectedRequest.donorId?.email || 'Not provided',
                      donorPic: selectedRequest.donorId?.profilePic,
                      donorAddress: selectedRequest.donorId?.location?.address || selectedRequest.donorId?.city || 'Pakistan'
                    })}
                  >
                    ✓ Accept & Get Contact
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}



      {/* Donor Contact Popup (Shown after Accept) */}
      {acceptedDonor && (
        <div className="modal-overlay" onClick={() => setAcceptedDonor(null)} style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0, 0, 0, 0.75)' }}>
          <div className="modal-content donor-contact-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, padding: '2rem', background: 'rgba(10, 18, 36, 0.98)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '24px', color: 'white' }}>
            <button className="close-modal" onClick={() => setAcceptedDonor(null)} style={{ background: 'rgba(255,255,255,0.08)', color: 'white' }}><X size={16} /></button>
            <div className="success-icon-container" style={{ 
              borderColor: acceptedDonor.isDirectContact ? 'rgba(59,130,246,0.4)' : 'rgba(16,185,129,0.4)', 
              background: acceptedDonor.isDirectContact ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)', 
              width: 72, height: 72, 
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '1rem auto 1rem' 
            }}>
              {acceptedDonor.isDirectContact ? (
                <Phone size={40} color="#60a5fa" />
              ) : (
                <Check size={40} color="#34d399" />
              )}
            </div>
            <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'white' }}>
              {acceptedDonor.isDirectContact ? 'Partner Contact Details' : 'Donation Accepted!'}
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              {acceptedDonor.isDirectContact 
                ? 'Get in touch directly with this partner to coordinate donations.' 
                : 'You can now contact the donor to coordinate pickup/delivery.'}
            </p>

            <div className="donor-info-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {acceptedDonor.donorPic ? (
                  <img src={acceptedDonor.donorPic} alt={acceptedDonor.donorName} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <UserCircle size={48} className="text-primary" />
                )}
                <div>
                  <h3 style={{ margin: 0, color: 'white' }}>{acceptedDonor.donorName}</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}><ShieldCheck size={14} /> Verified Donor</p>
                </div>
              </div>

              <div className="contact-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)' }}>
                <Phone size={16} className="text-primary" />
                <span>{acceptedDonor.donorPhone}</span>
              </div>
              <div className="contact-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)' }}>
                <Mail size={16} className="text-primary" />
                <span style={{ wordBreak: 'break-all' }}>{acceptedDonor.donorEmail}</span>
              </div>
              {acceptedDonor.donorAddress && (
                <div className="contact-row" style={{ border: 'none', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0 0', fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)' }}>
                  <MapPin size={16} className="text-primary" />
                  <span>{acceptedDonor.donorAddress}</span>
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center', marginTop: '1.75rem' }}>
              <button className="btn btn-primary" style={{ padding: '0.6rem 2rem', borderRadius: '12px' }} onClick={() => setAcceptedDonor(null)}>Done</button>
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
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Category</label>
                <CustomDropdown
                  value={newPostCategory}
                  onChange={setNewPostCategory}
                  options={[
                    { value: 'Food', label: 'Food' },
                    { value: 'Medicine', label: 'Medicine' },
                    { value: 'Clothes', label: 'Clothes' },
                    { value: 'Grocery', label: 'Grocery' },
                    { value: 'Household', label: 'Household' }
                  ]}
                  placeholder="Select category..."
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
        <div className="modal-overlay" onClick={() => setSelectedMyPost(null)} style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0, 0, 0, 0.75)' }}>
          <div className="modal-content post-modal" onClick={e => e.stopPropagation()} style={{ background: 'rgba(10, 18, 36, 0.98)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '24px', color: 'white' }}>
            <button className="close-modal" onClick={() => setSelectedMyPost(null)} style={{ background: 'rgba(255,255,255,0.08)', color: 'white' }}><X size={20} /></button>
            <div className="rd-header">
              <h2 style={{ color: 'white', fontWeight: 800 }}>{selectedMyPost.title}</h2>
              <p style={{ color: 'var(--text-muted)' }}>Status: <strong className={selectedMyPost.status === 'Fulfilled' ? 'text-primary' : 'text-danger'} style={{ color: selectedMyPost.status === 'Fulfilled' ? '#10b981' : '#ef4444' }}>{selectedMyPost.status}</strong></p>
            </div>
            <div className="rd-body">
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', color: 'white' }}>
                <h3 style={{ marginBottom: '0.5rem', color: 'white' }}>Description</h3>
                <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem', lineHeight: 1.6 }}>{selectedMyPost.desc || selectedMyPost.description}</p>
                <div style={{ marginTop: '1rem', display: 'flex', gap: '2rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
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
          <div className="modal-content post-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden', background: 'rgba(10, 18, 36, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '24px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', color: 'white' }}>
            <div style={{ position: 'relative', height: 160, flexShrink: 0, background: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #065f46 100%)', display: 'flex', alignItems: 'flex-end', padding: '1.5rem', overflow: 'hidden' }}>
              {/* Cover pattern overlay */}
              <div style={{ position: 'absolute', inset: 0, opacity: 0.1, background: 'radial-gradient(circle, #fff 10%, transparent 11%)', backgroundSize: '12px 12px' }} />
              <button className="close-modal" onClick={() => setSelectedDonor(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', zIndex: 2 }}>
                <div style={{ width: 64, height: 64, borderRadius: '16px', background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {selectedDonor.profilePic ? (
                    <img src={selectedDonor.profilePic} alt={selectedDonor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <UserCircle size={44} color="#fff" />
                  )}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'white', fontFamily: 'var(--font-heading)' }}>{selectedDonor.name}</h2>
                  <span style={{ background: 'rgba(255, 255, 255, 0.12)', padding: '2px 8px', borderRadius: 99, fontSize: '0.68rem', color: '#cbd5e1', fontWeight: 700, border: '1px solid rgba(255,255,255,0.06)' }}>
                    {selectedDonor.type}
                  </span>
                </div>
              </div>
            </div>

            {/* Scrollable Modal Body */}
            <div style={{ padding: '1.75rem', overflowY: 'auto', flex: 1 }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1.25rem', borderRadius: '16px', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>About Partner</h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{selectedDonor.bio}</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '2px' }}>Email</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white', wordBreak: 'break-all' }}>{selectedDonor.email}</span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '2px' }}>Phone</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>{selectedDonor.phone}</span>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '2px' }}>Address</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>{selectedDonor.address || selectedDonor.city || 'Not specified'}</span>
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
            </div>

            {/* Fixed Modal Footer */}
            <div style={{ padding: '1.25rem 1.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn-primary"
                style={{ padding: '0.6rem 1.5rem', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => {
                  setAcceptedDonor({
                    donorName: selectedDonor.name,
                    donorPhone: selectedDonor.phone,
                    donorEmail: selectedDonor.email,
                    donorPic: selectedDonor.profilePic,
                    donorAddress: selectedDonor.address || selectedDonor.city || 'Pakistan',
                    isDirectContact: true
                  });
                  setSelectedDonor(null);
                }}
              >
                📞 Contact Partner
              </button>
              <button className="btn btn-outline" style={{ padding: '0.6rem 1.5rem', borderRadius: '12px' }} onClick={() => setSelectedDonor(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Donation Detail Modal */}
      {selectedCompletedDonation && (
        <div className="modal-overlay" onClick={() => { setSelectedCompletedDonation(null); setActiveHistoryImgIdx(0); }} style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0, 0, 0, 0.75)' }}>
          <div
            className="modal-content post-modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 520, padding: 0, background: 'rgba(10, 18, 36, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '24px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', color: 'white', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}
          >
            <div style={{ position: 'relative', height: 200, overflow: 'hidden', flexShrink: 0 }}>
              {(() => {
                const imgs = selectedCompletedDonation.imageUrl
                  ? (Array.isArray(selectedCompletedDonation.imageUrl) ? selectedCompletedDonation.imageUrl : [selectedCompletedDonation.imageUrl])
                  : [];
                const activeImg = imgs[activeHistoryImgIdx] || imgs[0];
                return activeImg ? (
                  <img src={activeImg} alt="Donation" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #022c22 0%, #064e3b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={56} color="#047857" />
                  </div>
                );
              })()}
              {/* Glowing overlay shadow on header image */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(10,18,36,0.95) 100%)' }} />
              <button className="close-modal" onClick={() => { setSelectedCompletedDonation(null); setActiveHistoryImgIdx(0); }} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            </div>

            {/* Scrollable Body */}
            <div style={{ padding: '1.25rem 1.75rem', overflowY: 'auto', flex: 1 }}>
              <h2 style={{ margin: '0 0 10px', fontSize: '1.75rem', fontWeight: 900, color: 'white', fontFamily: 'var(--font-heading)', letterSpacing: '-0.5px' }}>{selectedCompletedDonation.title}</h2>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <span style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '4px 12px', borderRadius: 99, fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 700, border: '1px solid rgba(255,255,255,0.06)' }}>
                  📦 {selectedCompletedDonation.category || 'General'}
                </span>
                <span style={{ background: 'rgba(16,185,129,0.15)', padding: '4px 12px', borderRadius: 99, fontSize: '0.75rem', color: '#6ee7b7', fontWeight: 700, border: '1px solid rgba(16,185,129,0.25)' }}>
                  ACCEPTED & VERIFIED
                </span>
              </div>

              {/* Carousel selector */}
              {(() => {
                const imgs = selectedCompletedDonation.imageUrl
                  ? (Array.isArray(selectedCompletedDonation.imageUrl) ? selectedCompletedDonation.imageUrl : [selectedCompletedDonation.imageUrl])
                  : [];
                if (imgs.length <= 1) return null;
                return (
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '1.25rem', padding: '4px 0' }}>
                    {imgs.map((im, idx) => (
                      <img
                        key={idx}
                        src={im}
                        alt="Thumbnail"
                        onClick={() => setActiveHistoryImgIdx(idx)}
                        style={{
                          width: '45px', height: '45px', objectFit: 'cover', borderRadius: '8px',
                          border: activeHistoryImgIdx === idx ? '2px solid #10b981' : '2px solid rgba(255,255,255,0.1)',
                          cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      />
                    ))}
                  </div>
                );
              })()}

              {/* Donor Contact Box */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1.25rem', borderRadius: '16px', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Donor Contact Details</h3>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #1e40af, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {selectedCompletedDonation.donorId?.profilePic ? (
                      <img src={selectedCompletedDonation.donorId.profilePic} alt={selectedCompletedDonation.donorId.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <UserCircle size={24} color="white" />
                    )}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, color: 'white', fontSize: '0.95rem', fontWeight: 700 }}>{selectedCompletedDonation.donorId?.name || 'Anonymous Donor'}</h4>
                    <span style={{ color: '#60a5fa', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Verified Donor</span>
                  </div>
                </div>

                <div className="modal-donor-grid" style={{ gap: '10px', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.85)' }}>
                  <div style={{ wordBreak: 'break-all' }}><strong style={{ color: 'var(--text-dim)' }}>Email:</strong> {selectedCompletedDonation.donorId?.email || 'N/A'}</div>
                  <div style={{ wordBreak: 'break-all' }}><strong style={{ color: 'var(--text-dim)' }}>Phone:</strong> {selectedCompletedDonation.donorId?.phone || 'N/A'}</div>
                  <div className="grid-span-2"><strong style={{ color: 'var(--text-dim)' }}>City:</strong> {selectedCompletedDonation.donorId?.city || 'Pakistan'}</div>
                </div>
              </div>

              {/* AI Safety Report */}
              <div style={{ background: 'rgba(16, 185, 129, 0.07)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <ShieldCheck size={18} color="#34d399" />
                  <strong style={{ color: '#34d399', fontSize: '0.9rem', fontWeight: 800 }}>AI Safety Report (Score: {selectedCompletedDonation.aiSafetyScore}%)</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.55 }}>
                  {selectedCompletedDonation.aiAnalysisReason || 'Items verified safe by SpareShare AI validation service.'}
                </p>
              </div>

              {/* Coordination Live Chat System Toggle */}
              <div style={{ 
                marginBottom: '1.25rem', 
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
                    if (activeChatDonationId === selectedCompletedDonation._id) {
                      setActiveChatDonationId(null);
                    } else {
                      setActiveChatDonationId(selectedCompletedDonation._id);
                    }
                  }}
                  className="btn"
                  style={{
                    padding: '8px 16px', fontSize: '0.82rem', borderRadius: '10px',
                    background: activeChatDonationId === selectedCompletedDonation._id ? 'rgba(239,68,68,0.15)' : '#10b981',
                    color: activeChatDonationId === selectedCompletedDonation._id ? '#fca5a5' : 'white',
                    border: 'none', cursor: 'pointer', fontWeight: 700
                  }}
                >
                  {activeChatDonationId === selectedCompletedDonation._id ? 'Close Chat Drawer' : 'Open Chat Panel'}
                </button>
              </div>

              {/* Trust Metrics Rating */}
              <div style={{ background: 'rgba(245, 158, 11, 0.04)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '16px', padding: '1.25rem', marginBottom: '1rem' }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⭐ Rate & Review Donor
                </h3>
                {selectedCompletedDonation.rating ? (
                  <div>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          size={20}
                          fill={star <= selectedCompletedDonation.rating ? '#f59e0b' : 'none'}
                          color={star <= selectedCompletedDonation.rating ? '#f59e0b' : '#64748b'}
                        />
                      ))}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: 'rgba(255,255,255,0.7)' }}>
                      You rated this exchange {selectedCompletedDonation.rating} out of 5 stars.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={{ margin: '0 0 10px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Provide a trust score review based on your pickup or interaction experience to prevent fraud and update donor trust score.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
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
                      <div>
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
                          onClick={() => submitRating(selectedCompletedDonation._id)}
                        >
                          {isSubmittingRating ? 'Submitting...' : 'Submit Rating'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Fixed Footer */}
            <div style={{ padding: '1.25rem 1.75rem', background: 'rgba(10, 18, 36, 0.98)', borderTop: '1px solid rgba(255, 255, 255, 0.08)', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {selectedCompletedDonation.donorId && (
                <button
                  className="btn btn-primary animate-pulse"
                  style={{ 
                    padding: '0.6rem 1.5rem', 
                    borderRadius: '12px', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    background: 'linear-gradient(to right, #10b981, #059669)',
                    borderColor: '#10b981'
                  }}
                  onClick={() => {
                    if (activeChatDonationId === selectedCompletedDonation._id) {
                      setActiveChatDonationId(null);
                    } else {
                      setActiveChatDonationId(selectedCompletedDonation._id);
                    }
                  }}
                >
                  💬 Chat with Donor
                </button>
              )}
              <button className="btn btn-outline" style={{ padding: '0.6rem 1.5rem', borderRadius: '12px' }} onClick={() => { setSelectedCompletedDonation(null); setActiveHistoryImgIdx(0); }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div 
          className="modal-overlay" 
          onClick={() => setPreviewImage(null)} 
          style={{ 
            backdropFilter: 'blur(16px)', 
            backgroundColor: 'rgba(0, 0, 0, 0.9)', 
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'fixed',
            inset: 0
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setPreviewImage(null)} 
              style={{ 
                position: 'absolute', 
                top: -40, 
                right: 0, 
                background: 'rgba(255,255,255,0.15)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '50%', 
                width: 36, 
                height: 36, 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
            <img 
              src={previewImage} 
              alt="Preview" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '80vh', 
                borderRadius: '12px', 
                border: '2px solid rgba(255,255,255,0.1)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                objectFit: 'contain'
              }} 
            />
          </div>
        </div>
      )}

      {/* Sliding Floating Coordination Chat Drawer */}
      {activeChatDonationId && (() => {
        const donationItem = activeChatDonation || completedDonations.find(d => d._id === activeChatDonationId) || selectedCompletedDonation;
        if (!donationItem) return null;

        const partnerName = donationItem.donorId?.name || 'Verified Donor';
        const partnerPic = donationItem.donorId?.profilePic;

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
                    <span style={{ fontSize: '1rem' }}>👤</span>
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
                  onClick={() => setActiveChatDonationId(null)}
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


export default ReceiverPortal;
