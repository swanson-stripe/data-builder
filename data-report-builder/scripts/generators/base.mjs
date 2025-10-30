import { faker } from '@faker-js/faker';

// Date range configuration
const START_DATE = new Date(2020, 0, 1); // Jan 1, 2020
const END_DATE = new Date(); // Today

/**
 * Set faker seed for deterministic data generation
 */
export function setFakerSeed(seed = 12345) {
  faker.seed(seed);
}

/**
 * Generate a random date within the configured range
 * @param {number} bias2025 - Probability (0-1) of generating a date in 2025
 */
export function randomDate(bias2025 = 0.9) {
  if (Math.random() < bias2025) {
    // Generate date in 2025
    const start2025 = new Date(2025, 0, 1);
    const end2025 = END_DATE.getFullYear() === 2025 ? END_DATE : new Date(2025, 11, 31);
    return faker.date.between({ from: start2025, to: end2025 });
  }
  // Generate date across full range
  return faker.date.between({ from: START_DATE, to: END_DATE });
}

/**
 * Generate a date after a given date
 */
export function dateAfter(after, maxDaysAfter = 365) {
  const start = new Date(after);
  const end = new Date(after);
  end.setDate(end.getDate() + maxDaysAfter);
  
  // Ensure we don't go past END_DATE
  const effectiveEnd = end > END_DATE ? END_DATE : end;
  
  // If start is after effectiveEnd, just return start
  if (start >= effectiveEnd) {
    return start;
  }
  
  return faker.date.between({ from: start, to: effectiveEnd });
}

/**
 * Generate a date before a given date
 */
export function dateBefore(before, maxDaysBefore = 365) {
  const end = new Date(before);
  const start = new Date(before);
  start.setDate(start.getDate() - maxDaysBefore);
  // Ensure we don't go before START_DATE
  if (start < START_DATE) {
    return faker.date.between({ from: START_DATE, to: end });
  }
  return faker.date.between({ from: start, to: end });
}

/**
 * Generate a Stripe ID with the given prefix
 */
export function stripeId(prefix) {
  return `${prefix}_${faker.string.alphanumeric(24)}`;
}

/**
 * Pick random item from array
 */
export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate amount in cents (Stripe format)
 */
export function randomAmount(min = 500, max = 50000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Maybe return value (for nullable fields)
 */
export function maybe(value, probability = 0.7) {
  return Math.random() < probability ? value : null;
}

/**
 * Convert timestamp to ISO string for JSON output
 */
export function toISODate(date) {
  return date.toISOString();
}

/**
 * Currency codes
 */
export const CURRENCIES = ['usd', 'eur', 'gbp', 'cad', 'aud'];

/**
 * Country codes
 */
export const COUNTRIES = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'JP'];

/**
 * Card brands
 */
export const CARD_BRANDS = ['visa', 'mastercard', 'amex', 'discover'];

/**
 * Log generation progress
 */
export function logProgress(message) {
  console.log(`[Generator] ${message}`);
}

/**
 * Shuffle array (Fisher-Yates)
 */
export function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

