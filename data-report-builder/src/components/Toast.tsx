'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

type ToastProps = {
  message: string;
  onClose: () => void;
  duration?: number;
};

export function Toast({ message, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // Only render on client side
  if (typeof window === 'undefined') return null;

  return createPortal(
    <div
      className="fixed z-50 animate-slideUp"
      style={{
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
      }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          minWidth: '300px',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="flex-shrink-0"
        >
          <circle cx="10" cy="10" r="10" fill="#22c55e" />
          <path
            d="M6 10L9 13L14 7"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500 }}>
          {message}
        </span>
      </div>
    </div>,
    document.body
  );
}

