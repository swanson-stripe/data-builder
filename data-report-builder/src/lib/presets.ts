import { ReportKey, MetricDef, MetricOp, MetricScope } from '@/types';
import { actions } from '@/state/app';
import { Granularity } from '@/lib/time';

export type PresetOption = {
  key: ReportKey;
  label: string;
};

export const PRESET_OPTIONS: PresetOption[] = [
  { key: 'mrr', label: 'MRR' },
  { key: 'gross_volume', label: 'Gross Volume' },
  { key: 'active_subscribers', label: 'Active Subscribers' },
  { key: 'refund_count', label: 'Refund Count' },
  { key: 'subscriber_ltv', label: 'Subscriber LTV' },
];

/**
 * Configuration for each preset including objects and field selections
 */
export type PresetConfig = {
  key: ReportKey;
  objects: string[];
  fields: { object: string; field: string }[];
  range?: { start: string; end: string; granularity: Granularity };
  metric?: Partial<MetricDef> & { source?: { object: string; field: string } };
};

/**
 * Preset configurations with objects and fields
 */
export const PRESET_CONFIGS: Record<ReportKey, PresetConfig> = {
  mrr: {
    key: 'mrr',
    objects: ['subscription', 'customer', 'price'],
    fields: [
      { object: 'subscription', field: 'id' },
      { object: 'subscription', field: 'status' },
      { object: 'subscription', field: 'created' },
      { object: 'subscription', field: 'current_period_start' },
      { object: 'subscription', field: 'current_period_end' },
      { object: 'customer', field: 'id' },
      { object: 'customer', field: 'email' },
      { object: 'price', field: 'unit_amount' },
      { object: 'price', field: 'currency' },
      { object: 'price', field: 'recurring_interval' },
    ],
    metric: {
      name: 'Monthly Recurring Revenue (MRR)',
      source: { object: 'subscription', field: 'id' },
      op: 'sum' as MetricOp,
      scope: 'per_bucket' as MetricScope,
    },
  },
  gross_volume: {
    key: 'gross_volume',
    objects: ['payment', 'customer', 'product'],
    fields: [
      { object: 'payment', field: 'id' },
      { object: 'payment', field: 'amount' },
      { object: 'payment', field: 'currency' },
      { object: 'payment', field: 'created' },
      { object: 'payment', field: 'status' },
      { object: 'customer', field: 'id' },
      { object: 'customer', field: 'email' },
      { object: 'product', field: 'name' },
    ],
    metric: {
      name: 'Gross Volume',
      source: { object: 'payment', field: 'amount' },
      op: 'sum' as MetricOp,
      scope: 'per_bucket' as MetricScope,
    },
  },
  active_subscribers: {
    key: 'active_subscribers',
    objects: ['subscription', 'customer'],
    fields: [
      { object: 'subscription', field: 'id' },
      { object: 'subscription', field: 'status' },
      { object: 'subscription', field: 'current_period_end' },
      { object: 'subscription', field: 'created' },
      { object: 'customer', field: 'id' },
      { object: 'customer', field: 'email' },
      { object: 'customer', field: 'name' },
    ],
    metric: {
      name: 'Active Subscribers',
      source: { object: 'subscription', field: 'id' },
      op: 'sum' as MetricOp,
      scope: 'per_bucket' as MetricScope,
    },
  },
  refund_count: {
    key: 'refund_count',
    objects: ['refund', 'payment', 'customer'],
    fields: [
      { object: 'refund', field: 'id' },
      { object: 'refund', field: 'amount' },
      { object: 'refund', field: 'created' },
      { object: 'refund', field: 'status' },
      { object: 'refund', field: 'reason' },
      { object: 'payment', field: 'id' },
      { object: 'payment', field: 'amount' },
      { object: 'customer', field: 'id' },
      { object: 'customer', field: 'email' },
    ],
    metric: {
      name: 'Refund Count',
      source: { object: 'refund', field: 'id' },
      op: 'sum' as MetricOp,
      scope: 'per_bucket' as MetricScope,
    },
  },
  subscriber_ltv: {
    key: 'subscriber_ltv',
    objects: ['subscription', 'customer', 'invoice'],
    fields: [
      { object: 'customer', field: 'id' },
      { object: 'customer', field: 'email' },
      { object: 'customer', field: 'created' },
      { object: 'subscription', field: 'id' },
      { object: 'subscription', field: 'status' },
      { object: 'invoice', field: 'id' },
      { object: 'invoice', field: 'amount_paid' },
      { object: 'invoice', field: 'created' },
    ],
    metric: {
      name: 'Subscriber Lifetime Value',
      source: { object: 'invoice', field: 'amount_paid' },
      op: 'avg' as MetricOp,
      scope: 'entire_period' as MetricScope,
    },
  },
};

/**
 * Get date range based on preset key
 */
function getDateRange(key: ReportKey): { start: string; end: string } {
  const end = new Date();
  const start = new Date();

  switch (key) {
    case 'mrr':
      // Year to date for MRR
      start.setMonth(0); // January 1st
      start.setDate(1);
      break;

    case 'gross_volume':
    case 'active_subscribers':
    case 'subscriber_ltv':
      // Last 1 year
      start.setFullYear(start.getFullYear() - 1);
      break;

    case 'refund_count':
      // Last 6 months
      start.setMonth(start.getMonth() - 6);
      break;
  }

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

/**
 * Apply a preset configuration to the app state
 */
export function applyPreset(
  key: ReportKey,
  dispatch: React.Dispatch<any>
): void {
  const config = PRESET_CONFIGS[key];

  // 1. Set the report type
  dispatch(actions.setReport(key));

  // 2. Set appropriate date range
  const { start, end } = getDateRange(key);
  dispatch(actions.setRange(start, end));

  // 3. Reset existing selections to ensure clean state
  dispatch(actions.resetSelections());

  // 4. Select preset objects (in order)
  config.objects.forEach((objectName) => {
    dispatch(actions.toggleObject(objectName));
  });

  // 5. Select preset fields
  config.fields.forEach(({ object, field }) => {
    dispatch(actions.toggleField(object, field));
  });

  // 6. Apply metric configuration if present
  if (config.metric) {
    if (config.metric.name) {
      dispatch(actions.setMetricName(config.metric.name));
    }
    if (config.metric.source) {
      dispatch(actions.setMetricSource(config.metric.source));
    }
    if (config.metric.op) {
      dispatch(actions.setMetricOp(config.metric.op));
    }
    if (config.metric.scope) {
      dispatch(actions.setMetricScope(config.metric.scope));
    }
  }

  console.log(
    `[Preset] Applied "${key}" preset:`,
    {
      dateRange: `${start} to ${end}`,
      objects: config.objects,
      fields: config.fields.length,
      metric: config.metric ? config.metric.name : 'none',
    }
  );
}
