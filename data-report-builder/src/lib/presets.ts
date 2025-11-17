// src/lib/presets.ts
import { Granularity } from '@/lib/time';
import { MetricDef, FilterCondition, MetricOp, MetricType, CalculationOperator, UnitType, GroupBy } from '@/types';
import { AppAction, ChartType } from '@/state/app';
import { getGroupValues } from '@/lib/grouping';

export type PresetKey =
  | 'blank'
  | 'mrr'
  | 'gross_volume'
  | 'active_subscribers'
  | 'refund_count'
  | 'subscriber_ltv'
  | 'customer_acquisition'
  | 'payment_success_rate'
  | 'revenue_by_product';

type QualifiedField = { object: string; field: string };

type PresetBlock = {
  id: string;
  name: string;
  source: QualifiedField | undefined;
  op: MetricOp;
  type: MetricType;
  filters: FilterCondition[];
};

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
  // Optional multi-block calculation (for complex metrics like rates)
  multiBlock?: {
    blocks: PresetBlock[];
    calculation: {
      operator: CalculationOperator;
      leftOperand: string;
      rightOperand: string;
      resultUnitType?: UnitType;
    };
    outputUnit: 'rate' | 'volume' | 'count';
  };
  // Optional default time settings
  range?: { start: string; end: string; granularity: Granularity };
  // Optional filters to apply
  filters?: FilterCondition[];
  // Optional chart settings
  chartType?: ChartType;
  // Optional default sort for data list
  defaultSort?: {
    column: string; // Qualified field name: "object.field"
    direction: 'asc' | 'desc';
  };
  // Optional group by configuration
  groupBy?: Omit<GroupBy, 'autoAddedField'>; // Exclude autoAddedField from preset config
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
    range: { start: `${new Date().getFullYear()}-01-01`, end: todayISO(), granularity: 'week' },
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
    range: { start: `${new Date().getFullYear()}-01-01`, end: todayISO(), granularity: 'week' },
    filters: [
      {
        field: { object: 'subscription', field: 'status' },
        operator: 'equals',
        value: 'active',
      },
    ],
    defaultSort: {
      column: 'customer.email',
      direction: 'asc',
    },
  },

  gross_volume: {
    key: 'gross_volume',
    label: 'Gross Volume',
    objects: ['charge', 'customer'],
    fields: [
      { object: 'charge', field: 'id' },
      { object: 'charge', field: 'amount' },
      { object: 'charge', field: 'currency' },
      { object: 'charge', field: 'created' },
      { object: 'charge', field: 'status' },
      { object: 'customer', field: 'id' },
      { object: 'customer', field: 'email' },
    ],
    // Flow metric — sum amounts per bucket
    metric: {
      name: 'Gross Volume',
      source: { object: 'charge', field: 'amount' },
      op: 'sum',
      type: 'sum_over_period',
    },
    range: { start: `${new Date().getFullYear()}-01-01`, end: todayISO(), granularity: 'week' },
    defaultSort: {
      column: 'charge.created',
      direction: 'desc',
    },
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
    range: { start: `${new Date().getFullYear()}-01-01`, end: todayISO(), granularity: 'week' },
    // Only count subscriptions with status = 'active'
    filters: [
      {
        field: { object: 'subscription', field: 'status' },
        operator: 'in',
        value: ['active'],
      },
    ],
    defaultSort: {
      column: 'customer.email',
      direction: 'asc',
    },
  },

  refund_count: {
    key: 'refund_count',
    label: 'Refund Count',
    objects: ['refund', 'payment', 'charge', 'customer'],
    fields: [
      { object: 'refund', field: 'id' },
      { object: 'refund', field: 'created' },
      { object: 'refund', field: 'amount' },
      { object: 'refund', field: 'status' },
      { object: 'refund', field: 'reason' },
      { object: 'payment', field: 'id' },
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
    defaultSort: {
      column: 'refund.created',
      direction: 'desc',
    },
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
    // Average revenue per user - average over period (not latest snapshot)
    metric: {
      name: 'Average Revenue Per User (ARPU)',
      source: { object: 'invoice', field: 'amount_paid' },
      op: 'avg',
      type: 'average_over_period',
    },
    range: { start: `${new Date().getFullYear()}-01-01`, end: todayISO(), granularity: 'week' },
    defaultSort: {
      column: 'invoice.amount_paid',
      direction: 'desc',
    },
  },

  customer_acquisition: {
    key: 'customer_acquisition',
    label: 'Customer Acquisition',
    objects: ['customer', 'charge'],
    fields: [
      { object: 'customer', field: 'id' },
      { object: 'customer', field: 'email' },
      { object: 'customer', field: 'created' },
      { object: 'charge', field: 'id' },
      { object: 'charge', field: 'amount' },
      { object: 'charge', field: 'created' },
      { object: 'charge', field: 'status' },
    ],
    // Count new customers per period
    metric: {
      name: 'Customer Acquisition',
      source: { object: 'customer', field: 'id' },
      op: 'count',
      type: 'sum_over_period',
    },
    range: { start: `${new Date().getFullYear()}-01-01`, end: todayISO(), granularity: 'week' },
    chartType: 'bar',
    defaultSort: {
      column: 'customer.created',
      direction: 'desc',
    },
  },

  payment_success_rate: {
    key: 'payment_success_rate',
    label: 'Payment Success Rate',
    objects: ['charge'],
    fields: [
      { object: 'charge', field: 'id' },
      { object: 'charge', field: 'amount' },
      { object: 'charge', field: 'status' },
      { object: 'charge', field: 'created' },
    ],
    // Placeholder metric (will be replaced by multi-block calculation)
    metric: {
      name: 'Payment Success Rate',
      source: { object: 'charge', field: 'id' },
      op: 'count',
      type: 'sum_over_period',
    },
    // Multi-block calculation: succeeded / total (as rate/percentage)
    multiBlock: {
      blocks: [
        {
          id: 'successful_payments',
          name: 'Successful Payments',
          source: { object: 'charge', field: 'id' },
          op: 'count',
          type: 'sum_over_period',
          filters: [
            {
              field: { object: 'charge', field: 'status' },
              operator: 'equals',
              value: 'succeeded',
            },
          ],
        },
        {
          id: 'total_payments',
          name: 'Total Payments',
          source: { object: 'charge', field: 'id' },
          op: 'count',
          type: 'sum_over_period',
          filters: [],
        },
      ],
      calculation: {
        operator: 'divide',
        leftOperand: 'successful_payments',
        rightOperand: 'total_payments',
        resultUnitType: 'rate',
      },
      outputUnit: 'rate',
    },
    range: { 
      start: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0], 
      end: todayISO(), 
      granularity: 'day' 
    },
    filters: [], // No global filters, using block-level filters instead
    defaultSort: {
      column: 'charge.created',
      direction: 'desc',
    },
  },

  revenue_by_product: {
    key: 'revenue_by_product',
    label: 'Revenue by Product',
    objects: ['charge', 'product'],
    fields: [
      { object: 'product', field: 'name' },
      { object: 'product', field: 'id' },
      { object: 'charge', field: 'id' },
      { object: 'charge', field: 'amount' },
      { object: 'charge', field: 'created' },
      { object: 'charge', field: 'status' },
    ],
    // Sum payment amounts
    metric: {
      name: 'Revenue by Product',
      source: { object: 'charge', field: 'amount' },
      op: 'sum',
      type: 'sum_over_period',
    },
    range: { 
      start: `${new Date().getFullYear()}-01-01`, 
      end: todayISO(), 
      granularity: 'week' 
    },
    chartType: 'bar',
    defaultSort: {
      column: 'charge.amount',
      direction: 'desc',
    },
    groupBy: {
      field: { object: 'product', field: 'name' },
      selectedValues: [], // Empty array means show top 10 values from dataset
    },
  },
};

