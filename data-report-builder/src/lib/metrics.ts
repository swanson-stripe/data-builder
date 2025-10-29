import { MetricDef, MetricResult, SeriesPoint, SchemaCatalog, ValueKind, MetricOp } from '@/types';
import { Granularity, rangeByGranularity, bucketLabel } from '@/lib/time';
import { pickTimestamp } from '@/lib/fields';
import { Warehouse } from '@/data/warehouse';

/**
 * Parameters for computing a metric
 */
export type ComputeMetricParams = {
  def: MetricDef;
  start: string;
  end: string;
  granularity: Granularity;
  store: Warehouse;
  include?: Set<string>; // Set of "${object}:${id}" for PK-based filtering
  schema?: SchemaCatalog;
};

/**
 * Infer value kind (currency, number, or string) from schema field
 */
export function inferValueKind(object: string, field: string, schema?: SchemaCatalog): ValueKind {
  if (!schema) return 'number';

  // Currency-like field names
  const currencyFields = ['amount', 'price', 'unit_amount', 'balance', 'total', 'amount_paid', 'amount_due'];
  if (currencyFields.some(cf => field.toLowerCase().includes(cf))) {
    return 'currency';
  }

  // Find the field in schema
  const schemaObj = schema.objects.find(o => o.name === object);
  if (!schemaObj) return 'number';

  const schemaField = schemaObj.fields.find(f => f.name === field);
  if (!schemaField) return 'number';

  // Type-based inference
  if (schemaField.type === 'number') return 'number';
  if (schemaField.type === 'string') return 'string';

  return 'number';
}

/**
 * Get best timestamp field for an object using pickTimestamp
 */
function getTimestampField(object: string, row: any): string | null {
  return pickTimestamp(object, row);
}

/**
 * Bucket rows by granularity
 */
export function bucketRows(
  rows: any[],
  object: string,
  start: string,
  end: string,
  granularity: Granularity
): Map<string, any[]> {
  const buckets = new Map<string, any[]>();
  const startDate = new Date(start);
  const endDate = new Date(end);

  // Initialize all buckets
  const bucketDates = rangeByGranularity(startDate, endDate, granularity);
  for (const date of bucketDates) {
    const label = bucketLabel(date, granularity);
    buckets.set(label, []);
  }

  // Place rows into buckets
  for (const row of rows) {
    const tsField = getTimestampField(object, row);
    if (!tsField || !row[tsField]) continue;

    const rowDate = new Date(row[tsField]);
    if (rowDate < startDate || rowDate > endDate) continue;

    const label = bucketLabel(rowDate, granularity);
    const bucket = buckets.get(label);
    if (bucket) {
      bucket.push(row);
    }
  }

  return buckets;
}

/**
 * Apply a metric operation to bucket data
 */
function applyOperation(
  bucketRows: any[],
  sourceField: string,
  op: MetricOp
): number | null {
  if (op === 'count') {
    return bucketRows.length;
  }

  if (op === 'distinct_count') {
    const values = bucketRows.map(row => row[sourceField]).filter(v => v != null);
    return new Set(values).size;
  }

  // Extract numeric values
  const values = bucketRows
    .map(row => {
      const val = row[sourceField];
      return typeof val === 'number' ? val : parseFloat(val);
    })
    .filter(v => !isNaN(v));

  if (values.length === 0) return null;

  switch (op) {
    case 'sum':
      return values.reduce((acc, val) => acc + val, 0);

    case 'avg':
      return values.reduce((acc, val) => acc + val, 0) / values.length;

    case 'median': {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    }

    case 'mode': {
      const freq = new Map<number, number>();
      values.forEach(v => freq.set(v, (freq.get(v) || 0) + 1));
      let maxFreq = 0;
      let mode: number | null = null;
      freq.forEach((count, value) => {
        if (count > maxFreq) {
          maxFreq = count;
          mode = value;
        }
      });
      return mode;
    }

    default:
      return null;
  }
}

/**
 * Compute a metric based on the metric definition and data from warehouse
 */
export function computeMetric({
  def,
  start,
  end,
  granularity,
  store,
  include,
  schema,
}: ComputeMetricParams): MetricResult {
  // Check if source is defined
  if (!def.source) {
    return {
      value: null,
      series: null,
      note: 'Select a metric source field',
    };
  }

  const { object, field } = def.source;
  const kind = inferValueKind(object, field, schema);

  // Get rows from warehouse for this object type
  // @ts-ignore - dynamic property access on Warehouse
  let allRows = store[object];

  // If singular form doesn't work, try plural form
  if (!allRows) {
    const pluralKey = object + 's' as keyof Warehouse;
    allRows = store[pluralKey];
  }

  // If still no rows found, return empty result
  if (!allRows || !Array.isArray(allRows)) {
    return {
      value: null,
      series: null,
      note: `No data found for ${object}`,
    };
  }

  // Filter rows by PK allowlist (if provided)
  let rows = allRows;
  if (include && include.size > 0) {
    rows = allRows.filter(row => {
      const rowKey = `${object}:${row.id}`;
      return include.has(rowKey);
    });
  }

  // If no rows after filtering, return zero/null
  if (rows.length === 0) {
    return {
      value: null,
      series: null,
      note: 'No data in selection',
    };
  }

  // Bucket the rows by timestamp using pickTimestamp
  const buckets = bucketRows(rows, object, start, end, granularity);
  const bucketEntries = Array.from(buckets.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  // Compute per-bucket values
  const perBucketValues: Array<{ date: string; value: number }> = [];

  for (const [bucketDate, bucketRows] of bucketEntries) {
    const bucketValue = applyOperation(bucketRows, field, def.op);
    if (bucketValue !== null) {
      perBucketValues.push({ date: bucketDate, value: bucketValue });
    } else {
      perBucketValues.push({ date: bucketDate, value: 0 });
    }
  }

  // Apply metric type for headline and series
  let headlineValue: number | null = null;
  const series: SeriesPoint[] = perBucketValues;

  const nonNullValues = perBucketValues.map(p => p.value).filter(v => v !== 0);

  switch (def.type) {
    case 'sum_over_period':
      headlineValue = perBucketValues.reduce((acc, p) => acc + p.value, 0);
      break;

    case 'average_over_period':
      headlineValue = nonNullValues.length > 0
        ? nonNullValues.reduce((acc, v) => acc + v, 0) / nonNullValues.length
        : null;
      break;

    case 'latest':
      headlineValue = perBucketValues.length > 0
        ? perBucketValues[perBucketValues.length - 1].value
        : null;
      break;

    case 'first':
      headlineValue = perBucketValues.length > 0
        ? perBucketValues[0].value
        : null;
      break;
  }

  return {
    value: headlineValue,
    series,
    kind,
  };
}
