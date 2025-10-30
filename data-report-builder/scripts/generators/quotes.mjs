import { faker } from '@faker-js/faker';
import {
  stripeId,
  randomDate,
  dateAfter,
  pickRandom,
  maybe,
  randomAmount,
  toISODate,
  logProgress,
} from './base.mjs';

/**
 * Generate quote records
 */
export function generateQuotes(customers, count = 100) {
  logProgress(`Generating ${count} quotes...`);
  
  const quotes = [];

  for (let i = 0; i < count; i++) {
    const customer = pickRandom(customers);
    const createdDate = randomDate(0.8); // 80% in 2025

    // Status distribution
    const statusRoll = Math.random();
    let status;
    if (statusRoll < 0.3) {
      status = 'draft';
    } else if (statusRoll < 0.5) {
      status = 'open';
    } else if (statusRoll < 0.8) {
      status = 'accepted';
    } else {
      status = 'canceled';
    }

    // Amounts
    const subtotal = randomAmount(5000, 100000); // $50-$1000
    const tax = Math.floor(subtotal * (Math.random() * 0.1)); // 0-10% tax
    const total = subtotal + tax;

    // Expiration (30-90 days after creation)
    const expiresAt = dateAfter(createdDate, Math.floor(Math.random() * 60) + 30);

    quotes.push({
      id: stripeId('qt'),
      customer_id: customer.id,
      amount_subtotal: subtotal,
      amount_total: total,
      currency: customer.currency,
      status,
      created: toISODate(createdDate),
      expires_at: toISODate(expiresAt),
      description: maybe(faker.commerce.productDescription(), 0.5),
    });
  }

  logProgress(`✓ Generated ${quotes.length} quotes`);
  return quotes;
}

