import { ReportKey, ReportSeries, SeriesPoint, SchemaObject, FieldType } from '@/types';
import { rangeByGranularity, bucketLabel, Granularity } from '@/lib/time';
import { getObject } from './schema';
import seedData from './seed.json';

/**
 * Simple deterministic PRNG using a seeded Linear Congruential Generator
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    // LCG parameters from Numerical Recipes
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }
}

/**
 * Get base value and growth parameters for each report type
 */
function getReportConfig(key: ReportKey) {
  switch (key) {
    case 'mrr':
      return {
        label: 'Monthly Recurring Revenue',
        baseValue: 50000,
        growthRate: 0.05, // 5% monthly growth trend
        volatility: 0.15, // 15% random variation
        floor: 10000,
      };
    case 'gross_volume':
      return {
        label: 'Gross Volume',
        baseValue: 250000,
        growthRate: 0.04,
        volatility: 0.2,
        floor: 50000,
      };
    case 'active_subscribers':
      return {
        label: 'Active Subscribers',
        baseValue: 500,
        growthRate: 0.06,
        volatility: 0.1,
        floor: 100,
      };
    case 'refund_count':
      return {
        label: 'Refund Count',
        baseValue: 15,
        growthRate: 0.02,
        volatility: 0.3,
        floor: 0,
      };
    case 'subscriber_ltv':
      return {
        label: 'Subscriber Lifetime Value',
        baseValue: 2500,
        growthRate: 0.03,
        volatility: 0.12,
        floor: 500,
      };
  }
}

/**
 * Generate a time series with plausible data
 */
export function generateSeries({
  key,
  start,
  end,
  granularity = 'month',
  seed = 12345,
}: {
  key: ReportKey;
  start: Date;
  end: Date;
  granularity?: Granularity;
  seed?: number;
}): ReportSeries {
  const config = getReportConfig(key);
  const rng = new SeededRandom(seed);
  const dates = rangeByGranularity(start, end, granularity);
  const points: SeriesPoint[] = [];

  dates.forEach((date, index) => {
    // Calculate trend-based growth
    const growthFactor = Math.pow(1 + config.growthRate, index);
    const trendValue = config.baseValue * growthFactor;

    // Add random variation
    const variation = 1 + (rng.next() - 0.5) * 2 * config.volatility;
    let value = trendValue * variation;

    // Apply floor
    value = Math.max(value, config.floor);

    // Round based on magnitude
    if (value > 1000) {
      value = Math.round(value / 10) * 10; // Round to nearest 10
    } else if (value > 100) {
      value = Math.round(value);
    } else {
      value = Math.round(value * 10) / 10; // One decimal place
    }

    points.push({
      date: bucketLabel(date, granularity),
      value,
    });
  });

  return {
    key,
    label: config.label,
    points,
  };
}

/**
 * Generate mock field value based on field type
 */
