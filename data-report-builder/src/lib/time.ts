export type Granularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * Generate an array of Date objects from start to end based on granularity
 */
export function rangeByGranularity(
  start: Date,
  end: Date,
  granularity: Granularity
): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);

  while (current <= end) {
    dates.push(new Date(current));

    switch (granularity) {
      case 'day':
        current.setDate(current.getDate() + 1);
        break;
      case 'week':
        current.setDate(current.getDate() + 7);
        break;
      case 'month':
        current.setMonth(current.getMonth() + 1);
        break;
      case 'quarter':
        current.setMonth(current.getMonth() + 3);
        break;
      case 'year':
        current.setFullYear(current.getFullYear() + 1);
        break;
    }
  }

  return dates;
}

/**
 * Format a date as a string label based on granularity
 */
export function bucketLabel(date: Date, granularity: Granularity): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (granularity) {
    case 'day':
      return `${year}-${month}-${day}`;
    case 'week': {
      // Format as week starting date
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start on Sunday
      const wYear = weekStart.getFullYear();
      const wMonth = String(weekStart.getMonth() + 1).padStart(2, '0');
      const wDay = String(weekStart.getDate()).padStart(2, '0');
      return `${wYear}-${wMonth}-${wDay}`;
    }
    case 'month':
      return `${year}-${month}`;
    case 'quarter': {
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `${year}-Q${quarter}`;
    }
    case 'year':
      return `${year}`;
  }
}

/**
 * Validate granularity-range combination to prevent excessive data points
 * Maximum recommended: 500 buckets
 */
export function validateGranularityRange(
  start: Date,
  end: Date,
  granularity: Granularity,
  maxBuckets = 500
): { valid: boolean; bucketCount: number; warning?: string } {
  const dates = rangeByGranularity(start, end, granularity);
  const bucketCount = dates.length;

  if (bucketCount > maxBuckets) {
    return {
      valid: false,
      bucketCount,
      warning: `Too many data points (${bucketCount}). Maximum ${maxBuckets} allowed. Try a coarser granularity.`,
    };
  }

  return { valid: true, bucketCount };
}

/**
 * Suggest optimal granularity for a given date range
 */
export function suggestGranularity(start: Date, end: Date): Granularity {
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 31) return 'day';
  if (diffDays <= 90) return 'week';
  if (diffDays <= 730) return 'month'; // ~2 years
  if (diffDays <= 1825) return 'quarter'; // ~5 years
  return 'year';
}
