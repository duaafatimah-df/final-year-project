import React, { useState, useEffect } from 'react';
import { useLang } from '../context/AuthContext';

/**
 * Premium AI-Powered Dynamic Translation Wrapper
 * Automatically translates nested text on the fly using the Python ML Translator when Urdu is selected.
 */
export default function AiTranslatedText({ children, className = '', style = {} }) {
  const { lang, translateText } = useLang();
  const [translated, setTranslated] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!children || typeof children !== 'string') {
      setTranslated(children || '');
      return;
    }

    const trimmed = children.trim();
    if (!trimmed) {
      setTranslated('');
      return;
    }

    if (lang === 'Eng') {
      setTranslated(children);
      return;
    }

    setLoading(true);
    translateText(trimmed, 'ur')
      .then(res => {
        if (res) {
          setTranslated(res);
        } else {
          setTranslated(children);
        }
      })
      .catch(() => {
        setTranslated(children);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [children, lang, translateText]);

  return (
    <span 
      className={className} 
      style={{ 
        ...style, 
        opacity: loading ? 0.7 : 1, 
        transition: 'opacity 0.25s ease-in-out' 
      }}
    >
      {translated || children}
    </span>
  );
}
