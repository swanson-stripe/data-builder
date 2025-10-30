#!/usr/bin/env node

/**
 * Test script for Phase 2 generators
 */

import { setFakerSeed } from './generators/base.mjs';
import { generateCustomers } from './generators/customers.mjs';
import { generateProducts } from './generators/products.mjs';
import { generatePrices } from './generators/prices.mjs';

console.log('=== Testing Phase 2 Generators ===\n');

// Set seed for deterministic results
setFakerSeed(12345);

// Test customers generator
const customers = generateCustomers(100);
console.log(`\nCustomers sample:`);
console.log(JSON.stringify(customers[0], null, 2));
console.log(`Total: ${customers.length} customers`);

// Test products generator
const products = generateProducts(10);
console.log(`\nProducts sample:`);
console.log(JSON.stringify(products[0], null, 2));
console.log(`Total: ${products.length} products`);

// Test prices generator
const prices = generatePrices(products);
console.log(`\nPrices sample:`);
console.log(JSON.stringify(prices[0], null, 2));
console.log(`Total: ${prices.length} prices`);

// Basic validation
console.log('\n=== Validation ===');
const priceProductIds = new Set(prices.map(p => p.product_id));
const productIds = new Set(products.map(p => p.id));
const orphanedPrices = [...priceProductIds].filter(id => !productIds.has(id));

if (orphanedPrices.length > 0) {
  console.log(`❌ Found ${orphanedPrices.length} orphaned prices`);
} else {
  console.log(`✓ All prices have valid product_id references`);
}

console.log(`✓ Generated customers: ${customers.length}`);
console.log(`✓ Generated products: ${products.length}`);
console.log(`✓ Generated prices: ${prices.length}`);
console.log('\n✅ Phase 2 test complete!\n');

