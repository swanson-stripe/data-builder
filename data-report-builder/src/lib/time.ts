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

/**
 * Calculate the date range (start and end) for a given bucket date and granularity
 * Returns ISO date strings in format YYYY-MM-DD
 */
export function getBucketRange(
  bucketDate: Date,
  granularity: Granularity
): { start: string; end: string } {
  const start = new Date(bucketDate);
  const end = new Date(bucketDate);

  switch (granularity) {
    case 'day':
      // Same day, end at 23:59:59
      end.setDate(end.getDate() + 1);
      break;
    case 'week':
      // Start on Sunday of that week
      start.setDate(start.getDate() - start.getDay());
      // Set end to 7 days after start
      end.setTime(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      // First day of month to first day of next month
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(1);
      break;
    case 'quarter':
      // First day of quarter to first day of next quarter
      const quarterStartMonth = Math.floor(start.getMonth() / 3) * 3;
      start.setMonth(quarterStartMonth);
      start.setDate(1);
      end.setMonth(quarterStartMonth + 3);
      end.setDate(1);
      break;
    case 'year':
      // First day of year to first day of next year
      start.setMonth(0);
      start.setDate(1);
      end.setFullYear(end.getFullYear() + 1);
      end.setMonth(0);
      end.setDate(1);
      break;
  }

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}
