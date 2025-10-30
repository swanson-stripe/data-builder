#!/usr/bin/env node

/**
 * Master generator script for full Stripe schema
 * Orchestrates all generators in correct dependency order
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import generators
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
import { generatePaymentMethods, linkPaymentMethodsToCustomers } from './generators/payment-methods.mjs';
import { generatePaymentIntents, linkPaymentIntentsToInvoices } from './generators/payment-intents.mjs';
import { generateCharges } from './generators/charges.mjs';
import { generateRefunds } from './generators/refunds.mjs';
import { generateBalanceTransactions } from './generators/balance-transactions.mjs';
import { generateCustomerBalanceTransactions } from './generators/customer-balance-transactions.mjs';
import { generateCustomerTaxIds } from './generators/customer-tax-ids.mjs';
import { generateQuotes } from './generators/quotes.mjs';
import { generateCreditNotes } from './generators/credit-notes.mjs';
import { generateSubscriptionSchedules } from './generators/subscription-schedules.mjs';
import { generateDisputes } from './generators/disputes.mjs';

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  Stripe Schema Generator - Full Dataset                       ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const startTime = Date.now();

// Configuration
const SEED = 12345;
const CUSTOMER_COUNT = 1000;
const PRODUCT_COUNT = 25;
const SUBSCRIPTION_COUNT = 800;
const QUOTE_COUNT = 150;

// Set deterministic seed
setFakerSeed(SEED);

// ============================================================================
// Phase 1: Core Entities
// ============================================================================
console.log('📦 Phase 1: Core Entities\n');

const customers = generateCustomers(CUSTOMER_COUNT);
const products = generateProducts(PRODUCT_COUNT);
const prices = generatePrices(products);

console.log('');

// ============================================================================
// Phase 2: Subscriptions & Billing
// ============================================================================
console.log('📦 Phase 2: Subscriptions & Billing\n');

const subscriptions = generateSubscriptions(customers, prices, SUBSCRIPTION_COUNT);
const subscriptionItems = generateSubscriptionItems(subscriptions, prices);
const invoices = generateInvoices(subscriptions, subscriptionItems, prices);
const invoiceItems = generateInvoiceItems(invoices, subscriptionItems, prices);
const coupons = generateCoupons(20);
const discounts = generateDiscounts(customers, subscriptions, invoices, coupons);

console.log('');

// ============================================================================
// Phase 3: Payment Flow
// ============================================================================
console.log('📦 Phase 3: Payment Flow\n');

const paymentMethods = generatePaymentMethods(customers);
linkPaymentMethodsToCustomers(customers, paymentMethods);

const paymentIntents = generatePaymentIntents(invoices, paymentMethods);
linkPaymentIntentsToInvoices(invoices, paymentIntents);

const charges = generateCharges(paymentIntents);
const refunds = generateRefunds(charges);
const balanceTransactions = generateBalanceTransactions(charges, refunds);

console.log('');

// ============================================================================
// Phase 4: Customer & Additional Billing
// ============================================================================
console.log('📦 Phase 4: Customer & Additional Billing\n');

const customerBalanceTransactions = generateCustomerBalanceTransactions(customers, invoices);
const customerTaxIds = generateCustomerTaxIds(customers);
const quotes = generateQuotes(customers, QUOTE_COUNT);
const creditNotes = generateCreditNotes(invoices);
const subscriptionSchedules = generateSubscriptionSchedules(subscriptions);

console.log('');

// ============================================================================
// Phase 5: Disputes & Remaining
// ============================================================================
console.log('📦 Phase 5: Disputes & Remaining\n');

const disputes = generateDisputes(charges);

console.log('');

// ============================================================================
// Assemble Warehouse Data
// ============================================================================
console.log('📊 Assembling warehouse data...\n');

const warehouse = {
  customer: customers,
  product: products,
  price: prices,
  subscription: subscriptions,
  subscription_item: subscriptionItems,
  invoice: invoices,
  invoice_item: invoiceItems,
  coupon: coupons,
  discount: discounts,
  payment_method: paymentMethods,
  payment_intent: paymentIntents,
  charge: charges,
  refund: refunds,
  balance_transaction: balanceTransactions,
  customer_balance_transaction: customerBalanceTransactions,
  customer_tax_id: customerTaxIds,
  quote: quotes,
  credit_note: creditNotes,
  subscription_schedule: subscriptionSchedules,
  dispute: disputes,
  payment: [], // Legacy table - empty for now
  checkout_session: [], // To be implemented
  plan: [], // Legacy - replaced by prices
};

// ============================================================================
// Write to File
// ============================================================================
console.log('💾 Writing warehouse-data.ts...');

const outputPath = path.join(__dirname, '..', 'src', 'data', 'warehouse-data.ts');
const warehouseContent = `/**
 * Generated Stripe warehouse data
 * DO NOT EDIT - regenerate with: npm run generate-stripe-schema
 * Generated: ${new Date().toISOString()}
 * Seed: ${SEED}
 */

export const warehouse = ${JSON.stringify(warehouse, null, 2)};

export default warehouse;
`;

fs.writeFileSync(outputPath, warehouseContent, 'utf-8');

const fileSizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
console.log(`✓ Written to ${outputPath} (${fileSizeMB} MB)\n`);

// ============================================================================
// Summary
// ============================================================================
const duration = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  Generation Complete                                           ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log('📊 Dataset Summary:\n');
console.log(`  Core Entities:`);
console.log(`    • ${customers.length.toLocaleString()} customers`);
console.log(`    • ${products.length.toLocaleString()} products`);
console.log(`    • ${prices.length.toLocaleString()} prices\n`);

console.log(`  Subscription & Billing:`);
console.log(`    • ${subscriptions.length.toLocaleString()} subscriptions`);
console.log(`    • ${subscriptionItems.length.toLocaleString()} subscription items`);
console.log(`    • ${invoices.length.toLocaleString()} invoices`);
console.log(`    • ${invoiceItems.length.toLocaleString()} invoice items`);
console.log(`    • ${coupons.length.toLocaleString()} coupons`);
console.log(`    • ${discounts.length.toLocaleString()} discounts\n`);

console.log(`  Payment Flow:`);
console.log(`    • ${paymentMethods.length.toLocaleString()} payment methods`);
console.log(`    • ${paymentIntents.length.toLocaleString()} payment intents`);
console.log(`    • ${charges.length.toLocaleString()} charges`);
console.log(`    • ${refunds.length.toLocaleString()} refunds`);
console.log(`    • ${balanceTransactions.length.toLocaleString()} balance transactions\n`);

console.log(`  Additional:`);
console.log(`    • ${customerBalanceTransactions.length.toLocaleString()} customer balance transactions`);
console.log(`    • ${customerTaxIds.length.toLocaleString()} customer tax IDs`);
console.log(`    • ${quotes.length.toLocaleString()} quotes`);
console.log(`    • ${creditNotes.length.toLocaleString()} credit notes`);
console.log(`    • ${subscriptionSchedules.length.toLocaleString()} subscription schedules`);
console.log(`    • ${disputes.length.toLocaleString()} disputes\n`);

const totalRecords = Object.values(warehouse).reduce((sum, arr) => sum + arr.length, 0);
console.log(`  📦 Total: ${totalRecords.toLocaleString()} records`);
console.log(`  ⏱️  Generated in ${duration}s`);
console.log(`  💾 File size: ${fileSizeMB} MB\n`);

console.log('✅ Done! Run `npm run dev` to view the data.\n');

