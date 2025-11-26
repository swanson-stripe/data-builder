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
import { getAvailableGroupFields, getGroupValues, resolveFieldValue, createFilteredWarehouse, batchResolveFieldValues } from '@/lib/grouping';
import GroupBySelector from './GroupBySelector';
import { FieldFilter } from './FieldFilter';
import type { MetricResult, FilterCondition, SchemaField } from '@/types';
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
    if (!state.groupBy || state.groupBy.selectedValues.length === 0) {
      return null;
    }

    // Get the rows for the primary object
    const primaryObject = state.selectedObjects[0] || state.metricFormula.blocks[0]?.source?.object;
    if (!primaryObject) {
      return null;
    }

    const warehouseData = warehouse as Record<string, any[]>;
    const allRows = warehouseData[primaryObject];
    if (!Array.isArray(allRows)) {
      return null;
    }

    const groupBy = state.groupBy; // TypeScript narrowing

    // Batch resolve all field values at once (much faster than per-row lookups)
    const resolvedValues = batchResolveFieldValues(
      allRows,
      primaryObject,
      groupBy.field,
      warehouse
    );

    // Compute metric for each selected group
    const results = new Map<string, MetricResult>();
    
    for (const groupKey of groupBy.selectedValues) {
      // Filter rows for this group using pre-computed values
      const groupRows = allRows.filter(row => resolvedValues.get(row) === groupKey);

      // Create a filtered warehouse with all related tables filtered accordingly
      const groupWarehouse = createFilteredWarehouse(warehouse, primaryObject, groupRows);

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
        results.set(groupKey, result);
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
        results.set(groupKey, result);
      }
    }

    // Compute "other" group for all unselected values (using pre-computed values)
    const otherRows = allRows.filter(row => {
      const value = resolvedValues.get(row);
      if (value === null || value === undefined) return false;
      return !groupBy.selectedValues.includes(value);
    });

    if (otherRows.length > 0) {
      // Count how many unique "other" values there are (using pre-computed values)
      const otherValuesSet = new Set(
        otherRows.map(row => resolvedValues.get(row)).filter(v => v !== null)
      );
      const otherCount = otherValuesSet.size;

      // Create a filtered warehouse with all related tables filtered accordingly
      const otherWarehouse = createFilteredWarehouse(warehouse, primaryObject, otherRows);

      // Compute metric for "other" group
      if (useFormula) {
        const { result } = computeFormula({
          formula: state.metricFormula,
          start: state.start,
          end: state.end,
          granularity: state.granularity,
          store: otherWarehouse,
          schema,
          selectedObjects: state.selectedObjects,
          selectedFields: state.selectedFields,
        });
        // Store with special key that includes count
        results.set(`__other__${otherCount}`, result);
      } else {
        const result = computeMetric({
          def: state.metric,
          start: state.start,
          end: state.end,
          granularity: state.granularity,
          store: otherWarehouse,
          include: undefined,
          schema,
          objects: state.selectedObjects,
        });
        results.set(`__other__${otherCount}`, result);
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
        for (const [groupKey, groupResult] of groupedMetrics.entries()) {
          if (groupResult.series && groupResult.series[index]) {
            const value = groupResult.series[index].value;
            dataPoint[groupKey] = valueKind === 'currency' ? value / 100 : value;
          } else {
            dataPoint[groupKey] = 0;
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
  const [groupBySearchQuery, setGroupBySearchQuery] = useState('');
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const [groupPopoverMode, setGroupPopoverMode] = useState<'filter' | 'group'>('filter');
  const [activeFilterField, setActiveFilterField] = useState<string | null>(null);
  const [activeChipLabel, setActiveChipLabel] = useState<string>('');
  const groupByButtonRef = useRef<HTMLDivElement>(null);
  const groupByPopoverRef = useRef<HTMLDivElement>(null);
  const activeChipRef = useRef<HTMLButtonElement | null>(null);
  const prevGroupPopoverState = useRef<{ open: boolean; mode: 'filter' | 'group' }>({ open: false, mode: 'filter' });

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

  // Group By: Get available fields with categorization
  const availableGroupFields = useMemo(() => {
    const allFields = getAvailableGroupFields(state.selectedObjects, schema);
    
    // Common field names to prioritize (status, currency, type, etc.)
    const commonFieldNames = ['status', 'currency', 'type', 'country', 'brand', 'category', 'method', 'tier'];
    
    // Categorize into common and other
    const common: typeof allFields = [];
    const other: typeof allFields = [];
    
    allFields.forEach(field => {
      const fieldName = field.field.toLowerCase();
      if (commonFieldNames.some(commonName => fieldName.includes(commonName))) {
        common.push(field);
      } else {
        other.push(field);
      }
    });
    
    return { common, other, all: allFields };
  }, [state.selectedObjects]);
  
  // Filtered group by fields based on search
  const filteredGroupFields = useMemo(() => {
    if (!groupBySearchQuery) {
      return availableGroupFields;
    }
    
    const query = groupBySearchQuery.toLowerCase();
    const filterFields = (fields: typeof availableGroupFields.all) => 
      fields.filter(f => 
        f.label.toLowerCase().includes(query) ||
        f.object.toLowerCase().includes(query) ||
        f.field.toLowerCase().includes(query)
      );
    
    return {
      common: filterFields(availableGroupFields.common),
      other: filterFields(availableGroupFields.other),
      all: filterFields(availableGroupFields.all),
    };
  }, [availableGroupFields, groupBySearchQuery]);

  // Group By: Get available values for selected field
  const availableGroupValues = useMemo(() => {
    if (!state.groupBy) return [];
    // Get the primary object for cross-object grouping
    const primaryObject = state.selectedObjects[0] || state.metricFormula.blocks[0]?.source?.object;
    return getGroupValues(warehouse, state.groupBy.field, 100, primaryObject);
  }, [state.groupBy?.field, state.selectedObjects, state.metricFormula.blocks, version]);
  
  const enabledFields = useMemo(() => {
    const orderMap = new Map<string, number>();
    state.fieldOrder.forEach((key, index) => orderMap.set(key, index));
    return state.selectedFields
      .map((ref) => {
        const schemaObject = schema.objects.find((obj) => obj.name === ref.object);
        const schemaField = schemaObject?.fields.find((fld) => fld.name === ref.field);
        if (!schemaField) return null;
        return {
          key: `${ref.object}.${ref.field}`,
          ref,
          schemaField,
          objectLabel: schemaObject?.label ?? ref.object,
          fieldLabel: schemaField.label ?? ref.field,
          order: orderMap.get(`${ref.object}.${ref.field}`) ?? Number.MAX_SAFE_INTEGER,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a!.order ?? 0) - (b!.order ?? 0)) as Array<{
        key: string;
        ref: { object: string; field: string };
        schemaField: SchemaField;
        objectLabel: string;
        fieldLabel: string;
      }>;
  }, [state.selectedFields, state.fieldOrder]);

  const filtersByField = useMemo(() => {
    const map = new Map<string, { condition: FilterCondition; index: number }>();
    state.filters.conditions.forEach((condition, index) => {
      const key = `${condition.field.object}.${condition.field.field}`;
      if (!map.has(key)) {
        map.set(key, { condition, index });
      }
    });
    return map;
  }, [state.filters.conditions]);

  const distinctValueCache = useMemo(() => {
    const cache = new Map<string, string[]>();
    enabledFields.forEach((field) => {
      const schemaField = field.schemaField;
      if (schemaField.enum && schemaField.type === 'string') {
        const dataArray = (warehouse as any)[field.ref.object];
        if (Array.isArray(dataArray) && dataArray.length > 0) {
          const distinctSet = new Set<string>();
          dataArray.forEach((row: any) => {
            const value = row[field.ref.field];
            if (typeof value === 'string' && value.trim().length > 0) {
              distinctSet.add(value);
            }
          });
          if (distinctSet.size > 0) {
            cache.set(field.key, Array.from(distinctSet).sort());
          }
        }
      }
    });
    return cache;
  }, [enabledFields, warehouse, version]);

  // Helper to format value to sentence case
  const formatValueLabel = useCallback((value: string) => {
    // Convert snake_case or camelCase to Title Case
    return value
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }, []);

  const formatFilterSummary = useCallback((schemaField?: SchemaField, condition?: FilterCondition) => {
    if (!schemaField || !condition) return 'Add a filter';
    const { operator, value } = condition;
    if (
      value === '' ||
      value === null ||
      value === undefined ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return 'Filter for blank';
    }

    if (schemaField.type === 'boolean') {
      return value === true ? 'Filter for true' : 'Filter for false';
    }

    if (schemaField.type === 'date') {
      if (operator === 'between' && Array.isArray(value)) {
        return 'Filter between dates';
      }
      if (operator === 'less_than') return `Filter before ${value}`;
      if (operator === 'greater_than') return `Filter after ${value}`;
      return `Filter for ${value}`;
    }

    if (schemaField.type === 'number') {
      if (operator === 'between' && Array.isArray(value)) {
        const [min, max] = value as [number, number];
        return `Filter between ${min} and ${max}`;
      }
      if (operator === 'greater_than') return `Filter > ${value}`;
      if (operator === 'less_than') return `Filter < ${value}`;
      if (operator === 'not_equals') return `Filter ≠ ${value}`;
      return `Filter for ${value}`;
    }

    if (Array.isArray(value)) {
      if (value.length === 1) {
        return `Filter for ${value[0]}`;
      }
      const [first, second] = value;
      if (value.length === 2) {
        return `Filter for ${first} and ${second}`;
      }
      return `Filter for ${first}, ${second}, and ${value.length - 2} more`;
    }

    return `Filter for ${value}`;
  }, []);

  // Extract just the values from a filter condition for chip labels
  const formatFilterChipLabel = useCallback((condition?: FilterCondition) => {
    if (!condition) return 'Filter';
    const { value } = condition;
    
    if (
      value === '' ||
      value === null ||
      value === undefined ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return 'Blank';
    }

    if (typeof value === 'boolean') {
      return value ? 'True' : 'False';
    }

    if (Array.isArray(value)) {
      const formattedValues = value.map(v => formatValueLabel(String(v)));
      const MAX_CHARS = 20;
      
      if (formattedValues.length === 1) {
        return formattedValues[0];
      }
      
      // Check if first value alone exceeds limit
      if (formattedValues[0].length > MAX_CHARS) {
        return `${formattedValues[0]} and ${formattedValues.length - 1} more`;
      }
      
      // Try to include multiple values within the limit
      let result = formattedValues[0];
      let includedCount = 1;
      
      for (let i = 1; i < formattedValues.length; i++) {
        const nextValue = formattedValues[i];
        const separator = i === formattedValues.length - 1 ? ' and ' : ', ';
        const potentialResult = result + separator + nextValue;
        
        if (potentialResult.length > MAX_CHARS) {
          break;
        }
        
        result = potentialResult;
        includedCount++;
      }
      
      const remainingCount = formattedValues.length - includedCount;
      if (remainingCount > 0) {
        return `${result} and ${remainingCount} more`;
      }
      
      return result;
    }

    return formatValueLabel(String(value));
  }, [formatValueLabel]);

  type ControlChip = {
    key: string;
    type: 'filter' | 'group';
    fieldKey?: string;
    label: string;
    description: string;
  };

  const filterChips = useMemo<ControlChip[]>(() => {
    return state.filters.conditions.map((condition, index) => {
      const schemaObject = schema.objects.find((obj) => obj.name === condition.field.object);
      const schemaField = schemaObject?.fields.find((fld) => fld.name === condition.field.field);
      const fieldKey = `${condition.field.object}.${condition.field.field}`;

      return {
        key: `filter:${fieldKey}:${index}`,
        type: 'filter',
        fieldKey,
        label: formatFilterChipLabel(condition),
        description: formatFilterSummary(schemaField, condition),
      };
    });
  }, [state.filters.conditions, formatFilterSummary, formatFilterChipLabel]);

  const groupByLabel = useMemo(() => {
    if (!state.groupBy) return 'Group by';
    
    const values = state.groupBy.selectedValues.map(formatValueLabel);
    if (values.length === 0) return 'Group by';
    
    const MAX_CHARS = 20;
    
    // Try to fit as many values as possible within the character limit
    if (values.length === 1) {
      return values[0];
    }
    
    // Check if first value alone exceeds limit - if so, just show "X and Y more"
    if (values[0].length > MAX_CHARS) {
      return `${values[0]} and ${values.length - 1} more`;
    }
    
    // Try to include multiple values within the limit
    let result = values[0];
    let includedCount = 1;
    
    for (let i = 1; i < values.length; i++) {
      const nextValue = values[i];
      const separator = i === values.length - 1 ? ' and ' : ', ';
      const potentialResult = result + separator + nextValue;
      
      // If adding this value exceeds limit, stop and show "and X more"
      if (potentialResult.length > MAX_CHARS) {
        break;
      }
      
      result = potentialResult;
      includedCount++;
    }
    
    const remainingCount = values.length - includedCount;
    if (remainingCount > 0) {
      return `${result} and ${remainingCount} more`;
    }
    
    return result;
  }, [state.groupBy?.selectedValues, formatValueLabel]);

  const groupChips = useMemo<ControlChip[]>(() => {
    if (!state.groupBy) return [];
    const schemaObject = schema.objects.find((obj) => obj.name === state.groupBy!.field.object);
    const schemaField = schemaObject?.fields.find((fld) => fld.name === state.groupBy!.field.field);
    const fieldKey = `${state.groupBy.field.object}.${state.groupBy.field.field}`;

    return [
      {
        key: `group:${fieldKey}`,
        type: 'group',
        fieldKey,
        label: groupByLabel,
        description: `${schemaField?.label ?? formatValueLabel(state.groupBy.field.field)}: ${groupByLabel}`,
      },
    ];
  }, [state.groupBy, groupByLabel, formatValueLabel]);

  const controlChips = useMemo(() => [...filterChips, ...groupChips], [filterChips, groupChips]);

  const handleFilterChange = useCallback(
    (fieldRef: { object: string; field: string }, condition: FilterCondition | null) => {
      const existingIndex = state.filters.conditions.findIndex(
        (c) => c.field.object === fieldRef.object && c.field.field === fieldRef.field
      );
      if (condition) {
        if (existingIndex >= 0) {
          dispatch(actions.updateFilter(existingIndex, condition));
        } else {
          dispatch(actions.addFilter(condition));
        }
      } else if (existingIndex >= 0) {
        dispatch(actions.removeFilter(existingIndex));
      }
    },
    [dispatch, state.filters.conditions]
  );

  useEffect(() => {
    const popoverJustOpened =
      isGroupByFieldSelectorOpen && !prevGroupPopoverState.current.open;
    const switchedToFilter =
      groupPopoverMode === 'filter' && prevGroupPopoverState.current.mode !== 'filter';

    if ((popoverJustOpened || switchedToFilter) && groupPopoverMode === 'filter') {
      const fieldWithFilter = enabledFields.find((field) => filtersByField.has(field.key));
      const fallbackField = enabledFields[0];
      setActiveFilterField(fieldWithFilter?.key ?? fallbackField?.key ?? null);
      setFilterSearchQuery('');
    }

    prevGroupPopoverState.current = {
      open: isGroupByFieldSelectorOpen,
      mode: groupPopoverMode,
    };
  }, [
    isGroupByFieldSelectorOpen,
    groupPopoverMode,
    enabledFields,
    filtersByField,
  ]);

  const renderFilterContent = () => {
    const query = filterSearchQuery.trim().toLowerCase();
    // Filter out fields that already have a filter applied
    const fieldsWithoutActiveFilter = enabledFields.filter((field) => !filtersByField.has(field.key));
    const filtered = query
      ? fieldsWithoutActiveFilter.filter((field) =>
          field.fieldLabel.toLowerCase().includes(query) ||
          field.objectLabel.toLowerCase().includes(query)
        )
      : fieldsWithoutActiveFilter;

    return (
      <>
        <div style={{ padding: '0 12px', borderBottom: '1px solid var(--border-default)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 0',
              backgroundColor: 'transparent',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              style={{ color: 'var(--text-muted)' }}
            >
              <path
                d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10.5 10.5L14 14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              type="text"
              placeholder="Search"
              value={filterSearchQuery}
              onChange={(e) => setFilterSearchQuery(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                padding: 0,
              }}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              No matching fields
            </div>
          ) : (
            filtered.map((field) => (
              <button
                key={field.key}
                type="button"
                onClick={() => {
                  setActiveFilterField(field.key);
                  setGroupPopoverMode('filter');
                  setIsGroupByFieldSelectorOpen(false);
                  setIsGroupByValueSelectorOpen(true);
                }}
                className="w-full text-left transition-colors flex flex-col gap-1"
                style={{
                  paddingLeft: '16px',
                  paddingRight: '16px',
                  paddingTop: '8px',
                  paddingBottom: '8px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 400 }}>
                  {field.fieldLabel}
                </span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>
                  {field.ref.object}.{field.ref.field}
                </span>
              </button>
            ))
          )}
        </div>
      </>
    );
  };


  const renderFilterDetail = () => {
    const fieldInfo = activeFilterField
      ? enabledFields.find((field) => field.key === activeFilterField)
      : enabledFields[0];

    if (!fieldInfo) {
      return (
        <div style={{ padding: '16px', width: '320px' }}>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Select a field to filter.
          </p>
        </div>
      );
    }

    const activeEntry = filtersByField.get(fieldInfo.key);

    return (
      <div
        style={{
          width: '320px',
          maxHeight: '360px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 16px',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'var(--text-primary)', flexShrink: 0 }}>
            <path d="M1.5 3H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M3 6H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M4.5 9H7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-primary)' }}>
            {activeChipLabel}
          </span>
        </div>
        <div style={{ padding: '12px' }}>
          <FieldFilter
            field={fieldInfo.schemaField}
            objectName={fieldInfo.ref.object}
            currentFilter={activeEntry?.condition}
            onFilterChange={(condition) => {
              handleFilterChange(fieldInfo.ref, condition);
              setIsGroupByValueSelectorOpen(false);
            }}
            onCancel={() => {
              setIsGroupByValueSelectorOpen(false);
              setIsGroupByFieldSelectorOpen(true);
            }}
            distinctValues={distinctValueCache.get(fieldInfo.key)}
          />
        </div>
      </div>
    );
  };


  const renderGroupFieldContent = () => (
    <>
      {/* Search bar */}
      <div style={{ padding: '0 12px', borderBottom: '1px solid var(--border-default)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 0',
            backgroundColor: 'transparent',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            style={{ color: 'var(--text-muted)' }}
          >
            <path
              d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10.5 10.5L14 14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            type="text"
            placeholder="Search"
            value={groupBySearchQuery}
            onChange={(e) => setGroupBySearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
              padding: 0,
            }}
          />
        </div>
      </div>

      {/* Scrollable field list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {filteredGroupFields.all.length === 0 ? (
          <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            No matching fields
          </div>
        ) : (
          <>
            {/* Common section */}
            {filteredGroupFields.common.length > 0 && (
              <>
                <div
                  className="px-4 py-2 text-xs"
                  style={{
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Common
                </div>
                {filteredGroupFields.common.map((field) => {
                  const plainLabel = getFieldDisplayLabel(field.label);
                  return (
                    <button
                      key={`${field.object}.${field.field}`}
                      onClick={() => {
                        dispatch(
                          actions.setGroupBy({
                            field: { object: field.object, field: field.field },
                            selectedValues: [],
                            autoAddedField: false,
                          })
                        );
                        setIsGroupByFieldSelectorOpen(false);
                        setGroupBySearchQuery('');
                        setTimeout(() => setIsGroupByValueSelectorOpen(true), 100);
                      }}
                      className="w-full text-left transition-colors flex flex-col gap-1"
                      style={{
                        paddingLeft: '16px',
                        paddingRight: '16px',
                        paddingTop: '8px',
                        paddingBottom: '8px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 400 }}>
                        {plainLabel}
                      </span>
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>
                        {field.object}.{field.field}
                      </span>
                    </button>
                  );
                })}
              </>
            )}

            {/* Other section */}
            {filteredGroupFields.other.length > 0 && (
              <>
                <div
                  className="px-4 py-2 text-xs"
                  style={{
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {filteredGroupFields.common.length > 0 ? 'Other' : 'All Fields'}
                </div>
                {filteredGroupFields.other.map((field) => {
                  const plainLabel = getFieldDisplayLabel(field.label);
                  return (
                    <button
                      key={`${field.object}.${field.field}`}
                      onClick={() => {
                        dispatch(
                          actions.setGroupBy({
                            field: { object: field.object, field: field.field },
                            selectedValues: [],
                            autoAddedField: false,
                          })
                        );
                        setIsGroupByFieldSelectorOpen(false);
                        setGroupBySearchQuery('');
                        setTimeout(() => setIsGroupByValueSelectorOpen(true), 100);
                      }}
                      className="w-full text-left transition-colors flex flex-col gap-1"
                      style={{
                        paddingLeft: '16px',
                        paddingRight: '16px',
                        paddingTop: '8px',
                        paddingBottom: '8px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 400 }}>
                        {plainLabel}
                      </span>
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>
                        {field.object}.{field.field}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>
    </>
  );

  const getFieldDisplayLabel = (label: string) => {
    if (!label) return '';
    const parts = label.split('.');
    return parts[parts.length - 1];
  };

  // Position popovers relative to active chip or container
  useEffect(() => {
    if ((isGroupByFieldSelectorOpen || isGroupByValueSelectorOpen) && groupByPopoverRef.current) {
      const popover = groupByPopoverRef.current;
      const container = groupByButtonRef.current;
      const activeChip = activeChipRef.current;
      
      if (activeChip && isGroupByValueSelectorOpen) {
        // Position relative to the clicked chip - overlap with chip
        const chipRect = activeChip.getBoundingClientRect();
        const containerRect = container?.getBoundingClientRect();
        
        if (containerRect) {
          const leftOffset = chipRect.left - containerRect.left;
          popover.style.left = `${leftOffset}px`;
          popover.style.top = '0px'; // Overlap with the chip
        }
      } else if (container) {
        // Position relative to the plus button (for field selector)
        popover.style.left = '0px';
        popover.style.top = '40px';
      }
    }
  }, [isGroupByFieldSelectorOpen, isGroupByValueSelectorOpen, activeFilterField, groupPopoverMode]);

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
      <div className="flex flex-wrap items-center mt-10" style={{ gap: '8px' }}>
        {/* Date Range Control */}
        <div className="relative inline-flex items-center">
          <div className="flex items-center gap-1 px-1" style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '50px', height: '32px' }}>
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
                  className="text-sm font-medium transition-colors focus:outline-none flex items-center"
                  style={{
                    backgroundColor: isSelected ? 'var(--bg-active)' : 'transparent',
                    borderRadius: '50px',
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                    height: '24px',
                    paddingLeft: '8px',
                    paddingRight: '8px',
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
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-active)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
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

        {/* Group By Control */}
        <div
          ref={groupByButtonRef}
          className="relative inline-flex items-center flex-wrap gap-2"
          style={{ minHeight: '32px' }}
        >
          {controlChips.map((chip) => (
          <button
              key={chip.key}
              type="button"
              ref={(el) => {
                if (
                  (chip.type === 'filter' && chip.fieldKey === activeFilterField && isGroupByValueSelectorOpen && groupPopoverMode === 'filter') ||
                  (chip.type === 'group' && isGroupByValueSelectorOpen && groupPopoverMode === 'group')
                ) {
                  activeChipRef.current = el;
                }
              }}
              onClick={(e) => {
                activeChipRef.current = e.currentTarget;
                if (chip.type === 'filter' && chip.fieldKey) {
                  setGroupPopoverMode('filter');
                  setFilterSearchQuery('');
                  setActiveFilterField(chip.fieldKey);
                  setActiveChipLabel(chip.label);
                  setIsGroupByFieldSelectorOpen(false);
                  setIsGroupByValueSelectorOpen(true);
                } else if (chip.type === 'group') {
                  setGroupPopoverMode('group');
                  setFilterSearchQuery('');
                  setActiveChipLabel(chip.label);
                  setIsGroupByFieldSelectorOpen(false);
                  setIsGroupByValueSelectorOpen(true);
                }
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-active)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
              }}
              className="text-sm border-none focus:outline-none cursor-pointer flex items-center justify-center transition-colors gap-2"
              style={{
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontWeight: 400,
                borderRadius: '50px',
                padding: '6px 12px',
                height: '32px',
                whiteSpace: 'nowrap',
              }}
              title={chip.description}
            >
              {chip.type === 'group' ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1.3125 3.1875C1.82812 3.1875 2.25 2.76562 2.25 2.25C2.25 1.73438 1.82812 1.3125 1.3125 1.3125C0.796875 1.3125 0.375 1.73438 0.375 2.25C0.375 2.775 0.796875 3.1875 1.3125 3.1875Z" fill="currentColor"/>
                  <path d="M1.3125 6.9375C1.82812 6.9375 2.25 6.51562 2.25 6C2.25 5.48438 1.82812 5.0625 1.3125 5.0625C0.796875 5.0625 0.375 5.48438 0.375 6C0.375 6.525 0.796875 6.9375 1.3125 6.9375Z" fill="currentColor"/>
                  <path d="M1.3125 10.6875C1.82812 10.6875 2.25 10.2656 2.25 9.75C2.25 9.23438 1.82812 8.8125 1.3125 8.8125C0.796875 8.8125 0.375 9.23438 0.375 9.75C0.375 10.275 0.796875 10.6875 1.3125 10.6875Z" fill="currentColor"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M3 2.15625C3 1.79381 3.29381 1.5 3.65625 1.5H10.9688C11.3312 1.5 11.625 1.79381 11.625 2.15625C11.625 2.51869 11.3312 2.8125 10.9688 2.8125H3.65625C3.29381 2.8125 3 2.51869 3 2.15625Z" fill="currentColor"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M3 6.00073C3 5.6383 3.29381 5.34448 3.65625 5.34448H10.9688C11.3312 5.34448 11.625 5.6383 11.625 6.00073C11.625 6.36317 11.3312 6.65698 10.9688 6.65698H3.65625C3.29381 6.65698 3 6.36317 3 6.00073Z" fill="currentColor"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M3 9.84375C3 9.48131 3.29381 9.1875 3.65625 9.1875H10.9688C11.3312 9.1875 11.625 9.48131 11.625 9.84375C11.625 10.2062 11.3312 10.5 10.9688 10.5H3.65625C3.29381 10.5 3 10.2062 3 9.84375Z" fill="currentColor"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1.5 3H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M3 6H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M4.5 9H7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
              <span>
                {chip.label}
              </span>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 3L4 5L6 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ))}

          <button
            onClick={(e) => {
              activeChipRef.current = e.currentTarget;
              setGroupPopoverMode('filter');
              setFilterSearchQuery('');
              if (!activeFilterField && enabledFields[0]) {
                setActiveFilterField(enabledFields[0].key);
              }
              setIsGroupByFieldSelectorOpen(true);
              setIsGroupByValueSelectorOpen(false);
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-active)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
            }}
            className="flex items-center justify-center transition-colors"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '50px',
              color: 'var(--text-muted)',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
            }}
            aria-label="Add group or filter"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6.5625 3.1875C6.5625 2.87684 6.31066 2.625 6 2.625C5.68934 2.625 5.4375 2.87684 5.4375 3.1875V5.4375H3.1875C2.87684 5.4375 2.625 5.68934 2.625 6C2.625 6.31066 2.87684 6.5625 3.1875 6.5625H5.4375V8.8125C5.4375 9.12316 5.68934 9.375 6 9.375C6.31066 9.375 6.5625 9.12316 6.5625 8.8125V6.5625H8.8125C9.12316 6.5625 9.375 6.31066 9.375 6C9.375 5.68934 9.12316 5.4375 8.8125 5.4375H6.5625V3.1875Z" fill="currentColor"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M12 5.99999C12 9.31404 9.31405 12 6 12C2.68595 12 0 9.31404 0 5.99999C0 2.68595 2.68595 0 6 0C9.32231 0 12 2.68595 12 5.99999ZM10.875 5.99999C10.875 8.69272 8.69272 10.875 6 10.875C3.30728 10.875 1.125 8.69272 1.125 5.99999C1.125 3.30727 3.30727 1.125 6 1.125C8.69998 1.125 10.875 3.30626 10.875 5.99999Z" fill="currentColor"/>
            </svg>
          </button>

          {/* Field Selector Popover */}
          {isGroupByFieldSelectorOpen && (
            <div
              ref={groupByPopoverRef}
              className="absolute py-1 z-50"
              style={{
                top: 0,
                left: 0,
                width: '320px',
                maxHeight: '360px',
                backgroundColor: 'var(--bg-elevated)',
                borderRadius: '16px',
                boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  padding: '12px',
                  display: 'flex',
                  gap: '8px',
                  borderBottom: '1px solid var(--border-default)',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setGroupPopoverMode('filter');
                    setIsGroupByValueSelectorOpen(false);
                    setFilterSearchQuery('');
                    if (!activeFilterField && enabledFields[0]) {
                      setActiveFilterField(enabledFields[0].key);
                    }
                  }}
                  className="flex-1 text-sm font-medium transition-colors"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    color: groupPopoverMode === 'filter' ? 'var(--text-primary)' : 'var(--text-muted)',
                    backgroundColor:
                      groupPopoverMode === 'filter' ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                    boxShadow:
                      groupPopoverMode === 'filter' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M2 4.5H14M4.5 8H11.5M6.5 11.5H9.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>Filter</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGroupPopoverMode('group');
                    setFilterSearchQuery('');
                    setActiveFilterField(null);
                    setIsGroupByValueSelectorOpen(false);
                  }}
                  className="flex-1 text-sm font-medium transition-colors"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    color: groupPopoverMode === 'group' ? 'var(--text-primary)' : 'var(--text-muted)',
                    backgroundColor:
                      groupPopoverMode === 'group' ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                    boxShadow:
                      groupPopoverMode === 'group' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1.3125 3.1875C1.82812 3.1875 2.25 2.76562 2.25 2.25C2.25 1.73438 1.82812 1.3125 1.3125 1.3125C0.796875 1.3125 0.375 1.73438 0.375 2.25C0.375 2.775 0.796875 3.1875 1.3125 3.1875Z" fill="currentColor" />
                    <path d="M1.3125 6.9375C1.82812 6.9375 2.25 6.51562 2.25 6C2.25 5.48438 1.82812 5.0625 1.3125 5.0625C0.796875 5.0625 0.375 5.48438 0.375 6C0.375 6.525 0.796875 6.9375 1.3125 6.9375Z" fill="currentColor" />
                    <path d="M1.3125 10.6875C1.82812 10.6875 2.25 10.2656 2.25 9.75C2.25 9.23438 1.82812 8.8125 1.3125 8.8125C0.796875 8.8125 0.375 9.23438 0.375 9.75C0.375 10.275 0.796875 10.6875 1.3125 10.6875Z" fill="currentColor" />
                    <path fillRule="evenodd" clipRule="evenodd" d="M3 2.15625C3 1.79381 3.29381 1.5 3.65625 1.5H10.9688C11.3312 1.5 11.625 1.79381 11.625 2.15625C11.625 2.51869 11.3312 2.8125 10.9688 2.8125H3.65625C3.29381 2.8125 3 2.51869 3 2.15625Z" fill="currentColor" />
                    <path fillRule="evenodd" clipRule="evenodd" d="M3 6.00073C3 5.6383 3.29381 5.34448 3.65625 5.34448H10.9688C11.3312 5.34448 11.625 5.6383 11.625 6.00073C11.625 6.36317 11.3312 6.65698 10.9688 6.65698H3.65625C3.29381 6.65698 3 6.36317 3 6.00073Z" fill="currentColor" />
                    <path fillRule="evenodd" clipRule="evenodd" d="M3 9.84375C3 9.48131 3.29381 9.1875 3.65625 9.1875H10.9688C11.3312 9.1875 11.625 9.48131 11.625 9.84375C11.625 10.2062 11.3312 10.5 10.9688 10.5H3.65625C3.29381 10.5 3 10.2062 3 9.84375Z" fill="currentColor" />
                  </svg>
                  <span>Group</span>
                </button>
              </div>
              {groupPopoverMode === 'filter'
                ? renderFilterContent()
                : renderGroupFieldContent()}
            </div>
          )}

          {/* Value Selector Popover */}
          {isGroupByValueSelectorOpen && (
            <div
              ref={groupByPopoverRef}
              className="absolute py-1 z-50"
              style={{
                top: 0,
                left: 0,
                width: '320px',
                maxHeight: '360px',
                backgroundColor: 'var(--bg-elevated)',
                borderRadius: '16px',
                boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {groupPopoverMode === 'filter' ? (
                renderFilterDetail()
              ) : (
                state.groupBy && (
                  <GroupBySelector
                    availableValues={availableGroupValues}
                    selectedValues={state.groupBy.selectedValues}
                    onApply={(selectedValues) => {
                      dispatch(actions.updateGroupValues(selectedValues));
                      setIsGroupByValueSelectorOpen(false);
                    }}
                    onRemove={() => {
                      dispatch(actions.clearGroupBy());
                      setIsGroupByValueSelectorOpen(false);
                    }}
                    onCancel={() => {
                      setIsGroupByValueSelectorOpen(false);
                    }}
                    maxSelections={10}
                  />
                )
              )}
            </div>
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
                Array.from(groupedMetrics.keys()).map((groupKey, idx) => {
                  // Check if this is the "other" group
                  const isOtherGroup = groupKey.startsWith('__other__');
                  const otherCount = isOtherGroup ? parseInt(groupKey.replace('__other__', '')) : 0;
                  
                  // Get display name
                  const displayName = isOtherGroup
                    ? `All ${otherCount} other ${state.groupBy!.field.field}${otherCount === 1 ? '' : 's'}`
                    : groupKey;
                  
                  const colors = [
                    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
                    '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#84cc16'
                  ];
                  const color = colors[idx % colors.length];
                  
                  return (
                    <Line
                      key={groupKey}
                      type="linear"
                      dataKey={groupKey}
                      name={displayName}
                      stroke={color}
                      strokeWidth={2}
                      isAnimationActive={false}
                      dot={(props: any) => {
                        // Respect aggregation basis for grouped metrics (same logic as ungrouped)
                        const isSelected = state.selectedBucket?.label === props.payload.date;
                        const isHovered = state.hoveredBucket === props.payload.date && state.hoveredGroup === groupKey;
                        const index = props.index;
                        
                        // For "latest" metrics, only show dot on last bucket
                        if (state.metric.type === 'latest' && index !== chartData.length - 1) {
                          return <g key={`${groupKey}-empty-${index}`} />;
                        }
                        
                        // For "first" metrics, only show dot on first bucket
                        if (state.metric.type === 'first' && index !== 0) {
                          return <g key={`${groupKey}-empty-${index}`} />;
                        }
                        
                        // Show dot with click handler
                        return (
                          <circle
                            key={`${groupKey}-${index}`}
                            cx={props.cx}
                            cy={props.cy}
                            r={isSelected ? 5 : isHovered ? 4.5 : 4}
                            fill={color}
                            stroke="white"
                            strokeWidth={isSelected ? 2 : 0}
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={() => {
                              dispatch(actions.setHoveredBucket(props.payload.date));
                              dispatch(actions.setHoveredGroup(groupKey));
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
                                  value: groupKey,
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
                Array.from(groupedMetrics.keys()).map((groupKey, idx) => {
                  const colors = [
                    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
                    '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#84cc16'
                  ];
                  const color = colors[idx % colors.length];
                  
                  return (
                    <Area
                      key={groupKey}
                      type="monotone"
                      dataKey={groupKey}
                      name={groupKey}
                      fill={color}
                      fillOpacity={0.3}
                      stroke={color}
                      strokeWidth={2}
                      isAnimationActive={false}
                      stackId="stack"
                      dot={(props: any) => {
                        // Respect aggregation basis for grouped metrics
                        const isSelected = state.selectedBucket?.label === props.payload.date;
                        const isHovered = state.hoveredBucket === props.payload.date && state.hoveredGroup === groupKey;
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
                              dispatch(actions.setHoveredGroup(groupKey));
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
                                  value: groupKey,
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
                Array.from(groupedMetrics.keys()).map((groupKey, idx) => {
                  const colors = [
                    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
                    '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#84cc16'
                  ];
                  const color = colors[idx % colors.length];
                  
                  return (
                    <Bar
                      key={groupKey}
                      dataKey={groupKey}
                      name={groupKey}
                      fill={color}
                      isAnimationActive={false}
                      stackId="stack"
                      shape={(props: any) => {
                        const { x, y, width, height, payload } = props;
                        const isSelected = state.selectedBucket?.label === payload.date;
                        const isHovered = state.hoveredBucket === payload.date && state.hoveredGroup === groupKey;
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
                              dispatch(actions.setHoveredGroup(groupKey));
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
                                  value: groupKey,
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
