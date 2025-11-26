// src/components/TemplateCarousel.tsx
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/state/app';
import { PresetKey, PRESET_CONFIGS } from '@/lib/presets';
import { applyPreset } from '@/lib/presets';
import TemplateCard from './TemplateCard';
import { useWarehouseStore } from '@/lib/useWarehouse';
import { TEMPLATE_TAXONOMY, TemplateReport } from '@/data/templateTaxonomy';
import { FilterPath } from './CategoryFilter';
import { convertReportToPreset } from '@/lib/reportToPreset';

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
  'payments_net_revenue',
  'first_purchase_behavior',
  'active_customers',
  'purchase_frequency',
  'customer_ltv',
  'subscription_churn',
  'invoice_status',
  'current_balances',
  'balance_flows',
  'payouts_over_time',
  'dispute_rates',
  'disputes_by_reason',
  'discounted_revenue',
  'tax_by_jurisdiction',
];

type Props = {
  onExploreOwn: () => void;
  filterPath?: FilterPath;
};

export default function TemplateCarousel({ onExploreOwn, filterPath }: Props) {
  const { state, dispatch } = useApp();
  const { store: warehouse, loadEntity } = useWarehouseStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Collect actual reports from taxonomy based on filter path
  // This returns ALL reports in the taxonomy, not just ones with presets
  const filteredReports = useMemo((): TemplateReport[] => {
    // No filter: show default preset-based templates (for backwards compatibility)
    if (!filterPath || !filterPath.categoryId) {
      return [];
    }

    // Find the category in taxonomy
    const category = TEMPLATE_TAXONOMY.find(cat => cat.id === filterPath.categoryId);
    if (!category) return [];

    let reports: TemplateReport[] = [];

    if (filterPath.topicId) {
      // Level 2: Topic selected - get all reports in that topic
      const topic = category.topics.find(t => t.id === filterPath.topicId);
      if (topic && topic.reports) {
        reports = topic.reports;
      }
    } else {
      // Level 1: Category selected - get all reports in all topics
      reports = category.topics.flatMap(topic => topic.reports || []);
    }

    // Debug logging
    console.log('[TemplateCarousel] Filtered reports:', {
      filterPath,
      reportCount: reports.length,
      sampleReports: reports.slice(0, 3).map(r => r.label)
    });

    return reports;
  }, [filterPath]);

  // For backwards compatibility: also filter preset-based templates
  const filteredTemplateKeys = useMemo(() => {
    // If we have filtered reports from taxonomy, don't show preset-based templates
    if (filteredReports.length > 0) {
      return [];
    }
    // Otherwise show all preset templates (default state when no filter is active)
    return TEMPLATE_KEYS;
  }, [filteredReports]);

  // Reset carousel to start when filter changes
  useEffect(() => {
    setCurrentIndex(0);
    setDisplayIndex(0);
  }, [filterPath]);

  // Determine what to display: either taxonomy reports or preset templates
  const hasFilteredReports = filteredReports.length > 0;
  const totalCount = hasFilteredReports ? filteredReports.length : filteredTemplateKeys.length;
  
  // Get up to three items to display (use displayIndex to prevent content flashing)
  const visibleReports = hasFilteredReports 
    ? filteredReports.slice(displayIndex, displayIndex + 3)
    : [];
  const visibleTemplateKeys = !hasFilteredReports
    ? filteredTemplateKeys.slice(displayIndex, displayIndex + 3)
    : [];

  const isAtStart = currentIndex === 0;
  const isAtEnd = currentIndex + 3 >= totalCount || totalCount <= 3;

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
      const newIndex = Math.min(totalCount - 3, currentIndex + 3);
      setCurrentIndex(newIndex);
      setDisplayIndex(newIndex);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 300);
  };

  const handleSelectTemplate = async (key: PresetKey) => {
    const presetConfig = PRESET_CONFIGS[key];
    
    // If preset has groupBy, ensure the required object is loaded first
    if (presetConfig.groupBy) {
      const requiredObject = presetConfig.groupBy.field.object;
      console.log('[TemplateCarousel] Preset has groupBy, ensuring', requiredObject, 'is loaded');
      
      if (!warehouse[requiredObject] || !Array.isArray(warehouse[requiredObject]) || warehouse[requiredObject].length === 0) {
        console.log('[TemplateCarousel] Loading', requiredObject, 'before applying preset');
        try {
          await loadEntity(requiredObject as any);
          console.log('[TemplateCarousel]', requiredObject, 'loaded successfully');
        } catch (err) {
          console.error('[TemplateCarousel] Failed to load', requiredObject, err);
        }
      }
    }
    
    applyPreset(key, dispatch, state, warehouse);
    dispatch({ type: 'HIDE_TEMPLATE_SELECTOR' });
  };

  return (
    <div className="w-full flex flex-col" style={{ gap: '16px' }}>
      {/* Templates row */}
      {totalCount === 0 ? (
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
          {/* Render taxonomy reports */}
          {visibleReports.map((report) => (
            <div key={report.id} style={{ flex: 1 }}>
              <TemplateCard
                template={{
                  key: report.id as PresetKey,
                  label: report.label,
                  reportId: report.id,
                  // Placeholder values for now - these reports don't have full preset configs yet
                  objects: [],
                  fields: [],
                  metric: { name: '', source: { object: '', field: '' }, op: 'count', type: 'sum_over_period' },
                  range: { start: '', end: '', granularity: 'day' },
                }}
                description={report.description}
                onSelect={async () => {
                  const presetConfig = convertReportToPreset(report);
                  
                  // Load all objects needed for the template (including relationship chain for groupBy)
                  const objectsToLoad = [...(presetConfig.objects || [])];
                  
                  // Ensure all objects are loaded before applying preset
                  for (const obj of objectsToLoad) {
                    if (!warehouse[obj] || !Array.isArray(warehouse[obj]) || warehouse[obj].length === 0) {
                      console.log('[TemplateCarousel] Loading', obj, 'before applying preset');
                      try {
                        await loadEntity(obj as any);
                      } catch (err) {
                        console.error('[TemplateCarousel] Failed to load', obj, err);
                      }
                    }
                  }
                  
                  // Now apply the preset with loaded warehouse data
                  applyPreset(presetConfig, dispatch, state, warehouse);
                  dispatch({ type: 'HIDE_TEMPLATE_SELECTOR' });
                }}
              />
            </div>
          ))}
          
          {/* Render preset templates (when no taxonomy filter is active) */}
          {visibleTemplateKeys.map((key) => (
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

        <div className="flex items-center gap-4">
          <button
            onClick={handlePrevious}
            disabled={isAtStart || totalCount <= 3}
            className="p-2 transition-all"
            style={{ 
              color: 'var(--text-secondary)',
              cursor: (isAtStart || totalCount <= 3) ? 'not-allowed' : 'pointer',
              opacity: (isAtStart || totalCount <= 3) ? 0.3 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isAtStart && totalCount > 3) {
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isAtStart && totalCount > 3) {
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
            disabled={isAtEnd || totalCount <= 3}
            className="p-2 transition-all"
            style={{ 
              color: 'var(--text-secondary)',
              cursor: (isAtEnd || totalCount <= 3) ? 'not-allowed' : 'pointer',
              opacity: (isAtEnd || totalCount <= 3) ? 0.3 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isAtEnd && totalCount > 3) {
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isAtEnd && totalCount > 3) {
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

