/**
 * Tests for field utilities
 */
import { qualify, unqualify, pickTimestamp, getPrimaryTimestampField, isTimestampField } from '../fields';

describe('Field Utilities', () => {
  describe('qualify', () => {
    test('creates qualified field names', () => {
      expect(qualify('payment', 'amount')).toBe('payment.amount');
      expect(qualify('subscription', 'current_period_start')).toBe('subscription.current_period_start');
      expect(qualify('customer', 'id')).toBe('customer.id');
    });
  });

  describe('unqualify', () => {
    test('parses qualified field names', () => {
      expect(unqualify('payment.amount')).toEqual({ object: 'payment', field: 'amount' });
      expect(unqualify('subscription.current_period_start')).toEqual({
        object: 'subscription',
        field: 'current_period_start',
      });
    });

    test('handles unqualified field names', () => {
      expect(unqualify('amount')).toEqual({ object: '', field: 'amount' });
      expect(unqualify('created')).toEqual({ object: '', field: 'created' });
    });

    test('handles fields with multiple dots', () => {
      expect(unqualify('payment.meta.id')).toEqual({ object: 'payment', field: 'meta.id' });
    });
  });

  describe('pickTimestamp', () => {
    test('picks created for payments', () => {
      const payment = { id: 'pi_001', created: '2025-03-15', amount: 1000 };
      expect(pickTimestamp('payment', payment)).toBe('2025-03-15');
    });

    test('picks current_period_start for subscriptions (priority)', () => {
      const subscription = {
        id: 'sub_001',
        current_period_start: '2025-03-01',
        created: '2025-02-15',
      };
      expect(pickTimestamp('subscription', subscription)).toBe('2025-03-01');
    });

    test('falls back to created when primary field missing', () => {
      const subscription = {
        id: 'sub_001',
        created: '2025-02-15',
      };
      expect(pickTimestamp('subscription', subscription)).toBe('2025-02-15');
    });

    test('returns null when no timestamp fields present', () => {
      const record = { id: 'obj_001', name: 'Test' };
      expect(pickTimestamp('payment', record)).toBeNull();
    });

    test('works with both singular and plural object names', () => {
      const payment = { id: 'pi_001', created: '2025-03-15' };
      expect(pickTimestamp('payment', payment)).toBe('2025-03-15');
      expect(pickTimestamp('payments', payment)).toBe('2025-03-15');
    });

    test('picks arrival_date for payouts (priority)', () => {
      const payout = {
        id: 'po_001',
        arrival_date: '2025-03-20',
        created: '2025-03-15',
      };
      expect(pickTimestamp('payout', payout)).toBe('2025-03-20');
    });
  });

  describe('getPrimaryTimestampField', () => {
    test('returns primary timestamp field for each object', () => {
      expect(getPrimaryTimestampField('payment')).toBe('created');
      expect(getPrimaryTimestampField('subscription')).toBe('current_period_start');
      expect(getPrimaryTimestampField('payout')).toBe('arrival_date');
      expect(getPrimaryTimestampField('invoice')).toBe('created');
    });

    test('defaults to created for unknown objects', () => {
      expect(getPrimaryTimestampField('unknown_object')).toBe('created');
    });

    test('works with both singular and plural forms', () => {
      expect(getPrimaryTimestampField('payment')).toBe('created');
      expect(getPrimaryTimestampField('payments')).toBe('created');
    });
  });

  describe('isTimestampField', () => {
    test('identifies timestamp fields correctly', () => {
      expect(isTimestampField('payment', 'created')).toBe(true);
      expect(isTimestampField('subscription', 'current_period_start')).toBe(true);
      expect(isTimestampField('subscription', 'created')).toBe(true);
      expect(isTimestampField('payout', 'arrival_date')).toBe(true);
    });

    test('returns false for non-timestamp fields', () => {
      expect(isTimestampField('payment', 'amount')).toBe(false);
      expect(isTimestampField('customer', 'email')).toBe(false);
      expect(isTimestampField('subscription', 'price_id')).toBe(false);
    });

    test('works with both singular and plural forms', () => {
      expect(isTimestampField('payment', 'created')).toBe(true);
      expect(isTimestampField('payments', 'created')).toBe(true);
    });
  });
});
