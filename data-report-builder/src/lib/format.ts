/**
 * Format a number as currency (assumes value is in cents)
 */
export function currency(value: number, options?: { compact?: boolean }): string {
  const { compact = false } = options || {};
  
  // Convert cents to dollars
  const dollars = value / 100;

  if (compact) {
    if (Math.abs(dollars) >= 1_000_000) {
      return `$${(dollars / 1_000_000).toFixed(2)}M`;
    } else if (Math.abs(dollars) >= 1_000) {
      return `$${(dollars / 1_000).toFixed(1)}K`;
    }
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Format a number with commas
 */
export function number(value: number, options?: { decimals?: number; compact?: boolean }): string {
  const { decimals = 0, compact = false } = options || {};

  if (compact) {
    if (Math.abs(value) >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(2)}M`;
    } else if (Math.abs(value) >= 10_000) {
      return `${(value / 1_000).toFixed(1)}K`;
    }
  }

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
  // Parse as local date to avoid timezone shifts
  // For "2025-07", create July 1st in local time, not UTC
  const parts = date.split('-');
  const d = parts.length === 2
    ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1)
    : new Date(date);
  
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

/**
 * Format a metric value based on its kind
 */
export function formatMetricValue(
  value: number | null,
  kind: 'number' | 'currency' | 'string' = 'number'
): string {
  if (value === null) return 'N/A';

  switch (kind) {
    case 'currency':
      return currency(value);
    case 'number':
      return number(value);
    case 'string':
      // For string counts, show as plain number without currency
      return number(value);
    default:
      return number(value);
  }
}
