#!/usr/bin/env node

/**
 * Master data generation script - creates all entities with proper referential integrity
 * This replaces inconsistent data with a clean, relationally-correct dataset
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { setFakerSeed } from './generators/base.mjs';
import { generateCustomers } from './generators/customers.mjs';
import { generateProducts } from './generators/products.mjs';
import { generatePrices } from './generators/prices.mjs';
import { generateSubscriptions } from './generators/subscriptions.mjs';
import { generateSubscriptionItems } from './generators/subscription-items.mjs';
import { generateInvoices } from './generators/invoices.mjs';
import { generatePaymentIntents } from './generators/payment-intents.mjs';
import { generatePaymentMethods } from './generators/payment-methods.mjs';
import { generateCharges } from './generators/charges.mjs';
import { generateRefunds } from './generators/refunds.mjs';
import { generateDisputes } from './generators/disputes.mjs';
import { generateQuotes } from './generators/quotes.mjs';
import { generateCreditNotes } from './generators/credit-notes.mjs';
import { generateSubscriptionSchedules } from './generators/subscription-schedules.mjs';
import { generateDiscounts } from './generators/discounts.mjs';
import { generateCustomerBalanceTransactions } from './generators/customer-balance-transactions.mjs';
import { generateCustomerTaxIds } from './generators/customer-tax-ids.mjs';
import { generateInvoiceItems } from './generators/invoice-items.mjs';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

const SEED = 42; // Deterministic seed for reproducible data
const ENTITY_COUNTS = {
  customers: 1000,
  products: 15,
  subscriptions: 800,
  paymentIntents: 3000,
  charges: 1000,
  quotes: 100,
};

console.log('🚀 Generating complete Stripe dataset with referential integrity...\n');
console.log('⚙️  Configuration:');
console.log(`   Seed: ${SEED} (deterministic)`);
console.log(`   Customers: ${ENTITY_COUNTS.customers}`);
console.log(`   Products: ${ENTITY_COUNTS.products}`);
console.log(`   Subscriptions: ${ENTITY_COUNTS.subscriptions}`);
console.log(`   Payment Intents: ${ENTITY_COUNTS.paymentIntents}`);
console.log(`   Charges: ${ENTITY_COUNTS.charges}\n`);

// Set deterministic seed
setFakerSeed(SEED);

// ============================================================================
// Phase 1: Core Entities (no dependencies)
// ============================================================================

console.log('📦 Phase 1: Generating core entities...\n');

const customers = generateCustomers(ENTITY_COUNTS.customers);
const products = generateProducts(ENTITY_COUNTS.products);
const prices = generatePrices(products);
const paymentMethods = generatePaymentMethods(customers);

// ============================================================================
// Phase 2: Subscription-related entities (depend on customers & prices)
// ============================================================================

console.log('\n📦 Phase 2: Generating subscription entities...\n');

const subscriptions = generateSubscriptions(customers, prices, ENTITY_COUNTS.subscriptions);
const subscriptionItems = generateSubscriptionItems(subscriptions, prices);
const subscriptionSchedules = generateSubscriptionSchedules(subscriptions);

// ============================================================================
// Phase 3: Billing entities (depend on subscriptions)
// ============================================================================

console.log('\n📦 Phase 3: Generating billing entities...\n');

const invoices = generateInvoices(subscriptions, subscriptionItems, prices);
const invoiceItems = generateInvoiceItems(invoices, subscriptionItems, prices);
const creditNotes = generateCreditNotes(invoices);

// ============================================================================
// Phase 4: Payment entities (depend on customers, invoices, charges)
// ============================================================================

console.log('\n📦 Phase 4: Generating payment entities...\n');

const paymentIntents = generatePaymentIntents(invoices, paymentMethods);
const charges = generateCharges(paymentIntents);
const refunds = generateRefunds(charges);

// ============================================================================
// Phase 5: Additional entities
// ============================================================================

console.log('\n📦 Phase 5: Generating additional entities...\n');

const disputes = generateDisputes(charges);
const coupons = []; // Generate coupons if needed, or leave empty for now
const discounts = generateDiscounts(customers, subscriptions, invoices, coupons);
const quotes = generateQuotes(customers, ENTITY_COUNTS.quotes);
const customerBalanceTransactions = generateCustomerBalanceTransactions(customers, invoices);
const customerTaxIds = generateCustomerTaxIds(customers);

// ============================================================================
// Create master warehouse object
// ============================================================================

const warehouse = {
  customers,
  products,
  prices,
  payment_methods: paymentMethods,
  subscriptions,
  subscription_item: subscriptionItems,
  subscription_schedule: subscriptionSchedules,
  invoices,
  invoice_item: invoiceItems,
  credit_notes: creditNotes,
  payment_intent: paymentIntents,
  charges,
  refunds,
  disputes,
  discounts: discounts,
  quotes: quotes,
  customer_balance_transactions: customerBalanceTransactions,
  customer_tax_ids: customerTaxIds,
  // Add empty arrays for entities that might be referenced but not yet generated
  payouts: [],
  plans: [],
  coupons: [],
  discount: [],
  dispute: [],
  quote: [],
};

// ============================================================================
// Validation: Check referential integrity
// ============================================================================

console.log('\n🔍 Validating referential integrity...\n');

const customerIds = new Set(customers.map(c => c.id));
const productIds = new Set(products.map(p => p.id));
const priceIds = new Set(prices.map(p => p.id));
const subscriptionIds = new Set(subscriptions.map(s => s.id));
const invoiceIds = new Set(invoices.map(i => i.id));
const chargeIds = new Set(charges.map(c => c.id));

let errors = 0;

// Validate subscriptions
const invalidSubCustomers = subscriptions.filter(s => !customerIds.has(s.customer_id));
const invalidSubPrices = subscriptions.filter(s => !priceIds.has(s.price_id));
if (invalidSubCustomers.length > 0) {
  console.log(`❌ ${invalidSubCustomers.length} subscriptions have invalid customer_id`);
  errors += invalidSubCustomers.length;
} else {
  console.log('✓ All subscriptions have valid customer_id references');
}
if (invalidSubPrices.length > 0) {
  console.log(`❌ ${invalidSubPrices.length} subscriptions have invalid price_id`);
  errors += invalidSubPrices.length;
} else {
  console.log('✓ All subscriptions have valid price_id references');
}

// Validate subscription_items
const invalidSISubscriptions = subscriptionItems.filter(si => !subscriptionIds.has(si.subscription_id));
const invalidSIPrices = subscriptionItems.filter(si => !priceIds.has(si.price_id));
if (invalidSISubscriptions.length > 0) {
  console.log(`❌ ${invalidSISubscriptions.length} subscription_items have invalid subscription_id`);
  errors += invalidSISubscriptions.length;
} else {
  console.log('✓ All subscription_items have valid subscription_id references');
}
if (invalidSIPrices.length > 0) {
  console.log(`❌ ${invalidSIPrices.length} subscription_items have invalid price_id`);
  errors += invalidSIPrices.length;
} else {
  console.log('✓ All subscription_items have valid price_id references');
}

// Validate invoices
const invalidInvCustomers = invoices.filter(i => !customerIds.has(i.customer_id));
const invalidInvSubscriptions = invoices.filter(i => i.subscription_id && !subscriptionIds.has(i.subscription_id));
if (invalidInvCustomers.length > 0) {
  console.log(`❌ ${invalidInvCustomers.length} invoices have invalid customer_id`);
  errors += invalidInvCustomers.length;
} else {
  console.log('✓ All invoices have valid customer_id references');
}
if (invalidInvSubscriptions.length > 0) {
  console.log(`❌ ${invalidInvSubscriptions.length} invoices have invalid subscription_id`);
  errors += invalidInvSubscriptions.length;
} else {
  console.log('✓ All invoices have valid subscription_id references');
}

// Validate charges
const invalidChargeCustomers = charges.filter(c => !customerIds.has(c.customer_id));
if (invalidChargeCustomers.length > 0) {
  console.log(`❌ ${invalidChargeCustomers.length} charges have invalid customer_id`);
  errors += invalidChargeCustomers.length;
} else {
  console.log('✓ All charges have valid customer_id references');
}

// Validate refunds
const invalidRefundCharges = refunds.filter(r => !chargeIds.has(r.charge_id));
if (invalidRefundCharges.length > 0) {
  console.log(`❌ ${invalidRefundCharges.length} refunds have invalid charge_id`);
  errors += invalidRefundCharges.length;
} else {
  console.log('✓ All refunds have valid charge_id references');
}

if (errors > 0) {
  console.log(`\n❌ Validation failed with ${errors} errors. Aborting.\n`);
  process.exit(1);
}

console.log('\n✅ All referential integrity checks passed!\n');

// ============================================================================
// Write individual JSON files
// ============================================================================

console.log('📝 Writing JSON files...\n');

const outputDir = path.join(__dirname, '..', 'public', 'data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

let totalRecords = 0;
let totalSize = 0;

for (const [tableName, records] of Object.entries(warehouse)) {
  if (!Array.isArray(records) || records.length === 0) continue;
  
  const outputPath = path.join(outputDir, `${tableName}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(records, null, 2), 'utf-8');
  
  const stats = fs.statSync(outputPath);
  const fileSizeKB = (stats.size / 1024).toFixed(2);
  totalSize += stats.size;
  
  console.log(`  ✓ ${tableName}.json (${records.length.toLocaleString()} records, ${fileSizeKB} KB)`);
  totalRecords += records.length;
}

// Create manifest
const manifest = {
  generated: new Date().toISOString(),
  seed: SEED,
  entities: Object.keys(warehouse).filter(k => warehouse[k].length > 0),
  counts: Object.fromEntries(
    Object.entries(warehouse)
      .filter(([_, records]) => Array.isArray(records) && records.length > 0)
      .map(([name, records]) => [name, records.length])
  ),
};

fs.writeFileSync(
  path.join(outputDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2),
  'utf-8'
);

console.log(`  ✓ manifest.json`);

// ============================================================================
// Summary
// ============================================================================

const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

console.log('\n✅ Data generation complete!\n');
console.log('📊 Summary:');
console.log(`   Total records: ${totalRecords.toLocaleString()}`);
console.log(`   Total files: ${Object.keys(warehouse).length}`);
console.log(`   Total size: ${totalSizeMB} MB`);
console.log(`   Output directory: ${outputDir}`);
console.log('\n🔗 Referential integrity: ✓ VERIFIED');
console.log('\n📅 Next steps:');
console.log('   1. Restart dev server: npm run dev');
console.log('   2. Test MRR, ARPU, and other presets');
console.log('   3. Verify data list shows all fields\n');

