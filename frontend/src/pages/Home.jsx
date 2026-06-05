import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Leaf, ShieldCheck, Cpu, Heart, CheckCircle2, Filter, MapPin, Zap, Users, Package, UploadCloud, Search, Handshake } from 'lucide-react';
import { useLang } from '../context/AuthContext';
import axios from 'axios';
import CustomDropdown from '../components/CustomDropdown';
import './Home.css';

const t = (lang, en, ur) => lang === 'Eng' ? en : ur;

const img1 = 'https://images.pexels.com/photos/6646917/pexels-photo-6646917.jpeg?auto=compress&cs=tinysrgb&w=800';
const img2 = 'https://images.pexels.com/photos/6995201/pexels-photo-6995201.jpeg?auto=compress&cs=tinysrgb&w=800';
const img3 = 'https://images.pexels.com/photos/6994982/pexels-photo-6994982.jpeg?auto=compress&cs=tinysrgb&w=800';
const img4 = 'https://images.pexels.com/photos/6591154/pexels-photo-6591154.jpeg?auto=compress&cs=tinysrgb&w=800';
const logo1 = 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=150';

export const organizations = [
  { id: 'edhi', name: 'Edhi Foundation', type: 'NGO', image: img1, logo: logo1, desc: 'Ambulance and social welfare services across Pakistan.', city: 'Karachi', tags: ['Health', 'Shelter'] },
  { id: 'saylani', name: 'Saylani Welfare', type: 'NGO', image: img2, logo: logo1, desc: 'Feeding hundreds of thousands daily across all provinces.', city: 'Karachi', tags: ['Food', 'Education'] },
  { id: 'chhipa', name: 'Chhipa Welfare', type: 'NGO', image: img3, logo: logo1, desc: 'Rescue ambulances and food distribution drives.', city: 'Lahore', tags: ['Emergency'] },
  { id: 'tcf', name: 'The Citizens Foundation', type: 'NGO', image: img4, logo: logo1, desc: 'Providing quality education to underprivileged children.', city: 'Islamabad', tags: ['Education'] },
  { id: 'alkhidmat', name: 'Al-Khidmat', type: 'NGO', image: img1, logo: logo1, desc: 'Disaster relief, health camps and community development.', city: 'Peshawar', tags: ['Disaster Relief'] },
  { id: 'jdc', name: 'JDC Welfare', type: 'NGO', image: img2, logo: logo1, desc: 'Free healthcare, rescue operations and food distribution.', city: 'Karachi', tags: ['Rescue'] },
  { id: 'transparent', name: 'Transparent Hands', type: 'NGO', image: img3, logo: logo1, desc: 'Medical surgeries crowdfunding for the underprivileged.', city: 'Lahore', tags: ['Medical'] },
  { id: 'shahid', name: 'Shahid Afridi Foundation', type: 'NGO', image: img4, logo: logo1, desc: 'Clean water, health and education for rural communities.', city: 'Peshawar', tags: ['Water', 'Health'] },
  { id: 'akhuwat', name: 'Akhuwat', type: 'NGO', image: img1, logo: logo1, desc: 'Interest-free microfinance empowering thousands of families.', city: 'Lahore', tags: ['Empowerment'] },
  { id: 'shaukat', name: 'Shaukat Khanum', type: 'NGO', image: img2, logo: logo1, desc: 'Cancer hospital, research and free treatment for patients.', city: 'Islamabad', tags: ['Health'] },
  { id: 'rizq', name: '@Rizq.ShareFood', type: 'Social', image: img3, logo: logo1, desc: 'Eradicating hunger through community food banks.', city: 'Lahore', tags: ['Food Rescue'] },
  { id: 'robinhood', name: '@RobinHoodArmyPK', type: 'Social', image: img4, logo: logo1, desc: 'Zero-funds volunteer organization fighting hunger.', city: 'Islamabad', tags: ['Surplus'] },
  { id: 'wall', name: '@WallOfKindness', type: 'Social', image: img1, logo: logo1, desc: 'Leave what you don\'t need, take what you do.', city: 'Peshawar', tags: ['Clothing'] },
  { id: 'smile', name: '@SmileSpreaders', type: 'Social', image: img2, logo: logo1, desc: 'Youth volunteers spreading smiles across Pakistan.', city: 'Karachi', tags: ['Youth'] },
  { id: 'hope', name: '@HopeForAll', type: 'Social', image: img3, logo: logo1, desc: 'Monthly ration distribution drives for deserving families.', city: 'Lahore', tags: ['Rations'] },
  { id: 'street', name: '@StreetScholars', type: 'Social', image: img4, logo: logo1, desc: 'Teaching street children through mobile classrooms.', city: 'Karachi', tags: ['Education'] },
  { id: 'warm', name: '@WarmHearts', type: 'Social', image: img1, logo: logo1, desc: 'Winter clothing drives for underprivileged communities.', city: 'Islamabad', tags: ['Winter'] },
  { id: 'green', name: '@GreenPakistan', type: 'Social', image: img2, logo: logo1, desc: 'Planting trees and environmental cleanup drives.', city: 'Peshawar', tags: ['Environment'] },
  { id: 'blood', name: '@BloodDonorsPK', type: 'Social', image: img3, logo: logo1, desc: 'Connecting blood donors with patients in need.', city: 'Lahore', tags: ['Health'] },
  { id: 'animal', name: '@AnimalRescuePK', type: 'Social', image: img4, logo: logo1, desc: 'Rescuing and rehabilitating street animals across Pakistan.', city: 'Karachi', tags: ['Animals'] },
];