function generateFieldValue(
  fieldName: string,
  fieldType: FieldType,
  rng: SeededRandom,
  index: number
): string | number | boolean {
  switch (fieldType) {
    case 'id':
      // Generate ID based on field name prefix
      const prefix = fieldName.split('_')[0].substring(0, 3);
      return `${prefix}_${String(index + 1).padStart(8, '0')}`;

    case 'string':
      // Generate contextual string values
      if (fieldName.includes('email')) {
        return `user${index + 1}@example.com`;
      }
      if (fieldName.includes('name')) {
        const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
        return `${firstNames[rng.nextInt(0, firstNames.length - 1)]} ${lastNames[rng.nextInt(0, lastNames.length - 1)]}`;
      }
      if (fieldName.includes('status')) {
        const statuses = ['active', 'inactive', 'pending', 'canceled', 'past_due'];
        return statuses[rng.nextInt(0, statuses.length - 1)];
      }
      if (fieldName.includes('currency')) {
        const currencies = ['usd', 'eur', 'gbp', 'jpy', 'cad'];
        return currencies[rng.nextInt(0, currencies.length - 1)];
      }
      if (fieldName.includes('type')) {
        return 'card';
      }
      if (fieldName.includes('brand')) {
        const brands = ['visa', 'mastercard', 'amex', 'discover'];
        return brands[rng.nextInt(0, brands.length - 1)];
      }
      if (fieldName.includes('last4')) {
        return String(rng.nextInt(1000, 9999));
      }
      if (fieldName.includes('description')) {
        return `Description for item ${index + 1}`;
      }
      if (fieldName.includes('reason')) {
        const reasons = ['requested_by_customer', 'duplicate', 'fraudulent'];
        return reasons[rng.nextInt(0, reasons.length - 1)];
      }
      if (fieldName.includes('interval')) {
        const intervals = ['month', 'year', 'week', 'day'];
        return intervals[rng.nextInt(0, intervals.length - 1)];
      }
      return `value_${index + 1}`;

    case 'number':
      // Generate contextual numbers
      if (fieldName.includes('amount') || fieldName.includes('balance') || fieldName.includes('price')) {
        return rng.nextInt(100, 100000);
      }
      if (fieldName.includes('quantity')) {
        return rng.nextInt(1, 10);
      }
      return rng.nextInt(0, 1000);

    case 'boolean':
      return rng.next() > 0.5;

    case 'date':
      // Generate dates within the last 2 years
      const now = Date.now();
      const twoYearsAgo = now - (2 * 365 * 24 * 60 * 60 * 1000);
      const randomTime = twoYearsAgo + rng.next() * (now - twoYearsAgo);
      return new Date(randomTime).toISOString().split('T')[0];

    default:
      return '';
  }
}

/**
 * Generate mock rows for data list based on selected objects
 */
