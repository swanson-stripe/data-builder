export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'id';

export type SchemaField = {
  name: string;
  label: string;
  type: FieldType;
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

export type MetricOp = 'sum' | 'avg' | 'latest' | 'first';

export type MetricScope = 'per_bucket' | 'entire_period';

export type MetricDef = {
  name: string;
  source?: {
    object: string;
    field: string;
  };
  op: MetricOp;
  scope: MetricScope;
};

export type MetricResult = {
  value: number | null;
  series: SeriesPoint[] | null;
  note?: string;
};
