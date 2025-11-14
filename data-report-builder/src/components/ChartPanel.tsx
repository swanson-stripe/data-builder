'use client';
import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useApp, actions } from '@/state/app';
import {
  generateSeries,
  shiftSeriesByPeriod,
  createPeriodStartSeries,
  createBenchmarkSeries,
} from '@/data/mock';
import { computeMetric } from '@/lib/metrics';
import { computeFormula } from '@/lib/formulaMetrics';
import { Granularity, validateGranularityRange, getBucketRange } from '@/lib/time';
import { useWarehouseStore } from '@/lib/useWarehouse';
import schema from '@/data/schema';
import { buildDataListView } from '@/lib/views';
import { applyFilters } from '@/lib/filters';
import { getAvailableGroupFields, getGroupValues } from '@/lib/grouping';
import GroupBySelector from './GroupBySelector';
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

  // Always use formula system now (blocks always exist, single block = simple metric)
  const useFormula = true;

  // Compute metric result (includes series) - supports both legacy and multi-block
  const metricResult = useMemo(() => {
    if (useFormula) {
      // Use multi-block formula system
      const { result } = computeFormula({
        formula: state.metricFormula,
        start: state.start,
        end: state.end,
        granularity: state.granularity,
        store: warehouse,
        schema,
        selectedObjects: state.selectedObjects,
        selectedFields: state.selectedFields,
      });
      return result;
    } else {
      // Use legacy single-metric system
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
    }
  }, [
    useFormula,
    state.metricFormula,
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
    state.selectedFields,
    version, // Re-compute when warehouse data changes
  ]);

  // Remove the mount-only effect - we'll track loading based on data readiness instead

  // Compute grouped metrics if grouping is active
  const groupedMetrics = useMemo(() => {
    const hasGrouping = state.groupBy && state.groupBy.selectedValues.length > 0;
    
    if (!hasGrouping) {
      return null;
    }

    // Get the rows for the primary object
    const primaryObject = state.selectedObjects[0] || state.metricFormula.blocks[0]?.source?.object;
    if (!primaryObject) {
      return null;
    }

    const allRows = warehouse[primaryObject as keyof Warehouse];
    if (!Array.isArray(allRows)) {
      return null;
    }

    // Compute metric for each group
    const results = new Map<string, MetricResult>();
    
    for (const groupValue of state.groupBy.selectedValues) {
      // Filter rows for this group
      const groupRows = allRows.filter(row => {
        const value = row[state.groupBy!.field.field];
        return String(value) === groupValue;
      });

      // Create a temporary warehouse with only this group's rows
      const groupWarehouse = {
        ...warehouse,
        [primaryObject]: groupRows,
      };

      // Compute metric for this group
      if (useFormula) {
        const { result } = computeFormula({
          formula: state.metricFormula,
          start: state.start,
          end: state.end,
          granularity: state.granularity,
          store: groupWarehouse,
          schema,
          selectedObjects: state.selectedObjects,
          selectedFields: state.selectedFields,
        });
        results.set(groupValue, result);
      } else {
        const result = computeMetric({
          def: state.metric,
          start: state.start,
          end: state.end,
          granularity: state.granularity,
          store: groupWarehouse,
          include: undefined, // Don't apply PK filtering for groups
          schema,
          objects: state.selectedObjects,
        });
        results.set(groupValue, result);
      }
    }

    return results;
  }, [
    state.groupBy,
    state.metricFormula,
    state.metric,
    state.start,
    state.end,
    state.granularity,
    state.selectedObjects,
    state.selectedFields,
    useFormula,
    version,
  ]);

  // Extract series from metric result (for compatibility with existing code)
  const series = useMemo(() => {
    if (!metricResult.series) {
      const metricName = useFormula ? state.metricFormula.name : state.metric.name;
      return { key: state.report, label: metricName, points: [] };
    }
    const metricName = useFormula ? state.metricFormula.name : state.metric.name;
    return {
      key: state.report,
      label: metricName,
      points: metricResult.series,
    };
  }, [metricResult, state.report, state.metric.name, useFormula, state.metricFormula.name]);

  // Handle point click
  const handlePointClick = useCallback((data: any) => {
    // Extract date - Recharts passes it in payload.date when clicking dots/bars
    let dateStr = (data.payload?.date || data.date || data) as string;

    // For "latest" or "first" metrics, override the clicked bucket to show the bucket
    // that actually contributes to the metric value (not the clicked bucket)
    // This only applies to legacy single-metric mode
    if (!useFormula && (state.metric.type === 'latest' || state.metric.type === 'first')) {
      // Compute the appropriate bucket from the metric result series
      if (metricResult.series && metricResult.series.length > 0) {
        if (state.metric.type === 'latest') {
          // Always select the last bucket for "latest" metrics
          dateStr = metricResult.series[metricResult.series.length - 1].date;
        } else if (state.metric.type === 'first') {
          // Always select the first bucket for "first" metrics
          dateStr = metricResult.series[0].date;
        }
      }
    }

    // Parse date in local time to avoid timezone shifts
    // For "2025-11-02", create Nov 2 at midnight local time (not UTC)
    const parts = dateStr.split('-');
    const bucketDate = parts.length === 3
      ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
      : new Date(dateStr);
    
    if (isNaN(bucketDate.getTime())) {
      console.error('[ChartPanel] Invalid date:', dateStr);
      return;
    }

    const { start, end } = getBucketRange(bucketDate, state.granularity);
    dispatch(actions.setSelectedBucket(start, end, dateStr));
  }, [useFormula, state.metric.type, state.granularity, metricResult.series, dispatch]);

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

        // Compute actual metric for previous period using formula system
        const prevResult = useFormula
          ? computeFormula({
              formula: state.metricFormula,
              start: shiftedStart.toISOString().split('T')[0],
              end: shiftedEnd.toISOString().split('T')[0],
              granularity: state.granularity,
              store: warehouse,
              schema,
              selectedObjects: state.selectedObjects,
              selectedFields: state.selectedFields,
            }).result
          : computeMetric({
              def: state.metric,
              start: shiftedStart.toISOString().split('T')[0],
              end: shiftedEnd.toISOString().split('T')[0],
              granularity: state.granularity,
              store: warehouse,
              include: includeSet,
              schema,
              objects: state.selectedObjects,
            });

        return {
          key: state.report,
          label: 'Previous Period',
          points: prevResult.series || [],
        };
      }

      case 'previous_year': {
        const yearStart = new Date(state.start);
        yearStart.setFullYear(yearStart.getFullYear() - 1);
        const yearEnd = new Date(state.end);
        yearEnd.setFullYear(yearEnd.getFullYear() - 1);

        // Compute actual metric for previous year using formula system
        const prevYearResult = useFormula
          ? computeFormula({
              formula: state.metricFormula,
              start: yearStart.toISOString().split('T')[0],
              end: yearEnd.toISOString().split('T')[0],
              granularity: state.granularity,
              store: warehouse,
              schema,
              selectedObjects: state.selectedObjects,
              selectedFields: state.selectedFields,
            }).result
          : computeMetric({
              def: state.metric,
              start: yearStart.toISOString().split('T')[0],
              end: yearEnd.toISOString().split('T')[0],
              granularity: state.granularity,
              store: warehouse,
              include: includeSet,
              schema,
              objects: state.selectedObjects,
            });

        return {
          key: state.report,
          label: 'Previous Year',
          points: prevYearResult.series || [],
        };
      }

      case 'benchmarks':
        // Benchmarks not yet implemented
        return null;

      default:
        return null;
    }
  }, [series, state.chart.comparison, state.start, state.end, state.granularity, useFormula, state.metricFormula, warehouse, schema, state.selectedObjects, state.selectedFields, includeSet, state.metric]);

  // Get value kind from metric result (must be declared before chartData)
  const valueKind = metricResult.kind || 'number';

  // Format chart data for Recharts - merge current and comparison series
  // IMPORTANT: Convert currency values from pennies to dollars for chart rendering
  const chartData = useMemo(() => {
    // If grouping is active, prepare data with all groups
    if (groupedMetrics) {
      const allDates = series.points.map(p => p.date);
      
      return allDates.map((date, index) => {
        const dataPoint: any = { date };
        
        // Add comparison if present (for ungrouped baseline)
        const comparisonPoint = comparisonSeries?.points[index];
        if (comparisonPoint && comparisonPoint.value !== null && comparisonPoint.value !== undefined) {
          dataPoint.comparison = valueKind === 'currency' ? comparisonPoint.value / 100 : comparisonPoint.value;
        }
        
        // Add each group's value
        for (const [groupValue, groupResult] of groupedMetrics.entries()) {
          if (groupResult.series && groupResult.series[index]) {
            const value = groupResult.series[index].value;
            dataPoint[groupValue] = valueKind === 'currency' ? value / 100 : value;
          } else {
            dataPoint[groupValue] = 0;
          }
        }
        
        return dataPoint;
      });
    }
    
    // Regular ungrouped data
    const data = series.points.map((point, index) => {
      const currentValue = valueKind === 'currency' ? point.value / 100 : point.value;
      
      // Check if comparison value exists (including 0, but excluding null/undefined)
      const comparisonPoint = comparisonSeries?.points[index];
      const comparisonValue = comparisonPoint && comparisonPoint.value !== null && comparisonPoint.value !== undefined
        ? (valueKind === 'currency' ? comparisonPoint.value / 100 : comparisonPoint.value)
        : undefined;
      
      return {
        date: point.date,
        current: currentValue,
        comparison: comparisonValue,
      };
    });
    return data;
  }, [series, comparisonSeries, valueKind, groupedMetrics]);

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

  // Track chart loading based on data readiness
  useEffect(() => {
    if (chartData.length > 0) {
      // Start loading when we begin rendering
      dispatch(actions.startComponentLoading('chart'));
      
      // Chart data is computed and ready to render
      // Longer delay to account for Recharts rendering (2-3 seconds for complex charts)
      const timer = setTimeout(() => {
        dispatch(actions.finishComponentLoading('chart'));
      }, 3000);
      
      return () => {
        clearTimeout(timer);
        // Don't call finishComponentLoading in cleanup - let the timeout handle it
        // Otherwise cleanup fires on re-render and finishes loading prematurely
      };
    }
  }, [chartData.length, groupedMetrics?.size, dispatch]);

  // Format number for display based on value kind (compact for chart axes)
  // Note: Values are already converted to dollars in chartData, so we format directly
  const formatValue = (value: number) => {
    if (valueKind === 'currency') {
      // Value is already in dollars, not pennies
      if (Math.abs(value) >= 1_000_000) {
        return `$${(value / 1_000_000).toFixed(2)}M`;
      } else if (Math.abs(value) >= 1_000) {
        return `$${(value / 1_000).toFixed(1)}K`;
      }
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } else if (metricResult.unitType === 'rate') {
      // For rates, display as percentage with 2 decimal places
      return `${(value * 100).toFixed(2)}%`;
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
  // Note: Values are already converted to dollars in chartData, so we format directly
  const formatTooltipValue = (value: number) => {
    if (valueKind === 'currency') {
      // Value is already in dollars, not pennies
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } else if (metricResult.unitType === 'rate') {
      // For rates, display as percentage with 2 decimal places
      return `${(value * 100).toFixed(2)}%`;
    } else {
      return value.toLocaleString();
    }
  };

  // Format tooltip date label based on granularity
  const formatTooltipDate = (dateString: string) => {
    const date = new Date(dateString);
    
    switch (state.granularity) {
      case 'year':
        return date.getFullYear().toString();
      
      case 'month':
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      case 'week': {
        // For week, show the date range like "Aug 2-8, 2025"
        const { start, end } = getBucketRange(date, 'week');
        const startDate = new Date(start);
        const endDate = new Date(end);
        // Subtract 1 day from end because getBucketRange returns exclusive end date
        endDate.setDate(endDate.getDate() - 1);
        
        // If same month, show "Aug 2-8, 2025"
        if (startDate.getMonth() === endDate.getMonth()) {
          return `${startDate.toLocaleDateString('en-US', { month: 'short' })} ${startDate.getDate()}-${endDate.getDate()}, ${startDate.getFullYear()}`;
        } else {
          // If different months, show "Aug 30-Sep 5, 2025"
          return `${startDate.toLocaleDateString('en-US', { month: 'short' })} ${startDate.getDate()}-${endDate.toLocaleDateString('en-US', { month: 'short' })} ${endDate.getDate()}, ${endDate.getFullYear()}`;
        }
      }
      
      case 'day':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      
      case 'quarter': {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `Q${quarter} ${date.getFullYear()}`;
      }
      
      default:
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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
  const [isEditingPresets, setIsEditingPresets] = useState(false);
  const [activePresets, setActivePresets] = useState<string[]>(['1D', '1W', '1M', '3M', '1Y', 'YTD']);
  const dateRangeButtonRef = useRef<HTMLButtonElement>(null);
  const dateRangePopoverRef = useRef<HTMLDivElement>(null);
  const dateCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Group By state
  const [isGroupByFieldSelectorOpen, setIsGroupByFieldSelectorOpen] = useState(false);
  const [isGroupByValueSelectorOpen, setIsGroupByValueSelectorOpen] = useState(false);
  const groupByButtonRef = useRef<HTMLButtonElement>(null);
  const groupByPopoverRef = useRef<HTMLDivElement>(null);

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
      setIsEditingPresets(false); // Reset edit mode when closing
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

  // Handlers for preset editing
  const handleRemovePreset = (label: string) => {
    setActivePresets(prev => prev.filter(p => p !== label));
  };

  const handleAddPreset = (label: string) => {
    setActivePresets(prev => [...prev, label]);
  };

  const handleReorderPresets = (startIndex: number, endIndex: number) => {
    const result = Array.from(activePresets);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    setActivePresets(result);
  };

  // Get available presets for adding (those not currently active)
  const availablePresetsToAdd = rangePresets
    .filter(p => !activePresets.includes(p.label))
    .concat(moreRangeOptions.filter(p => !activePresets.includes(p.code)).map(p => ({ label: p.code, getValue: p.getValue })));

  // Group By: Get available fields
  const availableGroupFields = useMemo(() => {
    return getAvailableGroupFields(state.selectedObjects, schema);
  }, [state.selectedObjects]);

  // Group By: Get available values for selected field
  const availableGroupValues = useMemo(() => {
    if (!state.groupBy) return [];
    return getGroupValues(warehouse, state.groupBy.field, 100);
  }, [state.groupBy?.field, version]);

  // Handle click outside to close group by popovers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        groupByButtonRef.current && 
        !groupByButtonRef.current.contains(event.target as Node) &&
        groupByPopoverRef.current &&
        !groupByPopoverRef.current.contains(event.target as Node)
      ) {
        setIsGroupByFieldSelectorOpen(false);
        setIsGroupByValueSelectorOpen(false);
      }
    };

    if (isGroupByFieldSelectorOpen || isGroupByValueSelectorOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isGroupByFieldSelectorOpen, isGroupByValueSelectorOpen]);

  return (
    <div className="flex flex-col h-full">
      {/* Metric Header */}
      <MetricHeader />

      {/* Controls */}
      <div className="flex items-center gap-2 mt-10">
        {/* Date Range Control */}
        <div className="relative inline-flex items-center">
          <div className="flex items-center gap-2 px-1" style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '50px', height: '32px' }}>
        {/* Range presets - use activePresets order */}
          {activePresets.map((presetLabel) => {
            const preset = rangePresets.find(p => p.label === presetLabel) ||
                          moreRangeOptions.find(p => p.code === presetLabel);
            if (!preset) return null;
            
            const range = preset.getValue();
            const isSelected = state.start === range.start && state.end === range.end;
            const displayLabel = ('code' in preset ? preset.code : preset.label) as string;
            
            return (
              <button
                key={presetLabel}
                onClick={() => {
                  dispatch(actions.setRange(range.start, range.end));
                }}
                  className="px-3 text-sm font-medium transition-colors focus:outline-none flex items-center"
                  style={{
                    backgroundColor: isSelected ? 'var(--bg-active)' : 'transparent',
                    borderRadius: '50px',
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                    height: '24px',
                    cursor: 'pointer',
                  }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-active)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
                aria-label={`Set date range to ${displayLabel}`}
                aria-pressed={isSelected}
              >
                {displayLabel}
              </button>
            );
          })}
            
            {/* Divider */}
            <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-subtle)' }} />
            
            {/* Chevron button for popover */}
            <button
              ref={dateRangeButtonRef}
              onClick={() => setIsDateRangePopoverOpen(!isDateRangePopoverOpen)}
              className="flex items-center justify-center border-none focus:outline-none cursor-pointer transition-colors"
              style={{
                backgroundColor: isDateRangePopoverOpen ? 'var(--bg-active)' : 'transparent',
                borderRadius: '50px',
                width: '24px',
                height: '24px',
              }}
              onMouseEnter={(e) => {
                if (!isDateRangePopoverOpen) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-active)';
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
              className="absolute py-1 z-50"
              style={{
                top: '44px',
                right: '-108px',
                borderRadius: '16px',
                boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
                width: '248px',
                opacity: datePopoverOpacity,
                transition: 'opacity 100ms ease-in-out',
                backgroundColor: 'var(--bg-elevated)'
              }}
            >
              {/* Header with Edit/Done button */}
              <div className="flex items-center justify-between py-2" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
                <span className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Preset list
                </span>
                {isEditingPresets ? (
                  <button
                    onClick={() => setIsEditingPresets(false)}
                    className="text-sm font-semibold transition-colors"
                    style={{ color: 'var(--text-link)', fontWeight: 600 }}
                  >
                    Done
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditingPresets(true)}
                    className="flex items-center justify-center transition-colors"
                    style={{ padding: '4px' }}
                    aria-label="Edit presets"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M0.975123 7.87492C0.991235 7.63323 1.09452 7.40561 1.2658 7.23433L7.43946 1.06068C8.02524 0.474891 8.97499 0.474891 9.56078 1.06068L10.9395 2.43936C11.5252 3.02514 11.5252 3.97489 10.9395 4.56068L4.7658 10.7343C4.59452 10.9056 4.3669 11.0089 4.12521 11.025L1.0352 11.231C0.884277 11.2411 0.75906 11.1159 0.769122 10.9649L0.975123 7.87492ZM2.36083 9.63931L2.4593 8.16215L6.53043 4.09102L7.90911 5.4697L3.83798 9.54083L2.36083 9.63931ZM8.96977 4.40904L9.8788 3.50002L8.50012 2.12134L7.59109 3.03036L8.96977 4.40904Z" fill="var(--text-muted)"/>
                    </svg>
                  </button>
                )}
              </div>

              {showGranularityOptions ? (
                /* Change Granularity View */
                <>
                  {/* Change granularity label */}
                  <div className="py-2 text-xs" style={{ paddingLeft: '16px', paddingRight: '16px', color: 'var(--text-muted)', fontWeight: 400 }}>
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
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        height: '32px',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <span>{option.charAt(0).toUpperCase() + option.slice(1)}</span>
                      {state.granularity === option && (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="8" cy="8" r="8" fill="var(--text-primary)"/>
                          <path d="M11 5.5L7 10L5 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {/* Granularity Section - hide when editing */}
                  {!isEditingPresets && (
                    <div>
                      {/* Granularity label - not clickable */}
                      <div className="py-2 text-xs" style={{ paddingLeft: '16px', paddingRight: '16px', color: 'var(--text-muted)', fontWeight: 400 }}>
                        Granularity
                      </div>
                      
                      {/* Current granularity - clickable to toggle view */}
                      <button
                        onClick={() => setShowGranularityOptions(true)}
                        className="w-full text-left py-2 text-sm transition-colors flex items-center justify-between"
                        style={{
                          paddingLeft: '16px',
                          paddingRight: '16px',
                          color: 'var(--text-primary)',
                          fontWeight: 600,
                          height: '32px',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
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
                  )}

                  {/* Preset List */}
                  <div className="py-2 text-xs" style={{ paddingLeft: '16px', paddingRight: '16px', color: 'var(--text-muted)', fontWeight: 400 }}>
                    Preset list
                  </div>
                  
                  {isEditingPresets ? (
                    /* Edit Mode */
                    <>
                      {activePresets.map((presetLabel, index) => {
                        const preset = rangePresets.find(p => p.label === presetLabel) || 
                                      moreRangeOptions.find(p => p.code === presetLabel);
                        if (!preset) return null;
                        
                        const displayLabel = ('code' in preset ? preset.code : preset.label) as string;
                        const displayName = ('code' in preset ? preset.label : (
                          presetLabel === '1D' ? 'Last 24 hours' :
                          presetLabel === '1W' ? 'Last week' :
                          presetLabel === '1M' ? 'Last 4 weeks' :
                          presetLabel === '3M' ? 'Last 3 months' :
                          presetLabel === '1Y' ? 'Last 12 months' :
                          presetLabel === 'YTD' ? 'Year to date' : presetLabel
                        )) as string;

                        return (
                          <div
                            key={presetLabel}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', index.toString());
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                              if (fromIndex !== index) {
                                handleReorderPresets(fromIndex, index);
                              }
                            }}
                            className="w-full text-left py-2 text-sm flex items-center justify-between"
                            style={{
                              paddingLeft: '16px',
                              paddingRight: '16px',
                              color: 'var(--text-primary)',
                              fontWeight: 600,
                              height: '32px',
                            }}
                          >
                            <div className="flex items-center gap-2">
                              {/* Drag handle */}
                              <div className="flex flex-col gap-0.5" style={{ cursor: 'grab' }}>
                                <div className="flex gap-0.5">
                                  <div style={{ width: '2px', height: '2px', backgroundColor: 'var(--chart-axis)', borderRadius: '50%' }} />
                                  <div style={{ width: '2px', height: '2px', backgroundColor: 'var(--chart-axis)', borderRadius: '50%' }} />
                                </div>
                                <div className="flex gap-0.5">
                                  <div style={{ width: '2px', height: '2px', backgroundColor: 'var(--chart-axis)', borderRadius: '50%' }} />
                                  <div style={{ width: '2px', height: '2px', backgroundColor: 'var(--chart-axis)', borderRadius: '50%' }} />
                                </div>
                                <div className="flex gap-0.5">
                                  <div style={{ width: '2px', height: '2px', backgroundColor: 'var(--chart-axis)', borderRadius: '50%' }} />
                                  <div style={{ width: '2px', height: '2px', backgroundColor: 'var(--chart-axis)', borderRadius: '50%' }} />
                                </div>
                              </div>
                              <span
                                className="flex items-center justify-center text-xs"
                                style={{
                                  minWidth: '42px',
                                  height: '24px',
                                  backgroundColor: 'transparent',
                                  borderRadius: '50px',
                                  color: 'var(--text-muted)',
                                  fontWeight: 400,
                                }}
                              >
                                {displayLabel}
                              </span>
                              <span>{displayName}</span>
                            </div>
                            {/* Minus button */}
                            <button
                              onClick={() => handleRemovePreset(presetLabel)}
                              className="flex items-center justify-center transition-colors"
                              style={{ padding: '4px' }}
                              aria-label={`Remove ${displayName}`}
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="8" cy="8" r="8" fill="#DC2626" stroke="#DC2626" strokeWidth="1.5"/>
                                <path d="M5 8H11" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    /* Normal Mode */
                    <>
                      {activePresets.map((presetLabel) => {
                        const preset = rangePresets.find(p => p.label === presetLabel) ||
                                      moreRangeOptions.find(p => p.code === presetLabel);
                        if (!preset) return null;
                        
                        const range = preset.getValue();
                        const isSelected = state.start === range.start && state.end === range.end;
                        const displayLabel = ('code' in preset ? preset.code : preset.label) as string;
                        const displayName = ('code' in preset ? preset.label : (
                          presetLabel === '1D' ? 'Last 24 hours' :
                          presetLabel === '1W' ? 'Last week' :
                          presetLabel === '1M' ? 'Last 4 weeks' :
                          presetLabel === '3M' ? 'Last 3 months' :
                          presetLabel === '1Y' ? 'Last 12 months' :
                          presetLabel === 'YTD' ? 'Year to date' : presetLabel
                        )) as string;

                        return (
                          <button
                            key={presetLabel}
                            onClick={() => {
                              dispatch(actions.setRange(range.start, range.end));
                              setIsDateRangePopoverOpen(false);
                            }}
                            className="w-full text-left py-2 text-sm transition-colors flex items-center justify-between"
                            style={{
                              paddingLeft: '16px',
                              paddingRight: '16px',
                              color: 'var(--text-primary)',
                              fontWeight: 600,
                              height: '32px',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="flex items-center justify-center text-xs"
                                style={{
                                  minWidth: '42px',
                                  height: '24px',
                                  backgroundColor: isSelected ? 'var(--bg-surface)' : 'transparent',
                                  borderRadius: '50px',
                                  color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                                  fontWeight: isSelected ? 600 : 400,
                                }}
                              >
                                {displayLabel}
                              </span>
                              <span>{displayName}</span>
                            </div>
                            {isSelected && (
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="8" cy="8" r="8" fill="var(--text-primary)"/>
                                <path d="M11 5.5L7 10L5 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </>
                  )}

                  {/* More Section */}
                  <div className="py-2 text-xs border-t border-gray-100" style={{ paddingLeft: '16px', paddingRight: '16px', color: 'var(--text-muted)', fontWeight: 400 }}>
                    More
                  </div>
                  
                  {isEditingPresets ? (
                    /* Edit Mode - Show all options with add/remove buttons */
                    <>
                      {[...rangePresets, ...moreRangeOptions.map(m => ({ label: m.code, getValue: m.getValue }))].map((preset) => {
                        const presetLabel = ('code' in preset ? preset.code : preset.label) as string;
                        const isActive = activePresets.includes(presetLabel);
                        
                        const displayLabel = presetLabel;
                        const displayName = (moreRangeOptions.find(m => m.code === presetLabel)?.label || (
                          presetLabel === '1D' ? 'Last 24 hours' :
                          presetLabel === '1W' ? 'Last week' :
                          presetLabel === '1M' ? 'Last 4 weeks' :
                          presetLabel === '3M' ? 'Last 3 months' :
                          presetLabel === '1Y' ? 'Last 12 months' :
                          presetLabel === 'YTD' ? 'Year to date' : presetLabel
                        )) as string;

                        // Don't show if it's in the active list
                        if (isActive) return null;

                        return (
                          <div
                            key={presetLabel}
                            className="w-full text-left py-2 text-sm flex items-center justify-between"
                            style={{
                              paddingLeft: '16px',
                              paddingRight: '16px',
                              color: 'var(--text-primary)',
                              fontWeight: 600,
                              height: '32px',
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="flex items-center justify-center text-xs"
                                style={{
                                  minWidth: '42px',
                                  height: '24px',
                                  backgroundColor: 'transparent',
                                  borderRadius: '50px',
                                  color: 'var(--text-muted)',
                                  fontWeight: 400,
                                }}
                              >
                                {displayLabel}
                              </span>
                              <span>{displayName}</span>
                            </div>
                            {/* Plus button */}
                            <button
                              onClick={() => handleAddPreset(presetLabel)}
                              className="flex items-center justify-center transition-colors"
                              style={{ padding: '4px' }}
                              aria-label={`Add ${displayName}`}
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="8" cy="8" r="8" fill="#635BFF" stroke="#635BFF" strokeWidth="1.5"/>
                                <path d="M8 5V11M5 8H11" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    /* Normal Mode - Show all options */
                    <>
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
                              color: 'var(--text-primary)',
                              fontWeight: 600,
                              height: '32px',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
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
                                <circle cx="8" cy="8" r="8" fill="var(--text-primary)"/>
                                <path d="M11 5.5L7 10L5 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </>
                  )}
                  
                  {/* Custom option - only show when not editing */}
                  {!isEditingPresets && (
                    <button
                      className="w-full text-left py-2 text-sm transition-colors flex items-center justify-between"
                      style={{
                        paddingLeft: '16px',
                        paddingRight: '16px',
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        height: '32px',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
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
                  )}
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
              backgroundColor: 'var(--bg-surface)',
              color: isComparisonSelected ? 'var(--text-primary)' : 'var(--text-muted)',
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
                <path d="M6.5625 3.1875C6.5625 2.87684 6.31066 2.625 6 2.625C5.68934 2.625 5.4375 2.87684 5.4375 3.1875V5.4375H3.1875C2.87684 5.4375 2.625 5.68934 2.625 6C2.625 6.31066 2.87684 6.5625 3.1875 6.5625H5.4375V8.8125C5.4375 9.12316 5.68934 9.375 6 9.375C6.31066 9.375 6.5625 9.12316 6.5625 8.8125V6.5625H8.8125C9.12316 6.5625 9.375 6.31066 9.375 6C9.375 5.68934 9.12316 5.4375 8.8125 5.4375H6.5625V3.1875Z" fill="var(--text-muted)"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M12 5.99999C12 9.31404 9.31405 12 6 12C2.68595 12 0 9.31404 0 5.99999C0 2.68595 2.68595 0 6 0C9.32231 0 12 2.68595 12 5.99999ZM10.875 5.99999C10.875 8.69272 8.69272 10.875 6 10.875C3.30728 10.875 1.125 8.69272 1.125 5.99999C1.125 3.30727 3.30727 1.125 6 1.125C8.69998 1.125 10.875 3.30626 10.875 5.99999Z" fill="var(--text-muted)"/>
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
              className="absolute py-1 z-50"
              style={{
                top: 0,
                left: 0,
                borderRadius: '16px',
                boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
                width: isComparisonSelected ? '248px' : 'auto',
                opacity: popoverOpacity,
                transition: 'opacity 100ms ease-in-out',
                backgroundColor: 'var(--bg-elevated)'
              }}
            >
              {/* Current selection label */}
              {isComparisonSelected && (
                <div className="py-2 text-sm" style={{ paddingLeft: '16px', paddingRight: '16px', color: 'var(--text-primary)', fontWeight: 400 }}>
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
                  className="w-full text-left py-2 text-sm transition-colors flex items-center gap-4"
                  style={{
                    paddingLeft: '16px',
                    paddingRight: '16px',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span>{option.label}</span>
                  {state.chart.comparison === option.value && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="8" cy="8" r="8" fill="var(--text-primary)"/>
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
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '50px',
              color: 'var(--text-muted)',
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

        {/* Group By Control */}
        <div className="relative inline-flex items-center">
          <button
            ref={groupByButtonRef}
            onClick={() => {
              if (!state.groupBy) {
                // Open field selector
                setIsGroupByFieldSelectorOpen(true);
              } else {
                // Open value selector
                setIsGroupByValueSelectorOpen(true);
              }
            }}
            className="text-sm border-none focus:outline-none cursor-pointer flex items-center transition-colors gap-2"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: state.groupBy ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: 400,
              borderRadius: '50px',
              padding: '6px 12px',
              height: '32px',
              whiteSpace: 'nowrap',
            }}
          >
            {!state.groupBy && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.5625 3.1875C6.5625 2.87684 6.31066 2.625 6 2.625C5.68934 2.625 5.4375 2.87684 5.4375 3.1875V5.4375H3.1875C2.87684 5.4375 2.625 5.68934 2.625 6C2.625 6.31066 2.87684 6.5625 3.1875 6.5625H5.4375V8.8125C5.4375 9.12316 5.68934 9.375 6 9.375C6.31066 9.375 6.5625 9.12316 6.5625 8.8125V6.5625H8.8125C9.12316 6.5625 9.375 6.31066 9.375 6C9.375 5.68934 9.12316 5.4375 8.8125 5.4375H6.5625V3.1875Z" fill="var(--text-muted)"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M12 5.99999C12 9.31404 9.31405 12 6 12C2.68595 12 0 9.31404 0 5.99999C0 2.68595 2.68595 0 6 0C9.32231 0 12 2.68595 12 5.99999ZM10.875 5.99999C10.875 8.69272 8.69272 10.875 6 10.875C3.30728 10.875 1.125 8.69272 1.125 5.99999C1.125 3.30727 3.30727 1.125 6 1.125C8.69998 1.125 10.875 3.30626 10.875 5.99999Z" fill="var(--text-muted)"/>
              </svg>
            )}
            <span>
              {state.groupBy 
                ? `${schema.objects.find(o => o.name === state.groupBy.field.object)?.label}.${schema.objects.find(o => o.name === state.groupBy.field.object)?.fields.find(f => f.name === state.groupBy.field.field)?.label} (${state.groupBy.selectedValues.length})`
                : 'Group by'}
            </span>
            {state.groupBy && (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 3L4 5L6 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>

          {/* Field Selector Popover */}
          {isGroupByFieldSelectorOpen && (
            <div
              ref={groupByPopoverRef}
              className="absolute z-50"
              style={{
                top: '40px',
                left: 0,
                minWidth: '200px',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-medium)',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                padding: '8px',
              }}
            >
              {availableGroupFields.length === 0 ? (
                <div className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  No categorical fields available
                </div>
              ) : (
                availableGroupFields.map((field) => (
                  <button
                    key={`${field.object}.${field.field}`}
                    onClick={() => {
                      // Get top 10 values for this field
                      const values = getGroupValues(warehouse, { object: field.object, field: field.field }, 10);
                      
                      dispatch(actions.setGroupBy({
                        field: { object: field.object, field: field.field },
                        selectedValues: values,
                        autoAddedField: false,
                      }));
                      
                      setIsGroupByFieldSelectorOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm transition-colors"
                    style={{
                      borderRadius: '4px',
                      color: 'var(--text-primary)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {field.label}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Value Selector Popover */}
          {isGroupByValueSelectorOpen && state.groupBy && (
            <div
              ref={groupByPopoverRef}
              className="absolute z-50"
              style={{
                top: '40px',
                left: 0,
              }}
            >
              <GroupBySelector
                availableValues={availableGroupValues}
                selectedValues={state.groupBy.selectedValues}
                onApply={(selectedValues) => {
                  dispatch(actions.updateGroupValues(selectedValues));
                  setIsGroupByValueSelectorOpen(false);
                }}
                onCancel={() => {
                  setIsGroupByValueSelectorOpen(false);
                }}
                maxSelections={10}
              />
            </div>
          )}

          {/* Clear button - show when grouping is active */}
          {state.groupBy && (
            <button
              onClick={() => {
                dispatch(actions.clearGroupBy());
              }}
              className="ml-2 flex items-center justify-center transition-colors"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: '50px',
                color: 'var(--text-muted)',
                width: '32px',
                height: '32px',
              }}
              aria-label="Clear grouping"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Warnings */}
        {!validation.valid && validation.warning && (
        <div className="mt-3 text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1" role="alert">
            ⚠️ {validation.warning}
          </div>
        )}

      {/* Chart and Table Container */}
      <div className="mt-3 p-2" style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
        {metricResult.series === null || (useFormula ? !state.metricFormula.blocks.some(b => b.source) : !state.metric.source) ? (
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
            <div className="focus:outline-none" style={{ height: '280px', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px', paddingTop: '8px', paddingLeft: '8px' }}>
          <ResponsiveContainer width="100%" height="100%">
          {state.chart.type === 'line' && (
            <LineChart data={chartData} onMouseMove={(data: any) => {
              if (data && data.activeLabel) {
                dispatch(actions.setHoveredBucket(data.activeLabel));
              }
            }} onMouseLeave={() => {
              dispatch(actions.clearHoveredBucket());
            }}>
                    <CartesianGrid 
                      horizontal={true} 
                      vertical={false}
                      stroke="var(--chart-grid)"
                      strokeDasharray="2 2"
                      strokeOpacity={0.5}
                    />
              <XAxis
                dataKey="date"
                      tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
                      stroke="none"
                      axisLine={{ stroke: 'var(--border-subtle)' }}
                      ticks={xAxisTicks}
                tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                }}
              />
              <YAxis
                      tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
                      stroke="none"
                      axisLine={false}
                tickFormatter={formatValue}
                      orientation="right"
              />
              <Tooltip
                cursor={{ stroke: 'var(--border-medium)', strokeWidth: 1, strokeDasharray: '4 4' }}
                contentStyle={{
                  backgroundColor: 'var(--chart-tooltip-bg)',
                  border: '1px solid var(--chart-tooltip-border)',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
                labelFormatter={formatTooltipDate}
                formatter={(value: any) => {
                  if (typeof value === 'number') {
                          return formatTooltipValue(value);
                  }
                  return value;
                }}
              />
              {/* Render grouped lines or single line */}
              {groupedMetrics ? (
                // Render a line for each group
                Array.from(groupedMetrics.keys()).map((groupValue, idx) => {
                  const colors = [
                    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
                    '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#84cc16'
                  ];
                  const color = colors[idx % colors.length];
                  
                  return (
                    <Line
                      key={groupValue}
                      type="linear"
                      dataKey={groupValue}
                      name={groupValue}
                      stroke={color}
                      strokeWidth={2}
                      isAnimationActive={false}
                      dot={(props: any) => {
                        // Respect aggregation basis for grouped metrics (same logic as ungrouped)
                        const isSelected = state.selectedBucket?.label === props.payload.date;
                        const isHovered = state.hoveredBucket === props.payload.date && state.hoveredGroup === groupValue;
                        const index = props.index;
                        
                        // For "latest" metrics, only show dot on last bucket
                        if (state.metric.type === 'latest' && index !== chartData.length - 1) {
                          return null;
                        }
                        
                        // For "first" metrics, only show dot on first bucket
                        if (state.metric.type === 'first' && index !== 0) {
                          return null;
                        }
                        
                        // Show dot with click handler
                        return (
                          <circle
                            key={`${groupValue}-${index}`}
                            cx={props.cx}
                            cy={props.cy}
                            r={isSelected ? 5 : isHovered ? 4.5 : 4}
                            fill={color}
                            stroke="white"
                            strokeWidth={isSelected ? 2 : 0}
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={() => {
                              dispatch(actions.setHoveredBucket(props.payload.date));
                              dispatch(actions.setHoveredGroup(groupValue));
                            }}
                            onMouseLeave={() => {
                              dispatch(actions.clearHoveredBucket());
                              dispatch(actions.clearHoveredGroup());
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Apply both bucket and group filters
                              const dateStr = props.payload.date;
                              const parts = dateStr.split('-');
                              const bucketDate = parts.length === 2
                                ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1)
                                : new Date(dateStr);
                              
                              const { start, end } = getBucketRange(bucketDate, state.granularity);
                              dispatch(actions.setSelectedBucket(start, end, dateStr));
                              
                              // Add filter for the group value
                              if (state.groupBy) {
                                dispatch(actions.addFilter({
                                  field: state.groupBy.field,
                                  operator: 'equals',
                                  value: groupValue,
                                }));
                              }
                            }}
                          />
                        );
                      }}
                      activeDot={{ r: 5, style: { cursor: 'pointer' } }}
                    />
                  );
                })
              ) : (
                // Regular single line
                <Line
                  type="linear"
                  dataKey="current"
                  name={series.label}
                        stroke="var(--chart-line-primary)"
                        strokeWidth={2.5}
                        isAnimationActive={false}
                  dot={(props: any) => {
                    const isSelected = state.selectedBucket?.label === props.payload.date;
                    const isHovered = state.hoveredBucket === props.payload.date;
                    const { key, ...dotProps } = props;
                          
                          // For latest/first value metrics, only show dot on the relevant bucket
                          // Use formula block type if available, otherwise fall back to legacy metric type
                          const metricType = useFormula && state.metricFormula.blocks.length > 0
                            ? state.metricFormula.blocks[0].type
                            : state.metric.type;
                          
                          const shouldShowDot = 
                            metricType === 'sum_over_period' || 
                            metricType === 'average_over_period' ||
                            (metricType === 'latest' && props.index === chartData.length - 1) ||
                            (metricType === 'first' && props.index === 0);
                          
                          if (!shouldShowDot && !isSelected && !isHovered) {
                            return <g key={key} />;
                          }
                          
                    return (
                      <Dot
                        key={key}
                        {...dotProps}
                              r={isSelected ? 6 : isHovered ? 5 : 4}
                              fill={isSelected ? 'var(--chart-line-primary)' : isHovered ? 'var(--chart-line-primary)' : 'var(--chart-line-primary)'}
                        stroke={isSelected ? 'var(--bg-elevated)' : 'none'}
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
              )}
              {comparisonSeries && !groupedMetrics && (
                <Line
                        type="linear"
                  dataKey="comparison"
                  name={comparisonSeries.label}
                        stroke="var(--chart-line-secondary)"
                  strokeWidth={2}
                        strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          )}

          {state.chart.type === 'area' && (
            <AreaChart data={chartData} onMouseMove={(data: any) => {
              if (data && data.activeLabel) {
                dispatch(actions.setHoveredBucket(data.activeLabel));
              }
            }} onMouseLeave={() => {
              dispatch(actions.clearHoveredBucket());
            }}>
                    <CartesianGrid 
                      horizontal={true} 
                      vertical={false}
                      stroke="var(--chart-grid)"
                      strokeDasharray="2 2"
                      strokeOpacity={0.5}
                    />
              <XAxis
                dataKey="date"
                      tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
                      stroke="none"
                      axisLine={{ stroke: 'var(--border-subtle)' }}
                      ticks={xAxisTicks}
                tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                }}
              />
              <YAxis
                      tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
                      stroke="none"
                      axisLine={false}
                tickFormatter={formatValue}
                      orientation="right"
              />
              <Tooltip
                cursor={{ stroke: 'var(--border-medium)', strokeWidth: 1, strokeDasharray: '4 4' }}
                contentStyle={{
                  backgroundColor: 'var(--chart-tooltip-bg)',
                  border: '1px solid var(--chart-tooltip-border)',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
                labelFormatter={formatTooltipDate}
                formatter={(value: any) => {
                  if (typeof value === 'number') {
                          return formatTooltipValue(value);
                  }
                  return value;
                }}
              />
              {comparisonSeries && !groupedMetrics && (
                <Area
                  type="monotone"
                  dataKey="comparison"
                  name={comparisonSeries.label}
                      fill="var(--chart-area-fill-secondary)"
                      fillOpacity={0.2}
                        stroke="var(--chart-line-secondary)"
                  strokeWidth={2}
                        strokeDasharray="4 4"
                  isAnimationActive={false}
                />
              )}
              {/* Render grouped areas or single area */}
              {groupedMetrics ? (
                // Render an area for each group (stacked)
                Array.from(groupedMetrics.keys()).map((groupValue, idx) => {
                  const colors = [
                    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
                    '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#84cc16'
                  ];
                  const color = colors[idx % colors.length];
                  
                  return (
                    <Area
                      key={groupValue}
                      type="monotone"
                      dataKey={groupValue}
                      name={groupValue}
                      fill={color}
                      fillOpacity={0.3}
                      stroke={color}
                      strokeWidth={2}
                      isAnimationActive={false}
                      stackId="stack"
                      dot={(props: any) => {
                        // Respect aggregation basis for grouped metrics
                        const isSelected = state.selectedBucket?.label === props.payload.date;
                        const isHovered = state.hoveredBucket === props.payload.date && state.hoveredGroup === groupValue;
                        const index = props.index;
                        const { key, ...dotProps } = props;
                        
                        // For "latest" metrics, only show dot on last bucket
                        if (state.metric.type === 'latest' && index !== chartData.length - 1 && !isSelected && !isHovered) {
                          return <g key={key} />;
                        }
                        
                        // For "first" metrics, only show dot on first bucket
                        if (state.metric.type === 'first' && index !== 0 && !isSelected && !isHovered) {
                          return <g key={key} />;
                        }
                        
                        // Show dot
                        return (
                          <circle
                            key={key}
                            {...dotProps}
                            r={isSelected ? 5 : isHovered ? 4.5 : 4}
                            fill={color}
                            stroke="white"
                            strokeWidth={isSelected ? 2 : 0}
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={() => {
                              dispatch(actions.setHoveredBucket(props.payload.date));
                              dispatch(actions.setHoveredGroup(groupValue));
                            }}
                            onMouseLeave={() => {
                              dispatch(actions.clearHoveredBucket());
                              dispatch(actions.clearHoveredGroup());
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Apply both bucket and group filters
                              const dateStr = props.payload.date;
                              const parts = dateStr.split('-');
                              const bucketDate = parts.length === 2
                                ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1)
                                : new Date(dateStr);
                              
                              const { start, end } = getBucketRange(bucketDate, state.granularity);
                              dispatch(actions.setSelectedBucket(start, end, dateStr));
                              
                              // Add filter for the group value
                              if (state.groupBy) {
                                dispatch(actions.addFilter({
                                  field: state.groupBy.field,
                                  operator: 'equals',
                                  value: groupValue,
                                }));
                              }
                            }}
                          />
                        );
                      }}
                    />
                  );
                })
              ) : (
                // Regular single area
                <Area
                  type="monotone"
                  dataKey="current"
                  name={series.label}
                        fill="var(--chart-area-fill)"
                        fillOpacity={0.3}
                        stroke="var(--chart-line-primary)"
                        strokeWidth={2.5}
                        isAnimationActive={false}
                  dot={(props: any) => {
                    const isSelected = state.selectedBucket?.label === props.payload.date;
                    const isHovered = state.hoveredBucket === props.payload.date;
                    const { key, ...dotProps } = props;
                          
                          // For latest/first value metrics, only show dot on the relevant bucket
                          // Use formula block type if available, otherwise fall back to legacy metric type
                          const metricType = useFormula && state.metricFormula.blocks.length > 0
                            ? state.metricFormula.blocks[0].type
                            : state.metric.type;
                          
                          const shouldShowDot = 
                            metricType === 'sum_over_period' || 
                            metricType === 'average_over_period' ||
                            (metricType === 'latest' && props.index === chartData.length - 1) ||
                            (metricType === 'first' && props.index === 0);
                          
                          if (!shouldShowDot && !isSelected && !isHovered) {
                            return <g key={key} />;
                          }
                          
                    return (
                      <Dot
                        key={key}
                        {...dotProps}
                              r={isSelected ? 6 : isHovered ? 5 : 4}
                              fill={isSelected ? 'var(--chart-line-primary)' : isHovered ? 'var(--chart-line-primary)' : 'var(--chart-line-primary)'}
                        stroke={isSelected ? 'var(--bg-elevated)' : 'none'}
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
              )}
            </AreaChart>
          )}

          {state.chart.type === 'bar' && (
            <BarChart data={chartData} onMouseMove={(data: any) => {
              if (data && data.activeLabel) {
                dispatch(actions.setHoveredBucket(data.activeLabel));
              }
            }} onMouseLeave={() => {
              dispatch(actions.clearHoveredBucket());
            }}>
                    <CartesianGrid 
                      horizontal={true} 
                      vertical={false}
                      stroke="var(--chart-grid)"
                      strokeDasharray="2 2"
                      strokeOpacity={0.5}
                    />
              <XAxis
                dataKey="date"
                      tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
                      stroke="none"
                      axisLine={{ stroke: 'var(--border-subtle)' }}
                      ticks={xAxisTicks}
                tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                }}
              />
              <YAxis
                      tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
                      stroke="none"
                      axisLine={false}
                tickFormatter={formatValue}
                      orientation="right"
              />
              <Tooltip
                cursor={{ fill: 'var(--bg-surface)', opacity: 0.5 }}
                contentStyle={{
                  backgroundColor: 'var(--chart-tooltip-bg)',
                  border: '1px solid var(--chart-tooltip-border)',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
                labelFormatter={formatTooltipDate}
                formatter={(value: any) => {
                  if (typeof value === 'number') {
                          return formatTooltipValue(value);
                  }
                  return value;
                }}
              />
              {/* Render grouped bars (stacked) or single bar */}
              {groupedMetrics ? (
                // Render a bar for each group (stacked)
                Array.from(groupedMetrics.keys()).map((groupValue, idx) => {
                  const colors = [
                    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
                    '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#84cc16'
                  ];
                  const color = colors[idx % colors.length];
                  
                  return (
                    <Bar
                      key={groupValue}
                      dataKey={groupValue}
                      name={groupValue}
                      fill={color}
                      isAnimationActive={false}
                      stackId="stack"
                      shape={(props: any) => {
                        const { x, y, width, height, payload } = props;
                        const isSelected = state.selectedBucket?.label === payload.date;
                        const isHovered = state.hoveredBucket === payload.date && state.hoveredGroup === groupValue;
                        return (
                          <rect
                            x={x}
                            y={y}
                            width={width}
                            height={height}
                            fill={color}
                            fillOpacity={isHovered ? 0.8 : 1}
                            stroke={isSelected ? 'white' : 'none'}
                            strokeWidth={isSelected ? 2 : 0}
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={() => {
                              dispatch(actions.setHoveredBucket(payload.date));
                              dispatch(actions.setHoveredGroup(groupValue));
                            }}
                            onMouseLeave={() => {
                              dispatch(actions.clearHoveredBucket());
                              dispatch(actions.clearHoveredGroup());
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Apply both bucket and group filters
                              const dateStr = payload.date;
                              const parts = dateStr.split('-');
                              const bucketDate = parts.length === 2
                                ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1)
                                : new Date(dateStr);
                              
                              const { start, end } = getBucketRange(bucketDate, state.granularity);
                              dispatch(actions.setSelectedBucket(start, end, dateStr));
                              
                              // Add filter for the group value
                              if (state.groupBy) {
                                dispatch(actions.addFilter({
                                  field: state.groupBy.field,
                                  operator: 'equals',
                                  value: groupValue,
                                }));
                              }
                            }}
                          />
                        );
                      }}
                    />
                  );
                })
              ) : (
                // Regular single bar
                <Bar
                  dataKey="current"
                  name={series.label}
                        fill="var(--chart-line-primary)"
                        isAnimationActive={false}
                  shape={(props: any) => {
                    const { x, y, width, height, payload } = props;
                    const isSelected = state.selectedBucket?.label === payload.date;
                    const isHovered = state.hoveredBucket === payload.date;
                    return (
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                              fill={isSelected ? 'var(--chart-line-primary)' : isHovered ? 'var(--chart-line-primary)' : 'var(--chart-line-primary)'}
                        stroke={isSelected ? 'var(--bg-elevated)' : 'none'}
                        strokeWidth={isSelected ? 2 : 0}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handlePointClick(payload)}
                      />
                    );
                  }}
                />
              )}
              {comparisonSeries && !groupedMetrics && (
                <Bar
                  dataKey="comparison"
                  name={comparisonSeries.label}
                        fill="#9ca3af"
                  isAnimationActive={false}
                />
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
            </div>

            {/* Summary Table - Integrated ValueTable with full functionality */}
            <div className="mt-2 px-3" style={{ backgroundColor: 'var(--bg-elevated)', borderRadius: '8px' }}>
              <ValueTable />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
