import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, User, Mail, Lock, FileText, ArrowRight, Eye, EyeOff, Phone, ShieldCheck, KeyRound } from 'lucide-react';
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
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [orgType, setOrgType] = useState('NGO');
  const [error, setError] = useState('');
  const [taxId, setTaxId] = useState('');
  const [regAuthority, setRegAuthority] = useState('');
  const [estYear, setEstYear] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [forgotMode, setForgotMode] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [customAlert, setCustomAlert] = useState(null);

  // Security Credentials OTP Verification System States
  const [showOtpScreen, setShowOtpScreen] = useState(null); // 'verification', 'reset', or null
  const [otpCode, setOtpCode] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register, verifyEmail, forgotPassword, resetPassword, resendOtp } = useAuth();

  useEffect(() => {
    setFieldErrors({});
    setError('');
    setSuccessMsg('');
  }, [isLogin, forgotMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (showOtpScreen === 'verification') {
        const res = await verifyEmail(otpEmail, otpCode);
        if (res.success) {
          if (res.token) {
            setSuccessMsg('✅ Email verified successfully! Logging you in...');
            setTimeout(() => {
              if (res.user.role === 'donor') navigate('/contributor', { replace: true });
              else if (res.user.role === 'admin') navigate('/admin', { replace: true });
            }, 1500);
          } else {
            setCustomAlert({
              title: 'Verification Submitted',
              message: 'Your email has been verified successfully! Your receiver profile has been submitted to the admin for manual approval. You will receive an email once approved.',
              onClose: () => {
                setShowOtpScreen(null);
                setIsLogin(true);
                setOtpCode('');
                setSuccessMsg('Your receiver profile has been submitted to the admin. You will receive an email once approved.');
              }
            });
          }
        } else {
          setError(res.error);
        }
      } else if (showOtpScreen === 'reset') {
        if (newPassword !== confirmPassword) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }
        const res = await resetPassword(otpEmail, otpCode, newPassword);
        if (res.success) {
          setCustomAlert({
            title: 'Password Reset Successful',
            message: 'Your password has been reset successfully! You can now log in to your account with your new password.',
            onClose: () => {
              setShowOtpScreen(null);
              setForgotMode(false);
              setIsLogin(true);
              setOtpCode('');
              setNewPassword('');
              setConfirmPassword('');
              setSuccessMsg('Password reset successfully! You can now log in.');
            }
          });
        } else {
          setError(res.error);
        }
      } else if (forgotMode) {
        const res = await forgotPassword(email);
        if (res.success) {
          setOtpEmail(email);
          setShowOtpScreen('reset');
          setSuccessMsg('A password reset verification OTP has been sent to your email.');
        } else {
          setError(res.error);
        }
      } else if (isLogin) {
        const res = await login(email, password);
        if (res.success) {
          if (res.role === 'donor') navigate('/contributor', { replace: true });
          else if (res.role === 'receiver') navigate('/receiver', { replace: true });
          else navigate('/admin', { replace: true });
        } else {
          if (res.verificationRequired) {
            setOtpEmail(res.email || email);
            setShowOtpScreen('verification');
            setSuccessMsg('Please verify your email address first. A verification OTP has been sent to your email.');
          } else {
            setError(res.error);
          }
        }
      } else {
        const errors = {};
        
        // Name Validation
        const nameRegex = /^[a-zA-Z\s]{3,}$/;
        const finalName = name;
        if (!finalName) {
          errors.name = 'Full Name / Organization Name is required.';
        } else if (!nameRegex.test(finalName)) {
          errors.name = 'Name must contain only alphabetic characters and spaces, and be at least 3 characters long.';
        }

        // Pakistani Phone Validation
        const pkPhoneRegex = /^((\+92)|(0092)|0)?(3\d{9})$/;
        if (!phone) {
          errors.phone = 'Phone number is required.';
        } else if (!pkPhoneRegex.test(phone.replace(/[\s-]/g, ''))) {
          errors.phone = 'Please enter a valid Pakistani mobile number (e.g., 03001234567).';
        }

        // Email Domain & Format Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const validateEmailDomain = (emailVal) => {
          const parts = emailVal.split('@');
          if (parts.length !== 2) return false;
          const domain = parts[1].toLowerCase();
          const allowedPublicDomains = [
            'gmail.com', 'yahoo.com', 'ymail.com', 'hotmail.com', 'outlook.com', 'icloud.com',
            'live.com', 'yandex.com', 'protonmail.com', 'zoho.com',
            'gmx.com', 'aol.com', 'proton.me', 'mail.ru'
          ];
          return allowedPublicDomains.includes(domain);
        };
        if (!email) {
          errors.email = 'Email address is required.';
        } else if (!emailRegex.test(email) || !validateEmailDomain(email)) {
          errors.email = 'Please provide a valid email address using a real provider (e.g., Gmail, Yahoo) or verified organization domain.';
        }

        // Password Validation
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!password) {
          errors.password = 'Password is required.';
        } else if (!passwordRegex.test(password)) {
          errors.password = 'Password must be at least 8 characters long, and include at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&).';
        }

        // Receiver/NGO Specific Validation
        if (type === 'receiver') {
          if (!taxId || taxId.trim().length < 5) {
            errors.taxId = 'NGO Registration/License Number is required (min 5 characters).';
          }
          if (!regAuthority || regAuthority.trim().length < 3) {
            errors.regAuthority = 'Registration Authority is required (e.g. PCP, SECP).';
          }
          const currentYear = new Date().getFullYear();
          const yearNum = parseInt(estYear, 10);
          if (!estYear || !/^\d{4}$/.test(estYear) || yearNum < 1800 || yearNum > currentYear) {
            errors.estYear = `Valid 4-digit Establishment Year between 1800 and ${currentYear} is required.`;
          }
        }

        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
          setLoading(false);
          return;
        }

        setFieldErrors({});

        const userData = {
          email,
          password,
          phone: phone,
          role: type,
          name: finalName,
          taxId: type === 'receiver' ? taxId : undefined,
          orgType: type === 'receiver' ? orgType : undefined,
          regAuthority: type === 'receiver' ? regAuthority : undefined,
          estYear: type === 'receiver' ? estYear : undefined
        };

        const res = await register(userData);
        if (res.success) {
          setOtpEmail(email);
          setShowOtpScreen('verification');
          setSuccessMsg('Registration submitted! A verification OTP has been sent to your email.');
        } else {
          setError(res.error);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setSuccessMsg('');
    try {
      const type = showOtpScreen === 'verification' ? 'verification' : 'reset';
      const res = await resendOtp(otpEmail, type);
      if (res.success) {
        setSuccessMsg('✉️ A new verification OTP code has been sent to your email.');
      } else {
        setError(res.error);
      }
    } catch {
      setError('Failed to resend OTP.');
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
            {showOtpScreen === 'verification'
              ? 'Security Verification'
              : (showOtpScreen === 'reset'
                ? 'Reset Password'
                : (forgotMode ? 'Forgot Password' : (isLogin ? 'Welcome Back' : 'Join SpareShare AI')))}
          </h2>
          <p>
            {showOtpScreen === 'verification'
              ? `We sent a 6-digit verification code to ${otpEmail}. Please enter it below.`
              : (showOtpScreen === 'reset'
                ? 'Please enter the password reset OTP and choose a new password.'
                : (forgotMode
                  ? 'Enter your email to receive a password reset OTP code.'
                  : (type === 'donor'
                    ? 'Empower communities in Pakistan by sharing surplus.'
                    : 'Register your organization / receiver account.')))}
          </p>
        </div>

        {!forgotMode && !showOtpScreen && (
          <div className="auth-tabs">
            <button type="button" className={`tab ${isLogin ? 'active' : ''}`} onClick={() => setIsLogin(true)}>Login</button>
            <button type="button" className={`tab ${!isLogin ? 'active' : ''}`} onClick={() => setIsLogin(false)}>
              {type === 'receiver' ? 'Apply as Receiver' : 'Sign Up'}
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.form
            key={showOtpScreen ? 'otp' : (forgotMode ? 'forgot' : (isLogin ? 'login' : 'signup'))}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onSubmit={handleSubmit}
            className="auth-form"
          >
            {error && <div className="error-box">{error}</div>}
            {successMsg && <div className="success-box">{successMsg}</div>}

            {/* OTP Verification Screen Form Fields */}
            {showOtpScreen && (
              <>
                <div className="form-group animate-fade-in">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ShieldCheck size={16} color="#10b981" /> 
                    {showOtpScreen === 'reset' ? '6-Digit Password Reset OTP' : '6-Digit Verification OTP Code'}
                  </label>
                  <div className="input-icon-wrapper">
                    <KeyRound className="input-icon" size={18} />
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-Digit OTP"
                      required
                      maxLength={6}
                      className="input-field with-icon"
                      style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '1.25rem', fontWeight: 'bold' }}
                    />
                  </div>
                </div>

                {showOtpScreen === 'reset' && (
                  <>
                    <div className="form-group animate-fade-in">
                      <label>New Password</label>
                      <div className="input-icon-wrapper">
                        <Lock className="input-icon" size={18} />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Choose a strong password"
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

                    <div className="form-group animate-fade-in">
                      <label>Confirm New Password</label>
                      <div className="input-icon-wrapper">
                        <Lock className="input-icon" size={18} />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm your password"
                          required
                          className="input-field with-icon"
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Standard Signup Fields */}
            {!showOtpScreen && !isLogin && !forgotMode && (
              <div className="form-group">
                <label>{type === 'donor' ? 'Full Name *' : 'Organization Name *'}</label>
                <div className="input-icon-wrapper">
                  {type === 'donor' ? <User className="input-icon" size={18} /> : <Building2 className="input-icon" size={18} />}
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={type === 'donor' ? 'Ali Khan' : 'Edhi Foundation'}
                    required
                    className="input-field with-icon"
                  />
                </div>
                {fieldErrors.name && <span className="field-error" style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>{fieldErrors.name}</span>}
              </div>
            )}

            {!showOtpScreen && !isLogin && type === 'receiver' && !forgotMode && (
              <>
                <div className="form-group">
                  <label>Organization Type *</label>
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
                  <label>NGO Registration / License Number *</label>
                  <div className="input-icon-wrapper">
                    <FileText className="input-icon" size={18} />
                    <input
                      type="text"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      placeholder="e.g. NGO-12345-KAR"
                      required
                      className="input-field with-icon"
                    />
                  </div>
                  {fieldErrors.taxId && <span className="field-error" style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>{fieldErrors.taxId}</span>}
                </div>
                <div className="form-group">
                  <label>Registration Authority *</label>
                  <div className="input-icon-wrapper">
                    <Building2 className="input-icon" size={18} />
                    <input
                      type="text"
                      value={regAuthority}
                      onChange={(e) => setRegAuthority(e.target.value)}
                      placeholder="e.g. Social Welfare Dept, SECP, PCP"
                      required
                      className="input-field with-icon"
                    />
                  </div>
                  {fieldErrors.regAuthority && <span className="field-error" style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>{fieldErrors.regAuthority}</span>}
                </div>
                <div className="form-group">
                  <label>Establishment Year *</label>
                  <div className="input-icon-wrapper">
                    <FileText className="input-icon" size={18} />
                    <input
                      type="text"
                      value={estYear}
                      onChange={(e) => setEstYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="e.g. 2015"
                      required
                      maxLength={4}
                      className="input-field with-icon"
                    />
                  </div>
                  {fieldErrors.estYear && <span className="field-error" style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>{fieldErrors.estYear}</span>}
                </div>
              </>
            )}

            {!showOtpScreen && !isLogin && !forgotMode && (
              <div className="form-group">
                <label>Phone Number *</label>
                <div className="input-icon-wrapper">
                  <Phone className="input-icon" size={18} />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+92 300 0000000"
                    required
                    className="input-field with-icon"
                  />
                </div>
                {fieldErrors.phone && <span className="field-error" style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>{fieldErrors.phone}</span>}
              </div>
            )}

            {/* Standard Email field */}
            {!showOtpScreen && (
              <div className="form-group">
                <label>Email Address *</label>
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
                 {!isLogin && fieldErrors.email && <span className="field-error" style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>{fieldErrors.email}</span>}
              </div>
            )}

            {/* Standard Password field */}
            {!showOtpScreen && !forgotMode && (
              <div className="form-group">
                <label>Password *</label>
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
                 {!isLogin && fieldErrors.password && <span className="field-error" style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>{fieldErrors.password}</span>}
              </div>
            )}

            {isLogin && !forgotMode && !showOtpScreen && (
              <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
                <button type="button" className="text-btn" onClick={() => { setForgotMode(true); setError(''); setSuccessMsg(''); }}>
                  Forgot Password?
                </button>
              </div>
            )}

            {!isLogin && type === 'receiver' && !forgotMode && !showOtpScreen && (
              <div className="info-box">
                <p><strong>Note:</strong> Organization accounts require manual verification by our Pakistan admins before full access is granted.</p>
              </div>
            )}

            {/* Main Action Submit Button */}
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading
                ? 'Processing...'
                : (showOtpScreen === 'verification'
                  ? 'Verify Email Address'
                  : (showOtpScreen === 'reset'
                    ? 'Reset Password'
                    : (forgotMode
                      ? 'Send Password Reset OTP'
                      : (isLogin ? 'Login' : (type === 'receiver' ? 'Submit Registration' : 'Create Account')))))}
            </button>

            {/* OTP actions */}
            {showOtpScreen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1.2rem' }}>
                <button type="button" className="btn btn-outline" style={{ width: '100%', padding: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={handleResendOtp}>
                  Resend OTP Code
                </button>
                <button type="button" className="text-btn" style={{ textAlign: 'center', marginTop: '0.5rem', width: '100%' }} onClick={() => { setShowOtpScreen(null); setError(''); setSuccessMsg(''); setOtpCode(''); setNewPassword(''); setConfirmPassword(''); }}>
                  Cancel & Go Back
                </button>
              </div>
            )}

            {/* Forgot mode back button */}
            {forgotMode && !showOtpScreen && (
              <button type="button" className="btn btn-outline" style={{ width: '100%', marginTop: '0.5rem', padding: '0.8rem' }} onClick={() => { setForgotMode(false); setError(''); setSuccessMsg(''); setNewPassword(''); setConfirmPassword(''); }}>
                Back to Login
              </button>
            )}
          </motion.form>
        </AnimatePresence>

        {!forgotMode && !showOtpScreen && (
          <div className="auth-footer">
            <Link to={`/auth/${type === 'donor' ? 'receiver' : 'donor'}`}>
              Are you a {type === 'donor' ? 'Receiver / Organization' : 'Donor'} instead? <ArrowRight size={16} style={{ verticalAlign: 'middle', marginLeft: '4px' }} />
            </Link>
          </div>
        )}
      </div>

      {customAlert && (
        <div className="custom-modal-overlay animate-fade-in" style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="custom-modal-card glass-panel animate-scale-up" style={{
            maxWidth: '450px', width: '90%', padding: '2rem', borderRadius: '24px',
            border: '1px solid rgba(16, 185, 129, 0.25)', background: 'var(--bg-surface)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(16, 185, 129, 0.1)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.12)', border: '2px solid var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem', color: 'var(--primary)'
            }}>
              <ShieldCheck size={32} />
            </div>
            <h3 style={{
              fontSize: '1.4rem', fontWeight: 800, color: 'white',
              marginBottom: '1rem', fontFamily: 'var(--font-heading)'
            }}>
              {customAlert.title}
            </h3>
            <p style={{
              fontSize: '0.95rem', color: 'var(--text-muted)',
              lineHeight: 1.6, marginBottom: '2rem'
            }}>
              {customAlert.message}
            </p>
            <button
              onClick={() => {
                const closeFn = customAlert.onClose;
                setCustomAlert(null);
                if (closeFn) closeFn();
              }}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem', borderRadius: '99px' }}
            >
              Okay, Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Auth;
