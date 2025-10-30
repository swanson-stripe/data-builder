import { faker } from '@faker-js/faker';
import {
  stripeId,
  randomDate,
  maybe,
  toISODate,
  logProgress,
} from './base.mjs';

const PRODUCT_NAMES = [
  'Professional Plan',
  'Enterprise Plan',
  'Starter Plan',
  'Premium Subscription',
  'Basic Package',
  'Advanced Features',
  'Pro Membership',
  'Business Suite',
  'Team Plan',
  'Individual License',
  'Standard Access',
  'Premium Support',
  'Cloud Storage',
  'Analytics Platform',
  'Developer Tools',
  'API Access',
  'Mobile App',
  'Desktop Software',
  'Training Course',
  'Consulting Services',
  'Managed Services',
  'Enterprise Support',
  'Priority Queue',
  'Custom Integration',
  'White Label Solution',
];

/**
 * Generate product records
 */
export function generateProducts(count = 25) {
  logProgress(`Generating ${count} products...`);
  
  const products = [];
  const usedNames = new Set();

  for (let i = 0; i < count; i++) {
    const createdDate = randomDate(0.5); // 50% in 2025
    
    // Pick unique product name
    let productName;
    do {
      productName = PRODUCT_NAMES[i % PRODUCT_NAMES.length];
      if (i >= PRODUCT_NAMES.length) {
        productName += ` ${Math.floor(i / PRODUCT_NAMES.length)}`;
      }
    } while (usedNames.has(productName));
    usedNames.add(productName);

    // Most products are active
    const active = Math.random() < 0.9;

    products.push({
      id: stripeId('prod'),
      name: productName,
      description: maybe(faker.commerce.productDescription(), 0.7),
      active,
      created: toISODate(createdDate),
    });
  }

  logProgress(`✓ Generated ${products.length} products`);
  return products;
}

