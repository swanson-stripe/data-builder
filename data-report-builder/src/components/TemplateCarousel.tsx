// src/components/TemplateCarousel.tsx
'use client';
import { useState } from 'react';
import { useApp } from '@/state/app';
import { PresetKey, PRESET_CONFIGS } from '@/lib/presets';
import { applyPreset } from '@/lib/presets';
import TemplateCard from './TemplateCard';
import { useWarehouseStore } from '@/lib/useWarehouse';

// Template presets to display in carousel (excluding 'blank' and 'mrr')
const TEMPLATE_KEYS: PresetKey[] = [
  'gross_volume',
  'active_subscribers',
  'refund_count',
  'customer_acquisition',
  'payment_success_rate',
  'revenue_by_product',
];

type Props = {
  onExploreOwn: () => void;
};

export default function TemplateCarousel({ onExploreOwn }: Props) {
  const { state, dispatch } = useApp();
  const { store: warehouse } = useWarehouseStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const isAtStart = currentIndex === 0;
  const isAtEnd = currentIndex + 3 >= TEMPLATE_KEYS.length;

  const handlePrevious = () => {
    if (isAtStart || isTransitioning) return;
    setIsTransitioning(true);
    // Fade out, then update content, then fade in
    setTimeout(() => {
      const newIndex = Math.max(0, currentIndex - 3);
      setCurrentIndex(newIndex);
      setDisplayIndex(newIndex);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 300);
  };

  const handleNext = () => {
    if (isAtEnd || isTransitioning) return;
    setIsTransitioning(true);
    // Fade out, then update content, then fade in
    setTimeout(() => {
      const newIndex = Math.min(TEMPLATE_KEYS.length - 3, currentIndex + 3);
      setCurrentIndex(newIndex);
      setDisplayIndex(newIndex);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 300);
  };

  const handleSelectTemplate = (key: PresetKey) => {
    applyPreset(key, dispatch, state, warehouse);
    dispatch({ type: 'HIDE_TEMPLATE_SELECTOR' });
  };

  // Get three templates to display (use displayIndex to prevent content flashing)
  const visibleTemplates = [
    TEMPLATE_KEYS[displayIndex],
    TEMPLATE_KEYS[(displayIndex + 1) % TEMPLATE_KEYS.length],
    TEMPLATE_KEYS[(displayIndex + 2) % TEMPLATE_KEYS.length],
  ];

  return (
    <div className="w-full flex flex-col" style={{ gap: '16px' }}>
      {/* Templates row */}
      <div 
        className="flex" 
        style={{ 
          gap: '16px',
          opacity: isTransitioning ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out',
        }}
      >
        {visibleTemplates.map((key) => (
          <div key={key} style={{ flex: 1 }}>
            <TemplateCard
              template={PRESET_CONFIGS[key]}
              onSelect={() => handleSelectTemplate(key)}
            />
          </div>
        ))}
      </div>

      {/* Navigation controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={onExploreOwn}
          className="text-sm transition-colors"
          style={{ 
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontWeight: 400,
            textDecoration: 'underline',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          Explore on my own
        </button>

        <div className="flex items-center gap-4">
          <button
            onClick={handlePrevious}
            disabled={isAtStart}
            className="p-2 transition-all"
            style={{ 
              color: 'var(--text-secondary)',
              cursor: isAtStart ? 'not-allowed' : 'pointer',
              opacity: isAtStart ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isAtStart) {
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isAtStart) {
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
            aria-label="Previous templates"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <button
            onClick={handleNext}
            disabled={isAtEnd}
            className="p-2 transition-all"
            style={{ 
              color: 'var(--text-secondary)',
              cursor: isAtEnd ? 'not-allowed' : 'pointer',
              opacity: isAtEnd ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isAtEnd) {
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isAtEnd) {
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
            aria-label="Next templates"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

