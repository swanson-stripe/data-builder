#!/usr/bin/env node

/**
 * Test script for Phase 3 - Subscription Ecosystem
 */

import { setFakerSeed } from './generators/base.mjs';
import { generateCustomers } from './generators/customers.mjs';
import { generateProducts } from './generators/products.mjs';
import { generatePrices } from './generators/prices.mjs';
import { generateSubscriptions } from './generators/subscriptions.mjs';
import { generateSubscriptionItems } from './generators/subscription-items.mjs';
import { generateInvoices } from './generators/invoices.mjs';
import { generateInvoiceItems } from './generators/invoice-items.mjs';
import { generateCoupons } from './generators/coupons.mjs';
import { generateDiscounts } from './generators/discounts.mjs';

console.log('=== Testing Phase 3 - Subscription Ecosystem ===\n');

// Set seed for deterministic results
setFakerSeed(12345);

// Generate prerequisite data
const customers = generateCustomers(200);
const products = generateProducts(10);
const prices = generatePrices(products);

// Generate subscription ecosystem
const subscriptions = generateSubscriptions(customers, prices, 300);
const subscriptionItems = generateSubscriptionItems(subscriptions, prices);
const invoices = generateInvoices(subscriptions, subscriptionItems, prices);
const invoiceItems = generateInvoiceItems(invoices, subscriptionItems, prices);
const coupons = generateCoupons(15);
const discounts = generateDiscounts(customers, subscriptions, invoices, coupons);

// Validation
console.log('\n=== Validation ===\n');

// Check foreign keys
const customerIds = new Set(customers.map(c => c.id));
const subscriptionIds = new Set(subscriptions.map(s => s.id));
const invoiceIds = new Set(invoices.map(i => i.id));
const priceIds = new Set(prices.map(p => p.id));
const couponIds = new Set(coupons.map(c => c.id));

// Validate subscriptions reference customers
const invalidSubCustomers = subscriptions.filter(s => !customerIds.has(s.customer_id));
console.log(invalidSubCustomers.length === 0 
  ? `✓ All subscriptions have valid customer_id references`
  : `❌ Found ${invalidSubCustomers.length} subscriptions with invalid customer_id`
);

// Validate invoices reference subscriptions and customers
const invalidInvSubs = invoices.filter(i => i.subscription_id && !subscriptionIds.has(i.subscription_id));
const invalidInvCustomers = invoices.filter(i => !customerIds.has(i.customer_id));
console.log(invalidInvSubs.length === 0 
  ? `✓ All invoices have valid subscription_id references`
  : `❌ Found ${invalidInvSubs.length} invoices with invalid subscription_id`
);
console.log(invalidInvCustomers.length === 0 
  ? `✓ All invoices have valid customer_id references`
  : `❌ Found ${invalidInvCustomers.length} invoices with invalid customer_id`
);

// Validate discounts reference coupons
const invalidDiscounts = discounts.filter(d => !couponIds.has(d.coupon_id));
console.log(invalidDiscounts.length === 0 
  ? `✓ All discounts have valid coupon_id references`
  : `❌ Found ${invalidDiscounts.length} discounts with invalid coupon_id`
);

// Check date sequences
let dateErrors = 0;
for (const sub of subscriptions) {
  const created = new Date(sub.created);
  const periodStart = new Date(sub.current_period_start);
  const periodEnd = new Date(sub.current_period_end);
  
  if (periodStart < created) {
    dateErrors++;
  }
  if (periodEnd <= periodStart) {
    dateErrors++;
  }
}
console.log(dateErrors === 0 
  ? `✓ All subscription date sequences are valid`
  : `❌ Found ${dateErrors} subscription date sequence errors`
);

// Check amounts
let amountErrors = 0;
for (const invoice of invoices) {
  if (invoice.amount_paid + invoice.amount_remaining !== invoice.amount_due) {
    amountErrors++;
  }
  if (invoice.total < invoice.subtotal) {
    amountErrors++;
  }
}
console.log(amountErrors === 0 
  ? `✓ All invoice amounts are consistent`
  : `❌ Found ${amountErrors} invoice amount inconsistencies`
);

// Summary
console.log('\n=== Summary ===\n');
console.log(`Generated:`);
console.log(`  • ${customers.length} customers`);
console.log(`  • ${products.length} products`);
console.log(`  • ${prices.length} prices`);
console.log(`  • ${subscriptions.length} subscriptions`);
console.log(`  • ${subscriptionItems.length} subscription items`);
console.log(`  • ${invoices.length} invoices`);
console.log(`  • ${invoiceItems.length} invoice items`);
console.log(`  • ${coupons.length} coupons`);
console.log(`  • ${discounts.length} discounts`);

// Status distribution
const statusCounts = {};
for (const sub of subscriptions) {
  statusCounts[sub.status] = (statusCounts[sub.status] || 0) + 1;
}
console.log(`\nSubscription status distribution:`);
for (const [status, count] of Object.entries(statusCounts)) {
  const pct = ((count / subscriptions.length) * 100).toFixed(1);
  console.log(`  • ${status}: ${count} (${pct}%)`);
}

console.log('\n✅ Phase 3 test complete!\n');

