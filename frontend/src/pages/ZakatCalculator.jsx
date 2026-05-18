import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useLang } from '../context/AuthContext';
import { Calculator, ArrowRight, Info, RefreshCw } from 'lucide-react';
import './ZakatCalculator.css';

const t = (lang, enText, urText) => lang === 'Eng' ? enText : urText;


const ZakatCalculator = ({ onDonate }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang } = useLang();

  const [gold, setGold] = useState('');
  const [silver, setSilver] = useState('');
  const [cash, setCash] = useState('');
  const [deposited, setDeposited] = useState('');
  const [loansGiven, setLoansGiven] = useState('');
  const [investments, setInvestments] = useState('');
  const [stock, setStock] = useState('');

  const [borrowed, setBorrowed] = useState('');
  const [taxes, setTaxes] = useState('');
  const [wages, setWages] = useState('');

  const nisab = 12770; // Reference Nisab value

  const calculateTotalAssets = () => {
    return (Number(gold) || 0) + (Number(silver) || 0) +
      (Number(cash) || 0) + (Number(deposited) || 0) +
      (Number(loansGiven) || 0) + (Number(investments) || 0) + (Number(stock) || 0);
  };

  const calculateLiabilities = () => {
    return (Number(borrowed) || 0) + (Number(taxes) || 0) + (Number(wages) || 0);
  };

  const calculateZakat = () => {
    const totalAssets = calculateTotalAssets();
    const netAssets = totalAssets - calculateLiabilities();

    if (netAssets >= nisab) {
      return (netAssets * 0.025).toFixed(2);
    }
    return 0;
  };

  const resetFields = () => {
    setGold(''); setSilver(''); setCash(''); setDeposited(''); setLoansGiven('');
    setInvestments(''); setStock(''); setBorrowed(''); setTaxes(''); setWages('');
  };

  const totalZakat = calculateZakat();

  return (
    <div className="zakat-page-wrapper">
      <div className="zakat-hero">
        <div className="container">
          <h1>{t(lang, 'Zakat Calculator', 'زکوٰۃ کیلکولیٹر')}</h1>
          <p>{t(lang, 'Calculate your Zakat accurately according to Islamic principles and donate to verified Pakistani organizations.', 'اسلامی اصولوں کے مطابق اپنی زکوٰۃ کا درست حساب لگائیں اور تصدیق شدہ پاکستانی تنظیموں کو عطیہ کریں۔')}</p>
        </div>
      </div>

      <div className="container zakat-container">
        <div className="zakat-content-grid">

          <div className="zakat-form-panel glass-panel">
            <div className="form-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calculator size={24} className="text-primary" />
                <h2>{t(lang, 'Enter Your Wealth Details', 'اپنی دولت کی تفصیلات درج کریں')}</h2>
              </div>
              <button onClick={resetFields} className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <RefreshCw size={14} /> {t(lang, 'Reset', 'ری سیٹ')}
              </button>
            </div>

            <div className="input-group">
              <label>{t(lang, 'Value of Gold (PKR)', 'سونے کی مالیت')}</label>
              <input type="number" placeholder="Current value of gold owned" value={gold} onChange={e => setGold(e.target.value)} />
            </div>

            <div className="input-group">
              <label>{t(lang, 'Value of Silver (PKR)', 'چاندی کی مالیت')}</label>
              <input type="number" placeholder="Current value of silver owned" value={silver} onChange={e => setSilver(e.target.value)} />
            </div>

            <div className="input-group">
              <label>{t(lang, 'Cash in Hand & Bank Accounts (PKR)', 'نقد اور بینک بیلنس')}</label>
              <input type="number" placeholder="e.g. 50000" value={cash} onChange={e => setCash(e.target.value)} />
            </div>

            <div className="input-group">
              <label>{t(lang, 'Deposited for future purpose (PKR)', 'مستقبل کے لئے جمع شدہ')}</label>
              <input type="number" placeholder="e.g. Hajj/Umrah funds" value={deposited} onChange={e => setDeposited(e.target.value)} />
            </div>

            <div className="input-group">
              <label>{t(lang, 'Given out in loans (PKR)', 'قرض دیئے گئے')}</label>
              <input type="number" placeholder="Loans to be received back" value={loansGiven} onChange={e => setLoansGiven(e.target.value)} />
            </div>

            <div className="input-group">
              <label>{t(lang, 'Business investments / shares (PKR)', 'کاروباری سرمایہ کاری')}</label>
              <input type="number" placeholder="e.g. 100000" value={investments} onChange={e => setInvestments(e.target.value)} />
            </div>

            <div className="input-group">
              <label>{t(lang, 'Value of stock (PKR)', 'اسٹاک کی مالیت')}</label>
              <input type="number" placeholder="Current value of stock" value={stock} onChange={e => setStock(e.target.value)} />
            </div>

            <div className="input-group liabilities-group">
              <label>{t(lang, 'Borrowed money / Goods on credit (PKR)', 'ادھار رقم')} <span className="text-danger">-</span></label>
              <input type="number" placeholder="Amount you owe" value={borrowed} onChange={e => setBorrowed(e.target.value)} />
            </div>

            <div className="input-group liabilities-group">
              <label>{t(lang, 'Taxes, rent, utility bills due (PKR)', 'ٹیکس، کرایہ، بل')} <span className="text-danger">-</span></label>
              <input type="number" placeholder="Currently due bills" value={taxes} onChange={e => setTaxes(e.target.value)} />
            </div>

            <div className="input-group liabilities-group">
              <label>{t(lang, 'Wages due to employees (PKR)', 'واجب الادا اجرت')} <span className="text-danger">-</span></label>
              <input type="number" placeholder="Unpaid wages" value={wages} onChange={e => setWages(e.target.value)} />
            </div>
          </div>

          <div className="zakat-results-panel">
            <div className="result-card glass-panel">
              <h3>{t(lang, 'Your Zakat Summary', 'زکوٰۃ کا خلاصہ')}</h3>

              <div className="summary-row">
                <span>{t(lang, 'Total Assets:', 'کل اثاثے:')}</span>
                <strong>PKR {calculateTotalAssets().toLocaleString()}</strong>
              </div>
              <div className="summary-row">
                <span>{t(lang, 'Total Liabilities:', 'قرضے:')}</span>
                <strong className="text-danger">- PKR {calculateLiabilities().toLocaleString()}</strong>
              </div>
              <div className="summary-row net-row">
                <span>{t(lang, 'Net Zakatable Assets:', 'خالص اثاثے:')}</span>
                <strong>PKR {(calculateTotalAssets() - calculateLiabilities()).toLocaleString()}</strong>
              </div>

              <div className="zakat-total-box">
                <span>{t(lang, 'Total Zakat Payable (2.5%)', 'زکوٰۃ کی کل رقم (2.5%)')}</span>
                <h2>PKR {Number(totalZakat).toLocaleString()}</h2>
              </div>

              {Number(totalZakat) === 0 && calculateTotalAssets() > 0 && (
                <div className="nisab-warning">
                  <Info size={16} /> Your net assets are below the current Nisab threshold. Zakat is not obligatory.
                </div>
              )}

              <button
                className="btn btn-primary btn-large donate-zakat-btn"
                disabled={Number(totalZakat) === 0}
                onClick={() => {
                  if (onDonate) onDonate();
                  else navigate(user ? '/contributor' : '/auth/donor');
                }}
              >
                {t(lang, 'Donate Zakat Items Now', 'زکوٰۃ ابھی عطیہ کریں')} <ArrowRight size={18} />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ZakatCalculator;
