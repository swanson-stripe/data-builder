// src/components/TemplateCarousel.tsx
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/state/app';
import { PresetKey, PRESET_CONFIGS } from '@/lib/presets';
import { applyPreset } from '@/lib/presets';
import TemplateCard from './TemplateCard';
import { useWarehouseStore } from '@/lib/useWarehouse';
import { TEMPLATE_TAXONOMY } from '@/data/templateTaxonomy';
import { FilterPath } from './CategoryFilter';

// Template presets to display in carousel (excluding 'blank')
const TEMPLATE_KEYS: PresetKey[] = [
  'mrr',
  'gross_volume',
  'active_subscribers',
  'refund_count',
  'customer_acquisition',
  'payment_success_rate',
  'revenue_by_product',
  'payment_acceptance_by_method',
  'payment_funnel',
  'payment_volume_by_attribute',
];

type Props = {
  onExploreOwn: () => void;
  filterPath?: FilterPath;
};

export default function TemplateCarousel({ onExploreOwn, filterPath }: Props) {
  const { state, dispatch } = useApp();
  const { store: warehouse } = useWarehouseStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Filter templates based on the current filter path
  const filteredTemplateKeys = useMemo(() => {
    // No filter: show all templates
    if (!filterPath || !filterPath.categoryId) {
      return TEMPLATE_KEYS;
    }

    // Find the category in taxonomy
    const category = TEMPLATE_TAXONOMY.find(cat => cat.id === filterPath.categoryId);
    if (!category) return TEMPLATE_KEYS;

    // Collect all report IDs that match the filter
    let reportIds: string[] = [];

    if (filterPath.reportId) {
      // Specific report selected
      reportIds = [filterPath.reportId];
    } else if (filterPath.topicId) {
      // Topic selected: get all reports in that topic
      const topic = category.topics.find(t => t.id === filterPath.topicId);
      if (topic) {
        reportIds = topic.reports.map(r => r.id);
      }
    } else {
      // Category selected: get all reports in all topics
      reportIds = category.topics.flatMap(topic => topic.reports.map(r => r.id));
    }

    // Filter TEMPLATE_KEYS to only include presets that match these reportIds
    const matched = TEMPLATE_KEYS.filter(key => {
      const config = PRESET_CONFIGS[key];
      return config.reportId && reportIds.includes(config.reportId);
    });

    // If no matches found, return a random subset of the category's reports
    // (placeholder behavior until all reports have presets)
    if (matched.length === 0 && reportIds.length > 0) {
      console.log('[TemplateCarousel] No presets match filter, showing all templates');
      return TEMPLATE_KEYS;
    }

    return matched.length > 0 ? matched : TEMPLATE_KEYS;
  }, [filterPath]);

  // Reset carousel to start when filter changes
  useEffect(() => {
    setCurrentIndex(0);
    setDisplayIndex(0);
  }, [filterPath]);

  const isAtStart = currentIndex === 0;
  const isAtEnd = currentIndex + 3 >= filteredTemplateKeys.length || filteredTemplateKeys.length <= 3;

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
      const newIndex = Math.min(filteredTemplateKeys.length - 3, currentIndex + 3);
      setCurrentIndex(newIndex);
      setDisplayIndex(newIndex);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 300);
  };

  const handleSelectTemplate = (key: PresetKey) => {
    applyPreset(key, dispatch, state, warehouse);
    dispatch({ type: 'HIDE_TEMPLATE_SELECTOR' });
  };

  // Get up to three templates to display (use displayIndex to prevent content flashing)
  const visibleTemplates = filteredTemplateKeys.length === 0 
    ? [] 
    : filteredTemplateKeys.slice(displayIndex, displayIndex + 3);

  return (
    <div className="w-full flex flex-col" style={{ gap: '16px' }}>
      {/* Templates row */}
      {visibleTemplates.length === 0 ? (
        <div 
          className="flex items-center justify-center p-8 rounded-lg"
          style={{ 
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
          }}
        >
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            No templates available yet for this category
          </p>
        </div>
      ) : (
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
      )}

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

        {filteredTemplateKeys.length > 3 && (
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
        )}
      </div>
    </div>
  );
}

