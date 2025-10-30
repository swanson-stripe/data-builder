import { faker } from '@faker-js/faker';
import {
  stripeId,
  randomDate,
  pickRandom,
  randomAmount,
  toISODate,
  CURRENCIES,
  logProgress,
} from './base.mjs';

/**
 * Generate price records for products
 */
export function generatePrices(products, avgPricesPerProduct = 2) {
  logProgress(`Generating prices for ${products.length} products...`);
  
  const prices = [];
  const intervals = ['month', 'year', 'week', 'day'];

  for (const product of products) {
    // Only create prices for active products, or occasionally for inactive ones
    if (!product.active && Math.random() > 0.2) {
      continue;
    }

    // Generate 1-3 prices per product
    const priceCount = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < priceCount; i++) {
      const createdDate = randomDate(0.5); // 50% in 2025
      const currency = pickRandom(CURRENCIES);
      const interval = i === 0 ? 'month' : pickRandom(intervals); // First price is usually monthly

      // Price varies by interval
      let baseAmount;
      switch (interval) {
        case 'day':
          baseAmount = randomAmount(100, 1000); // $1-$10/day
          break;
        case 'week':
          baseAmount = randomAmount(500, 5000); // $5-$50/week
          break;
        case 'month':
          baseAmount = randomAmount(999, 19999); // $10-$200/month
          break;
        case 'year':
          baseAmount = randomAmount(9999, 199999); // $100-$2000/year
          break;
      }

      prices.push({
        id: stripeId('price'),
        product_id: product.id,
        unit_amount: baseAmount,
        currency,
        recurring_interval: interval,
        active: product.active && Math.random() < 0.95, // Most prices are active
        created: toISODate(createdDate),
      });
    }
  }

  logProgress(`✓ Generated ${prices.length} prices`);
  return prices;
}

