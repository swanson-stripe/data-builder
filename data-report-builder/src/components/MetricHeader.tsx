'use client';
import { useMemo, useEffect } from 'react';
import { useApp } from '@/state/app';
import { computeMetric } from '@/lib/metrics';
import { formatMetricValue, deltaCurrency, deltaNumber } from '@/lib/format';
import { ReportKey } from '@/types';
import { useWarehouseStore } from '@/lib/useWarehouse';
import schema from '@/data/schema';
import { buildDataListView } from '@/lib/views';
import { applyFilters } from '@/lib/filters';

// Map report keys to their full labels
const REPORT_LABELS: Record<ReportKey, string> = {
  blank: 'Custom Report',
  mrr: 'Monthly Recurring Revenue',
  gross_volume: 'Gross Volume',
  active_subscribers: 'Active Subscribers',
  refund_count: 'Refund Count',
  subscriber_ltv: 'Subscriber Lifetime Value',
};

export function MetricHeader() {
  const { state } = useApp();
  const { store: warehouse, version, loadEntity, has } = useWarehouseStore();

  // Auto-load selected objects that aren't yet loaded
  useEffect(() => {
    state.selectedObjects.forEach((objectName) => {
      if (!has(objectName as any)) {
        console.log(`[MetricHeader] Auto-loading missing entity: ${objectName}`);
        loadEntity(objectName as any).catch((err) => {
          console.error(`[MetricHeader] Failed to load ${objectName}:`, err);
        });
      }
    });
  }, [state.selectedObjects, has, loadEntity]);

  // Build PK include set from field filters only (exclude grid selection)
  // Grid selection should only affect chart/table, not the headline metric
  const includeSet = useMemo(() => {
    // Only use field filters, not grid selection
    if (state.filters.conditions.length > 0 && state.selectedObjects.length > 0 && state.selectedFields.length > 0) {
      const rawRows = buildDataListView({
        store: warehouse,
        selectedObjects: state.selectedObjects,
        selectedFields: state.selectedFields,
      });
      
      const filteredRows = applyFilters(rawRows, state.filters);
      
      // Extract PKs from filtered rows
      return new Set(filteredRows.map(row => `${row.pk.object}:${row.pk.id}`));
    }
    
    // No filtering - return undefined to use all data
    return undefined;
  }, [
    state.filters,
    state.selectedObjects,
    state.selectedFields,
    version,
  ]);

  // Compute the metric result
  const metricResult = useMemo(() => {
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

  // Calculate delta based on selected comparison mode
  const delta = useMemo(() => {
    // Only show delta if comparison is enabled
    if (state.chart.comparison === 'none' || !metricResult.series || metricResult.series.length === 0) {
      return null;
    }

    const current = metricResult.series[metricResult.series.length - 1].value;

    switch (state.chart.comparison) {
      case 'period_start': {
        // Compare to first value in the period
        if (metricResult.series.length < 1) return null;
        const baseline = metricResult.series[0].value;
        return { absolute: current - baseline, baseline };
      }

      case 'previous_period': {
        // Compare to previous bucket
        if (metricResult.series.length < 2) return null;
        const previous = metricResult.series[metricResult.series.length - 2].value;
        return { absolute: current - previous, baseline: previous };
      }

      case 'previous_year': {
        // Compare to same bucket last year
        // Find a bucket approximately 12 months ago
        const currentBucket = metricResult.series[metricResult.series.length - 1];
        const currentDate = new Date(currentBucket.date);
        
        // Go back one year
        const targetDate = new Date(currentDate);
        targetDate.setFullYear(targetDate.getFullYear() - 1);
        
        // Find closest bucket to target date
        let closestBucket = null;
        let minDiff = Infinity;
        
        for (const bucket of metricResult.series) {
          const bucketDate = new Date(bucket.date);
          const diff = Math.abs(bucketDate.getTime() - targetDate.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closestBucket = bucket;
          }
        }
        
        if (!closestBucket) return null;
        return { absolute: current - closestBucket.value, baseline: closestBucket.value };
      }

      case 'benchmarks':
        // Benchmarks not yet implemented
        return null;

      default:
        return null;
    }
  }, [metricResult, state.chart.comparison]);

  // Get the display title
  const title = state.metric.name || REPORT_LABELS[state.report];

  // Get value kind from metric result
  const valueKind = metricResult.kind || 'number';

  // Format the main value using the kind
  const formattedValue = formatMetricValue(metricResult.value, valueKind);

  // Format the delta: show both absolute and relative change
  // MUST be before early return to maintain hooks order
  const formattedDelta = useMemo(() => {
    if (!delta) return null;

    // Format absolute change based on value kind
    const absoluteChange = valueKind === 'currency'
      ? deltaCurrency(delta.absolute)
      : deltaNumber(delta.absolute);

    // Calculate percentage change (omit if baseline is zero to avoid infinity/undefined)
    let percentDisplay = null;
    if (delta.baseline !== 0) {
      const percentChange = ((delta.absolute / delta.baseline) * 100).toFixed(1);
      const percentSign = delta.absolute > 0 ? '+' : '';
      percentDisplay = `${percentSign}${percentChange}%`;
    }
    
    return {
      absolute: absoluteChange,
      percent: percentDisplay,
      isPositive: delta.absolute > 0,
      isNegative: delta.absolute < 0,
    };
  }, [delta, valueKind]);

  // Handle no metric configured
  if (metricResult.value === null || !state.metric.source) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
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
    <div className="flex flex-col gap-2">
      {/* Title */}
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h3>

      {/* Value and Delta */}
      <div className="flex items-baseline gap-3">
        <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {formattedValue}
        </div>
        {formattedDelta && (
          <div
            className={`text-lg font-medium ${
              formattedDelta.isPositive
                ? 'text-green-600 dark:text-green-400'
                : formattedDelta.isNegative
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {formattedDelta.absolute}{formattedDelta.percent && <span className="text-sm"> ({formattedDelta.percent})</span>}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="text-sm text-gray-600 dark:text-gray-300">
        {state.metric.type === 'latest' ? (
          <>Latest value</>
        ) : state.metric.type === 'first' ? (
          <>First value</>
        ) : state.metric.type === 'sum_over_period' ? (
          <>Sum over period</>
        ) : (
          <>Average over period</>
        )}
      </div>
    </div>
  );
}
