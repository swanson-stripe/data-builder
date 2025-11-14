'use client';
import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useApp, actions } from '@/state/app';
import {
  generateSeries,
  createPeriodStartSeries,
  createBenchmarkSeries,
} from '@/data/mock';
import { computeMetric } from '@/lib/metrics';
import { computeFormula } from '@/lib/formulaMetrics';
import { currency, number, percentageChange, shortDate } from '@/lib/format';
import { getBucketRange } from '@/lib/time';
import { useWarehouseStore } from '@/lib/useWarehouse';
import schema from '@/data/schema';
import { buildDataListView } from '@/lib/views';
import { applyFilters } from '@/lib/filters';

export function ValueTable() {
  const { state, dispatch } = useApp();
  const { store: warehouse, version, loadEntity, has } = useWarehouseStore();
  const firstColumnRef = useRef<HTMLTableCellElement>(null);
  const [columnWidth, setColumnWidth] = useState(0);

  // Auto-load selected objects that aren't yet loaded
  useEffect(() => {
    state.selectedObjects.forEach((objectName) => {
      if (!has(objectName as any)) {
        console.log(`[ValueTable] Auto-loading missing entity: ${objectName}`);
        loadEntity(objectName as any).catch((err) => {
          console.error(`[ValueTable] Failed to load ${objectName}:`, err);
        });
      }
    });
  }, [state.selectedObjects, has, loadEntity]);

  // Build PK include set from grid selection and field filters
  // Value table SHOULD respond to grid selection (unlike the metric header)
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
        objects: state.selectedObjects,
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

  // Handle bucket selection
  const handleBucketClick = useCallback((date: string) => {
    let dateStr = date;

    // For "latest" or "first" metrics, override the clicked bucket to show the bucket
    // that actually contributes to the metric value (not the clicked bucket)
    if (state.metric.type === 'latest' || state.metric.type === 'first') {
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

    // Parse the bucket label as a local date to avoid timezone shifts
    // For "2025-07", create July 1st in local time, not UTC
    const parts = dateStr.split('-');
    const bucketDate = parts.length === 2
      ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1) // Year-month: create first of month
      : new Date(dateStr); // Full date string
    
    const { start, end } = getBucketRange(bucketDate, state.granularity);
    dispatch(actions.setSelectedBucket(start, end, dateStr));
  }, [state.metric.type, state.granularity, metricResult.series, dispatch]);

  // Compute grouped metrics if grouping is active
  const groupedMetrics = useMemo(() => {
    if (!state.groupBy || state.groupBy.selectedValues.length === 0) {
      return null;
    }

    // Get the rows for the primary object
    const primaryObject = state.selectedObjects[0] || state.metricFormula.blocks[0]?.source?.object;
    if (!primaryObject) return null;

    const allRows = warehouse[primaryObject as keyof typeof warehouse];
    if (!Array.isArray(allRows)) return null;

    // Compute metric for each group
    const results = new Map<string, typeof metricResult>();
    
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
          include: undefined,
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

  // Generate current period data (from metric result)
  const currentSeries = useMemo(() => {
    if (!metricResult.series) {
      return { key: state.report, label: state.metric.name, points: [] };
    }
    return {
      key: state.report,
      label: state.metric.name,
      points: metricResult.series,
    };
  }, [metricResult, state.report, state.metric.name]);

  // Generate comparison data based on comparison mode
  const comparisonSeries = useMemo(() => {
    if (state.chart.comparison === 'none') return null;

    switch (state.chart.comparison) {
      case 'period_start':
        return createPeriodStartSeries(currentSeries);

      case 'previous_period': {
        const bucketCount = currentSeries.points.length;
        const shiftedStart = new Date(state.start);
        const shiftedEnd = new Date(state.end);

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

        return generateSeries({
          key: state.report,
          start: shiftedStart,
          end: shiftedEnd,
          granularity: state.granularity,
          seed: 54321,
        });
      }

      case 'previous_year': {
        const yearStart = new Date(state.start);
        yearStart.setFullYear(yearStart.getFullYear() - 1);
        const yearEnd = new Date(state.end);
        yearEnd.setFullYear(yearEnd.getFullYear() - 1);

        return generateSeries({
          key: state.report,
          start: yearStart,
          end: yearEnd,
          granularity: state.granularity,
          seed: 54321,
        });
      }

      case 'benchmarks':
        // Benchmarks not yet implemented
        return null;

      default:
        return null;
    }
  }, [currentSeries, state.chart.comparison, state.start, state.end, state.granularity]);

  // Get buckets to display - show ALL buckets in the selected date range
  const { currentPoints, comparisonPoints: displayComparisonPoints } = useMemo(() => {
    // Show all available points in the date range
    return {
      currentPoints: currentSeries.points,
      comparisonPoints: comparisonSeries?.points,
    };
  }, [currentSeries, comparisonSeries]);

  // Measure first column width for shadow positioning
  useEffect(() => {
    if (firstColumnRef.current) {
      const width = firstColumnRef.current.offsetWidth;
      setColumnWidth(width);
    }
  }, [currentPoints, state.chart.comparison]);

  // Get comparison label
  const getComparisonLabel = () => {
    switch (state.chart.comparison) {
      case 'period_start':
        return 'vs. Period Start';
      case 'previous_period':
        return 'Previous Period';
      case 'previous_year':
        return 'Previous Year';
      default:
        return '';
    }
  };

  // Get value kind from metric result
  const valueKind = metricResult.kind || 'number';

  // Format value based on kind (full values, not compact)
  const formatValue = (val: number) => {
    if (valueKind === 'currency') {
      return currency(val, { compact: false });
    } else if (metricResult.unitType === 'rate') {
      // For rates, display as percentage with 2 decimal places
      return `${(val * 100).toFixed(2)}%`;
    } else {
      return number(val, { decimals: 0 });
    }
  };

  // Format column header based on granularity
  const formatColumnHeader = (dateString: string) => {
    const date = new Date(dateString);
    
    switch (state.granularity) {
      case 'year':
        return date.getFullYear().toString();
      
      case 'month':
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      case 'week': {
        // For week, show the date range like "Aug 2-8"
        const { start, end } = getBucketRange(date, 'week');
        const startDate = new Date(start);
        const endDate = new Date(end);
        // Subtract 1 day from end because getBucketRange returns exclusive end date
        endDate.setDate(endDate.getDate() - 1);
        
        // If same month, show "Aug 2-8"
        if (startDate.getMonth() === endDate.getMonth()) {
          return `${startDate.toLocaleDateString('en-US', { month: 'short' })} ${startDate.getDate()}-${endDate.getDate()}`;
        } else {
          // If different months, show "Aug 30-Sep 5"
          return `${startDate.toLocaleDateString('en-US', { month: 'short' })} ${startDate.getDate()}-${endDate.toLocaleDateString('en-US', { month: 'short' })} ${endDate.getDate()}`;
        }
      }
      
      case 'day':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      case 'quarter': {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `Q${quarter} ${date.getFullYear()}`;
      }
      
      default:
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
  };

  // Format period label with complete date range
  const formatPeriodLabel = (startDate: Date, endDate: Date) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // If same year, show "Jan 1 – Oct 30, 2025"
    if (start.getFullYear() === end.getFullYear()) {
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      // If different years, show "Nov 1, 2024 – Nov 1, 2025"
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
  };

  // Show placeholder if metric not configured
  const hasConfig = useFormula 
    ? (state.metricFormula.blocks.length > 0 && state.metricFormula.blocks.some(b => b.source))
    : state.metric.source;
    
  if (metricResult.series === null || !hasConfig) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-gray-400 dark:text-gray-500 text-center">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-sm font-medium">No metric configured</p>
          <p className="text-xs mt-1">
            {metricResult.note || 'Select a source field in the Metric tab.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Table */}
      <div style={{ position: 'relative' }}>
        {/* Shadow overlay for sticky column - fixed to viewport */}
        {columnWidth > 0 && (
          <div 
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: columnWidth,
              width: '1px',
              boxShadow: '3px 0 6px 0 rgba(0, 0, 0, 0.12)',
              pointerEvents: 'none',
              zIndex: 15
            }}
          />
        )}
        <div className="overflow-x-auto hide-scrollbar" style={{ paddingRight: '10px', marginRight: '-10px' }}>
          <table className="w-full border-collapse" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th 
                ref={firstColumnRef}
                className="text-left pt-2 pb-0 pl-2 pr-6 font-normal text-xs text-gray-500 whitespace-nowrap" 
                style={{ 
                  width: 'auto',
                  position: 'sticky',
                  left: 0,
                  zIndex: 20,
                  backgroundColor: 'var(--bg-elevated)'
                }}
              >
                Current period
              </th>
              {currentPoints.map((point, idx) => (
                <th
                  key={idx}
                  className="pt-2 pb-0 pl-3 pr-3 font-normal text-xs text-gray-500 whitespace-nowrap"
                  style={{ textAlign: 'right', minWidth: '100px', backgroundColor: 'var(--bg-elevated)' }}
                >
                  {formatColumnHeader(point.date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Grouped rows or single current period row */}
            {groupedMetrics ? (
              <>
                {/* Render a row for each group */}
                {Array.from(groupedMetrics.entries()).map(([groupValue, groupResult], groupIdx) => {
                  const colors = [
                    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
                    '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#84cc16'
                  ];
                  const color = colors[groupIdx % colors.length];
                  const groupPoints = groupResult.series || [];
                  
                  return (
                    <tr key={groupValue} className="transition-colors">
                      <td 
                        className="py-2 pl-2 pr-6 whitespace-nowrap"
                        style={{ 
                          position: 'sticky',
                          left: 0,
                          zIndex: 10,
                          backgroundColor: 'var(--bg-elevated)'
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {/* Legend marker with group color */}
                          {state.chart.type === 'bar' ? (
                            <div style={{ width: '12px', height: '10px', backgroundColor: color, borderRadius: '2px', flexShrink: 0 }}></div>
                          ) : (
                            <div style={{ width: '12px', height: '2px', backgroundColor: color, borderRadius: '1px', flexShrink: 0 }}></div>
                          )}
                          <div className="flex flex-col">
                            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                              {groupValue}
                            </span>
                          </div>
                        </div>
                      </td>
                      {groupPoints.map((point, idx) => {
                        const isSelected = state.selectedBucket?.label === point.date;
                        const isHovered = state.hoveredBucket === point.date && state.hoveredGroup === groupValue;
                        return (
                          <td
                            key={idx}
                            className="py-2 pl-3 pr-3 transition-colors cursor-pointer"
                            style={{
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              minWidth: '100px',
                              backgroundColor: isSelected ? 'var(--bg-selected)' : isHovered ? 'var(--bg-surface)' : 'var(--bg-elevated)'
                            }}
                            tabIndex={0}
                            onClick={() => {
                              // Apply both bucket and group filters
                              handleBucketClick(point.date);
                              
                              // Add filter for the group value
                              if (state.groupBy) {
                                dispatch(actions.addFilter({
                                  field: state.groupBy.field,
                                  operator: 'equals',
                                  value: groupValue,
                                }));
                              }
                            }}
                            onMouseEnter={() => {
                              dispatch(actions.setHoveredBucket(point.date));
                              dispatch(actions.setHoveredGroup(groupValue));
                            }}
                            onMouseLeave={() => {
                              dispatch(actions.clearHoveredBucket());
                              dispatch(actions.clearHoveredGroup());
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleBucketClick(point.date);
                                
                                // Add filter for the group value
                                if (state.groupBy) {
                                  dispatch(actions.addFilter({
                                    field: state.groupBy.field,
                                    operator: 'equals',
                                    value: groupValue,
                                  }));
                                }
                              }
                            }}
                            role="button"
                            aria-label={`Select period ${shortDate(point.date)} for ${groupValue}`}
                          >
                            <span className="text-sm underline" style={{ color: 'var(--text-primary)' }}>
                              {formatValue(point.value)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                
                {/* Total row */}
                <tr className="transition-colors" style={{ borderTop: '1px solid var(--border-default)', fontWeight: 600 }}>
                  <td 
                    className="py-2 pl-2 pr-6 whitespace-nowrap"
                    style={{ 
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      backgroundColor: 'var(--bg-elevated)'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div style={{ width: '12px', height: '2px', backgroundColor: 'transparent', flexShrink: 0 }}></div>
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Total
                      </span>
                    </div>
                  </td>
                  {currentPoints.map((point, idx) => {
                    // Sum all groups for this bucket
                    let total = 0;
                    for (const [_, groupResult] of groupedMetrics.entries()) {
                      if (groupResult.series && groupResult.series[idx]) {
                        total += groupResult.series[idx].value;
                      }
                    }
                    
                    const isSelected = state.selectedBucket?.label === point.date;
                    // Total row only highlights when hovering directly on it (no hoveredGroup)
                    const isHovered = state.hoveredBucket === point.date && !state.hoveredGroup;
                    return (
                      <td
                        key={idx}
                        className="py-2 pl-3 pr-3 transition-colors cursor-pointer"
                        style={{
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          minWidth: '100px',
                          backgroundColor: isSelected ? 'var(--bg-selected)' : isHovered ? 'var(--bg-surface)' : 'var(--bg-elevated)'
                        }}
                        tabIndex={0}
                        onClick={() => handleBucketClick(point.date)}
                        onMouseEnter={() => dispatch(actions.setHoveredBucket(point.date))}
                        onMouseLeave={() => dispatch(actions.clearHoveredBucket())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleBucketClick(point.date);
                          }
                        }}
                        role="button"
                        aria-label={`Select period ${shortDate(point.date)}`}
                      >
                        <span className="text-sm underline" style={{ color: 'var(--text-primary)' }}>
                          {formatValue(total)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              </>
            ) : (
              // Regular single row when no grouping
              <tr className="transition-colors" style={{ borderBottom: comparisonSeries ? '1px solid var(--border-default)' : 'none' }}>
                <td 
                  className="py-2 pl-2 pr-6 whitespace-nowrap"
                  style={{ 
                    position: 'sticky',
                    left: 0,
                    zIndex: 10,
                    backgroundColor: 'var(--bg-elevated)'
                  }}
                >
                  <div className="flex items-center gap-2">
                    {/* Legend marker - adapt based on chart type */}
                    {state.chart.type === 'bar' ? (
                      <div style={{ width: '12px', height: '10px', backgroundColor: 'var(--chart-line-primary)', borderRadius: '2px', flexShrink: 0 }}></div>
                    ) : (
                      <div style={{ width: '12px', height: '2px', backgroundColor: 'var(--chart-line-primary)', borderRadius: '1px', flexShrink: 0 }}></div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {state.metric.name}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatPeriodLabel(new Date(state.start), new Date(state.end))}
                      </span>
                    </div>
                  </div>
                </td>
                {currentPoints.map((point, idx) => {
                  const isSelected =
                    state.selectedBucket?.label === point.date;
                  const isHovered = state.hoveredBucket === point.date;
                  return (
                    <td
                      key={idx}
                      className="py-2 pl-3 pr-3 transition-colors cursor-pointer"
                      style={{
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        minWidth: '100px',
                        backgroundColor: isSelected ? 'var(--bg-selected)' : isHovered ? 'var(--bg-surface)' : 'var(--bg-elevated)'
                      }}
                      tabIndex={0}
                      onClick={() => handleBucketClick(point.date)}
                      onMouseEnter={() => dispatch(actions.setHoveredBucket(point.date))}
                      onMouseLeave={() => dispatch(actions.clearHoveredBucket())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleBucketClick(point.date);
                        }
                      }}
                      role="button"
                      aria-label={`Select period ${shortDate(point.date)}`}
                    >
                      <span className="text-sm underline" style={{ color: 'var(--text-primary)' }}>
                        {formatValue(point.value)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            )}

            {/* Comparison row */}
            {comparisonSeries && displayComparisonPoints && (
              <>
                <tr>
                  <th 
                    className="text-left pt-2 pb-0 pl-2 pr-6 font-normal text-xs text-gray-500 whitespace-nowrap"
                    style={{ 
                      position: 'sticky',
                      left: 0,
                      zIndex: 20,
                      backgroundColor: 'var(--bg-elevated)'
                    }}
                  >
                    Previous period
                  </th>
                  {displayComparisonPoints.map((point, idx) => (
                    <th
                      key={idx}
                      className="pt-2 pb-0 pl-3 pr-3 font-normal text-xs text-gray-500 whitespace-nowrap"
                      style={{ textAlign: 'right', minWidth: '100px', backgroundColor: 'var(--bg-elevated)' }}
                    >
                      {formatColumnHeader(point.date)}
                    </th>
                  ))}
                </tr>
                <tr>
                  <td 
                    className="py-2 pl-2 pr-6 whitespace-nowrap"
                    style={{ 
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      backgroundColor: 'var(--bg-elevated)'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {/* Legend marker - dashed for comparison */}
                      {state.chart.type === 'bar' ? (
                        <div style={{ 
                          width: '12px', 
                          height: '10px', 
                          backgroundColor: 'var(--chart-line-secondary)',
                          borderRadius: '2px',
                          flexShrink: 0
                        }}></div>
                      ) : (
                        <div style={{ 
                          width: '12px', 
                          height: '2px', 
                          backgroundColor: 'transparent',
                          backgroundImage: 'repeating-linear-gradient(to right, var(--chart-line-secondary) 0, var(--chart-line-secondary) 2px, transparent 2px, transparent 4px)',
                          borderRadius: '1px',
                          flexShrink: 0
                        }}></div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {state.metric.name}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {comparisonSeries.points[0] && comparisonSeries.points[comparisonSeries.points.length - 1] && 
                            formatPeriodLabel(new Date(comparisonSeries.points[0].date), new Date(comparisonSeries.points[comparisonSeries.points.length - 1].date))}
                        </span>
                      </div>
                    </div>
                  </td>
                  {displayComparisonPoints.map((point, idx) => (
                    <td
                      key={idx}
                      className="py-2 pl-3 pr-3"
                      style={{
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        minWidth: '100px',
                        backgroundColor: 'var(--bg-elevated)'
                      }}
                    >
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {formatValue(point.value)}
                      </span>
                    </td>
                  ))}
                </tr>
              </>
            )}

          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
