// src/lib/presets.ts
import { Granularity } from '@/lib/time';
import { MetricDef, FilterCondition } from '@/types';
import { AppAction, ChartType } from '@/state/app';

export type PresetKey =
  | 'blank'
  | 'mrr'
  | 'gross_volume'
  | 'active_subscribers'
  | 'refund_count'
  | 'subscriber_ltv';

type QualifiedField = { object: string; field: string };

type PresetConfig = {
  key: PresetKey;
  label: string;
  // Objects to auto-select in the Data tab
  objects: string[];
  // Qualified fields to auto-select in the Data List
  fields: QualifiedField[];
  // Metric driving the value/chart/summary
  metric: Pick<MetricDef, 'name' | 'op' | 'type'> & {
    source: QualifiedField | undefined;
  };
  // Optional default time settings
  range?: { start: string; end: string; granularity: Granularity };
  // Optional filters to apply
  filters?: FilterCondition[];
  // Optional chart settings
  chartType?: ChartType;
};

// convenience generator for ISO "today"
const todayISO = () => new Date().toISOString().slice(0, 10);

export const PRESET_CONFIGS: Record<PresetKey, PresetConfig> = {
  blank: {
    key: 'blank',
    label: 'None',
    objects: [],
    fields: [],
    metric: {
      name: 'Metric',
      source: undefined,
      op: 'sum',
      type: 'sum_over_period',
    },
    range: { start: `${new Date().getFullYear()}-01-01`, end: todayISO(), granularity: 'month' },
  },

  mrr: {
    key: 'mrr',
    label: 'MRR',
    objects: ['subscription', 'customer', 'subscription_item', 'price'],
    fields: [
      { object: 'subscription', field: 'id' },
      { object: 'subscription', field: 'status' },
      { object: 'subscription', field: 'current_period_start' },
      { object: 'subscription', field: 'current_period_end' },
      { object: 'customer', field: 'id' },
      { object: 'customer', field: 'email' },
      { object: 'subscription_item', field: 'id' },
      { object: 'subscription_item', field: 'quantity' },
      { object: 'price', field: 'unit_amount' },
      { object: 'price', field: 'currency' },
      { object: 'price', field: 'recurring_interval' },
    ],
    // MRR metric - latest snapshot of active subscription prices
    metric: {
      name: 'Monthly Recurring Revenue (MRR)',
      source: { object: 'price', field: 'unit_amount' },
      op: 'sum',
      type: 'latest',
    },
    range: { start: `${new Date().getFullYear()}-01-01`, end: todayISO(), granularity: 'month' },
    filters: [
      {
        field: { object: 'subscription', field: 'status' },
        operator: 'equals',
        value: 'active',
      },
    ],
  },

  gross_volume: {
    key: 'gross_volume',
    label: 'Gross Volume',
    objects: ['charge', 'customer', 'payment_intent', 'invoice'],
    fields: [
      { object: 'charge', field: 'id' },
      { object: 'charge', field: 'amount' },
      { object: 'charge', field: 'currency' },
      { object: 'charge', field: 'created' },
      { object: 'charge', field: 'status' },
      { object: 'customer', field: 'id' },
      { object: 'customer', field: 'email' },
      { object: 'payment_intent', field: 'id' },
      { object: 'invoice', field: 'id' },
      { object: 'invoice', field: 'number' },
    ],
    // Flow metric — sum amounts per bucket
    metric: {
      name: 'Gross Volume',
      source: { object: 'charge', field: 'amount' },
      op: 'sum',
      type: 'sum_over_period',
    },
    range: { start: `${new Date().getFullYear()}-01-01`, end: todayISO(), granularity: 'month' },
  },

  active_subscribers: {
    key: 'active_subscribers',
    label: 'Active Subscribers',
    objects: ['subscription', 'customer', 'invoice'],
    fields: [
      { object: 'subscription', field: 'id' },
      { object: 'subscription', field: 'status' },
      { object: 'subscription', field: 'current_period_end' },
      { object: 'subscription', field: 'cancel_at_period_end' },
      { object: 'customer', field: 'id' },
      { object: 'customer', field: 'email' },
      { object: 'invoice', field: 'id' },
      { object: 'invoice', field: 'amount_paid' },
      { object: 'invoice', field: 'created' },
    ],
    // Latest snapshot of active subscriber count
    metric: {
      name: 'Active Subscribers',
      source: { object: 'subscription', field: 'id' },
      op: 'count',
      type: 'latest',
    },
    range: { start: `${new Date().getFullYear()}-01-01`, end: todayISO(), granularity: 'month' },
    // Only count subscriptions with status = 'active'
    filters: [
      {
        field: { object: 'subscription', field: 'status' },
        operator: 'in',
        value: ['active'],
      },
    ],
  },

  refund_count: {
    key: 'refund_count',
    label: 'Refund Count',
    objects: ['refund', 'charge', 'customer'],
    fields: [
      { object: 'refund', field: 'id' },
      { object: 'refund', field: 'created' },
      { object: 'refund', field: 'amount' },
      { object: 'refund', field: 'status' },
      { object: 'refund', field: 'reason' },
      { object: 'charge', field: 'id' },
      { object: 'charge', field: 'amount' },
      { object: 'charge', field: 'created' },
      { object: 'customer', field: 'id' },
      { object: 'customer', field: 'email' },
    ],
    // Count-like flow — use per-bucket sum (series generator already models counts)
    metric: {
      name: 'Refund Count',
      source: { object: 'refund', field: 'id' }, // proxy for counting refunds
      op: 'count',
      type: 'sum_over_period',
    },
    range: { start: `${new Date().getFullYear()}-01-01`, end: todayISO(), granularity: 'week' },
    chartType: 'bar',
  },

  subscriber_ltv: {
    key: 'subscriber_ltv',
    label: 'ARPU',
    objects: ['subscription', 'customer', 'invoice'], // Start with subscription to only include customers who subscribe
    fields: [
      { object: 'customer', field: 'id' },
      { object: 'customer', field: 'email' },
      { object: 'customer', field: 'created' },
      { object: 'subscription', field: 'id' },
      { object: 'subscription', field: 'status' },
      { object: 'subscription', field: 'created' },
      { object: 'invoice', field: 'amount_paid' },
      { object: 'invoice', field: 'status' },
      { object: 'invoice', field: 'created' },
    ],
    // Average revenue per user - latest snapshot
    metric: {
      name: 'Average Revenue Per User (ARPU)',
      source: { object: 'invoice', field: 'amount_paid' },
      op: 'avg',
      type: 'latest',
    },
    range: { start: `${new Date().getFullYear()}-01-01`, end: todayISO(), granularity: 'month' },
  },
};

