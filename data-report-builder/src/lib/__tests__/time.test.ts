/**
 * Unit tests for time utilities
 *
 * These tests validate time/date range utilities and granularity validation.
 * To run with a test runner, install vitest or jest and update the import.
 */

// Test runner import (uncomment when test runner is installed):
// import { describe, it, expect } from 'vitest';

import {
  rangeByGranularity,
  bucketLabel,
  validateGranularityRange,
  suggestGranularity,
  Granularity,
} from '../time';

// Standalone test validation
if (typeof describe === 'undefined') {
  console.log('⚠️  No test runner detected. Tests are defined but not executed.');
  console.log('   Install vitest: npm i -D vitest');
  console.log('   Then run: npm test');
  // @ts-ignore
  global.describe = () => {};
  // @ts-ignore
  global.it = () => {};
}

describe('time utilities', () => {
  describe('rangeByGranularity', () => {
    it('generates daily ranges', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-05');
      const dates = rangeByGranularity(start, end, 'day');
      expect(dates.length).toBe(5);
      expect(dates[0].toISOString().split('T')[0]).toBe('2024-01-01');
      expect(dates[4].toISOString().split('T')[0]).toBe('2024-01-05');
    });

    it('generates weekly ranges', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-29');
      const dates = rangeByGranularity(start, end, 'week');
      expect(dates.length).toBeGreaterThanOrEqual(4);
      expect(dates.length).toBeLessThanOrEqual(5);
    });

    it('generates monthly ranges', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-06-01');
      const dates = rangeByGranularity(start, end, 'month');
      expect(dates.length).toBe(6);
    });

    it('generates quarterly ranges', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');
      const dates = rangeByGranularity(start, end, 'quarter');
      expect(dates.length).toBe(4);
    });

    it('generates yearly ranges', () => {
      const start = new Date('2020-01-01');
      const end = new Date('2024-01-01');
      const dates = rangeByGranularity(start, end, 'year');
      expect(dates.length).toBe(5);
    });
  });

  describe('bucketLabel', () => {
    it('formats day labels', () => {
      const date = new Date('2024-03-15');
      expect(bucketLabel(date, 'day')).toBe('2024-03-15');
    });

    it('formats month labels', () => {
      const date = new Date('2024-03-15');
      expect(bucketLabel(date, 'month')).toBe('2024-03');
    });

    it('formats quarter labels', () => {
      const q1 = new Date('2024-01-15');
      const q2 = new Date('2024-04-15');
      const q3 = new Date('2024-07-15');
      const q4 = new Date('2024-10-15');
      expect(bucketLabel(q1, 'quarter')).toBe('2024-Q1');
      expect(bucketLabel(q2, 'quarter')).toBe('2024-Q2');
      expect(bucketLabel(q3, 'quarter')).toBe('2024-Q3');
      expect(bucketLabel(q4, 'quarter')).toBe('2024-Q4');
    });

    it('formats year labels', () => {
      const date = new Date('2024-06-15');
      expect(bucketLabel(date, 'year')).toBe('2024');
    });
  });

  describe('validateGranularityRange', () => {
    it('validates acceptable ranges', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const result = validateGranularityRange(start, end, 'day');
      expect(result.valid).toBe(true);
      expect(result.bucketCount).toBe(31);
      expect(result.warning).toBeUndefined();
    });

    it('rejects excessive ranges', () => {
      const start = new Date('2020-01-01');
      const end = new Date('2024-12-31');
      const result = validateGranularityRange(start, end, 'day', 500);
      expect(result.valid).toBe(false);
      expect(result.bucketCount).toBeGreaterThan(500);
      expect(result.warning).toContain('Too many data points');
    });

    it('respects custom maxBuckets', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');
      const result = validateGranularityRange(start, end, 'day', 100);
      expect(result.valid).toBe(false);
      expect(result.bucketCount).toBeGreaterThan(100);
    });
  });

  describe('suggestGranularity', () => {
    it('suggests day for short ranges', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      expect(suggestGranularity(start, end)).toBe('day');
    });

    it('suggests week for 1-3 month ranges', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-03-31');
      expect(suggestGranularity(start, end)).toBe('week');
    });

    it('suggests month for 3 month - 2 year ranges', () => {
      const start = new Date('2023-01-01');
      const end = new Date('2024-12-31');
      expect(suggestGranularity(start, end)).toBe('month');
    });

    it('suggests quarter for 2-5 year ranges', () => {
      const start = new Date('2020-01-01');
      const end = new Date('2024-12-31');
      expect(suggestGranularity(start, end)).toBe('quarter');
    });

    it('suggests year for very long ranges', () => {
      const start = new Date('2015-01-01');
      const end = new Date('2024-12-31');
      expect(suggestGranularity(start, end)).toBe('year');
    });
  });
});