export const PRESET_OPTIONS = Object.values(PRESET_CONFIGS).map(p => ({
  key: p.key,
  label: p.label,
}));

export function applyPreset(
  key: PresetKey,
  dispatch: (a: AppAction) => void,
  currentState?: any, // Optional: pass current state to check existing blocks
  warehouse?: any // Optional: warehouse store for resolving groupBy values
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
  
  // Clear any formula calculation and extra blocks (unless multi-block preset)
  if (!p.multiBlock) {
    dispatch({ type: 'SET_CALCULATION', payload: undefined });
    
    // Clear exposeBlocks (presets don't expose intermediate blocks)
    if (currentState?.metricFormula?.exposeBlocks?.length > 0) {
      currentState.metricFormula.exposeBlocks.forEach((blockId: string) => {
        dispatch({ type: 'TOGGLE_EXPOSE_BLOCK', payload: blockId });
      });
    }
    
    // Remove any extra blocks beyond block_1 (single-block presets only)
    if (currentState?.metricFormula?.blocks) {
      currentState.metricFormula.blocks.forEach((block: any) => {
        if (block.id !== 'block_1') {
          dispatch({ type: 'REMOVE_METRIC_BLOCK', payload: block.id });
        }
      });
    }
  } else {
    // Multi-block preset: clear all existing blocks first
    if (currentState?.metricFormula?.blocks) {
      currentState.metricFormula.blocks.forEach((block: any) => {
        dispatch({ type: 'REMOVE_METRIC_BLOCK', payload: block.id });
      });
    }
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
  if (p.multiBlock) {
    // Multi-block calculation (e.g., Payment Success Rate)
    dispatch({ type: 'SET_METRIC_NAME', payload: p.metric.name });
    dispatch({ type: 'SET_METRIC_FORMULA_NAME', payload: p.metric.name });
    
    // Add all blocks
    for (const block of p.multiBlock.blocks) {
      dispatch({ 
        type: 'ADD_METRIC_BLOCK', 
        payload: {
          id: block.id,
          name: block.name,
          source: block.source,
          op: block.op,
          type: block.type,
          filters: block.filters,
        }
      });
    }
    
    // Set up the calculation formula with result unit type
    dispatch({ 
      type: 'SET_CALCULATION', 
      payload: {
        operator: p.multiBlock.calculation.operator,
        leftOperand: p.multiBlock.calculation.leftOperand,
        rightOperand: p.multiBlock.calculation.rightOperand,
        resultUnitType: p.multiBlock.calculation.resultUnitType,
      }
    });
  } else if (p.metric) {
    // Single-block metric
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

  // Apply default sort if specified
  if (p.defaultSort) {
    dispatch({ 
      type: 'SET_DATA_LIST_SORT', 
      payload: {
        column: p.defaultSort.column,
        direction: p.defaultSort.direction,
      }
    });
  }

  // Apply groupBy if specified
  if (p.groupBy && warehouse) {
    const selectedValues = p.groupBy.selectedValues.length > 0
      ? p.groupBy.selectedValues
      : getGroupValues(warehouse, p.groupBy.field, 10);

    dispatch({
      type: 'SET_GROUP_BY',
      payload: {
        field: p.groupBy.field,
        selectedValues,
        autoAddedField: false,
      }
    });
  }
}
