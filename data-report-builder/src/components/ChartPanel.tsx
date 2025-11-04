'use client';
import { useMemo, useEffect, useState, useRef } from 'react';
import { useApp, actions } from '@/state/app';
import {
  generateSeries,
  shiftSeriesByPeriod,
  createPeriodStartSeries,
  createBenchmarkSeries,
} from '@/data/mock';
import { computeMetric } from '@/lib/metrics';
import { Granularity, validateGranularityRange, getBucketRange } from '@/lib/time';
import { useWarehouseStore } from '@/lib/useWarehouse';
import schema from '@/data/schema';
import { buildDataListView } from '@/lib/views';
import { applyFilters } from '@/lib/filters';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Dot,
} from 'recharts';
import { MetricHeader } from './MetricHeader';
import { ValueTable } from './ValueTable';
import { currency, number as formatNumber } from '@/lib/format';

type RangePreset = {
  label: string;
  getValue: () => { start: string; end: string };
};

const rangePresets: RangePreset[] = [
  {
    label: '1D',
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 1);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
  {
    label: '1W',
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
  {
    label: '1M',
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
  {
    label: '3M',
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 3);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
  {
    label: 'YTD',
    getValue: () => {
      const end = new Date();
      const start = new Date(end.getFullYear(), 0, 1);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
  {
    label: '1Y',
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setFullYear(start.getFullYear() - 1);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
];

const granularityOptions: Granularity[] = ['day', 'week', 'month', 'quarter', 'year'];

export function ChartPanel() {
  const { state, dispatch } = useApp();
  const { store: warehouse, version, loadEntity, has } = useWarehouseStore();

  // Auto-load selected objects that aren't yet loaded
  useEffect(() => {
    state.selectedObjects.forEach((objectName) => {
      if (!has(objectName as any)) {
        console.log(`[ChartPanel] Auto-loading missing entity: ${objectName}`);
        loadEntity(objectName as any).catch((err) => {
          console.error(`[ChartPanel] Failed to load ${objectName}:`, err);
        });
      }
    });
  }, [state.selectedObjects, has, loadEntity]);

  // Handle point click
  const handlePointClick = (data: any) => {
    // Extract date - Recharts passes it in payload.date when clicking dots/bars
    const dateStr = (data.payload?.date || data.date || data) as string;

    const bucketDate = new Date(dateStr);
    if (isNaN(bucketDate.getTime())) {
      console.error('[ChartPanel] Invalid date:', dateStr);
      return;
    }

    const { start, end } = getBucketRange(bucketDate, state.granularity);
    dispatch(actions.setSelectedBucket(start, end, dateStr));
  };

  // Validate granularity-range combination
  const validation = useMemo(() => {
    return validateGranularityRange(
      new Date(state.start),
      new Date(state.end),
      state.granularity
    );
  }, [state.start, state.end, state.granularity]);

  // Build PK include set from grid selection and field filters
  // Chart/table SHOULD respond to grid selection (unlike the metric header)
  const includeSet = useMemo(() => {
    // If we have field filters, compute filtered PKs
    if (state.filters.conditions.length > 0 && state.selectedObjects.length > 0 && state.selectedFields.length > 0) {
      const rawRows = buildDataListView({
        store: warehouse,
        selectedObjects: state.selectedObjects,
        selectedFields: state.selectedFields,
      });
      
      const filteredRows = applyFilters(rawRows, state.filters);
      
      // Extract PKs from filtered rows
      const filterSet = new Set(filteredRows.map(row => `${row.pk.object}:${row.pk.id}`));
      
      // If we also have a grid selection, intersect the two sets
      if (state.selectedGrid && state.selectedGrid.rowIds.length > 0) {
        const gridSet = new Set(state.selectedGrid.rowIds.map(pk => `${pk.object}:${pk.id}`));
        return new Set([...filterSet].filter(pk => gridSet.has(pk)));
      }
      
      return filterSet;
    }
    
    // If no field filters, just use grid selection if present
    if (state.selectedGrid && state.selectedGrid.rowIds.length > 0) {
      return new Set(state.selectedGrid.rowIds.map(pk => `${pk.object}:${pk.id}`));
    }
    
    return undefined;
  }, [
    state.selectedGrid?.rowIds,
    state.filters,
    state.selectedObjects,
    state.selectedFields,
    version,
  ]);

  // Compute metric result (includes series)
  const metricResult = useMemo(() => {
    return computeMetric({
      def: state.metric,
      start: state.start,
      end: state.end,
      granularity: state.granularity,
      store: warehouse,
      include: includeSet,
      schema,
      objects: state.selectedObjects, // Pass selected objects to determine primary table
    });
  }, [
    state.metric.name,
    state.metric.op,
    state.metric.type,
    state.metric.source?.object,
    state.metric.source?.field,
    state.start,
    state.end,
    state.granularity,
    includeSet,
    state.selectedObjects,
  ]);

  // Extract series from metric result (for compatibility with existing code)
  const series = useMemo(() => {
    if (!metricResult.series) {
      return { key: state.report, label: state.metric.name, points: [] };
    }
    return {
      key: state.report,
      label: state.metric.name,
      points: metricResult.series,
    };
  }, [metricResult, state.report, state.metric.name]);

  // Generate comparison series based on comparison mode
  const comparisonSeries = useMemo(() => {
    if (state.chart.comparison === 'none') return null;

    switch (state.chart.comparison) {
      case 'period_start':
        return createPeriodStartSeries(series);

      case 'previous_period': {
        const bucketCount = series.points.length;
        const shiftedStart = new Date(state.start);
        const shiftedEnd = new Date(state.end);

        // Shift dates backward by the bucket count
        switch (state.granularity) {
          case 'day':
            shiftedStart.setDate(shiftedStart.getDate() - bucketCount);
            shiftedEnd.setDate(shiftedEnd.getDate() - bucketCount);
            break;
          case 'week':
            shiftedStart.setDate(shiftedStart.getDate() - bucketCount * 7);
            shiftedEnd.setDate(shiftedEnd.getDate() - bucketCount * 7);
            break;
          case 'month':
            shiftedStart.setMonth(shiftedStart.getMonth() - bucketCount);
            shiftedEnd.setMonth(shiftedEnd.getMonth() - bucketCount);
            break;
          case 'quarter':
            shiftedStart.setMonth(shiftedStart.getMonth() - bucketCount * 3);
            shiftedEnd.setMonth(shiftedEnd.getMonth() - bucketCount * 3);
            break;
          case 'year':
            shiftedStart.setFullYear(shiftedStart.getFullYear() - bucketCount);
            shiftedEnd.setFullYear(shiftedEnd.getFullYear() - bucketCount);
            break;
        }

        const prevSeries = generateSeries({
          key: state.report,
          start: shiftedStart,
          end: shiftedEnd,
          granularity: state.granularity,
          seed: 54321, // Different seed for variation
        });

        return {
          ...prevSeries,
          label: 'Previous Period',
        };
      }

      case 'previous_year': {
        const yearStart = new Date(state.start);
        yearStart.setFullYear(yearStart.getFullYear() - 1);
        const yearEnd = new Date(state.end);
        yearEnd.setFullYear(yearEnd.getFullYear() - 1);

        const prevYearSeries = generateSeries({
          key: state.report,
          start: yearStart,
          end: yearEnd,
          granularity: state.granularity,
          seed: 54321,
        });

        return {
          ...prevYearSeries,
          label: 'Previous Year',
        };
      }

      case 'benchmarks':
        // Benchmarks not yet implemented
        return null;

      default:
        return null;
    }
  }, [series, state.chart.comparison, state.start, state.end, state.granularity]);

  // Format chart data for Recharts - merge current and comparison series
  const chartData = useMemo(() => {
    const data = series.points.map((point, index) => ({
      date: point.date,
      current: point.value,
      comparison: comparisonSeries?.points[index]?.value,
    }));
    return data;
  }, [series, comparisonSeries]);

  // Compute X-axis ticks - only label the first occurrence of each month
  const xAxisTicks = useMemo(() => {
    const seenMonths = new Set<string>();
    return chartData
      .filter((point) => {
        const date = new Date(point.date);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        if (!seenMonths.has(monthKey)) {
          seenMonths.add(monthKey);
          return true;
        }
        return false;
      })
      .map((point) => point.date);
  }, [chartData]);

  // Get value kind from metric result
  const valueKind = metricResult.kind || 'number';

  // Format number for display based on value kind (compact for chart axes)
  const formatValue = (value: number) => {
    if (valueKind === 'currency') {
      return currency(value, { compact: true });
    } else {
      // For number/string, format with compact notation
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(2)}M`;
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return formatNumber(value);
    }
  };

  // Format for tooltips (full values, not compact)
  const formatTooltipValue = (value: number) => {
    if (valueKind === 'currency') {
      return currency(value, { compact: false });
    } else {
      return value.toLocaleString();
    }
  };

  const comparisonOptions: { value: string; label: string }[] = [
    { value: 'period_start', label: 'Period start' },
    { value: 'previous_period', label: 'Previous period' },
    { value: 'previous_year', label: 'Previous year' },
    { value: 'benchmarks', label: 'Benchmarks' },
    { value: 'none', label: 'No comparison' },
  ];

  const isComparisonSelected = state.chart.comparison !== 'none';
  const [isComparisonPopoverOpen, setIsComparisonPopoverOpen] = useState(false);
  const [shouldRenderPopover, setShouldRenderPopover] = useState(false);
  const [popoverOpacity, setPopoverOpacity] = useState(0);
  const comparisonButtonRef = useRef<HTMLButtonElement>(null);
  const comparisonPopoverRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Date range popover state
  const [isDateRangePopoverOpen, setIsDateRangePopoverOpen] = useState(false);
  const [shouldRenderDatePopover, setShouldRenderDatePopover] = useState(false);
  const [datePopoverOpacity, setDatePopoverOpacity] = useState(0);
  const [showGranularityOptions, setShowGranularityOptions] = useState(false);
  const dateRangeButtonRef = useRef<HTMLButtonElement>(null);
  const dateRangePopoverRef = useRef<HTMLDivElement>(null);
  const dateCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle popover open/close with animation
  useEffect(() => {
    if (isComparisonPopoverOpen) {
      // Open: mount and fade in
      setShouldRenderPopover(true);
      // Small delay to allow DOM to update before starting fade-in
      requestAnimationFrame(() => {
        setPopoverOpacity(1);
      });
    } else {
      // Close: fade out then unmount
      setPopoverOpacity(0);
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
      closeTimeoutRef.current = setTimeout(() => {
        setShouldRenderPopover(false);
      }, 100); // Match transition duration
    }
    
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [isComparisonPopoverOpen]);

  // Handle date range popover open/close with animation
  useEffect(() => {
    if (isDateRangePopoverOpen) {
      setShouldRenderDatePopover(true);
      requestAnimationFrame(() => {
        setDatePopoverOpacity(1);
      });
    } else {
      setDatePopoverOpacity(0);
      setShowGranularityOptions(false); // Reset when closing
      if (dateCloseTimeoutRef.current) {
        clearTimeout(dateCloseTimeoutRef.current);
      }
      dateCloseTimeoutRef.current = setTimeout(() => {
        setShouldRenderDatePopover(false);
      }, 100);
    }
    
    return () => {
      if (dateCloseTimeoutRef.current) {
        clearTimeout(dateCloseTimeoutRef.current);
      }
    };
  }, [isDateRangePopoverOpen]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        comparisonButtonRef.current && 
        !comparisonButtonRef.current.contains(event.target as Node) &&
        comparisonPopoverRef.current &&
        !comparisonPopoverRef.current.contains(event.target as Node)
      ) {
        setIsComparisonPopoverOpen(false);
      }
      
      if (
        dateRangeButtonRef.current &&
        !dateRangeButtonRef.current.contains(event.target as Node) &&
        dateRangePopoverRef.current &&
        !dateRangePopoverRef.current.contains(event.target as Node)
      ) {
        setIsDateRangePopoverOpen(false);
      }
    };

    if (isComparisonPopoverOpen || isDateRangePopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isComparisonPopoverOpen, isDateRangePopoverOpen]);

  // Get current comparison label
  const currentComparisonLabel = state.chart.comparison === 'none' 
    ? 'Compare' 
    : `Compare to ${comparisonOptions.find(opt => opt.value === state.chart.comparison)?.label.toLowerCase() || 'selection'}`;

  // Get current date range label
  const getCurrentRangeLabel = () => {
    const currentRange = rangePresets.find(preset => {
      const range = preset.getValue();
      return state.start === range.start && state.end === range.end;
    });
    return currentRange?.label || 'Custom';
  };
  
  // Extended range options for "More" section
  const moreRangeOptions = [
    {
      label: 'Today',
      code: 'T',
      getValue: () => {
        const today = new Date().toISOString().split('T')[0];
        return { start: today, end: today };
      },
    },
    {
      label: 'Month to date',
      code: 'MTD',
      getValue: () => {
        const end = new Date();
        const start = new Date(end.getFullYear(), end.getMonth(), 1);
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        };
      },
    },
    {
      label: 'All time',
      code: 'ALL',
      getValue: () => {
        // Return a very wide range
        const end = new Date();
        const start = new Date(2020, 0, 1);
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        };
      },
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Metric Header */}
      <MetricHeader />

      {/* Controls */}
      <div className="flex items-center gap-2 mt-10">
        {/* Date Range Control */}
        <div className="relative inline-flex items-center">
          <div className="flex items-center gap-2 px-1" style={{ backgroundColor: '#F5F6F8', borderRadius: '50px', height: '32px' }}>
        {/* Range presets */}
          {rangePresets.map((preset) => {
            const range = preset.getValue();
            const isSelected = state.start === range.start && state.end === range.end;
            
            return (
              <button
                key={preset.label}
                onClick={() => {
                  dispatch(actions.setRange(range.start, range.end));
                }}
                  className="px-3 text-sm font-medium transition-colors focus:outline-none flex items-center"
                  style={{
                    backgroundColor: isSelected ? '#D8DEE4' : 'transparent',
                    borderRadius: '50px',
                    color: isSelected ? '#000000' : '#6b7280',
                    height: '24px',
                    cursor: 'pointer',
                  }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = '#D8DEE4';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
                aria-label={`Set date range to ${preset.label}`}
                aria-pressed={isSelected}
              >
                {preset.label}
              </button>
            );
          })}
            
            {/* Divider */}
            <div style={{ width: '1px', height: '20px', backgroundColor: '#D8DEE4' }} />
            
            {/* Chevron button for popover */}
            <button
              ref={dateRangeButtonRef}
              onClick={() => setIsDateRangePopoverOpen(!isDateRangePopoverOpen)}
              className="flex items-center justify-center border-none focus:outline-none cursor-pointer transition-colors"
              style={{
                backgroundColor: isDateRangePopoverOpen ? '#D8DEE4' : 'transparent',
                borderRadius: '50px',
                width: '24px',
                height: '24px',
              }}
              onMouseEnter={(e) => {
                if (!isDateRangePopoverOpen) {
                  e.currentTarget.style.backgroundColor = '#D8DEE4';
                }
              }}
              onMouseLeave={(e) => {
                if (!isDateRangePopoverOpen) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
              aria-label="Open date range options"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
        </div>

          {/* Date Range Popover */}
          {shouldRenderDatePopover && (
            <div
              ref={dateRangePopoverRef}
              className="absolute bg-white py-1 z-50"
              style={{
                top: '44px',
                right: '-108px',
                borderRadius: '16px',
                boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
                width: '248px',
                opacity: datePopoverOpacity,
                transition: 'opacity 100ms ease-in-out',
              }}
            >
              {showGranularityOptions ? (
                /* Change Granularity View */
                <>
                  {/* Change granularity label */}
                  <div className="py-2 text-xs" style={{ paddingLeft: '16px', paddingRight: '16px', color: '#6b7280', fontWeight: 400 }}>
                    Change granularity
                  </div>
                  
                  {/* Granularity options */}
            {granularityOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        dispatch(actions.setGranularity(option));
                        setShowGranularityOptions(false);
                      }}
                      className="w-full text-left py-2 text-sm transition-colors flex items-center justify-between"
                      style={{
                        paddingLeft: '16px',
                        paddingRight: '16px',
                        color: '#374151',
                        fontWeight: 600,
                        height: '32px',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f6f8'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <span>{option.charAt(0).toUpperCase() + option.slice(1)}</span>
                      {state.granularity === option && (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="8" cy="8" r="8" fill="#374151"/>
                          <path d="M11 5.5L7 10L5 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {/* Granularity Section */}
                  <div>
                    {/* Granularity label - not clickable */}
                    <div className="py-2 text-xs" style={{ paddingLeft: '16px', paddingRight: '16px', color: '#6b7280', fontWeight: 400 }}>
                      Granularity
        </div>
                    
                    {/* Current granularity - clickable to toggle view */}
                    <button
                      onClick={() => setShowGranularityOptions(true)}
                      className="w-full text-left py-2 text-sm transition-colors flex items-center justify-between"
                      style={{
                        paddingLeft: '16px',
                        paddingRight: '16px',
                        color: '#374151',
                        fontWeight: 600,
                        height: '32px',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f6f8'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <span>{state.granularity.charAt(0).toUpperCase() + state.granularity.slice(1)}</span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M3 4.5L6 2L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M3 7.5L6 10L9 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
      </div>

                  {/* Preset List */}
                  <div className="py-2 text-xs" style={{ paddingLeft: '16px', paddingRight: '16px', color: '#6b7280', fontWeight: 400 }}>
                    Preset list
                  </div>
                  
                  {rangePresets.map((preset) => {
                    const range = preset.getValue();
                    const isSelected = state.start === range.start && state.end === range.end;
                    
                    return (
                      <button
                        key={preset.label}
                        onClick={() => {
                          dispatch(actions.setRange(range.start, range.end));
                          setIsDateRangePopoverOpen(false);
                        }}
                        className="w-full text-left py-2 text-sm transition-colors flex items-center justify-between"
                        style={{
                          paddingLeft: '16px',
                          paddingRight: '16px',
                          color: '#374151',
                          fontWeight: 600,
                          height: '32px',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f6f8'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="flex items-center justify-center text-xs"
                            style={{
                              minWidth: '42px',
                              height: '24px',
                              backgroundColor: isSelected ? '#f5f6f8' : 'transparent',
                              borderRadius: '50px',
                              color: isSelected ? '#000000' : '#6b7280',
                              fontWeight: isSelected ? 600 : 400,
                            }}
                          >
                            {preset.label}
                          </span>
                          <span>
                            {preset.label === '1D' && 'Last 24 hours'}
                            {preset.label === '1W' && 'Last week'}
                            {preset.label === '1M' && 'Last 4 weeks'}
                            {preset.label === '3M' && 'Last 3 months'}
                            {preset.label === '1Y' && 'Last 12 months'}
                            {preset.label === 'YTD' && 'Year to date'}
                          </span>
                        </div>
                        {isSelected && (
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="8" cy="8" r="8" fill="#374151"/>
                            <path d="M11 5.5L7 10L5 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                    );
                  })}

                  {/* More Section */}
                  <div className="py-2 text-xs border-t border-gray-100" style={{ paddingLeft: '16px', paddingRight: '16px', color: '#6b7280', fontWeight: 400 }}>
                    More
                  </div>
                  
                  {moreRangeOptions.map((option) => {
                    const range = option.getValue();
                    const isSelected = state.start === range.start && state.end === range.end;
                    
                    return (
                      <button
                        key={option.code}
                        onClick={() => {
                          dispatch(actions.setRange(range.start, range.end));
                          setIsDateRangePopoverOpen(false);
                        }}
                        className="w-full text-left py-2 text-sm transition-colors flex items-center justify-between"
                        style={{
                          paddingLeft: '16px',
                          paddingRight: '16px',
                          color: '#374151',
                          fontWeight: 600,
                          height: '32px',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f6f8'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="flex items-center justify-center text-xs"
                            style={{
                              minWidth: '42px',
                              height: '24px',
                              backgroundColor: isSelected ? '#f5f6f8' : 'transparent',
                              borderRadius: '50px',
                              color: isSelected ? '#000000' : '#6b7280',
                              fontWeight: isSelected ? 600 : 400,
                            }}
                          >
                            {option.code}
                          </span>
                          <span>{option.label}</span>
                        </div>
                        {isSelected && (
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="8" cy="8" r="8" fill="#374151"/>
                            <path d="M11 5.5L7 10L5 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                    );
                  })}
                  
                  {/* Custom option */}
                  <button
                    className="w-full text-left py-2 text-sm transition-colors flex items-center justify-between"
                    style={{
                      paddingLeft: '16px',
                      paddingRight: '16px',
                      color: '#374151',
                      fontWeight: 600,
                      height: '32px',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f6f8'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ minWidth: '42px' }}></span>
                      <span>Custom</span>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Comparison control */}
        <div className="relative inline-flex items-center">
          <button
            ref={comparisonButtonRef}
            onClick={() => setIsComparisonPopoverOpen(!isComparisonPopoverOpen)}
            className="text-sm border-none focus:outline-none cursor-pointer flex items-center transition-colors"
            style={{
              backgroundColor: '#F5F6F8',
              color: isComparisonSelected ? '#374151' : '#99A5B8',
              fontWeight: 400,
              borderRadius: '50px',
              padding: '6px 12px',
              height: '32px',
              whiteSpace: 'nowrap',
              gap: isComparisonSelected ? '4px' : '8px',
            }}
          >
            {!isComparisonSelected && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.5625 3.1875C6.5625 2.87684 6.31066 2.625 6 2.625C5.68934 2.625 5.4375 2.87684 5.4375 3.1875V5.4375H3.1875C2.87684 5.4375 2.625 5.68934 2.625 6C2.625 6.31066 2.87684 6.5625 3.1875 6.5625H5.4375V8.8125C5.4375 9.12316 5.68934 9.375 6 9.375C6.31066 9.375 6.5625 9.12316 6.5625 8.8125V6.5625H8.8125C9.12316 6.5625 9.375 6.31066 9.375 6C9.375 5.68934 9.12316 5.4375 8.8125 5.4375H6.5625V3.1875Z" fill="#99A5B8"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M12 5.99999C12 9.31404 9.31405 12 6 12C2.68595 12 0 9.31404 0 5.99999C0 2.68595 2.68595 0 6 0C9.32231 0 12 2.68595 12 5.99999ZM10.875 5.99999C10.875 8.69272 8.69272 10.875 6 10.875C3.30728 10.875 1.125 8.69272 1.125 5.99999C1.125 3.30727 3.30727 1.125 6 1.125C8.69998 1.125 10.875 3.30626 10.875 5.99999Z" fill="#99A5B8"/>
              </svg>
            )}
            <span>{currentComparisonLabel}</span>
            {isComparisonSelected && (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 3L4 5L6 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>

          {/* Popover */}
          {shouldRenderPopover && (
            <div
              ref={comparisonPopoverRef}
              className="absolute bg-white py-1 z-50"
              style={{
                top: 0,
                left: 0,
                borderRadius: '16px',
                boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
                width: isComparisonSelected ? '248px' : 'auto',
                opacity: popoverOpacity,
                transition: 'opacity 100ms ease-in-out',
              }}
            >
              {/* Current selection label */}
              {isComparisonSelected && (
                <div className="py-2 text-sm" style={{ paddingLeft: '16px', paddingRight: '16px', color: '#374151', fontWeight: 400 }}>
                  {currentComparisonLabel}
                </div>
              )}
              
              {/* Options */}
              {comparisonOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    dispatch(actions.setComparison(option.value as any));
                    setIsComparisonPopoverOpen(false);
                  }}
                  className="w-full text-left py-2 text-sm hover:bg-gray-100 transition-colors flex items-center gap-4"
                  style={{
                    paddingLeft: '16px',
                    paddingRight: '16px',
                    color: '#374151',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>{option.label}</span>
                  {state.chart.comparison === option.value && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="8" cy="8" r="8" fill="#374151"/>
                      <path d="M11 5.5L7 10L5 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Plus button - only show when comparison is selected */}
        {isComparisonSelected && (
          <button
            className="flex items-center justify-center transition-colors"
            style={{
              backgroundColor: '#F5F6F8',
              borderRadius: '50px',
              color: '#6b7280',
              width: '32px',
              height: '32px',
            }}
            aria-label="Add comparison"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Warnings */}
        {!validation.valid && validation.warning && (
        <div className="mt-3 text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1" role="alert">
            ⚠️ {validation.warning}
          </div>
        )}

      {/* Chart and Table Container */}
      <div className="mt-3 p-2" style={{ backgroundColor: '#F5F6F8', borderRadius: '8px' }}>
        {metricResult.series === null || !state.metric.source ? (
          <div className="flex flex-col items-center justify-center" style={{ height: '280px' }}>
            <div className="text-gray-400 dark:text-gray-500 text-center">
              <div className="text-4xl mb-2">📊</div>
              <p className="text-sm font-medium">No metric configured</p>
              <p className="text-xs mt-1">
                {metricResult.note || 'Select a source field in the Metric tab.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chart */}
            <div style={{ height: '280px', backgroundColor: '#ffffff', borderRadius: '8px', paddingTop: '8px', paddingLeft: '8px' }}>
          <ResponsiveContainer width="100%" height="100%">
          {state.chart.type === 'line' && (
            <LineChart data={chartData}>
                    <CartesianGrid 
                      horizontal={true} 
                      vertical={false}
                      stroke="#d1d5db"
                      strokeDasharray="2 2"
                      strokeOpacity={0.5}
                    />
              <XAxis
                dataKey="date"
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      stroke="none"
                      axisLine={{ stroke: '#e5e7eb' }}
                      ticks={xAxisTicks}
                tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString('en-US', { month: 'short' });
                }}
              />
              <YAxis
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      stroke="none"
                      axisLine={false}
                tickFormatter={formatValue}
                      orientation="right"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
                formatter={(value: any) => {
                  if (typeof value === 'number') {
                          return formatTooltipValue(value);
                  }
                  return value;
                }}
              />
              <Line
                      type="linear"
                dataKey="current"
                name={series.label}
                      stroke="#9966FF"
                      strokeWidth={2.5}
                dot={(props: any) => {
                  const isSelected = state.selectedBucket?.label === props.payload.date;
                  const { key, ...dotProps } = props;
                        
                        // For latest/first value metrics, only show dot on the relevant bucket
                        const shouldShowDot = 
                          state.metric.type === 'sum_over_period' || 
                          state.metric.type === 'average_over_period' ||
                          (state.metric.type === 'latest' && props.index === chartData.length - 1) ||
                          (state.metric.type === 'first' && props.index === 0);
                        
                        if (!shouldShowDot && !isSelected) {
                          return <></>;
                        }
                        
                  return (
                    <Dot
                      key={key}
                      {...dotProps}
                            r={isSelected ? 6 : 4}
                            fill={isSelected ? '#8052D9' : '#9966FF'}
                      stroke={isSelected ? '#fff' : 'none'}
                      strokeWidth={isSelected ? 2 : 0}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handlePointClick(props.payload)}
                    />
                  );
                }}
                activeDot={{
                  r: 5,
                  style: { cursor: 'pointer' },
                  onClick: (e: any, payload: any) => handlePointClick(payload)
                }}
              />
              {comparisonSeries && (
                <Line
                        type="linear"
                  dataKey="comparison"
                  name={comparisonSeries.label}
                        stroke="#9ca3af"
                  strokeWidth={2}
                        strokeDasharray="4 4"
                  dot={false}
                />
              )}
            </LineChart>
          )}

          {state.chart.type === 'area' && (
            <AreaChart data={chartData}>
                    <CartesianGrid 
                      horizontal={true} 
                      vertical={false}
                      stroke="#d1d5db"
                      strokeDasharray="2 2"
                      strokeOpacity={0.5}
                    />
              <XAxis
                dataKey="date"
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      stroke="none"
                      axisLine={{ stroke: '#e5e7eb' }}
                      ticks={xAxisTicks}
                tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString('en-US', { month: 'short' });
                }}
              />
              <YAxis
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      stroke="none"
                      axisLine={false}
                tickFormatter={formatValue}
                      orientation="right"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
                formatter={(value: any) => {
                  if (typeof value === 'number') {
                          return formatTooltipValue(value);
                  }
                  return value;
                }}
              />
              {comparisonSeries && (
                <Area
                  type="monotone"
                  dataKey="comparison"
                  name={comparisonSeries.label}
                        fill="#d1d5db"
                        fillOpacity={0.2}
                        stroke="#9ca3af"
                  strokeWidth={2}
                        strokeDasharray="4 4"
                />
              )}
              <Area
                type="monotone"
                dataKey="current"
                name={series.label}
                      fill="#CCAAFF"
                      fillOpacity={0.3}
                      stroke="#9966FF"
                      strokeWidth={2.5}
                dot={(props: any) => {
                  const isSelected = state.selectedBucket?.label === props.payload.date;
                  const { key, ...dotProps } = props;
                        
                        // For latest/first value metrics, only show dot on the relevant bucket
                        const shouldShowDot = 
                          state.metric.type === 'sum_over_period' || 
                          state.metric.type === 'average_over_period' ||
                          (state.metric.type === 'latest' && props.index === chartData.length - 1) ||
                          (state.metric.type === 'first' && props.index === 0);
                        
                        if (!shouldShowDot && !isSelected) {
                          return <></>;
                        }
                        
                  return (
                    <Dot
                      key={key}
                      {...dotProps}
                            r={isSelected ? 6 : 4}
                            fill={isSelected ? '#8052D9' : '#9966FF'}
                      stroke={isSelected ? '#fff' : 'none'}
                      strokeWidth={isSelected ? 2 : 0}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handlePointClick(props.payload)}
                    />
                  );
                }}
                activeDot={{
                  r: 5,
                  style: { cursor: 'pointer' },
                  onClick: (e: any, payload: any) => handlePointClick(payload)
                }}
              />
            </AreaChart>
          )}

          {state.chart.type === 'bar' && (
            <BarChart data={chartData}>
                    <CartesianGrid 
                      horizontal={true} 
                      vertical={false}
                      stroke="#d1d5db"
                      strokeDasharray="2 2"
                      strokeOpacity={0.5}
                    />
              <XAxis
                dataKey="date"
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      stroke="none"
                      axisLine={{ stroke: '#e5e7eb' }}
                      ticks={xAxisTicks}
                tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString('en-US', { month: 'short' });
                }}
              />
              <YAxis
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      stroke="none"
                      axisLine={false}
                tickFormatter={formatValue}
                      orientation="right"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
                formatter={(value: any) => {
                  if (typeof value === 'number') {
                          return formatTooltipValue(value);
                  }
                  return value;
                }}
              />
              <Bar
                dataKey="current"
                name={series.label}
                      fill="#9966FF"
                shape={(props: any) => {
                  const { x, y, width, height, payload } = props;
                  const isSelected = state.selectedBucket?.label === payload.date;
                  return (
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                            fill={isSelected ? '#8052D9' : '#9966FF'}
                      stroke={isSelected ? '#fff' : 'none'}
                      strokeWidth={isSelected ? 2 : 0}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handlePointClick(payload)}
                    />
                  );
                }}
              />
              {comparisonSeries && (
                <Bar
                  dataKey="comparison"
                  name={comparisonSeries.label}
                        fill="#9ca3af"
                />
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
            </div>

            {/* Summary Table - Integrated ValueTable with full functionality */}
            <div className="mt-2 px-3" style={{ backgroundColor: '#ffffff', borderRadius: '8px' }}>
              <ValueTable />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