export const PRESET_OPTIONS = Object.values(PRESET_CONFIGS).map(p => ({
  key: p.key,
  label: p.label,
}));

export function applyPreset(
  key: PresetKey,
  dispatch: (a: AppAction) => void,
  currentState?: any // Optional: pass current state to check existing blocks
) {
  const p = PRESET_CONFIGS[key];
  if (!p) return;

  // Set the report key first so the dropdown stays in sync
  dispatch({ type: 'SET_REPORT', payload: key });

  // Reset selections and clear any active bucket filter
  dispatch({ type: 'RESET_SELECTIONS' });
  dispatch({ type: 'CLEAR_SELECTED_BUCKET' });

  // Clear existing filters before applying preset filters
  dispatch({ type: 'CLEAR_FILTERS' });
  
  // Clear any formula calculation (presets are single-block only)
  dispatch({ type: 'SET_CALCULATION', payload: undefined });
  
  // Clear exposeBlocks (presets don't expose intermediate blocks)
  if (currentState?.metricFormula?.exposeBlocks?.length > 0) {
    currentState.metricFormula.exposeBlocks.forEach((blockId: string) => {
      dispatch({ type: 'TOGGLE_EXPOSE_BLOCK', payload: blockId });
    });
  }
  
  // Remove any extra blocks beyond block_1 (presets are single-block only)
  if (currentState?.metricFormula?.blocks) {
    currentState.metricFormula.blocks.forEach((block: any) => {
      if (block.id !== 'block_1') {
        dispatch({ type: 'REMOVE_METRIC_BLOCK', payload: block.id });
      }
    });
  }

  // Apply optional time range
  if (p.range) {
    dispatch({
      type: 'SET_RANGE',
      payload: {
        start: p.range.start,
        end: p.range.end,
      },
    });
    dispatch({
      type: 'SET_GRANULARITY',
      payload: p.range.granularity,
    });
  }

  // Select objects first (idempotent in reducer)
  for (const obj of p.objects) {
    dispatch({ type: 'TOGGLE_OBJECT', payload: obj });
  }

  // Then select qualified fields
  for (const f of p.fields) {
    dispatch({ type: 'TOGGLE_FIELD', payload: { object: f.object, field: f.field } });
  }

  // Configure Metric (Phase 3)
  if (p.metric) {
    dispatch({ type: 'SET_METRIC_NAME', payload: p.metric.name });
    dispatch({ type: 'SET_METRIC_OP', payload: p.metric.op });
    dispatch({ type: 'SET_METRIC_TYPE', payload: p.metric.type });
    dispatch({ type: 'SET_METRIC_SOURCE', payload: p.metric.source });
    
    // Update Block 1 in the formula system to match metric and include preset filters
    // This maps the block name, source, operation, aggregation, and filters from the preset
    dispatch({ 
      type: 'UPDATE_METRIC_BLOCK', 
      payload: { 
        blockId: 'block_1', 
        updates: {
          name: p.metric.name, // Set block name to match metric name
          source: p.metric.source,
          op: p.metric.op,
          type: p.metric.type,
          filters: p.filters || [], // Apply preset filters to the block (not global filters)
        }
      }
    });
    
    // Update formula name to match metric name
    dispatch({ type: 'SET_METRIC_FORMULA_NAME', payload: p.metric.name });
  }

  // Apply preset filters to global data list (for display purposes)
  // Note: Block filters are independent and already set above
  if (p.filters) {
    for (const filter of p.filters) {
      dispatch({ type: 'ADD_FILTER', payload: filter });
    }
  }

  // Apply chart type if specified
  if (p.chartType) {
    dispatch({ type: 'SET_CHART_TYPE', payload: p.chartType });
  }
}
