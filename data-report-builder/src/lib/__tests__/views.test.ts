/**
 * Tests for view utilities
 */
import {
  buildDataListView,
  filterRowsByDate,
  getRowKey,
  sortRowsByField,
  toUnqualifiedRecord,
  type RowView,
} from '../views';
import { warehouse } from '@/data/warehouse';

describe('View Utilities', () => {
  describe('buildDataListView', () => {
    test('creates RowView[] with qualified keys', () => {
      const rows = buildDataListView({
        store: warehouse,
        selectedObjects: ['payment'],
        selectedFields: [
          { object: 'payment', field: 'id' },
          { object: 'payment', field: 'amount' },
        ],
      });

      expect(rows.length).toBeGreaterThan(0);
      const firstRow = rows[0];

      // Check structure
      expect(firstRow).toHaveProperty('display');
      expect(firstRow).toHaveProperty('pk');
      expect(firstRow).toHaveProperty('ts');

      // Check qualified keys
      expect(firstRow.display).toHaveProperty('payment.id');
      expect(firstRow.display).toHaveProperty('payment.amount');

      // Check pk
      expect(firstRow.pk.object).toBe('payment');
      expect(firstRow.pk.id).toBeDefined();

      // Check timestamp
      expect(firstRow.ts).toBeDefined();
    });

    test('handles multiple objects', () => {
      const rows = buildDataListView({
        store: warehouse,
        selectedObjects: ['payment', 'customer'],
        selectedFields: [
          { object: 'payment', field: 'id' },
          { object: 'customer', field: 'email' },
        ],
      });

      const paymentRows = rows.filter(r => r.pk.object === 'payment');
      const customerRows = rows.filter(r => r.pk.object === 'customer');

      expect(paymentRows.length).toBeGreaterThan(0);
      expect(customerRows.length).toBeGreaterThan(0);

      // Check payment row has payment fields
      expect(paymentRows[0].display).toHaveProperty('payment.id');
      expect(paymentRows[0].display).not.toHaveProperty('customer.email');

      // Check customer row has customer fields
      expect(customerRows[0].display).toHaveProperty('customer.email');
      expect(customerRows[0].display).not.toHaveProperty('payment.id');
    });

    test('handles empty selections', () => {
      const rows = buildDataListView({
        store: warehouse,
        selectedObjects: [],
        selectedFields: [],
      });

      expect(rows).toEqual([]);
    });

    test('handles invalid object names', () => {
      const rows = buildDataListView({
        store: warehouse,
        selectedObjects: ['invalid_object'],
        selectedFields: [{ object: 'invalid_object', field: 'id' }],
      });

      expect(rows).toEqual([]);
    });

    test('picks canonical timestamp for each object', () => {
      // Test payment (uses 'created')
      const paymentRows = buildDataListView({
        store: warehouse,
        selectedObjects: ['payment'],
        selectedFields: [{ object: 'payment', field: 'id' }],
      });

      expect(paymentRows[0].ts).toBeDefined();
      expect(paymentRows[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Test subscription (uses 'current_period_start')
      const subscriptionRows = buildDataListView({
        store: warehouse,
        selectedObjects: ['subscription'],
        selectedFields: [{ object: 'subscription', field: 'id' }],
      });

      expect(subscriptionRows[0].ts).toBeDefined();
      expect(subscriptionRows[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('filterRowsByDate', () => {
    let rows: RowView[];

    beforeEach(() => {
      rows = buildDataListView({
        store: warehouse,
        selectedObjects: ['payment'],
        selectedFields: [{ object: 'payment', field: 'id' }],
      });
    });

    test('filters rows within date range', () => {
      const filtered = filterRowsByDate(rows, '2025-03-01', '2025-03-31');

      filtered.forEach(row => {
        expect(row.ts).toBeDefined();
        if (row.ts) {
          const date = new Date(row.ts);
          expect(date >= new Date('2025-03-01')).toBe(true);
          expect(date <= new Date('2025-03-31')).toBe(true);
        }
      });
    });

    test('returns empty array for range with no data', () => {
      const filtered = filterRowsByDate(rows, '2024-01-01', '2024-01-31');
      expect(filtered).toEqual([]);
    });

    test('excludes rows without timestamps', () => {
      const rowsWithNull = [
        ...rows,
        {
          display: { 'test.id': '1' },
          pk: { object: 'test', id: '1' },
          ts: null,
        },
      ];

      const filtered = filterRowsByDate(rowsWithNull, '2025-01-01', '2025-12-31');
      expect(filtered.every(r => r.ts !== null)).toBe(true);
    });
  });

  describe('getRowKey', () => {
    test('generates rowKey from RowView', () => {
      const row: RowView = {
        display: { 'payment.id': 'pi_001' },
        pk: { object: 'payment', id: 'pi_001' },
        ts: '2025-03-15',
      };

      expect(getRowKey(row)).toBe('payment:pi_001');
    });

    test('works with different object types', () => {
      const customerRow: RowView = {
        display: {},
        pk: { object: 'customer', id: 'cus_042' },
        ts: null,
      };

      expect(getRowKey(customerRow)).toBe('customer:cus_042');
    });
  });

  describe('sortRowsByField', () => {
    let rows: RowView[];

    beforeEach(() => {
      rows = [
        {
          display: { 'payment.amount': 1000, 'payment.id': 'pi_001' },
          pk: { object: 'payment', id: 'pi_001' },
          ts: '2025-03-15',
        },
        {
          display: { 'payment.amount': 500, 'payment.id': 'pi_002' },
          pk: { object: 'payment', id: 'pi_002' },
          ts: '2025-03-16',
        },
        {
          display: { 'payment.amount': 2000, 'payment.id': 'pi_003' },
          pk: { object: 'payment', id: 'pi_003' },
          ts: '2025-03-17',
        },
      ];
    });

    test('sorts ascending', () => {
      const sorted = sortRowsByField(rows, 'payment.amount', 'asc');

      expect(sorted[0].display['payment.amount']).toBe(500);
      expect(sorted[1].display['payment.amount']).toBe(1000);
      expect(sorted[2].display['payment.amount']).toBe(2000);
    });

    test('sorts descending', () => {
      const sorted = sortRowsByField(rows, 'payment.amount', 'desc');

      expect(sorted[0].display['payment.amount']).toBe(2000);
      expect(sorted[1].display['payment.amount']).toBe(1000);
      expect(sorted[2].display['payment.amount']).toBe(500);
    });

    test('handles null values', () => {
      const rowsWithNull = [
        ...rows,
        {
          display: { 'payment.amount': null, 'payment.id': 'pi_004' },
          pk: { object: 'payment', id: 'pi_004' },
          ts: null,
        },
      ];

      const sorted = sortRowsByField(rowsWithNull, 'payment.amount', 'asc');
      expect(sorted[sorted.length - 1].display['payment.amount']).toBeNull();
    });

    test('sorts strings', () => {
      const stringRows: RowView[] = [
        {
          display: { 'customer.name': 'Charlie' },
          pk: { object: 'customer', id: 'cus_003' },
          ts: null,
        },
        {
          display: { 'customer.name': 'Alice' },
          pk: { object: 'customer', id: 'cus_001' },
          ts: null,
        },
        {
          display: { 'customer.name': 'Bob' },
          pk: { object: 'customer', id: 'cus_002' },
          ts: null,
        },
      ];

      const sorted = sortRowsByField(stringRows, 'customer.name', 'asc');

      expect(sorted[0].display['customer.name']).toBe('Alice');
      expect(sorted[1].display['customer.name']).toBe('Bob');
      expect(sorted[2].display['customer.name']).toBe('Charlie');
    });
  });

  describe('toUnqualifiedRecord', () => {
    test('converts RowView to unqualified record', () => {
      const row: RowView = {
        display: {
          'payment.id': 'pi_001',
          'payment.amount': 29900,
          'payment.created': '2025-03-15',
        },
        pk: { object: 'payment', id: 'pi_001' },
        ts: '2025-03-15',
      };

      const record = toUnqualifiedRecord(row, 'payment');

      expect(record).toEqual({
        id: 'pi_001',
        amount: 29900,
        created: '2025-03-15',
      });
    });

    test('filters out fields from other objects', () => {
      const row: RowView = {
        display: {
          'payment.id': 'pi_001',
          'payment.amount': 29900,
          'customer.email': 'test@example.com',
        },
        pk: { object: 'payment', id: 'pi_001' },
        ts: '2025-03-15',
      };

      const record = toUnqualifiedRecord(row, 'payment');

      expect(record).toEqual({
        id: 'pi_001',
        amount: 29900,
      });
      expect(record).not.toHaveProperty('email');
    });

    test('always includes id from pk', () => {
      const row: RowView = {
        display: {},
        pk: { object: 'payment', id: 'pi_001' },
        ts: null,
      };

      const record = toUnqualifiedRecord(row, 'payment');

      expect(record.id).toBe('pi_001');
    });
  });
});
