import { MetricDef, MetricResult, SeriesPoint } from '@/types';
import { Granularity } from '@/lib/time';

/**
 * Parameters for computing a metric
 */
export type ComputeMetricParams = {
  def: MetricDef;
  start: string;
  end: string;
  granularity: Granularity;
  generateSeries: () => { points: SeriesPoint[] };
  rows?: any[];
};

/**
 * Apply a metric operation to an array of values
 */
function applyOp(values: number[], op: MetricDef['op']): number | null {
  if (values.length === 0) return null;

  switch (op) {
    case 'sum':
      return values.reduce((acc, val) => acc + val, 0);

    case 'avg':
      return values.reduce((acc, val) => acc + val, 0) / values.length;

    case 'latest':
      return values[values.length - 1];

    case 'first':
      return values[0];

    default:
      return null;
  }
}

/**
 * Compute a metric based on the metric definition and data
 *
 * For now, uses the mock time-series data for the report.
 * Later this will be wired to actual field selection.
 */
export function computeMetric({
  def,
  start,
  end,
  granularity,
  generateSeries,
  rows,
}: ComputeMetricParams): MetricResult {
  // Check if source is defined
  if (!def.source) {
    return {
      value: null,
      series: null,
      note: 'Metric source removed. Choose a new source in the Metric tab.',
    };
  }

  // Generate the series from the report (mock data for now)
  const reportSeries = generateSeries();
  const bucketValues = reportSeries.points.map(p => p.value);

  // Handle different scopes
  if (def.scope === 'per_bucket') {
    // Use bucket values as-is for the series
    const series = reportSeries.points;

    // Headline value is the latest bucket value
    const value = bucketValues.length > 0 ? bucketValues[bucketValues.length - 1] : null;

    return {
      value,
      series,
    };
  } else if (def.scope === 'entire_period') {
    // Compute a single aggregate value over all buckets
    const value = applyOp(bucketValues, def.op);

    // For entire_period, we still provide the series for visualization
    // but the headline value is the period aggregate
    return {
      value,
      series: reportSeries.points,
      note: `${def.op.toUpperCase()} across entire period`,
    };
  }

  // Fallback
  return {
    value: null,
    series: null,
    note: 'Invalid metric configuration',
  };
}
