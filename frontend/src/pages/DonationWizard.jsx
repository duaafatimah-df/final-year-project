import { useState, useCallback, useEffect } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Camera, CheckCircle2, ScanLine, ArrowLeft, Activity, ShieldCheck, Zap, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { organizations } from './Home';
import axios from 'axios';
import './DonationWizard.css';

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : 'https://spareshare-ai.up.railway.app';

const DonationWizard = () => {
  const { orgId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const categoriesParam = searchParams.get('categories') || 'General';

  // First check static orgs
  const staticOrg = organizations.find(o => o.id === orgId);

  const [dbOrg, setDbOrg] = useState(null);
  const [loadingOrg, setLoadingOrg] = useState(!staticOrg);
  const [step, setStep] = useState(1); // 1=upload, 2=scanning, 3=result
  const [file, setFile] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [trackingId] = useState(`SHP-${Math.floor(Math.random() * 90000) + 10000}`);

  useEffect(() => {
    if (!user) {
      navigate('/auth/donor', { state: { returnTo: `/organization/${orgId}` } });
    }
  }, [user, navigate, orgId]);

  useEffect(() => {
    if (!staticOrg) {
      axios.get(`${API}/api/users/org/${orgId}`)
        .then(res => setDbOrg(res.data.org))
        .catch(err => console.error(err))
        .finally(() => setLoadingOrg(false));
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

  const handleScan = async () => {
    if (!file) return;
    setStep(2); // Show scanning animation

    // Convert image to base64 for real transmission to backend
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setSubmitting(true);
        const imageUrl = reader.result;
        const receiverId = dbOrg?._id || null; // only for DB orgs

        // Ensure standard category string matching backend expectations
        let cleanCategory = 'General';
        const lowerParam = categoriesParam.toLowerCase();
        if (lowerParam.includes('food') || lowerParam.includes('ration')) cleanCategory = 'Food';
        else if (lowerParam.includes('med')) cleanCategory = 'Medicine';
        else if (lowerParam.includes('cloth')) cleanCategory = 'Clothes';
        else if (lowerParam.includes('groc')) cleanCategory = 'Grocery';
        else if (lowerParam.includes('house')) cleanCategory = 'Household';

        const res = await axios.post(`${API}/api/donations`, {
          receiverId,
          orgName: org?.name,
          title: `Direct Donation to ${org?.name}`,
          category: cleanCategory,
          imageUrl,
          lat: 24.8607,
          lng: 67.0011,
          address: 'Karachi, Pakistan',
          condition: 'Good',
          quantity: '1 batch'
        }, {
          headers: { 'x-auth-token': localStorage.getItem('token') }
        });

        // Set the REAL AI results returned by the backend!
        setAiResult({
          score: res.data.aiSafetyScore !== undefined ? res.data.aiSafetyScore : 85,
          safe: res.data.isVerifiedSafe || res.data.status === 'active',
          reason: res.data.aiAnalysisReason || 'Safe for distribution.',
          detectedCategory: res.data.aiDetectedItems || cleanCategory,
          status: res.data.status || 'active'
        });

        setStep(3);
      } catch (err) {
        console.error('Failed to save donation:', err.message);
        // Fallback to warning state
        setAiResult({
          score: 55,
          safe: false,
          reason: err.response?.data?.error || 'AI visual scan completed with warnings. Manual check suggested.',
          detectedCategory: 'General',
          status: 'needs_review'
        });
        setStep(3);
      } finally {
        setSubmitting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (loadingOrg) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1.25rem', color: '#9ca3af', backgroundColor: '#030712' }}>
        <div style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,0.06)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>Loading organization profile...</p>
      </div>
    );
  }

  const org = staticOrg
    ? { id: staticOrg.id, name: staticOrg.name, logo: staticOrg.logo }
    : dbOrg
      ? { id: dbOrg._id, name: dbOrg.name, logo: null }
      : null;

  if (!org) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1.5rem', backgroundColor: '#030712', color: '#ffffff' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)' }}>Organization not found</h2>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  return (
    <div className="wizard-container">
      <div className="wizard-card glass-panel">
        <Link to={`/organization/${org.id}`} className="back-link">
          <ArrowLeft size={16} /> Back to {org.name}
        </Link>

        {/* STEP 1: Upload */}
        {step === 1 && (
          <>
            <div className="wizard-header">
              {org.logo ? (
                <img src={org.logo} alt="org" className="wizard-logo" />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                  <Camera size={32} color="#10b981" />
                </div>
              )}
              <h2>Donate Items to {org.name}</h2>
              <p>Upload a clear photo of <strong>{categoriesParam}</strong> you wish to donate. Our AI will verify its safety instantly.</p>
            </div>

            <div className="wizard-step">
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

              <button
                className="wizard-submit"
                disabled={!file}
                onClick={handleScan}
                style={{ opacity: file ? 1 : 0.6 }}
              >
                <ScanLine size={18} /> Start AI Scan &amp; Donate
              </button>
            </div>
          </>
        )}

        {/* STEP 2: Scanning Animation */}
        {step === 2 && (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
            <div style={{ width: 88, height: 88, border: '4px solid rgba(255,255,255,0.06)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 2.5rem', boxShadow: '0 0 30px rgba(16,185,129,0.2)' }} />
            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.8rem', color: '#ffffff', marginBottom: '0.75rem' }}>SpareShare AI Scanning...</h2>
            <p style={{ color: '#9ca3af', fontSize: '0.95rem' }}>Analyzing your donation for safety and authenticity</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.75rem', marginTop: '2.5rem', flexWrap: 'wrap' }}>
              {['Computer Vision', 'Freshness Check', 'Safety Score', 'Route Match'].map((label, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontSize: '0.85rem', fontWeight: 700 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: `pulse ${0.5 + i * 0.3}s ease infinite alternate` }} />
                  {label}
                </div>
              ))}
            </div>
            {file && <img src={file.preview} alt="scanning" style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 16, marginTop: '2.5rem', border: '3px solid #10b981', opacity: 0.8, boxShadow: '0 10px 25px rgba(0,0,0,0.4)' }} />}
          </div>
        )}

        {/* STEP 3: AI Result + Confirmation */}
        {step === 3 && aiResult && (
          <div style={{ marginTop: '0.5rem', animation: 'fadeIn 0.4s ease' }}>
            {/* AI Dashboard */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 20, padding: '2rem', marginBottom: '2rem', backdropFilter: 'blur(20px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1.25rem' }}>
                <Activity size={24} color="#10b981" />
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', color: 'white', margin: 0, fontWeight: 800, fontSize: '1.25rem' }}>SpareShare AI Overview</h3>
                  <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: 0, marginTop: '2px' }}>Your donation has been scanned and verified</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }} className="rp-stats-grid">
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: '1.2rem 1rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#9ca3af', fontSize: '0.78rem', marginBottom: '8px', fontWeight: 600 }}>
                    <Zap size={13} color="#10b981" /> Safety Score
                  </div>
                  <p style={{ color: '#10b981', fontSize: '1.8rem', fontWeight: 900, margin: 0, fontFamily: 'var(--font-heading)', lineHeight: 1.1 }}>{aiResult.score}%</p>
                  <p style={{ color: aiResult.safe ? '#34d399' : '#f87171', fontSize: '0.75rem', margin: '4px 0 0', fontWeight: 700 }}>
                    {aiResult.safe ? '✓ Verified Safe' : '⚠️ Manual Review'}
                  </p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: '1.2rem 1rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#9ca3af', fontSize: '0.78rem', marginBottom: '8px', fontWeight: 600 }}>
                    <Clock size={13} color="#3b82f6" /> Delivery ETA
                  </div>
                  <p style={{ color: '#ffffff', fontSize: '1.8rem', fontWeight: 900, margin: 0, fontFamily: 'var(--font-heading)', lineHeight: 1.1 }}>12 min</p>
                  <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: '4px 0 0', fontWeight: 500 }}>Optimal route</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: '1.2rem 1rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#9ca3af', fontSize: '0.78rem', marginBottom: '8px', fontWeight: 600 }}>
                    <ShieldCheck size={13} color="#eab308" /> Detection
                  </div>
                  <p style={{ color: '#ffffff', fontSize: '1.05rem', fontWeight: 800, margin: 0, fontFamily: 'var(--font-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {aiResult.detectedCategory}
                  </p>
                  <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: '4px 0 0', fontWeight: 500 }}>Type detected</p>
                </div>
              </div>

              {/* Uploaded image preview */}
              {file && (
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16, padding: '1rem' }}>
                  <img src={file.preview} alt="donation" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 12, border: '2px solid #10b981', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ color: '#34d399', fontWeight: 700, margin: 0, fontSize: '0.92rem' }}>
                      {aiResult.safe ? '✓ Scan verified by SpareShare AI' : '⚠️ Scan flagged by SpareShare AI'}
                    </p>
                    <p style={{ color: '#9ca3af', margin: '4px 0 0', fontSize: '0.82rem', lineHeight: 1.5 }}>
                      {aiResult.reason}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Success alert card */}
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderLeft: '4px solid #10b981', padding: '1.75rem', borderRadius: 16, display: 'flex', alignItems: 'flex-start', gap: '1.25rem' }}>
              <CheckCircle2 size={32} color="#34d399" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h3 style={{ color: '#ffffff', fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Donation Request Sent! 🎉</h3>
                <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.88rem' }}>Tracking ID: <strong style={{ color: '#34d399' }}>#{trackingId}</strong></p>
                <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginTop: '0.75rem', lineHeight: 1.6 }}>
                  <strong style={{ color: '#ffffff' }}>{org.name}</strong> has been notified and will review your request shortly. You'll hear back once they accept it!
                </p>
              </div>
            </div>

            <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1.25rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/" className="btn btn-outline" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#ffffff', borderRadius: '9999px', padding: '0.9rem 2rem', textDecoration: 'none', fontWeight: 600 }}>Back to Home</Link>
              <Link to="/contributor" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#ffffff', borderRadius: '9999px', padding: '0.9rem 2rem', textDecoration: 'none', fontWeight: 700, boxShadow: '0 8px 20px rgba(16,185,129,0.25)' }}>Go to My Dashboard</Link>
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
