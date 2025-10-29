/**
 * Test that metric operations work correctly with warehouse
 */
import { computeMetric } from '../metrics';
import { warehouse } from '@/data/warehouse';
import { schema } from '@/data/schema';
import { MetricDef } from '@/types';

describe('Metrics Warehouse Integration', () => {
  test('count operation on payments', () => {
    const metricDef: MetricDef = {
      name: 'Payment Count',
      source: { object: 'payment', field: 'id' },
      op: 'count',
      type: 'sum_over_period',
    };

    const result = computeMetric({
      def: metricDef,
      start: '2025-01-01',
      end: '2025-12-31',
      granularity: 'month',
      store: warehouse,
      schema,
    });

    // Should have a numeric value
    expect(result.value).toBeGreaterThan(0);
    expect(typeof result.value).toBe('number');

    // Should have series data
    expect(result.series).toBeDefined();
    expect(Array.isArray(result.series)).toBe(true);
  });

  test('sum operation on payment amounts', () => {
    const metricDef: MetricDef = {
      name: 'Total Payment Amount',
      source: { object: 'payment', field: 'amount' },
      op: 'sum',
      type: 'sum_over_period',
    };

    const result = computeMetric({
      def: metricDef,
      start: '2025-01-01',
      end: '2025-12-31',
      granularity: 'month',
      store: warehouse,
      schema,
    });

    // Should have a numeric value
    expect(result.value).toBeGreaterThan(0);
    expect(typeof result.value).toBe('number');

    // Value kind should be currency
    expect(result.kind).toBe('currency');
  });

  test('avg operation on subscription amounts', () => {
    const metricDef: MetricDef = {
      name: 'Avg Subscription',
      source: { object: 'subscription', field: 'id' },
      op: 'avg',
      type: 'average_over_period',
    };

    const result = computeMetric({
      def: metricDef,
      start: '2025-01-01',
      end: '2025-12-31',
      granularity: 'month',
      store: warehouse,
      schema,
    });

    // Should have a value (could be null if no data in range)
    expect(result.value !== undefined).toBe(true);
  });

  test('filters rows correctly by PK allowlist', () => {
    // Get first 5 payment IDs
    const selectedPaymentIds = warehouse.payments.slice(0, 5).map(p => `payment:${p.id}`);
    const includeSet = new Set(selectedPaymentIds);

    const metricDef: MetricDef = {
      name: 'Selected Payment Count',
      source: { object: 'payment', field: 'id' },
      op: 'count',
      type: 'sum_over_period',
    };

    const result = computeMetric({
      def: metricDef,
      start: '2025-01-01',
      end: '2025-12-31',
      granularity: 'month',
      store: warehouse,
      include: includeSet,
      schema,
    });

    // Total should be <= 5 (some might be outside date range)
    expect(result.value).toBeLessThanOrEqual(5);
  });

  test('warehouse has unqualified field access', () => {
    // Verify payments have unqualified fields
    expect(warehouse.payments.length).toBeGreaterThan(0);
    expect(warehouse.payments[0]).toHaveProperty('id');
    expect(warehouse.payments[0]).toHaveProperty('amount');
    expect(warehouse.payments[0]).toHaveProperty('created');

    // Should NOT have qualified fields
    expect(warehouse.payments[0]).not.toHaveProperty('payment.id');
    expect(warehouse.payments[0]).not.toHaveProperty('payment.amount');
  });
});
