'use client';
import { useEffect, useState } from 'react';

type ToastProps = {
  message: string;
  duration?: number;
  onClose: () => void;
};

export function Toast({ message, duration = 2000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade-out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'var(--bg-elevated)',
        color: 'var(--text-primary)',
        padding: '12px 20px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        fontSize: '14px',
        fontWeight: 500,
        zIndex: 9999,
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 300ms ease-in-out',
        pointerEvents: 'none',
      }}
    >
      {message}
    </div>
  );
}
