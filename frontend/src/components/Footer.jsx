import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone, Calendar as CalendarIcon } from 'lucide-react';
import './Footer.css';

const Footer = () => {
  const getHijriDate = () => {
    try {
      const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      const parts = formatter.formatToParts(new Date());
      const year = parts.find(p => p.type === 'year')?.value || '1447';
      let month = parts.find(p => p.type === 'month')?.value || 'Shawwal';
      month = month.replace('ʻ', "'").replace('’', "'");
      return { year, month };
    } catch (e) {
      return { year: '1447', month: "Dhu'l-Hijjah" };
    }
  };

  const { year, month } = getHijriDate();

  return (
    <footer className="footer-hope">
      <div className="container">
        <div className="footer-grid">
          
          {/* Brand & About */}
          <div className="footer-col brand-col">
            <Link to="/" className="footer-logo-hope">
              <img src="/logo.png" alt="SpareShare Logo" className="footer-logo-img-large" />
              <span>SpareShare AI</span>
            </Link>
            <p>
              A registered non-profit initiative dedicated to reducing waste and empowering communities across Pakistan through intelligent distribution.
            </p>
            <div className="contact-info">
              <p><MapPin size={16} /> Pakistan 🇵🇰</p>
              <p><Mail size={16} /> duaafatimah00@gmail.com</p>
              <p><Phone size={16} /> +92 300 1234567</p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-col links-col">
            <h3>Quick Links</h3>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/auth/donor">Donate Now</Link></li>
              <li><Link to="/auth/receiver">NGO Registration</Link></li>
              <li><Link to="/">Impact Report</Link></li>
            </ul>
          </div>

          {/* Zakat Calendar Widget */}
          <div className="footer-col zakat-col">
            <h3>Zakat & Ramadan Calendar</h3>
            <div className="zakat-widget">
              <div className="zakat-header">
                <CalendarIcon size={20} />
                <span>Islamic Year {year} AH</span>
              </div>
              <div className="zakat-body">
                <div className="zakat-row">
                  <span>Current Month:</span>
                  <strong>{month}</strong>
                </div>
                <div className="zakat-row">
                  <span>Nisab Value (Gold):</span>
                  <strong>PKR 215,000</strong>
                </div>
                <div className="zakat-row">
                  <span>Zakat Percentage:</span>
                  <strong>2.5%</strong>
                </div>
                <Link to="/zakat" className="btn btn-primary btn-sm mt-3" style={{width: '100%'}}>
                  Calculate Zakat Now
                </Link>
              </div>
            </div>
          </div>

        </div>

        <div className="footer-bottom-hope">
          <p>&copy; {new Date().getFullYear()} SpareShare AI. Developed for Pakistan.</p>
          <div className="legal-links">
            <Link to="/">Privacy Policy</Link>
            <Link to="/">Terms & Conditions</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
