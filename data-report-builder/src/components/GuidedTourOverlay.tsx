'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

export type TourStep = {
  id: string;
  title: string;
  description: string;
};

type Props = {
  isOpen: boolean;
  stepIndex: number;
  steps: TourStep[];
  getHighlightRect: (step: TourStep) => DOMRect | null;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function GuidedTourOverlay({
  isOpen,
  stepIndex,
  steps,
  getHighlightRect,
  onClose,
  onBack,
  onNext,
}: Props) {
  const step = steps[stepIndex];
  const [rect, setRect] = useState<DOMRect | null>(null);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  useEffect(() => {
    if (!isOpen) return;

    let raf = 0;
    const update = () => {
      setRect(getHighlightRect(step));
      raf = window.requestAnimationFrame(update);
    };
    raf = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(raf);
  }, [getHighlightRect, isOpen, step]);

  // Tooltip positioning
  const tooltip = useMemo(() => {
    const w = 320;
    const pad = 16;
    const gap = 12;
    const r = rect;
    if (!r) {
      return { top: pad, left: pad, width: w };
    }

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const canRight = r.right + gap + w <= viewportW - pad;
    const canLeft = r.left - gap - w >= pad;

    let left = pad;
    let top = pad;

    if (canRight) {
      left = r.right + gap;
      top = clamp(r.top, pad, viewportH - pad - 160);
    } else if (canLeft) {
      left = r.left - gap - w;
      top = clamp(r.top, pad, viewportH - pad - 160);
    } else {
      left = clamp(r.left, pad, viewportW - pad - w);
      top = clamp(r.bottom + gap, pad, viewportH - pad - 160);
    }

    return { top, left, width: w };
  }, [rect]);

  const spotlight = useMemo(() => {
    if (!rect) return null;
    const pad = 6;
    return {
      top: Math.max(8, rect.top - pad),
      left: Math.max(8, rect.left - pad),
      width: Math.max(0, rect.width + pad * 2),
      height: Math.max(0, rect.height + pad * 2),
    };
  }, [rect]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
      }}
      onMouseDown={(e) => {
        // Clicking the dimmed overlay closes the tour
        e.stopPropagation();
        onClose();
      }}
    >
      {/* Spotlight cutout */}
      {spotlight && (
        <div
          style={{
            position: 'fixed',
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            borderRadius: '14px',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
            border: '2px solid var(--color-purple-500)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        style={{
          position: 'fixed',
          top: tooltip.top,
          left: tooltip.left,
          width: tooltip.width,
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-popover)',
          overflow: 'hidden',
          transform: 'translateY(0px)',
          opacity: 1,
          transition: 'opacity 200ms ease, transform 200ms ease',
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        <div style={{ padding: '14px 14px 12px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {step.title}
          </div>
          <button
            type="button"
            aria-label="Close tour"
            onClick={onClose}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div style={{ padding: '12px 14px 14px 14px' }}>
          <div style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '14px' }}>
            {step.description}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onBack}
              disabled={isFirst}
              style={{
                flex: 1,
                height: '36px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isFirst ? 'not-allowed' : 'pointer',
                opacity: isFirst ? 0.5 : 1,
                transition: 'background-color 100ms ease, opacity 100ms ease',
              }}
              onMouseEnter={(e) => {
                if (isFirst) return;
                e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
              }}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Back
            </button>

            <button
              type="button"
              onClick={onNext}
              style={{
                flex: 1,
                height: '36px',
                borderRadius: '10px',
                border: '1px solid var(--button-primary-border)',
                backgroundColor: 'var(--button-primary-bg)',
                color: 'var(--button-primary-text)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}


