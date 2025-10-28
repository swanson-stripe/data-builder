/**
 * Format a number as currency
 */
export function currency(value: number, options?: { compact?: boolean }): string {
  const { compact = false } = options || {};

  if (compact) {
    if (Math.abs(value) >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    } else if (Math.abs(value) >= 1_000) {
      return `$${(value / 1_000).toFixed(1)}K`;
    }
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a number with commas
 */
export function number(value: number, options?: { decimals?: number }): string {
  const { decimals = 0 } = options || {};

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a date range
 */
export function dateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

/**
 * Calculate percentage change
 */
export function percentageChange(current: number, previous: number): string {
  if (previous === 0) {
    return current > 0 ? '+∞%' : '0%';
  }

  const change = ((current - previous) / previous) * 100;
  const formatted = change.toFixed(1);

  if (change > 0) {
    return `+${formatted}%`;
  } else if (change < 0) {
    return `${formatted}%`;
  }
  return '0%';
}

/**
 * Format a short date label
 */
export function shortDate(date: string): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/**
 * Format a delta value with sign and currency
 */
export function deltaCurrency(value: number): string {
  const formatted = currency(Math.abs(value));
  if (value > 0) {
    return `+${formatted}`;
  } else if (value < 0) {
    return `-${formatted}`;
  }
  return formatted;
}

/**
 * Format a delta value with sign and number
 */
export function deltaNumber(value: number, decimals: number = 0): string {
  const formatted = number(Math.abs(value), { decimals });
  if (value > 0) {
    return `+${formatted}`;
  } else if (value < 0) {
    return `-${formatted}`;
  }
  return formatted;
}
