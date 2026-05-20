import { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : 'https://spareshare-ai.up.railway.app';

const AuthContext = createContext();
export const LangContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLangState] = useState(() => localStorage.getItem('spareshare_lang') || 'Eng');
  const navigate = useNavigate();

  const setLang = (newLang) => {
    setLangState(newLang);
    localStorage.setItem('spareshare_lang', newLang);
    // Apply RTL direction to entire page when switching to Urdu (like Saylani)
    document.documentElement.setAttribute('dir', newLang === 'Eng' ? 'ltr' : 'rtl');
    document.documentElement.setAttribute('lang', newLang === 'Eng' ? 'en' : 'ur');
  };

  useEffect(() => {
    // Restore language direction on mount
    document.documentElement.setAttribute('dir', lang === 'Eng' ? 'ltr' : 'rtl');
    document.documentElement.setAttribute('lang', lang === 'Eng' ? 'en' : 'ur');
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      axios.defaults.headers.common['x-auth-token'] = token;
    }
    setLoading(false);

    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401 && error.response.data?.error === 'Token is not valid') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          delete axios.defaults.headers.common['x-auth-token'];
          setUser(null);
          navigate('/');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [navigate]);

  const login = async (email, password) => {
    try {
      const res = await axios.post(`${API}/api/auth/login`, { email, password });
      const { token, user: userData } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      axios.defaults.headers.common['x-auth-token'] = token;
      setUser(userData);
      return { success: true, role: userData.role };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Login failed' };
    }
  };

  const register = async (userData) => {
    try {
      const res = await axios.post(`${API}/api/auth/register`, userData);
      const { token, user: newUser } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(newUser));
      axios.defaults.headers.common['x-auth-token'] = token;
      setUser(newUser);
      return { success: true, role: newUser.role };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Registration failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['x-auth-token'];
    setUser(null);
    navigate('/');
  };

  const [cache, setCache] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('spareshare_translations_cache') || '{}');
    } catch {
      return {};
    }
  });

  const translateText = async (text, targetLang = 'ur') => {
    if (!text) return '';
    const cacheKey = `${text}_${targetLang}`;
    if (cache[cacheKey]) return cache[cacheKey];

    try {
      const res = await axios.post(`${API}/api/ai/translate`, { text, targetLang });
      const translated = res.data.translatedText;
      if (translated) {
        setCache(prev => {
          const next = { ...prev, [cacheKey]: translated };
          localStorage.setItem('spareshare_translations_cache', JSON.stringify(next));
          return next;
        });
        return translated;
      }
    } catch (err) {
      console.error('Translation failed', err);
    }
    return '';
  };

  const t = (first, second, third) => {
    let enText, urText;
    if (third !== undefined) {
      // Signatures like t(lang, enText, urText)
      enText = second;
      urText = third;
    } else {
      // Signatures like t(enText, urText)
      enText = first;
      urText = second;
    }

    if (lang === 'Eng') return enText;
    if (!enText) return '';
    const cacheKey = `${enText}_ur`;
    if (cache[cacheKey]) {
      return cache[cacheKey];
    }
    const activeFetches = window._activeTranslationFetches = window._activeTranslationFetches || new Set();
    if (!activeFetches.has(cacheKey)) {
      activeFetches.add(cacheKey);
      axios.post(`${API}/api/ai/translate`, { text: enText, targetLang: 'ur' })
        .then(res => {
          const translated = res.data.translatedText;
          if (translated) {
            setCache(prev => {
              const next = { ...prev, [cacheKey]: translated };
              localStorage.setItem('spareshare_translations_cache', JSON.stringify(next));
              return next;
            });
          }
        })
        .catch(err => {
          console.error('Background translation failed for:', enText, err);
        })
        .finally(() => {
          activeFetches.delete(cacheKey);
        });
    }
    return urText || enText;
  };

  if (loading) return <div>Loading...</div>;

  return (
    <LangContext.Provider value={{ lang, setLang, t, translateText }}>
      <AuthContext.Provider value={{ user, login, register, logout }}>
        {children}
      </AuthContext.Provider>
    </LangContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export const useLang = () => useContext(LangContext);

