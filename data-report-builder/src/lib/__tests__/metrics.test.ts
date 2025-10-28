import { computeMetric } from '../metrics';
import { MetricDef } from '@/types';

describe('computeMetric', () => {
  const mockGenerateSeries = () => ({
    points: [
      { date: '2024-01', value: 100 },
      { date: '2024-02', value: 200 },
      { date: '2024-03', value: 300 },
      { date: '2024-04', value: 400 },
      { date: '2024-05', value: 500 },
    ],
  });

  it('returns null when no source is defined', () => {
    const def: MetricDef = {
      name: 'Test Metric',
      op: 'sum',
      scope: 'per_bucket',
    };

    const result = computeMetric({
      def,
      start: '2024-01-01',
      end: '2024-05-31',
      granularity: 'month',
      generateSeries: mockGenerateSeries,
    });

    expect(result.value).toBeNull();
    expect(result.series).toBeNull();
    expect(result.note).toBe('No metric source selected');
  });

  it('computes per_bucket metric with latest value as headline', () => {
    const def: MetricDef = {
      name: 'Test Metric',
      source: { object: 'subscription', field: 'amount' },
      op: 'sum',
      scope: 'per_bucket',
    };

    const result = computeMetric({
      def,
      start: '2024-01-01',
      end: '2024-05-31',
      granularity: 'month',
      generateSeries: mockGenerateSeries,
    });

    expect(result.value).toBe(500); // Latest bucket
    expect(result.series).toHaveLength(5);
    expect(result.series?.[0].value).toBe(100);
  });

  it('computes entire_period sum correctly', () => {
    const def: MetricDef = {
      name: 'Test Metric',
      source: { object: 'subscription', field: 'amount' },
      op: 'sum',
      scope: 'entire_period',
    };

    const result = computeMetric({
      def,
      start: '2024-01-01',
      end: '2024-05-31',
      granularity: 'month',
      generateSeries: mockGenerateSeries,
    });

    expect(result.value).toBe(1500); // 100 + 200 + 300 + 400 + 500
    expect(result.series).toHaveLength(5);
    expect(result.note).toContain('SUM');
  });

  it('computes entire_period avg correctly', () => {
    const def: MetricDef = {
      name: 'Test Metric',
      source: { object: 'subscription', field: 'amount' },
      op: 'avg',
      scope: 'entire_period',
    };

    const result = computeMetric({
      def,
      start: '2024-01-01',
      end: '2024-05-31',
      granularity: 'month',
      generateSeries: mockGenerateSeries,
    });

    expect(result.value).toBe(300); // (100 + 200 + 300 + 400 + 500) / 5
    expect(result.note).toContain('AVG');
  });

  it('computes entire_period latest correctly', () => {
    const def: MetricDef = {
      name: 'Test Metric',
      source: { object: 'subscription', field: 'amount' },
      op: 'latest',
      scope: 'entire_period',
    };

    const result = computeMetric({
      def,
      start: '2024-01-01',
      end: '2024-05-31',
      granularity: 'month',
      generateSeries: mockGenerateSeries,
    });

    expect(result.value).toBe(500); // Last value
    expect(result.note).toContain('LATEST');
  });

  it('computes entire_period first correctly', () => {
    const def: MetricDef = {
      name: 'Test Metric',
      source: { object: 'subscription', field: 'amount' },
      op: 'first',
      scope: 'entire_period',
    };

    const result = computeMetric({
      def,
      start: '2024-01-01',
      end: '2024-05-31',
      granularity: 'month',
      generateSeries: mockGenerateSeries,
    });

    expect(result.value).toBe(100); // First value
    expect(result.note).toContain('FIRST');
  });
});
