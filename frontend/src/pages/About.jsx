import { useNavigate } from 'react-router-dom';
import { useLang } from '../context/AuthContext';
import { ShieldCheck, CloudSun, MapPin, Sparkles, Heart, HelpCircle, ArrowRight } from 'lucide-react';
import './About.css';

const About = () => {
  const { lang, t } = useLang();
  const navigate = useNavigate();

  return (
    <div className="about-page animate-fade-in">
      <div className="about-container">
        
        {/* HERO SECTION */}
        <header className="about-hero">
          <span className="about-badge">{t('Our Mission', 'ہمارا مشن')}</span>
          <h1>
            {t('Bridging Surplus & Scarcity', 'فالتو وسائل اور ضرورت مندوں کا ملاپ')}
            <br />
            <span className="text-gradient">
              {t('Powered by Safety AI', 'سیفٹی اے آئی کے ساتھ')}
            </span>
          </h1>
          <p>
            {t(
              'SpareShare AI is a state-of-the-art resource redistribution platform tailored for Pakistan. We utilize custom weather detection intelligence, automated visual safety checks, and geospatial mapping to coordinate food and medicine donations safely and efficiently.',
              'اسپیئر شیئر اے آئی پاکستان کے لیے تیار کردہ ایک جدید وسائل کی دوبارہ تقسیم کا پلیٹ فارم ہے۔ ہم خوراک اور ادویات کے عطیات کو محفوظ اور مؤثر طریقے سے مربوط کرنے کے لیے کسٹم ویدر ڈیٹیکشن، خودکار بصری حفاظتی چیک، اور جیو اسپیشل میپنگ کا استعمال کرتے ہیں۔'
            )}
          </p>
        </header>

        {/* INTRO GRID */}
        <section className="about-grid">
          <div className="about-content">
            <h2>{t('Ensuring Safety, One Donation at a Time', 'حفاظت کو یقینی بنانا، ایک وقت میں ایک عطیہ')}</h2>
            <p>
              {t(
                'In developing nations like Pakistan, resource redistribution faces extreme challenges: high summer temperatures accelerating food spoilage, lack of coordination, and unverified donation item categories. SpareShare AI was built to solve these exact hurdles.',
                'پاکستان جیسے ترقی پذیر ممالک میں، فالتو اشیاء کی تقسیم کو شدید چیلنجز کا سامنا ہے: گرمیوں کا زیادہ درجہ حرارت جو کھانے کی خرابی کو تیز کرتا ہے، کوآرڈینیشن کی کمی، اور غیر تصدیق شدہ اشیاء۔ اسپیئر شیئر اے آئی انھی رکاوٹوں کو دور کرنے کے لیے بنایا گیا ہے۔'
              )}
            </p>
            <p>
              {t(
                'Our system validates donations at the source using advanced machine learning models to classify products and verify quality parameters like expiration dates and safety seals before requests ever reach receivers.',
                'ہمارا نظام جدید مشین لرننگ ماڈلز کا استعمال کرتے ہوئے عطیات کو ان کے ماخذ پر ہی تصدیق کرتا ہے تاکہ مصنوعات کی درجہ بندی کی جا سکے اور ان کی میعاد اور حفاظتی سیل کو چیک کیا جا سکے۔'
              )}
            </p>
          </div>
          <div className="about-image-wrapper">
            <img src="/pakistan_donation_about.png" alt="SpareShare AI Pakistan" />
            <div className="about-image-glow" />
          </div>
        </section>

        {/* CORE FEATURES SECTION */}
        <h2 className="features-title">{t('Our AI Technology Ecosystem', 'ہمارا اے آئی ٹیکنالوجی کا نظام')}</h2>
        <section className="features-grid">
          
          {/* Weather AI */}
          <div className="feature-card glass-panel">
            <div className="icon-box">
              <CloudSun size={26} />
            </div>
            <h3>{t('Open-Meteo Weather Routing', 'اوپن میٹیو ویدر روٹنگ')}</h3>
            <p>
              {t(
                'Our Python AI microservice integrates with Open-Meteo APIs to query real-time local weather. When temperatures exceed 30°C in hot summer months, the system strictly enforces a maximum 2-hour distribution window for prepared foods.',
                'ہمارا پائتھون اے آئی مائیکرو سروس اوپن میٹیو API کے ساتھ مربوط ہے۔ جب گرمیوں کے مہینوں میں درجہ حرارت 30 ڈگری سے زیادہ ہو جاتا ہے، تو نظام تیار شدہ کھانے کے لیے زیادہ سے زیادہ 2 گھنٹے کا ڈسٹری بیوشن ٹائم لاگو کرتا ہے۔'
              )}
            </p>
            <div className="feature-highlight">
              <strong>{t('Summer Constraint:', 'گرمیوں کی حد:')}</strong>{' '}
              {t(
                'Matches only donor-receiver pairs within a 10-20 minutes travel time radius to prevent food spoilage.',
                'کھانے کو خراب ہونے سے بچانے کے لیے صرف 10-20 منٹ کے سفری فاصلے والے عطیہ دہندگان اور وصول کنندگان کو ملایا جاتا ہے۔'
              )}
            </div>
          </div>

          {/* Category Classification */}
          <div className="feature-card glass-panel">
            <div className="icon-box">
              <ShieldCheck size={26} />
            </div>
            <h3>{t('Strict 5-Category Visual AI', 'بصری اے آئی کیٹیگری فلٹر')}</h3>
            <p>
              {t(
                'Donation photos are analyzed by our computer vision models to ensure strict item verification. Predictions are normalized automatically into five standard, actionable categories to maintain clean matching databases.',
                'اشیاء کی تصویروں کا تجزیہ ہمارے کمپیوٹر وژن ماڈلز کے ذریعے کیا جاتا ہے۔ تصاویر کو خودکار طریقے سے 5 بنیادی اقسام میں تقسیم کیا جاتا ہے تاکہ ڈیٹا بیس کو صاف اور درست رکھا جا سکے۔'
              )}
            </p>
            <div className="feature-highlight">
              <strong>{t('Categories:', 'اقسام:')}</strong>{' '}
              <code>{t('Food', 'خوراک')}</code>, <code>{t('Medicine', 'ادویات')}</code>,{' '}
              <code>{t('Clothes', 'کپڑے')}</code>, <code>{t('Grocery', 'گروسری')}</code>,{' '}
              <code>{t('Household', 'گھریلو اشیاء')}</code>.
            </div>
          </div>

          {/* Smart Map Fit */}
          <div className="feature-card glass-panel">
            <div className="icon-box">
              <MapPin size={26} />
            </div>
            <h3>{t('Geospatial Smart Mapping', 'جغرافیائی اسمارٹ نقشہ سازی')}</h3>
            <p>
              {t(
                'Our maps adapt dynamically. When suggested receivers are calculated for a donation, the system computes the exact bounding coordinates of all markers (the donor plus all matching NGOs) and centers the map viewport perfectly.',
                'ہمارے نقشے متحرک طور پر ایڈجسٹ ہوتے ہیں۔ جب کسی عطیہ کے لیے این جی اوز تجویز کی جاتی ہیں، تو نقشہ خود بخود تمام لوکیشنز کے مطابق زوم اور فٹ ہو جاتا ہے تاکہ تمام پنیں واضح نظر آئیں۔'
              )}
            </p>
            <div className="feature-highlight">
              <strong>{t('Live Routing:', 'لائیو روٹنگ:')}</strong>{' '}
              {t(
                'Uses coordinate boundaries to zoom, center, and plot both donors and recipients seamlessly.',
                'عطیہ دہندگان اور وصول کنندگان دونوں کے نقشے کی حدود کے مطابق خودکار زوم اور سینٹرنگ فراہم کرتا ہے۔'
              )}
            </div>
          </div>

        </section>

        {/* SIMULATED PAKISTANI PARTNERS */}
        <section className="partners-section">
          <h2>{t('Empowering Pakistani Welfare Platforms', 'پاکستانی ویلفیئر پلیٹ فارمز کی معاونت')}</h2>
          <p>
            {t(
              'SpareShare AI simulates and collaborates with major NGOs and welfare organizations in Lahore, Karachi, and Islamabad to test scale, logistics, and rapid response delivery coordinates.',
              'اسپیئر شیئر اے آئی لاہور، کراچی اور اسلام آباد میں بڑے فلاحی اداروں کے کوآرڈینیٹس اور لوکیشن کا استعمال کرتے ہوئے لاجسٹکس اور تیز رفتار ڈلیوری کو سیمولیٹ کرتا ہے۔'
            )}
          </p>
          <div className="partners-list">
            <div className="partner-logo-box">{t('Saylani Welfare Trust', 'سیلانی ویلفیئر ٹرسٹ')}</div>
            <div className="partner-logo-box">{t('Edhi Foundation', 'ایدھی فاؤنڈیشن')}</div>
            <div className="partner-logo-box">{t('Chhipa Welfare', 'چھیپا ویلفیئر')}</div>
            <div className="partner-logo-box">{t('Al-Khidmat Foundation', 'الخدمت فاؤنڈیشن')}</div>
            <div className="partner-logo-box">{t('JDC Pakistan', 'جے ڈی سی پاکستان')}</div>
          </div>
        </section>

        {/* CALL TO ACTION */}
        <section className="about-cta glass-panel">
          <h2>{t('Join the Movement Today', 'آج ہی اس کارِ خیر کا حصہ بنیں')}</h2>
          <p>
            {t(
              'Whether you are an individual with surplus meals, a pharmacy with surplus medicine, or a registered NGO looking to receive support, SpareShare AI is ready for you.',
              'خواہ آپ فالتو کھانا دینے والے فرد ہوں، اضافی ادویات کی فارمیسی ہو، یا مدد حاصل کرنے والی رجسٹرڈ این جی او، اسپیئر شیئر اے آئی آپ کی مدد کے لیے تیار ہے۔'
            )}
          </p>
          <div className="cta-buttons">
            <button className="btn btn-primary" onClick={() => navigate('/auth/donor')}>
              {t('Become a Contributor', 'عطیہ کنندہ بنیں')} <ArrowRight size={16} />
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/auth/receiver')}>
              {t('Register Your NGO', 'این جی او رجسٹر کریں')}
            </button>
          </div>
        </section>

      </div>
    </div>
  );
};

export default About;
