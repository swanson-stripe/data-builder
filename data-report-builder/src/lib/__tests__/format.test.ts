/**
 * Unit tests for format utilities
 *
 * These tests demonstrate the expected behavior of formatting functions.
 * To run with a test runner, install vitest or jest and update the import.
 */

// Test runner import (uncomment when test runner is installed):
// import { describe, it, expect } from 'vitest';

import { currency, number, dateRange, percentageChange, shortDate } from '../format';

// Standalone test validation - can be run directly with: npx tsx format.test.ts
if (typeof describe === 'undefined') {
  console.log('⚠️  No test runner detected. Tests are defined but not executed.');
  console.log('   Install vitest: npm i -D vitest');
  console.log('   Then run: npm test');
  // @ts-ignore
  global.describe = () => {};
  // @ts-ignore
  global.it = () => {};
}

describe('format utilities', () => {
  describe('currency', () => {
    it('formats small amounts', () => {
      expect(currency(123)).toBe('$123');
      expect(currency(999)).toBe('$999');
    });

    it('formats thousands with K suffix', () => {
      expect(currency(1500)).toBe('$1.5K');
      expect(currency(45000)).toBe('$45.0K');
      expect(currency(999999)).toBe('$1000.0K');
    });

    it('formats millions with M suffix', () => {
      expect(currency(1000000)).toBe('$1.00M');
      expect(currency(2500000)).toBe('$2.50M');
      expect(currency(10000000)).toBe('$10.00M');
    });

    it('formats with compact option', () => {
      expect(currency(1500, { compact: true })).toBe('$2K');
      expect(currency(1500000, { compact: true })).toBe('$2M');
    });
  });

  describe('number', () => {
    it('formats integers', () => {
      expect(number(100)).toBe('100');
      expect(number(1000)).toBe('1,000');
      expect(number(1000000)).toBe('1,000,000');
    });

    it('formats decimals with custom precision', () => {
      expect(number(123.456, { decimals: 2 })).toBe('123.46');
      expect(number(123.456, { decimals: 0 })).toBe('123');
      expect(number(123.456, { decimals: 3 })).toBe('123.456');
    });
  });

  describe('dateRange', () => {
    it('formats date ranges correctly', () => {
      expect(dateRange('2024-01-01', '2024-01-31')).toBe('Jan 1, 2024 - Jan 31, 2024');
      expect(dateRange('2024-01-01', '2024-12-31')).toBe('Jan 1, 2024 - Dec 31, 2024');
      expect(dateRange('2023-06-15', '2024-06-15')).toBe('Jun 15, 2023 - Jun 15, 2024');
    });
  });

  describe('percentageChange', () => {
    it('calculates positive percentage changes', () => {
      expect(percentageChange(150, 100)).toBe('+50%');
      expect(percentageChange(200, 100)).toBe('+100%');
    });

    it('calculates negative percentage changes', () => {
      expect(percentageChange(50, 100)).toBe('-50%');
      expect(percentageChange(75, 100)).toBe('-25%');
    });

    it('handles zero previous value', () => {
      expect(percentageChange(100, 0)).toBe('+∞');
    });

    it('handles zero current value', () => {
      expect(percentageChange(0, 100)).toBe('-100%');
    });

    it('handles no change', () => {
      expect(percentageChange(100, 100)).toBe('+0%');
    });
  });

  describe('shortDate', () => {
    it('formats dates in short format', () => {
      expect(shortDate('2024-01-15')).toBe('Jan 15');
      expect(shortDate('2024-12-31')).toBe('Dec 31');
    });
  });
});
