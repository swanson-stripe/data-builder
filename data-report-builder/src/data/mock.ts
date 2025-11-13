import { ReportKey, ReportSeries, SeriesPoint, SchemaObject, FieldType } from '@/types';
import { rangeByGranularity, bucketLabel, Granularity } from '@/lib/time';
import { getObject } from './schema';

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
    case 'blank':
      return {
        label: 'Custom Report',
        baseValue: 0,
        growthRate: 0,
        volatility: 0,
        floor: 0,
      };
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
  if (!config) {
    throw new Error(`No config found for report key: ${key}`);
  }
  
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
 * Generate realistic Stripe ID with proper prefix
 * Note: This function accepts both qualified (object.field) and unqualified (field) names.
 * It's primarily used by expandSeed which works with unqualified catalog data.
 */
function generateStripeId(fieldName: string, rng: SeededRandom): string {
  // Map field names to correct Stripe ID prefixes
  // Supports both qualified (object.id) and unqualified (field_id) patterns
  let prefix = '';

  if (fieldName.includes('customer')) {
    prefix = 'cus';
  } else if (fieldName.includes('subscription')) {
    prefix = 'sub';
  } else if (fieldName.includes('invoice')) {
    prefix = 'in';
  } else if (fieldName.includes('payment')) {
    prefix = 'pi';
  } else if (fieldName.includes('charge')) {
    prefix = 'ch';
  } else if (fieldName.includes('refund')) {
    prefix = 're';
  } else if (fieldName.includes('price')) {
    prefix = 'price';
  } else if (fieldName.includes('product')) {
    prefix = 'prod';
  } else if (fieldName.includes('method')) {
    prefix = 'pm';
  } else if (fieldName.includes('item')) {
    prefix = 'si';
  } else {
    // Fallback: try to extract from field name
    prefix = 'obj';
  }

  // Generate a random alphanumeric string (10-14 chars) similar to real Stripe IDs
  const idLength = rng.nextInt(10, 14);
  let randomId = '';
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < idLength; i++) {
    randomId += chars[rng.nextInt(0, chars.length - 1)];
  }
  return `${prefix}_${randomId}`;
}

/**
 * Generate realistic customer name
 */
function generateCustomerName(rng: SeededRandom): string {
  const firstNames = [
    'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
    'William', 'Barbara', 'David', 'Elizabeth', 'Richard', 'Susan', 'Joseph', 'Jessica',
    'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Nancy', 'Daniel', 'Lisa',
    'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
    'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
    'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Dorothy', 'George', 'Melissa',
    'Timothy', 'Deborah', 'Ronald', 'Stephanie', 'Edward', 'Rebecca', 'Jason', 'Sharon',
    'Jeffrey', 'Laura', 'Ryan', 'Cynthia', 'Jacob', 'Kathleen', 'Gary', 'Amy',
    'Nicholas', 'Angela', 'Eric', 'Shirley', 'Jonathan', 'Anna', 'Stephen', 'Brenda',
    'Larry', 'Pamela', 'Justin', 'Emma', 'Scott', 'Nicole', 'Brandon', 'Helen',
    'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Raymond', 'Christine', 'Patrick', 'Debra'
  ];

  const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
    'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
    'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
    'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
    'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
    'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker',
    'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy',
    'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey',
    'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson'
  ];

  const firstName = firstNames[rng.nextInt(0, firstNames.length - 1)];
  const lastName = lastNames[rng.nextInt(0, lastNames.length - 1)];
  return `${firstName} ${lastName}`;
}

/**
 * Generate realistic email from name
 */
function generateEmailFromName(name: string, rng: SeededRandom): string {
  const [firstName, lastName] = name.toLowerCase().split(' ');
  const domains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
    'protonmail.com', 'aol.com', 'mail.com', 'zoho.com', 'fastmail.com'
  ];
  const domain = domains[rng.nextInt(0, domains.length - 1)];

  // Various email formats
  const formats = [
    `${firstName}${lastName}@${domain}`,
    `${firstName}.${lastName}@${domain}`,
    `${firstName}${lastName[0]}@${domain}`,
    `${firstName[0]}${lastName}@${domain}`,
    `${firstName}${rng.nextInt(0, 999)}@${domain}`,
  ];

  return formats[rng.nextInt(0, formats.length - 1)];
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
      return generateStripeId(fieldName, rng);

    case 'string':
      // Generate contextual string values
      if (fieldName.includes('email')) {
        // Generate realistic email
        const name = generateCustomerName(rng);
        return generateEmailFromName(name, rng);
      }
      if (fieldName.includes('name')) {
        return generateCustomerName(rng);
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
 * @deprecated This function generates qualified keys and is not used anymore.
 * Use store.joinForDisplay() instead, which is the single source of qualified key generation.
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
  throw new Error('mockRowsForDataList is deprecated. Use store.joinForDisplay() instead.');
}

/**
 * Export a consistent default seed
 */
export const DEFAULT_SEED = 12345;

/**
 * Load seed data from JSON
 * @deprecated Use warehouse from warehouse.ts instead. This function is kept for backwards compatibility with expandSeed.
 */
export function loadSeed(): Record<string, any[]> {
  // Import warehouse dynamically to avoid circular dependencies
  const { warehouse } = require('./warehouse');
  return warehouse as Record<string, any[]>;
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

        // Keep the original ID from seed data (already sequential like pi_001, pi_002)
        // No need to regenerate IDs

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
 * Create a baseline series as a flat line at the first point's value
 * (similar to stock charts that show a horizontal baseline)
 */
export function createPeriodStartSeries(series: ReportSeries): ReportSeries {
  if (series.points.length === 0) return series;

  const baseline = series.points[0].value;

  return {
    ...series,
    label: `${series.label} (vs. Start)`,
    points: series.points.map((point) => ({
      ...point,
      value: baseline, // Flat line at the starting value
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
