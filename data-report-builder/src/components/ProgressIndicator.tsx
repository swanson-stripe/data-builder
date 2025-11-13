'use client';
import { useEffect, useState } from 'react';

type ProgressIndicatorProps = {
  isLoading: boolean;
  message?: string;
};

export function ProgressIndicator({ isLoading, message = 'Loading...' }: ProgressIndicatorProps) {
  const [progress, setProgress] = useState(0);
  const [showComplete, setShowComplete] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setShowComplete(false);
      setProgress(0);
      
      // Simulate progress (0-90% while loading)
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return 90;
          return prev + Math.random() * 15;
        });
      }, 200);

      return () => clearInterval(interval);
    } else if (progress > 0) {
      // Complete the progress bar quickly
      setProgress(100);
      setShowComplete(true);
      
      // Hide after showing complete state
      const timeout = setTimeout(() => {
        setProgress(0);
        setShowComplete(false);
      }, 800);
      
      return () => clearTimeout(timeout);
    }
  }, [isLoading, progress]);

  if (progress === 0 && !isLoading) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '12px',
        right: '12px',
        zIndex: 1000,
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: '8px',
        padding: '8px 12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        minWidth: '200px',
        transition: 'opacity 0.3s ease-in-out',
        opacity: progress > 0 ? 1 : 0,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        {showComplete ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6.5" stroke="#10b981" strokeWidth="1" fill="none" />
            <path d="M4 7l2 2 4-4" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{
              animation: 'spin 1s linear infinite',
            }}
          >
            <circle
              cx="7"
              cy="7"
              r="5"
              stroke="var(--border-medium)"
              strokeWidth="2"
              fill="none"
              opacity="0.25"
            />
            <path
              d="M7 2a5 5 0 0 1 5 5"
              stroke="#675DFF"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        )}
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
          {showComplete ? 'Complete' : message}
        </span>
      </div>
      
      {/* Progress bar */}
      <div
        style={{
          width: '100%',
          height: '3px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            backgroundColor: showComplete ? '#10b981' : '#675DFF',
            borderRadius: '2px',
            transition: 'width 0.3s ease-out, background-color 0.3s ease-out',
          }}
        />
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