const Home = () => {
  const navigate = useNavigate();
  const { lang } = useLang();
  const [selectedCity, setSelectedCity] = useState('All');
  const [dbReceivers, setDbReceivers] = useState([]);

  useEffect(() => {
    const fetchReceivers = async () => {
      try {
        const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? 'http://localhost:5000'
          : (import.meta.env.VITE_API_URL || 'https://spareshare-ai.up.railway.app');
        const res = await axios.get(`${API}/api/users/receivers`);
        setDbReceivers(res.data);
      } catch (err) {
        console.error("Failed to fetch receivers", err);
      }
    };
    fetchReceivers();
  }, []);

  const combinedOrgs = [
    ...organizations,
    ...dbReceivers.map(r => ({
      id: r._id,
      name: r.name,
      type: r.orgType || 'NGO',
      image: r.profileBanner || localStorage.getItem(`banner_${r._id}`) || 'https://images.pexels.com/photos/6995136/pexels-photo-6995136.jpeg',
      logo: r.profilePic || logo1,
      desc: r.bio || localStorage.getItem(`bio_${r._id}`) || `${r.name} is a verified organization on SpareShare AI, actively collecting and distributing donations across Pakistan.`,
      city: r.city || localStorage.getItem(`city_${r._id}`) || 'Karachi',
      tags: []
    }))
  ];

  const filteredOrgs = selectedCity === 'All'
    ? combinedOrgs
    : combinedOrgs.filter(org => org.city.toLowerCase().includes(selectedCity.toLowerCase()) || selectedCity.toLowerCase().includes(org.city.toLowerCase()));

  const ngos = filteredOrgs.filter(o => o.type === 'NGO' || o.type === 'Foundation');
  const socialOrgs = filteredOrgs.filter(o => o.type === 'Social' || o.type === 'Instagram Page' || o.type === 'Community Group');

  return (
    <div className="home-wrapper">

      {/* ── HERO ── */}
      <section className="hero-banner">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />

        <div className="hero-inner">
          {/* Left */}
          <div className="hero-text-col animate-fade-in">
            <div className="hero-badge">
              <span className="hero-badge-dot" />
              {t(lang, 'AI-Powered Donation Platform', 'اے آئی سے چلنے والا عطیہ پلیٹ فارم')}
            </div>

            <h1 className="hero-heading">
              {t(lang, 'Easier giving.', 'آسان عطیہ دہی۔')}<br />
              <span className="highlight">{t(lang, 'Greater good.', 'بڑی بھلائی۔')}</span>
            </h1>

            <p className="hero-sub">
              {t(lang,
                "SpareShare AI uses computer vision to verify every donation item, connecting Pakistan's surplus resources with verified nonprofits instantly and transparently.",
                'اسپیئر شیئر اے آئی ہر عطیہ کی تصدیق کرتا ہے اور پاکستان کے اضافی وسائل کو تصدیق شدہ غیر منافع بخش اداروں سے فوری اور شفافیت کے ساتھ جوڑتا ہے۔'
              )}
            </p>

            <div className="hero-cta-group">
              <button className="hero-cta-primary" onClick={() => navigate('/auth/donor')}>
                <Heart size={18} /> {t(lang, 'Start Donating', 'عطیہ شروع کریں')}
              </button>
              <button className="hero-cta-secondary" onClick={() => navigate('/auth/receiver')}>
                {t(lang, 'Register Your NGO', 'اپنا این جی او رجسٹر کریں')} <ArrowRight size={16} />
              </button>
            </div>

            <div className="hero-stats">
              <div className="hero-stat">
                <div className="hero-stat-value">20+</div>
                <div className="hero-stat-label">{t(lang, 'Partner NGOs', 'پارٹنر این جی اوز')}</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value">99%</div>
                <div className="hero-stat-label">{t(lang, 'AI Accuracy', 'اے آئی درستگی')}</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value">4 Cities</div>
                <div className="hero-stat-label">{t(lang, 'Covered', 'شامل')}</div>
              </div>
            </div>
          </div>

          {/* Right — Action Cards */}
          <div className="hero-card-col animate-fade-in" style={{ animationDelay: '0.15s' }}>
            <div className="hero-action-card" onClick={() => navigate('/auth/donor')}>
              <div className="hac-icon" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <Heart size={26} color="#10b981" />
              </div>
              <div className="hac-text">
                <h3>{t(lang, 'For Donors', 'عطیہ دہندگان کے لیے')}</h3>
                <p>{t(lang, 'Upload, AI-verify and dispatch surplus items to verified NGOs in minutes.', 'منٹوں میں اضافی اشیاء اپ لوڈ کریں، اے آئی سے تصدیق کریں اور تصدیق شدہ این جی اوز کو بھیجیں۔')}</p>
              </div>
              <ArrowRight className="hac-arrow" size={20} />
            </div>

            <div className="hero-action-card" onClick={() => navigate('/auth/receiver')}>
              <div className="hac-icon" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <ShieldCheck size={26} color="#60a5fa" />
              </div>
              <div className="hac-text">
                <h3>{t(lang, 'For Nonprofits', 'غیر منافع بخش اداروں کے لیے')}</h3>
                <p>{t(lang, 'Register your organization, post demands and receive verified physical donations.', 'اپنی تنظیم رجسٹر کریں، ضروریات پوسٹ کریں اور تصدیق شدہ عطیات وصول کریں۔')}</p>
              </div>
              <ArrowRight className="hac-arrow" size={20} />
            </div>

            <div className="hero-action-card" style={{ cursor: 'default' }}>
              <div className="hac-icon" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <Cpu size={26} color="#f59e0b" />
              </div>
              <div className="hac-text">
                <h3>{t(lang, 'AI Safety Engine', 'اے آئی سیفٹی انجن')}</h3>
                <p>{t(lang, 'Every item scanned for quality, freshness and safety before it reaches any NGO.', 'ہر آئٹم این جی او تک پہنچنے سے پہلے معیار، تازگی اور حفاظت کے لیے اسکین کیا جاتا ہے۔')}</p>
              </div>
              <Zap size={20} color="#f59e0b" />
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS & ABOUT US ── */}
      <section className="about-us-section" id="about">
        <div className="container">
          <div className="section-header-clean" style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2>{t(lang, 'How SpareShare AI Works', 'اسپیئر شیئر اے آئی کیسے کام کرتا ہے')}</h2>
            <p>{t(lang, "Three simple steps to turn your surplus into someone's necessity", 'آپ کے اضافے کو کسی کی ضرورت بنانے کے تین آسان اقدامات')}</p>
          </div>
          <div className="hiw-grid">
            <div className="hiw-step">
              <div className="hiw-icon-wrap"><UploadCloud size={32} color="#10b981" /></div>
              <h3>{t(lang, 'Post Your Donation', 'اپنا عطیہ پوسٹ کریں')}</h3>
              <p>{t(lang, 'Upload a photo, add details like category, quantity and expiry date. Our AI instantly validates food safety and medicine compliance.', 'تصویر اپ لوڈ کریں، زمرہ، مقدار اور میعاد کی تاریخ جیسی تفصیلات شامل کریں۔ ہمارا اے آئی فوری طور پر خوراک کی حفاظت کی تصدیق کرتا ہے۔')}</p>
              <div className="hiw-connector" />
            </div>
            <div className="hiw-step">
              <div className="hiw-icon-wrap"><Search size={32} color="#10b981" /></div>
              <h3>{t(lang, 'Smart Matching', 'ذہین ملاپ')}</h3>
              <p>{t(lang, 'Receivers browse and request nearby donations filtered by category and distance. Food items are restricted to 5km for freshness.', 'وصول کنندگان قریبی عطیات براؤز کرتے اور درخواست دیتے ہیں۔ تازگی کے لیے خوراکی اشیاء 5 کلومیٹر تک محدود ہیں۔')}</p>
              <div className="hiw-connector" />
            </div>
            <div className="hiw-step">
              <div className="hiw-icon-wrap"><Handshake size={32} color="#10b981" /></div>
              <h3>{t(lang, 'Safe Handoff', 'محفوظ حوالگی')}</h3>
              <p>{t(lang, 'Donor approves the request, receiver gets contact details for pickup. Trust scores are updated after every successful exchange.', 'عطیہ دہندہ درخواست منظور کرتا ہے، وصول کنندہ کو رابطہ تفصیلات ملتی ہیں۔ ہر کامیاب تبادلے کے بعد ٹرسٹ اسکور اپ ڈیٹ ہوتا ہے۔')}</p>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '3rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="hero-cta-primary" onClick={() => navigate('/auth/donor')}>
              <Heart size={18} /> {t(lang, 'Donate Now', 'ابھی عطیہ کریں')}
            </button>
            <button className="hero-cta-secondary" onClick={() => navigate('/auth/receiver')}>
              {t(lang, 'Find Items', 'اشیاء تلاش کریں')} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ── IMPACT STATS ── */}
      <section className="impact-stats-section">
        <div className="container">
          <div className="section-header-clean" style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2>{t(lang, 'Our Growing Impact', 'ہمارا بڑھتا ہوا اثر')}</h2>
            <p>{t(lang, 'Every donation tracked, every life touched in real time', 'ہر عطیہ ٹریک کیا گیا، ہر زندگی چھوئی گئی — حقیقی وقت میں')}</p>
          </div>
          <div className="impact-grid">
            {[
              { value: '12,400+', label: t(lang, 'Items Donated', 'اشیاء عطیہ'), icon: '📦', color: '#10b981' },
              { value: '3,200+', label: t(lang, 'Families Helped', 'خاندانوں کی مدد'), icon: '🏠', color: '#3b82f6' },
              { value: '20+', label: t(lang, 'Verified NGOs', 'تصدیق شدہ این جی اوز'), icon: '🏛️', color: '#f59e0b' },
              { value: '99%', label: t(lang, 'Safety Rate', 'حفاظت کی شرح'), icon: '🛡️', color: '#8b5cf6' },
            ].map((stat, i) => (
              <div key={i} className="impact-card">
                <div className="impact-icon">{stat.icon}</div>
                <div className="impact-value" style={{ color: stat.color }}>{stat.value}</div>
                <div className="impact-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ORGANIZATIONS ── */}

      <section className="organizations-section container">
        <div className="org-filter-header">
          <div className="section-header-clean" style={{ marginBottom: 0, textAlign: 'left' }}>
            <h2>{t(lang, 'Explore Verified Organizations', 'تصدیق شدہ تنظیمیں دیکھیں')}</h2>
            <p>{t(lang, 'Find an organizations making a difference near you', 'آپ کے قریب فرق ڈالنے والی تنظیمیں تلاش کریں')}</p>
          </div>
          <div className="city-filter-box">
            <Filter size={16} color="#64748b" />
            <CustomDropdown
              value={selectedCity}
              onChange={setSelectedCity}
              options={[
                { value: 'All', label: t(lang, 'All Cities', 'تمام شہر') },
                { value: 'Karachi', label: t(lang, 'Karachi', 'کراچی') },
                { value: 'Lahore', label: t(lang, 'Lahore', 'لاہور') },
                { value: 'Islamabad', label: t(lang, 'Islamabad', 'اسلام آباد') },
                { value: 'Peshawar', label: t(lang, 'Peshawar', 'پشاور') }
              ]}
              style={{ width: '160px', padding: '8px 12px' }}
            />
          </div>
        </div>

        <h3 className="category-heading"><Users size={20} /> {t(lang, 'Verified NGOs', 'تصدیق شدہ این جی اوز')}</h3>
        <div className="org-grid" style={{ marginBottom: '4rem' }}>
          {ngos.length > 0 ? ngos.map(org => (
            <Link to={`/organization/${org.id}`} key={org.id} className="org-card">
              <div className="org-card-image"><img src={org.image} alt={org.name} loading="lazy" /></div>
              <div className="org-card-content">
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span className="org-type">{t(lang, org.type, org.type === 'NGO' ? 'این جی او' : 'ادارہ')}</span>
                  <span className="badge-verified"><ShieldCheck size={12} /> {t(lang, 'Verified', 'تصدیق شدہ')}</span>
                </div>
                <h3>{org.name}</h3>
                <p className="org-location"><MapPin size={12} /> {org.city}, {t(lang, 'Pakistan', 'پاکستان')}</p>
                <p className="org-desc">{org.desc}</p>
              </div>
            </Link>
          )) : <p style={{ color: 'var(--text-muted)' }}>{t(lang, `No NGOs found in ${selectedCity}.`, `${selectedCity} میں کوئی این جی او نہیں ملی۔`)}</p>}
        </div>

        <h3 className="category-heading"><Package size={20} /> {t(lang, 'Social Media Organizations', 'سوشل میڈیا تنظیمیں')}</h3>
        <div className="org-grid">
          {socialOrgs.length > 0 ? socialOrgs.map(org => (
            <Link to={`/organization/${org.id}`} key={org.id} className="org-card">
              <div className="org-card-image"><img src={org.image} alt={org.name} loading="lazy" /></div>
              <div className="org-card-content">
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span className="org-type">{t(lang, org.type, org.type === 'Instagram Page' ? 'انسٹاگرام پیج' : 'سوشل میڈیا')}</span>
                  <span className="badge-verified"><ShieldCheck size={12} /> {t(lang, 'Verified', 'تصدیق شدہ')}</span>
                </div>
                <h3>{org.name}</h3>
                <p className="org-location"><MapPin size={12} /> {org.city}, {t(lang, 'Pakistan', 'پاکستان')}</p>
                <p className="org-desc">{org.desc}</p>
              </div>
            </Link>
          )) : <p style={{ color: 'var(--text-muted)' }}>{t(lang, `No Social Organizations found in ${selectedCity}.`, `${selectedCity} میں کوئی سوشل تنظیم نہیں ملی۔`)}</p>}
        </div>
      </section>


    </div>
  );
};

export default Home;
