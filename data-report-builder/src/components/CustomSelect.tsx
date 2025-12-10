'use client';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

type CustomSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; schemaName?: string }[];
  disabled?: boolean;
  placeholder?: string;
  showSchemaName?: boolean;
  backgroundColor?: string; // Optional background color override
  hoverBackgroundColor?: string; // Optional hover background color override
};

export function CustomSelect({ value, onChange, options, disabled = false, placeholder, showSchemaName = false, backgroundColor, hoverBackgroundColor }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Update dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(200, rect.width),
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);
  const displayLabel = selectedOption?.label || placeholder || 'Select...';
  const displaySchemaName = selectedOption?.schemaName || '';

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={buttonRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={disabled}
        style={{
          display: 'inline-flex',
          flexDirection: showSchemaName && displaySchemaName ? 'column' : 'row',
          alignItems: showSchemaName && displaySchemaName ? 'flex-start' : 'center',
          gap: showSchemaName && displaySchemaName ? '2px' : '8px',
          paddingLeft: '12px',
          paddingRight: showSchemaName && displaySchemaName ? '36px' : '12px',
          paddingTop: '8px',
          paddingBottom: '8px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: isHovered 
            ? (hoverBackgroundColor || 'var(--bg-surface)') 
            : (backgroundColor || 'transparent'),
          color: 'var(--text-primary)',
          fontSize: '14px',
          fontWeight: 400,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s',
          opacity: disabled ? 0.5 : 1,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0, alignItems: 'flex-start' }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left', width: '100%' }}>{displayLabel}</span>
          {showSchemaName && displaySchemaName && (
            <span className="font-mono" style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left', width: '100%' }}>
              {displaySchemaName}
            </span>
          )}
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            flexShrink: 0,
            transition: 'transform 0.2s',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            position: showSchemaName && displaySchemaName ? 'absolute' : 'relative',
            right: showSchemaName && displaySchemaName ? '12px' : 'auto',
            top: showSchemaName && displaySchemaName ? '50%' : 'auto',
            marginTop: showSchemaName && displaySchemaName ? '-6px' : '0',
          }}
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown menu - rendered via portal */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            minWidth: dropdownPosition.width,
            maxHeight: '300px',
            overflowY: 'auto',
            backgroundColor: 'var(--bg-elevated)',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-popover)',
            zIndex: 9999,
            paddingTop: '4px',
            paddingBottom: '4px',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: 400,
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{option.label}</span>
                {showSchemaName && option.schemaName && (
                  <span className="font-mono" style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {option.schemaName}
                  </span>
                )}
              </div>
              {value === option.value && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                  <path d="M13 4L6 11L3 8" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

