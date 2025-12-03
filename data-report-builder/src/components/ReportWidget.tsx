'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/state/app';
import { useWarehouseStore } from '@/lib/useWarehouse';
import { computeFormula } from '@/lib/formulaMetrics';
import { PRESET_CONFIGS, PresetKey, applyPreset } from '@/lib/presets';
import { toSlug } from '@/lib/slugs';
import { currency, number as formatNumber } from '@/lib/format';
import schema from '@/data/schema';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
  Tooltip,
} from 'recharts';

type ReportWidgetProps = {
  presetKey: PresetKey;
  /** Override label if needed */
  label?: string;
};

/**
 * A clickable widget that displays a preset report's key metrics and sparkline.
 * Used on the analytics index page.
 */
export function ReportWidget({ presetKey, label }: ReportWidgetProps) {
  const router = useRouter();
  const { state, dispatch } = useApp();
  const { store: warehouse } = useWarehouseStore();
  const [isHovered, setIsHovered] = useState(false);

  const preset = PRESET_CONFIGS[presetKey];
  const displayLabel = label || preset.label;

  // Compute metric data for this preset
  const { chartData, currentValue, previousValue, percentChange, isNegativeChange } = useMemo(() => {
    if (!warehouse || Object.keys(warehouse).length === 0) {
      return { chartData: [], currentValue: 0, previousValue: null, percentChange: null, isNegativeChange: false };
    }

    // Check if required data is loaded for this preset
    const requiredObjects = preset.objects;
    const hasRequiredData = requiredObjects.some(obj => {
      const data = warehouse[obj as keyof typeof warehouse];
      return data && Array.isArray(data) && data.length > 0;
    });

    if (!hasRequiredData) {
      return { chartData: [], currentValue: 0, previousValue: null, percentChange: null, isNegativeChange: false };
    }

    // Build a temporary formula from the preset config
    const blocks = preset.multiBlock?.blocks || [{
      id: 'main',
      name: preset.metric.name,
      source: preset.metric.source,
      op: preset.metric.op,
      type: preset.metric.type,
      filters: preset.filters || [],
    }];

    const formula = {
      name: preset.label,
      blocks,
      calculation: preset.multiBlock?.calculation || null,
      outputUnit: preset.multiBlock?.outputUnit || (preset.metric.op === 'count' || preset.metric.op === 'distinct_count' ? 'count' : 'volume'),
    };

    const range = preset.range || {
      start: `${new Date().getFullYear()}-01-01`,
      end: new Date().toISOString().slice(0, 10),
      granularity: 'week' as const,
    };

    try {
      const { result } = computeFormula({
        formula: formula as any,
        start: range.start,
        end: range.end,
        granularity: range.granularity,
        store: warehouse,
        schema,
        selectedObjects: preset.objects,
        selectedFields: preset.fields,
      });

      const series = result.series || [];
      // Use result.value which is the properly computed headline value based on metric type
      const current = result.value ?? 0;
      
      // Calculate previous period comparison
      let previous: number | null = null;
      let pctChange: number | null = null;
      let isNegative = false;

      if (series.length >= 2) {
        // For flow metrics (sum_over_period), compare sum of first half to sum of second half
        // For stock metrics (latest/first), compare first value to last value
        const isStockMetric = preset.metric.type === 'latest' || preset.metric.type === 'first';
        
        if (isStockMetric) {
          const firstValue = series[0].value;
          const lastValue = series[series.length - 1].value;
          previous = firstValue;
          if (firstValue !== 0) {
            pctChange = ((lastValue - firstValue) / Math.abs(firstValue)) * 100;
            isNegative = pctChange < 0;
          }
        } else {
          // Flow metric - compare halves
          const midpoint = Math.floor(series.length / 2);
          const firstHalfSum = series.slice(0, midpoint).reduce((sum, d) => sum + d.value, 0);
          const secondHalfSum = series.slice(midpoint).reduce((sum, d) => sum + d.value, 0);
          
          if (firstHalfSum !== 0) {
            pctChange = ((secondHalfSum - firstHalfSum) / Math.abs(firstHalfSum)) * 100;
            isNegative = pctChange < 0;
          }
          previous = firstHalfSum;
        }
      }

      return {
        chartData: series,
        currentValue: current,
        previousValue: previous,
        percentChange: pctChange,
        isNegativeChange: isNegative,
      };
    } catch (err) {
      console.error(`[ReportWidget] Error computing ${presetKey}:`, err);
      return { chartData: [], currentValue: 0, previousValue: null, percentChange: null, isNegativeChange: false };
    }
  }, [warehouse, preset, presetKey]);

  // Format the value based on metric type - always use full values
  const formattedValue = useMemo(() => {
    const isCount = preset.metric.op === 'count' || preset.metric.op === 'distinct_count';
    if (isCount) {
      return formatNumber(currentValue);
    }
    return currency(currentValue);
  }, [currentValue, preset.metric.op]);

  const formattedPrevious = useMemo(() => {
    if (previousValue === null) return null;
    const isCount = preset.metric.op === 'count' || preset.metric.op === 'distinct_count';
    if (isCount) {
      return `${formatNumber(previousValue)} previous period`;
    }
    return `${currency(previousValue)} previous period`;
  }, [previousValue, preset.metric.op]);

  const handleClick = () => {
    const slug = toSlug(displayLabel);
    router.push(`/${slug}`);
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex flex-col cursor-pointer transition-all"
      style={{
        backgroundColor: 'var(--bg-primary)',
        border: `1px solid ${isHovered ? 'var(--border-medium)' : 'var(--border-default)'}`,
        borderRadius: '12px',
        padding: '16px',
        minHeight: '200px',
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`View ${displayLabel} report`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span style={{ 
          fontSize: '14px', 
          fontWeight: 500, 
          color: isHovered ? 'var(--button-primary-bg)' : 'var(--text-primary)',
          transition: 'color 0.15s ease',
        }}>
          {displayLabel}
        </span>
        {/* Arrow icon - changes on hover */}
        <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
          {isHovered && (
            <span style={{ 
              fontSize: '12px', 
              fontWeight: 500, 
              color: 'var(--button-primary-bg)',
            }}>
              Open
            </span>
          )}
          <svg 
            width="14" 
            height="14" 
            viewBox="0 0 14 14" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            style={{ 
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            <path 
              d="M4 10L10 4M10 4H5M10 4V9" 
              stroke={isHovered ? 'var(--button-primary-bg)' : 'var(--text-muted)'} 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Value and change */}
      <div className="flex items-baseline gap-2 mb-1">
        <span style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {formattedValue}
        </span>
        {percentChange !== null && (
          <span
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: isNegativeChange ? '#ef4444' : '#22c55e',
            }}
          >
            {isNegativeChange ? '' : '+'}{percentChange.toFixed(0)}%
          </span>
        )}
      </div>

      {/* Previous period */}
      {formattedPrevious && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          {formattedPrevious}
        </div>
      )}

      {/* Sparkline chart with tooltip */}
      <div className="flex-1 min-h-[60px]">
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Tooltip
                cursor={{ stroke: 'var(--border-medium)', strokeWidth: 1, strokeDasharray: '4 4' }}
                contentStyle={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
                labelFormatter={(dateString: string) => {
                  const date = new Date(dateString);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }}
                formatter={(value: number) => {
                  const isCount = preset.metric.op === 'count' || preset.metric.op === 'distinct_count';
                  if (isCount) {
                    return [formatNumber(value), displayLabel];
                  }
                  return [currency(value), displayLabel];
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--button-primary-bg)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

