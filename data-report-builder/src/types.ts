export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'id';

export type SchemaField = {
  name: string;
  label: string;
  type: FieldType;
  enum?: string[]; // Valid values for categorical string fields
  definition?: string; // Field description from Stripe docs
};

export type SchemaObject = {
  name: string;
  label: string;
  fields: SchemaField[];
  definition?: string; // Table description from Stripe docs
  group?: string; // Category like "Billing", "Core", "Connect", etc.
};

export type Relationship = {
  from: string;
  to: string;
  type: 'one-to-many' | 'many-to-one' | 'many-to-many';
  via?: string;
  description?: string;
};

export type SchemaCatalog = {
  objects: SchemaObject[];
  relationships: Relationship[];
};

export type SeriesPoint = {
  date: string;
  value: number;
};

// Allow dynamic report IDs from taxonomy in addition to predefined preset keys
export type ReportKey = string;

// Legacy preset keys (for reference and backwards compatibility)
export type PresetReportKey =
  | 'blank'
  | 'mrr'
  | 'gross_volume'
  | 'active_subscribers'
  | 'refund_count'
  | 'subscriber_ltv'
  | 'customer_acquisition'
  | 'payment_success_rate'
  | 'revenue_by_product'
  | 'payment_acceptance_by_method'
  | 'payment_funnel'
  | 'payment_volume_by_attribute'
  | 'payments_net_revenue'
  | 'first_purchase_behavior'
  | 'active_customers'
  | 'purchase_frequency'
  | 'customer_ltv'
  | 'subscription_churn'
  | 'invoice_status'
  | 'current_balances'
  | 'balance_flows'
  | 'payouts_over_time'
  | 'dispute_rates'
  | 'disputes_by_reason'
  | 'discounted_revenue'
  | 'tax_by_jurisdiction';

export type ReportSeries = {
  key: ReportKey;
  label: string;
  points: SeriesPoint[];
};

export type MetricOp =
  | 'sum'
  | 'avg'
  | 'median'
  | 'mode'
  | 'count'
  | 'distinct_count';

export type MetricType =
  | 'sum_over_period'      // totals within each bucket or the entire range
  | 'average_over_period'  // mean within each bucket or over entire range
  | 'latest'               // snapshot at end of bucket/range
  | 'first';               // snapshot at start of bucket/range

export type ValueKind = 'number' | 'currency' | 'string';

// Unit types for metric calculations
export type UnitType = 'currency' | 'count' | 'date' | 'rate';

export type MetricDef = {
  name: string;
  source?: {
    object: string;
    field: string;
  };
  op: MetricOp;
  type: MetricType; // replaces "scope"
};

/**
 * Multi-block metric calculation types
 */
export type MetricBlock = {
  id: string; // unique identifier like "block_1"
  name: string; // user-facing name
  source?: { object: string; field: string };
  op: MetricOp;
  type: MetricType;
  filters: FilterCondition[]; // independent from data list filters
  unitType?: UnitType; // Inferred from source field or manually set
};

export type CalculationOperator = 'add' | 'subtract' | 'multiply' | 'divide';

export type CalculationStep = {
  operator: CalculationOperator;
  leftOperand: string; // block ID
  rightOperand: string; // block ID
  resultUnitType?: UnitType; // User-selected unit type for the result
};

export type MetricFormula = {
  name: string;
  blocks: MetricBlock[];
  calculation?: CalculationStep; // if undefined, uses first block (backward compatible)
  exposeBlocks?: string[]; // IDs of blocks to show as intermediate values
};

export type MetricResult = {
  value: number | null;
  series: SeriesPoint[] | null;
  note?: string;
  kind?: ValueKind;
  unitType?: UnitType; // Unit type for display and validation
};

export type BlockResult = {
  blockId: string;
  blockName: string;
  value: number | null;
  series: SeriesPoint[] | null;
  unitType?: UnitType; // Unit type for this block's result
};

/**
 * Filter types
 */
export type FilterOperator = 
  | 'equals' | 'not_equals'
  | 'greater_than' | 'less_than' | 'between'
  | 'contains' | 'in'
  | 'is_true' | 'is_false';

export type FilterCondition = {
  field: { object: string; field: string };
  qualifiedField?: string;
  operator: FilterOperator;
  value: string | number | boolean | string[] | [number, number];
};

export type FilterGroup = {
  conditions: FilterCondition[];
  logic: 'AND' | 'OR';
};

/**
 * Grouping types
 */
export type GroupBy = {
  field: { object: string; field: string };
  selectedValues: string[]; // Max 10 values
  autoAddedField?: boolean; // Track if field was auto-added
};

/**
 * Data catalog types
 */
export type Catalog = {
  customers: any[];
  payment_methods: any[];
  products: any[];
  prices: any[];
  subscriptions: any[];
  invoices: any[];
  payments: any[];
  refunds: any[];
  payouts: any[];
};

export type RowKey = string; // `${object}:${id}`

export type RowMeta = {
  object: string;
  id: string;
  rowKey: RowKey;
};

export type DisplayRow = Record<string, any> & {
  __meta: RowMeta;
};