export function mockRowsForDataList({
  objectsSelected,
  count = 50,
  seed = 12345,
}: {
  objectsSelected: string[];
  count?: number;
  seed?: number;
}): Record<string, string | number | boolean>[] {
  if (objectsSelected.length === 0) {
    return [];
  }

  const rng = new SeededRandom(seed);
  const rows: Record<string, string | number | boolean>[] = [];

  // Get the primary object (first selected)
  const primaryObjectName = objectsSelected[0];
  const primaryObject = getObject(primaryObjectName);

  if (!primaryObject) {
    return [];
  }

  // Collect all fields from selected objects
  const allFields: Array<{ field: string; type: FieldType; objectName: string }> = [];

  objectsSelected.forEach((objName) => {
    const obj = getObject(objName);
    if (obj) {
      obj.fields.forEach((field) => {
        allFields.push({
          field: `${objName}.${field.name}`,
          type: field.type,
          objectName: objName,
        });
      });
    }
  });

  // Generate rows
  for (let i = 0; i < count; i++) {
    const row: Record<string, string | number | boolean> = {};

    allFields.forEach(({ field, type }) => {
      const fieldName = field.split('.')[1];
      row[field] = generateFieldValue(fieldName, type, rng, i);
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Export a consistent default seed
 */
export const DEFAULT_SEED = 12345;

/**
 * Load seed data from JSON
 */
export function loadSeed(): Record<string, any[]> {
  return seedData as Record<string, any[]>;
}

/**
 * Expand seed data by sampling and perturbing to fill date range
 * Generates additional rows with date shifting and variance
 */
export function expandSeed({
  start,
  end,
  granularity = 'month',
  seed = 12345,
}: {
  start: Date;
  end: Date;
  granularity?: Granularity;
  seed?: number;
}): Record<string, any[]> {
  const rng = new SeededRandom(seed);
  const dates = rangeByGranularity(start, end, granularity);
  const baseSeed = loadSeed();
  const expanded: Record<string, any[]> = {};

  // For each entity type in seed data
  Object.keys(baseSeed).forEach((entityType) => {
    const baseRows = baseSeed[entityType];
    if (baseRows.length === 0) {
      expanded[entityType] = [];
      return;
    }

    const expandedRows: any[] = [];
    const rowsPerBucket = Math.ceil(baseRows.length / dates.length);

    // Generate rows for each date bucket
    dates.forEach((bucketDate, bucketIndex) => {
      const bucketDateStr = bucketLabel(bucketDate, granularity);

      // Sample rows from seed data for this bucket
      for (let i = 0; i < rowsPerBucket; i++) {
        const sourceRow = baseRows[rng.nextInt(0, baseRows.length - 1)];
        const newRow = { ...sourceRow };

        // Generate unique ID
        const idField = Object.keys(newRow).find(key => key === 'id');
        if (idField) {
          const prefix = String(newRow[idField]).split('_')[0];
          const uniqueNum = bucketIndex * rowsPerBucket + i + 1;
          newRow[idField] = `${prefix}_${String(uniqueNum).padStart(3, '0')}`;
        }

        // Update all date fields to bucket date with small variance
        Object.keys(newRow).forEach((key) => {
          if (
            key.includes('created') ||
            key.includes('date') ||
            key === 'current_period_start' ||
            key === 'current_period_end' ||
            key === 'canceled_at'
          ) {
            // Add random days variance (-7 to +7 days)
            const variance = rng.nextInt(-7, 7);
            const variedDate = new Date(bucketDate);
            variedDate.setDate(variedDate.getDate() + variance);
            newRow[key] = variedDate.toISOString().split('T')[0];
          }

          // Vary amount fields by ±20%
          if (
            key.includes('amount') ||
            key.includes('balance') ||
            key === 'unit_amount'
          ) {
            const originalValue = typeof newRow[key] === 'number' ? newRow[key] : 0;
            const varianceFactor = 1 + (rng.next() - 0.5) * 0.4; // ±20%
            newRow[key] = Math.round(originalValue * varianceFactor);
          }
        });

        // Vary status distributions
        if (newRow.status) {
          const statusRoll = rng.next();
          if (entityType === 'subscriptions') {
            if (statusRoll < 0.7) newRow.status = 'active';
            else if (statusRoll < 0.85) newRow.status = 'canceled';
            else if (statusRoll < 0.95) newRow.status = 'past_due';
            else newRow.status = 'trialing';
          } else if (entityType === 'invoices') {
            if (statusRoll < 0.85) newRow.status = 'paid';
            else if (statusRoll < 0.95) newRow.status = 'open';
            else newRow.status = 'draft';
          } else if (entityType === 'payments') {
            if (statusRoll < 0.9) newRow.status = 'succeeded';
            else newRow.status = 'requires_payment_method';
          } else if (entityType === 'refunds') {
            if (statusRoll < 0.9) newRow.status = 'succeeded';
            else newRow.status = 'pending';
          }
        }

        expandedRows.push(newRow);
      }
    });

    expanded[entityType] = expandedRows;
  });

  return expanded;
}

/**
 * Shift series dates by a specified time period
 */
export function shiftSeriesByPeriod(
  series: ReportSeries,
  bucketCount: number,
  granularity: Granularity
): ReportSeries {
  return {
    ...series,
    points: series.points.map((point) => {
      const date = new Date(point.date);

      switch (granularity) {
        case 'day':
          date.setDate(date.getDate() - bucketCount);
          break;
        case 'week':
          date.setDate(date.getDate() - (bucketCount * 7));
          break;
        case 'month':
          date.setMonth(date.getMonth() - bucketCount);
          break;
        case 'quarter':
          date.setMonth(date.getMonth() - (bucketCount * 3));
          break;
        case 'year':
          date.setFullYear(date.getFullYear() - bucketCount);
          break;
      }

      return {
        ...point,
        date: bucketLabel(date, granularity),
      };
    }),
  };
}

/**
 * Create a baseline series relative to the first point
 */
export function createPeriodStartSeries(series: ReportSeries): ReportSeries {
  if (series.points.length === 0) return series;

  const baseline = series.points[0].value;

  return {
    ...series,
    label: `${series.label} (vs. Start)`,
    points: series.points.map((point) => ({
      ...point,
      value: point.value - baseline,
    })),
  };
}

/**
 * Create a benchmark series with a constant value
 */
export function createBenchmarkSeries(
  series: ReportSeries,
  benchmark: number
): ReportSeries {
  return {
    ...series,
    label: 'Benchmark',
    points: series.points.map((point) => ({
      ...point,
      value: benchmark,
    })),
  };
}
