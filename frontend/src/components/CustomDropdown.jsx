import React, { useState, useRef, useEffect } from 'react';

/**
 * Premium Custom Dropdown Component
 * Designed to replace standard HTML <select> boxes with glassmorphism + custom animations.
 * 
 * Props:
 * - options: Array of { value: any, label: string }
 * - value: Current selected value
 * - onChange: Callback function when value changes
 * - placeholder: Default text when no option is selected
 * - className: Custom outer container classes
 * - required: boolean
 */
export default function CustomDropdown({
  options = [],
  value,
  onChange,
  placeholder = 'Select option',
  className = '',
  required = false,
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  const handleSelect = (val) => {
    if (onChange) {
      onChange(val);
    }
    setIsOpen(false);
  };

  return (
    <div
      ref={dropdownRef}
      className={`custom-dropdown-container ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        zIndex: isOpen ? 9999 : 10,
        boxSizing: 'border-box'
      }}
    >
      {/* Hidden input for HTML form validation if required is true */}
      {required && (
        <input
          type="text"
          value={value || ''}
          onChange={() => {}}
          required
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            opacity: 0,
            pointerEvents: 'none',
            zIndex: -1
          }}
        />
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="custom-dropdown-trigger"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'between',
          padding: '11px 16px',
          background: 'rgba(10, 15, 26, 0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: isOpen ? '1.5px solid #10b981' : '1.5px solid rgba(16, 185, 129, 0.35)',
          borderRadius: '12px',
          color: '#f1f5f9',
          fontFamily: "var(--font-body), 'Inter', sans-serif",
          fontSize: '0.92rem',
          fontWeight: '500',
          outline: 'none',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isOpen 
            ? '0 0 22px rgba(16, 185, 129, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.1)'
            : '0 4px 15px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.05)',
          textAlign: 'left',
          ...style
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.75)';
            e.currentTarget.style.boxShadow = '0 0 18px rgba(16, 185, 129, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.backgroundColor = 'rgba(10, 15, 26, 0.85)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.35)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.backgroundColor = 'rgba(10, 15, 26, 0.75)';
          }
        }}
      >
        <span style={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#10b981"
          strokeWidth="2.5"
          style={{
            marginLeft: '8px',
            flexShrink: 0,
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <ul
          className="custom-dropdown-options scrollbar-thin"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '8px',
            maxHeight: '260px',
            overflowY: 'auto',
            background: '#0c1222',
            border: '1.5px solid rgba(16, 185, 129, 0.45)',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(16, 185, 129, 0.1)',
            listStyle: 'none',
            padding: '6px 0',
            margin: 0,
            animation: 'fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards'
          }}
        >
          {options.length === 0 ? (
            <li
              style={{
                padding: '10px 16px',
                color: 'var(--text-dim)',
                fontSize: '0.9rem',
                fontStyle: 'italic'
              }}
            >
              No options available
            </li>
          ) : (
            options.map((option) => {
              const isSelected = String(option.value) === String(value);
              return (
                <li
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  style={{
                    padding: '10px 16px',
                    color: isSelected ? '#10b981' : '#f1f5f9',
                    background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                    fontFamily: "var(--font-body), 'Inter', sans-serif",
                    fontSize: '0.92rem',
                    fontWeight: isSelected ? '600' : '400',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderLeft: isSelected ? '3px solid #10b981' : '3px solid transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)';
                      e.currentTarget.style.color = '#10b981';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#f1f5f9';
                    }
                  }}
                >
                  {option.label}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
