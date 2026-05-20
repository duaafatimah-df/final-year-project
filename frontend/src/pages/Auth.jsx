import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, User, Mail, Lock, FileText, ArrowRight, Eye, EyeOff, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomDropdown from '../components/CustomDropdown';
import './Auth.css';

const Auth = () => {
  const { type } = useParams(); // 'donor' or 'receiver'
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [orgType, setOrgType] = useState('NGO');
  const [error, setError] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (forgotMode) {
      alert('Password reset link sent to ' + email);
      setForgotMode(false);
      return;
    }

    if (isLogin) {
      const res = await login(email, password);
      if (res.success) {
        if (res.role === 'donor') navigate('/contributor', { replace: true });
        else if (res.role === 'receiver') navigate('/receiver', { replace: true });
        else navigate('/admin', { replace: true });
      } else {
        setError(res.error);
      }
    } else {
      const userData = {
        email,
        password,
        phone: phone || '+92 000 0000000',
        role: type,
        name: name || (type === 'donor' ? 'New Donor' : 'New NGO'),
        taxId: type === 'receiver' ? '123456' : undefined,
        orgType: type === 'receiver' ? orgType : undefined
      };

      const res = await register(userData);
      if (res.success) {
        if (type === 'receiver') {
          alert('Registration request sent! We will review your organization documents and approve your account shortly.');
          navigate('/receiver', { replace: true });
        } else {
          navigate('/contributor', { replace: true });
        }
      } else {
        setError(res.error);
      }
    }
  };

  return (
    <div className="auth-container animate-fade-in">
      <div className="auth-card glass-panel">
        <div className="auth-header">
          <div className="auth-brand">
            <img src="/logo.png" alt="SpareShare" />
            <span className="auth-brand-name">SpareShare AI</span>
          </div>
          <h2>
            {forgotMode ? 'Reset Password' : (isLogin ? 'Welcome Back' : 'Join SpareShare AI')}
          </h2>
          <p>
            {forgotMode 
              ? 'Enter your email to receive a reset link.'
              : (type === 'donor' 
                ? 'Empower communities in Pakistan by sharing surplus.' 
                : 'Register your organization / receiver account.')}
          </p>
        </div>

        {!forgotMode && (
          <div className="auth-tabs">
            <button type="button" className={`tab ${isLogin ? 'active' : ''}`} onClick={() => setIsLogin(true)}>Login</button>
            <button type="button" className={`tab ${!isLogin ? 'active' : ''}`} onClick={() => setIsLogin(false)}>
              {type === 'receiver' ? 'Apply as Receiver' : 'Sign Up'}
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.form 
            key={forgotMode ? 'forgot' : (isLogin ? 'login' : 'signup')}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onSubmit={handleSubmit}
            className="auth-form"
          >
            {error && <div className="error-box">{error}</div>}
            {successMsg && <div className="success-box">{successMsg}</div>}

            {!isLogin && !forgotMode && (
              <div className="form-group">
                <label>{type === 'donor' ? 'Full Name' : 'Organization Name'}</label>
                <div className="input-icon-wrapper">
                  {type === 'donor' ? <User className="input-icon" size={18} /> : <Building2 className="input-icon" size={18} />}
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={type === 'donor' ? 'Ali Khan' : 'Edhi Foundation'} 
                    className="input-field with-icon" 
                  />
                </div>
              </div>
            )}

            {!isLogin && type === 'receiver' && !forgotMode && (
              <>
                <div className="form-group">
                  <label>Organization Type</label>
                  <div className="input-icon-wrapper">
                    <Building2 className="input-icon" size={18} />
                    <CustomDropdown
                      value={orgType}
                      onChange={setOrgType}
                      options={[
                        { value: 'NGO', label: 'Registered NGO' },
                        { value: 'Foundation', label: 'Foundation' },
                        { value: 'Community Group', label: 'Community Group' },
                        { value: 'Instagram Page', label: 'Instagram / Social Page' }
                      ]}
                      style={{ paddingLeft: '40px' }}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Registration / Tax ID (Optional)</label>
                  <div className="input-icon-wrapper">
                    <FileText className="input-icon" size={18} />
                    <input type="text" placeholder="Registration # if applicable" className="input-field with-icon" />
                  </div>
                </div>
              </>
            )}

            {!isLogin && !forgotMode && (
              <div className="form-group">
                <label>Phone Number</label>
                <div className="input-icon-wrapper">
                  <Phone className="input-icon" size={18} />
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+92 300 0000000" 
                    className="input-field with-icon" 
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Email Address</label>
              <div className="input-icon-wrapper">
                <Mail className="input-icon" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com" 
                  required 
                  className="input-field with-icon" 
                />
              </div>
            </div>

            {!forgotMode && (
              <div className="form-group">
                <label>Password</label>
                <div className="input-icon-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" 
                    required 
                    className="input-field with-icon has-toggle" 
                  />
                  <button 
                    type="button" 
                    className="toggle-password" 
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {isLogin && !forgotMode && (
              <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
                <button type="button" className="text-btn" onClick={() => setForgotMode(true)}>
                  Forgot Password?
                </button>
              </div>
            )}

            {!isLogin && type === 'receiver' && !forgotMode && (
              <div className="info-box">
                <p><strong>Note:</strong> Organization accounts require manual verification by our Pakistan admins before full access is granted.</p>
              </div>
            )}

            <button type="submit" className="auth-submit-btn">
              {forgotMode 
                ? 'Send Reset Link' 
                : (isLogin ? 'Login' : (type === 'receiver' ? 'Submit Registration' : 'Create Account'))}
            </button>
            
            {forgotMode && (
              <button type="button" className="btn btn-outline" style={{width: '100%', marginTop: '0.5rem', padding: '0.8rem'}} onClick={() => setForgotMode(false)}>
                Back to Login
              </button>
            )}
          </motion.form>
        </AnimatePresence>

        {!forgotMode && (
          <div className="auth-footer">
            <Link to={`/auth/${type === 'donor' ? 'receiver' : 'donor'}`}>
              Are you a {type === 'donor' ? 'Receiver / Organization' : 'Donor'} instead? <ArrowRight size={16} style={{verticalAlign: 'middle'}}/>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
