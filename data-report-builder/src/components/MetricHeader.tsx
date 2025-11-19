'use client';
import { useMemo, useEffect } from 'react';
import { useApp } from '@/state/app';
import { computeMetric } from '@/lib/metrics';
import { computeFormula } from '@/lib/formulaMetrics';
import { formatMetricValue, deltaCurrency, deltaNumber } from '@/lib/format';
import { formatValueByUnit, getUnitLabel } from '@/lib/unitTypes';
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
  customer_acquisition: 'Customer Acquisition',
  payment_success_rate: 'Payment Success Rate',
  revenue_by_product: 'Revenue by Product',
  payment_acceptance_by_method: 'Acceptance by Payment Method',
  payment_funnel: 'Payment Funnel',
  payment_volume_by_attribute: 'Payment Volume by Attribute',
  payments_net_revenue: 'Net Revenue from Payments',
  first_purchase_behavior: 'First Purchase Behavior',
  active_customers: 'Active vs Inactive Customers',
  purchase_frequency: 'Purchase Frequency',
  customer_ltv: 'Customer Lifetime Value',
  subscription_churn: 'Subscription Churn',
  invoice_status: 'Invoice Status',
  current_balances: 'Current Balances',
  balance_flows: 'Balance Flows',
  payouts_over_time: 'Payouts Over Time',
  dispute_rates: 'Dispute Rates',
  disputes_by_reason: 'Disputes by Reason',
  discounted_revenue: 'Discounted Revenue',
  tax_by_jurisdiction: 'Tax by Jurisdiction',
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

  // Always use formula system now (blocks always exist, single block = simple metric)
  const useFormula = true;

  // Compute the metric result and block results - supports both legacy single-metric and multi-block formula
  const { metricResult, blockResults } = useMemo(() => {
    if (useFormula) {
      // Use multi-block formula system
      const { result, blockResults } = computeFormula({
        formula: state.metricFormula,
        start: state.start,
        end: state.end,
        granularity: state.granularity,
        store: warehouse,
        schema,
        selectedObjects: state.selectedObjects,
        selectedFields: state.selectedFields,
      });
      return { metricResult: result, blockResults };
    } else {
      // Use legacy single-metric system
      const result = computeMetric({
        def: state.metric,
        start: state.start,
        end: state.end,
        granularity: state.granularity,
        store: warehouse,
        include: includeSet,
        schema,
        objects: state.selectedObjects,
      });
      return { metricResult: result, blockResults: [] };
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

  // Calculate delta based on selected comparison mode
  const delta = useMemo(() => {
    // Only show delta if comparison is enabled
    if (state.chart.comparison === 'none' || !metricResult.series || metricResult.series.length === 0) {
      return null;
    }

    // For latest/first value metrics, use the single value
    // For sum/average metrics, compare the sum of all values in the period
    const isLatestOrFirst = state.metric.type === 'latest' || state.metric.type === 'first';
    
    const current = isLatestOrFirst 
      ? metricResult.series[metricResult.series.length - 1].value
      : metricResult.series.reduce((sum, point) => sum + point.value, 0);

    switch (state.chart.comparison) {
      case 'period_start': {
        // Compare current total to first value in the period
        if (metricResult.series.length < 1) return null;
        const baseline = metricResult.series[0].value;
        return { absolute: current - baseline, baseline };
      }

      case 'previous_period': {
        // Compare sum of current period to sum of previous period of equal length
        const bucketCount = metricResult.series.length;
        
        // Compute previous period using the same logic as ChartPanel
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

        // Compute metric for previous period
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

        if (!prevResult.series || prevResult.series.length === 0) return null;

        const baseline = isLatestOrFirst
          ? prevResult.series[prevResult.series.length - 1].value
          : prevResult.series.reduce((sum, point) => sum + point.value, 0);

        return { absolute: current - baseline, baseline };
      }

      case 'previous_year': {
        // Compare to same period last year
        const yearStart = new Date(state.start);
        yearStart.setFullYear(yearStart.getFullYear() - 1);
        const yearEnd = new Date(state.end);
        yearEnd.setFullYear(yearEnd.getFullYear() - 1);

        // Compute metric for previous year
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

        if (!prevYearResult.series || prevYearResult.series.length === 0) return null;

        const baseline = isLatestOrFirst
          ? prevYearResult.series[prevYearResult.series.length - 1].value
          : prevYearResult.series.reduce((sum, point) => sum + point.value, 0);

        return { absolute: current - baseline, baseline };
      }

      case 'benchmarks':
        // Benchmarks not yet implemented
        return null;

      default:
        return null;
    }
  }, [metricResult, state.chart.comparison, state.metric.type, state.granularity, state.start, state.end, useFormula, state.metricFormula, warehouse, schema, state.selectedObjects, state.selectedFields, includeSet, state.metric]);

  // Get the display title (use block name for single blocks, formula name for multi-block, otherwise legacy metric name)
  const title = useFormula 
    ? (state.metricFormula.blocks.length === 1 
        ? (state.metricFormula.blocks[0].name || state.metricFormula.name || REPORT_LABELS[state.report])
        : (state.metricFormula.name || REPORT_LABELS[state.report]))
    : (state.metric.name || REPORT_LABELS[state.report]);

  // Get unit type from metric result
  const unitType = metricResult.unitType || 'count';

  // Format the main value using unit type
  const formattedValue = formatValueByUnit(metricResult.value, unitType);

  // Format the delta: show both absolute and relative change
  // MUST be before early return to maintain hooks order
  const formattedDelta = useMemo(() => {
    if (!delta) return null;

    // Format absolute change based on unit type
    const absoluteChange = formatValueByUnit(delta.absolute, unitType);

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
  }, [delta, unitType]);

  // Get exposed blocks - MUST be before any early returns (React hooks rule)
  const exposedBlocks = useMemo(() => {
    if (!state.metricFormula.exposeBlocks || state.metricFormula.exposeBlocks.length === 0) {
      return [];
    }
    
    return state.metricFormula.exposeBlocks
      .map(blockId => {
        const block = state.metricFormula.blocks.find(b => b.id === blockId);
        const result = blockResults.find(r => r.blockId === blockId);
        return { block, result };
      })
      .filter(item => item.block && item.result && item.result.value !== null);
  }, [state.metricFormula.exposeBlocks, state.metricFormula.blocks, blockResults]);

  // Handle no metric configured
  const hasConfig = useFormula 
    ? (state.metricFormula.blocks.length > 0 && state.metricFormula.blocks.some(b => b.source))
    : state.metric.source;
    
  if (metricResult.value === null || !hasConfig) {
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
    <div className="flex flex-col gap-4">
      {/* Main Metric */}
      <div className="flex flex-col gap-2">
        {/* Title */}
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>

        {/* Value and Delta */}
        <div className="flex items-baseline gap-3">
          <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
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
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Private to you</span>
          <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-subtle)' }} />
          <button className="underline" style={{ fontWeight: 400, color: 'var(--text-primary)' }}>
            Show version history
          </button>
        </div>
      </div>

      {/* Exposed Intermediate Values */}
      {exposedBlocks.length > 0 && (
        <div
          className="pt-4"
          style={{
            borderTop: '1px solid var(--border-default)',
          }}
        >
          <div className="flex flex-wrap" style={{ gap: '24px' }}>
            {exposedBlocks.map(({ block, result }) => (
              <div
                key={block!.id}
                className="exposed-block-card p-3 rounded-lg"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginRight: '16px' }}>
                  <div className="block-title text-xs font-medium" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s ease' }}>
                    {block!.name}
                  </div>
                  <div className="text-xl font-bold" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {result!.unitType && formatValueByUnit(result!.value, result!.unitType)}
                  </div>
                </div>
                <svg className="block-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, transition: 'fill 0.2s ease' }}>
                  <path d="M4.5 0.5625C4.08579 0.5625 3.75 0.898286 3.75 1.3125C3.75 1.72671 4.08579 2.0625 4.5 2.0625H8.87684L1.34467 9.59467C1.05178 9.88756 1.05178 10.3624 1.34467 10.6553C1.63756 10.9482 2.11244 10.9482 2.40533 10.6553L9.9375 3.12316V7.5C9.9375 7.91421 10.2733 8.25 10.6875 8.25C11.1017 8.25 11.4375 7.91421 11.4375 7.5V1.3125C11.4375 0.898286 11.1017 0.5625 10.6875 0.5625H4.5Z" fill="#474E5A"/>
                </svg>
                <style jsx>{`
                  .exposed-block-card:hover {
                    border-color: #B6C0CD !important;
                  }
                  .exposed-block-card:hover .block-title {
                    color: #675DFF !important;
                  }
                  .exposed-block-card:hover .block-icon path {
                    fill: #675DFF !important;
                  }
                  :global(.dark) .exposed-block-card:hover {
                    border-color: #4A5568 !important;
                  }
                `}</style>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
