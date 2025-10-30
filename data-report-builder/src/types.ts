export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'id';

export type SchemaField = {
  name: string;
  label: string;
  type: FieldType;
  enum?: string[]; // Valid values for categorical string fields
};

export type SchemaObject = {
  name: string;
  label: string;
  fields: SchemaField[];
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

export type ReportKey =
  | 'mrr'
  | 'gross_volume'
  | 'active_subscribers'
  | 'refund_count'
  | 'subscriber_ltv';

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

export type MetricDef = {
  name: string;
  source?: {
    object: string;
    field: string;
  };
  op: MetricOp;
  type: MetricType; // replaces "scope"
};

export type MetricResult = {
  value: number | null;
  series: SeriesPoint[] | null;
  note?: string;
  kind?: ValueKind;
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
  operator: FilterOperator;
  value: string | number | boolean | string[] | [number, number];
};

export type FilterGroup = {
  conditions: FilterCondition[];
  logic: 'AND' | 'OR';
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
