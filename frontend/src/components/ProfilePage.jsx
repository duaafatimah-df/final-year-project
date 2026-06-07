import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  UserCircle, Mail, Phone, MapPin, Edit2, Check, X,
  Camera, ShieldCheck, Building2, Heart, Star, Upload
} from 'lucide-react';
import './ProfilePage.css';

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : (import.meta.env.VITE_API_URL || 'https://spareshare-ai.up.railway.app');

const ProfilePage = ({ onClose }) => {
  const { user, updateUser } = useAuth();
  const fileRef = useRef(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [city, setCity] = useState(user?.city || '');
  const [profilePic, setProfilePic] = useState(user?.profilePic || '');
  const [address, setAddress] = useState(user?.location?.address || '');
  const [lat, setLat] = useState((user?.location?.lat !== undefined && user?.location?.lat !== null) ? user.location.lat : '');
  const [lng, setLng] = useState((user?.location?.lng !== undefined && user?.location?.lng !== null) ? user.location.lng : '');
  const [website, setWebsite] = useState(user?.website || '');
  const [avgRating, setAvgRating] = useState(user?.avgRating ?? null);
  const [ratingCount, setRatingCount] = useState(user?.ratingCount ?? 0);

  // Load from DB on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`${API}/api/users/me`, {
          headers: { 'x-auth-token': localStorage.getItem('token') }
        });
        const u = res.data;
        setName(u.name || '');
        setPhone(u.phone || '');
        setBio(u.bio || '');
        setCity(u.city || '');
        setProfilePic(u.profilePic || '');
        setAddress(u.location?.address || '');
        setLat((u.location?.lat !== undefined && u.location?.lat !== null) ? u.location.lat : '');
        setLng((u.location?.lng !== undefined && u.location?.lng !== null) ? u.location.lng : '');
        setWebsite(u.website || '');
        setAvgRating(u.avgRating);
        setRatingCount(u.ratingCount);
      } catch (err) {
        console.error('Failed to load profile', err);
      }
    };
    fetchProfile();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setProfilePic(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.put(`${API}/api/users/me`,
        { name, phone, bio, city, profilePic, address, lat, lng, website },
        { headers: { 'x-auth-token': localStorage.getItem('token') } }
      );
      // Update global context & local storage user details
      updateUser(res.data);
      setSaveMsg('✅ Profile saved!');
      setEditing(false);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg(`❌ Save failed: ${err.response?.data?.error || 'Try again.'}`);
      setTimeout(() => setSaveMsg(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  const isReceiver = user?.role === 'receiver';
  const roleLabel = isReceiver ? 'Verified NGO' : 'Verified Donor';
  const roleColor = isReceiver ? '#064e3b' : '#1e40af';
  const roleBg = isReceiver ? '#d1fae5' : '#dbeafe';

  return (
    <div className="profile-page-overlay" onClick={onClose}>
      <div className="profile-page-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="pp-header">
          <div style={{ flex: 1 }}>
            <h2 className="pp-title">My Profile</h2>
            <p className="pp-subtitle">Your personal information &amp; settings</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {!editing ? (
              <button className="pp-edit-btn" onClick={() => setEditing(true)}>
                <Edit2 size={15} /> Edit
              </button>
            ) : (
              <>
                <button className="pp-cancel-btn" onClick={() => setEditing(false)}>
                  <X size={15} /> Cancel
                </button>
                <button className="pp-save-btn" onClick={handleSave} disabled={saving}>
                  <Check size={15} /> {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
            <button className="pp-close-btn" onClick={onClose}><X size={20} /></button>
          </div>
        </div>

        {saveMsg && (
          <div className={`pp-toast ${saveMsg.startsWith('✅') ? 'success' : 'error'}`}>
            {saveMsg}
          </div>
        )}

        <div className="pp-body">
          {/* Left: Avatar section */}
          <div className="pp-avatar-col">
            <div className="pp-avatar-wrapper">
              {profilePic ? (
                <img src={profilePic} alt="Profile" className="pp-avatar-img" />
              ) : (
                <div className="pp-avatar-placeholder">
                  {isReceiver ? <Building2 size={48} color="white" /> : <Heart size={48} color="white" />}
                </div>
              )}
              {editing && (
                <button className="pp-avatar-edit" onClick={() => fileRef.current?.click()}>
                  <Camera size={16} />
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
            </div>

            <div className="pp-avatar-info">
              <h3 className="pp-name">{name}</h3>
              <span className="pp-role-badge" style={{ background: roleBg, color: roleColor }}>
                <ShieldCheck size={13} /> {roleLabel}
              </span>
              {user?.orgType && (
                <span className="pp-org-type">{user.orgType}</span>
              )}
            </div>

            {/* Quick stats */}
            <div className="pp-quick-stats">
              <div className="pp-qs-item">
                <Star size={16} color="#f59e0b" />
                <span>
                  {ratingCount > 0 && avgRating !== null && avgRating !== undefined
                    ? `${Math.round(avgRating * 20)}% Trust Score`
                    : (isReceiver ? 'New NGO' : 'New Partner')}
                </span>
              </div>
              <div className="pp-qs-item">
                <ShieldCheck size={16} color="#10b981" />
                <span>Identity Verified</span>
              </div>
            </div>
          </div>

          {/* Right: Fields */}
          <div className="pp-fields-col">
            <div className="pp-section-title">Personal Information</div>

            <div className="pp-field-grid">
              <div className="pp-field">
                <label><Mail size={14} /> Full Name</label>
                {editing ? (
                  <input value={name} onChange={e => setName(e.target.value)} className="pp-input" placeholder="Your full name" />
                ) : (
                  <p className="pp-value">{name || 'N/A'}</p>
                )}
              </div>

              <div className="pp-field">
                <label><Mail size={14} /> Email Address</label>
                <p className="pp-value pp-readonly">{user?.email}</p>
                <span className="pp-readonly-note">Email cannot be changed</span>
              </div>

              <div className="pp-field">
                <label><Phone size={14} /> Phone Number</label>
                {editing ? (
                  <input value={phone} onChange={e => setPhone(e.target.value)} className="pp-input" placeholder="+92 300 0000000" />
                ) : (
                  <p className="pp-value">{phone || 'N/A'}</p>
                )}
              </div>

              <div className="pp-field">
                <label><MapPin size={14} /> City / Location</label>
                {editing ? (
                  <input value={city} onChange={e => setCity(e.target.value)} className="pp-input" placeholder="e.g. Karachi, Pakistan" />
                ) : (
                  <p className="pp-value">{city || 'N/A'}</p>
                )}
              </div>

              <div className="pp-field" style={{ gridColumn: 'span 2' }}>
                <label><MapPin size={14} /> Full Street Address</label>
                {editing ? (
                  <input value={address} onChange={e => setAddress(e.target.value)} className="pp-input" placeholder="e.g. House 123, Street 4, Gul Colony" />
                ) : (
                  <p className="pp-value">{address || 'N/A'}</p>
                )}
              </div>

              {isReceiver && (
                <div className="pp-field" style={{ gridColumn: 'span 2' }}>
                  <label><Building2 size={14} /> Website Link</label>
                  {editing ? (
                    <input type="url" value={website} onChange={e => setWebsite(e.target.value)} className="pp-input" placeholder="e.g. https://www.yourorganisation.org" />
                  ) : (
                    <p className="pp-value">
                      {website ? (
                        <a href={website.startsWith('http') ? website : `https://${website}`} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
                          {website}
                        </a>
                      ) : 'N/A'}
                    </p>
                  )}
                </div>
              )}

              <div className="pp-field">
                <label><MapPin size={14} /> Latitude</label>
                {editing ? (
                  <input type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} className="pp-input" placeholder="Latitude" />
                ) : (
                  <p className="pp-value">{lat || 'N/A'}</p>
                )}
              </div>

              <div className="pp-field">
                <label><MapPin size={14} /> Longitude</label>
                {editing ? (
                  <input type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} className="pp-input" placeholder="Longitude" />
                ) : (
                  <p className="pp-value">{lng || 'N/A'}</p>
                )}
              </div>

              {editing && (
                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '0.8rem', padding: '8px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer' }}
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          pos => {
                            setLat(pos.coords.latitude);
                            setLng(pos.coords.longitude);
                            alert("Coordinates detected: " + pos.coords.latitude + ", " + pos.coords.longitude);
                          },
                          err => alert("Error detecting location coordinates. Try manually.")
                        );
                      } else {
                        alert("Geolocation not supported.");
                      }
                    }}
                  >
                    📍 Detect Current Coordinates
                  </button>
                </div>
              )}
            </div>

            <div className="pp-section-title" style={{ marginTop: '1.5rem' }}>
              {isReceiver ? 'About Your Organization' : 'About Me'}
            </div>
            <div className="pp-field" style={{ marginTop: '0.5rem' }}>
              {editing ? (
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  className="pp-input pp-textarea"
                  placeholder={isReceiver
                    ? "Describe your organization's mission, history, and impact for donors to read..."
                    : "Share a little about yourself and why you donate..."}
                  rows={4}
                />
              ) : (
                <p className="pp-value" style={{ lineHeight: 1.7, color: bio ? '#374151' : '#94a3b8' }}>
                  {bio || (isReceiver ? 'No organization bio yet. Click Edit to add your story.' : 'No bio yet. Click Edit to add one.')}
                </p>
              )}
            </div>

            {isReceiver && (
              <div className="pp-donor-tip">
                💡 <strong>Tip:</strong> A complete profile with bio and city gets <strong>3× more donations</strong>!
                This info shows on your public organization page visible to all donors.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
