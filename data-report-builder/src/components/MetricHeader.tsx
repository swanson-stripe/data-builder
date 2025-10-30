'use client';
import { useMemo } from 'react';
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
  mrr: 'Monthly Recurring Revenue',
  gross_volume: 'Gross Volume',
  active_subscribers: 'Active Subscribers',
  refund_count: 'Refund Count',
  subscriber_ltv: 'Subscriber Lifetime Value',
};

export function MetricHeader() {
  const { state } = useApp();
  const { store: warehouse, version } = useWarehouseStore();

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

  // Calculate delta (current vs previous bucket)
  const delta = useMemo(() => {
    if (!metricResult.series || metricResult.series.length < 2) {
      return null;
    }
    const current = metricResult.series[metricResult.series.length - 1].value;
    const previous = metricResult.series[metricResult.series.length - 2].value;
    return current - previous;
  }, [metricResult]);

  // Get the display title
  const title = state.metric.name || REPORT_LABELS[state.report];

  // Get value kind from metric result
  const valueKind = metricResult.kind || 'number';

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

  // Format the main value using the kind
  const formattedValue = formatMetricValue(metricResult.value, valueKind);

  // Format the delta based on kind
  const formattedDelta =
    delta !== null
      ? valueKind === 'currency'
        ? deltaCurrency(delta)
        : deltaNumber(delta)
      : null;

  return (
    <div className="flex flex-col gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
      {/* Title */}
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
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
              delta && delta > 0
                ? 'text-green-600 dark:text-green-400'
                : delta && delta < 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {formattedDelta}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="text-xs text-gray-600 dark:text-gray-300">
        {state.metric.type === 'latest' ? (
          <>Latest value • {metricResult.series?.length || 0} data points</>
        ) : state.metric.type === 'first' ? (
          <>First value • {metricResult.series?.length || 0} data points</>
        ) : state.metric.type === 'sum_over_period' ? (
          <>Sum over period • {metricResult.series?.length || 0} data points</>
        ) : (
          <>Average over period • {metricResult.series?.length || 0} data points</>
        )}
      </div>
    </div>
  );
}
