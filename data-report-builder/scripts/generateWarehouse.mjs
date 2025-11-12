/**
 * Generate realistic synthetic Stripe-like dataset
 * Run with: node scripts/generateWarehouse.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { faker } from '@faker-js/faker';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

const YEARS = 6;
const START_DATE = new Date(2020, 0, 1); // Jan 1, 2020
const END_DATE = new Date(); // TODAY - ensures current data

// Reduced scale for faster generation and smaller file size
const CUSTOMERS = 1000;     // 5000 -> 1000 (80% reduction)
const PRODUCTS = 15;        // 20 -> 15 (25% reduction)
const PAYMENTS = 10000;     // 50000 -> 10000 (80% reduction)
const SUBSCRIPTIONS = 800;  // 4000 -> 800 (80% reduction)

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate random date between start and end
 */
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/**
 * Convert Date to ISO date string (YYYY-MM-DD)
 */
function iso(d) {
  return d.toISOString().split('T')[0];
}

/**
 * Pick random element from array
 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate Stripe-style ID with prefix
 */
function stripeId(prefix, length = 10) {
  return `${prefix}_${faker.string.alphanumeric({ length, casing: 'lower' })}`;
}

// ============================================================================
// Main Generation
// ============================================================================

console.log('🚀 Generating realistic synthetic dataset...\n');

const warehouse = {
  customers: [],
  payment_methods: [],
  products: [],
  prices: [],
  payments: [],
  refunds: [],
  subscriptions: [],
  subscription_items: [],
  invoices: [],
  charges: [],
  payouts: [],
};

// 1️⃣ Generate Customers
console.log(`1️⃣  Generating ${CUSTOMERS} customers...`);
for (let i = 0; i < CUSTOMERS; i++) {
  const created = randomDate(START_DATE, END_DATE);
  warehouse.customers.push({
    id: stripeId('cus'),
    email: faker.internet.email().toLowerCase(),
    name: faker.person.fullName(),
    country: faker.location.countryCode(),
    created: iso(created),
    balance: faker.number.int({ min: -10000, max: 10000 }),
    delinquent: faker.datatype.boolean({ probability: 0.1 }),
  });
}

// 2️⃣ Generate Products + Prices
console.log(`2️⃣  Generating ${PRODUCTS} products with prices...`);
for (let i = 0; i < PRODUCTS; i++) {
  const pid = stripeId('prod', 8);
  const created = randomDate(START_DATE, END_DATE);

  warehouse.products.push({
    id: pid,
    name: faker.commerce.productName(),
    active: faker.datatype.boolean({ probability: 0.9 }),
    description: faker.commerce.productDescription(),
    created: iso(created),
  });

  // Each product has 1-3 prices
  const priceCount = faker.number.int({ min: 1, max: 3 });
  for (let j = 0; j < priceCount; j++) {
    const currency = pick(['usd', 'eur', 'gbp']);
    warehouse.prices.push({
      id: stripeId('price'),
      product_id: pid,
      unit_amount: faker.number.int({ min: 500, max: 20000 }),
      currency,
      recurring_interval: pick(['month', 'year', 'week']),
      active: faker.datatype.boolean({ probability: 0.95 }),
      created: iso(created),
    });
  }
}

// 3️⃣ Generate Payment Methods (1-2 per customer)
console.log(`3️⃣  Generating payment methods...`);
for (const c of warehouse.customers) {
  const pmCount = faker.number.int({ min: 1, max: 2 });
  for (let j = 0; j < pmCount; j++) {
    const created = randomDate(new Date(c.created), END_DATE);
    warehouse.payment_methods.push({
      id: stripeId('pm'),
      type: 'card',
      brand: pick(['visa', 'mastercard', 'amex', 'discover']),
      last4: faker.string.numeric(4),
      exp_month: faker.number.int({ min: 1, max: 12 }),
      exp_year: faker.number.int({ min: 2025, max: 2030 }),
      customer_id: c.id,
      created: iso(created),
    });
  }
}

// 4️⃣ Generate Subscriptions
console.log(`4️⃣  Generating ${SUBSCRIPTIONS} subscriptions...`);
const activeCustomers = warehouse.customers.filter(() => Math.random() < 0.8); // 80% have subscriptions
for (let i = 0; i < SUBSCRIPTIONS && i < activeCustomers.length; i++) {
  const c = activeCustomers[i];
  const pr = pick(warehouse.prices);
  // Bias 90% of subscriptions towards 2025 (recent data for time filters)
  const use2025 = Math.random() < 0.9;
  const startDate = use2025 ? new Date(2025, 0, 1) : new Date(c.created);
  const created = randomDate(startDate, END_DATE);

  const periodLength = pr.recurring_interval === 'year' ? 12 : pr.recurring_interval === 'week' ? 0.25 : 1;
  
  // For active subscriptions, extend period end into the future
  const isCanceled = faker.datatype.boolean({ probability: 0.15 }); // Reduce cancellation rate
  const periodStart = new Date(END_DATE); // Start most recent period from today
  periodStart.setDate(periodStart.getDate() - 7); // Started a week ago
  const periodEnd = new Date(END_DATE);
  periodEnd.setMonth(periodEnd.getMonth() + periodLength); // End in the future

  const canceledAt = isCanceled ? randomDate(created, END_DATE) : undefined;

  const subId = stripeId('sub');
  warehouse.subscriptions.push({
    id: subId,
    customer_id: c.id,
    price_id: pr.id,
    status: isCanceled ? 'canceled' : pick(['active', 'active', 'active', 'trialing', 'past_due']), // Bias toward active
    created: iso(created),
    current_period_start: iso(periodStart),
    current_period_end: iso(periodEnd),
    canceled_at: canceledAt ? iso(canceledAt) : undefined,
  });

  // Generate 1-3 subscription items per subscription
  const itemCount = faker.number.int({ min: 1, max: 3 });
  for (let j = 0; j < itemCount; j++) {
    const itemPrice = pick(warehouse.prices);
    warehouse.subscription_items.push({
      id: stripeId('si'),
      subscription_id: subId,
      price_id: itemPrice.id,
      quantity: faker.number.int({ min: 1, max: 5 }),
      created: iso(created),
    });
  }
}

// 5️⃣ Generate Payments
console.log(`5️⃣  Generating ${PAYMENTS} payments...`);
for (let i = 0; i < PAYMENTS; i++) {
  const c = pick(warehouse.customers);
  const pms = warehouse.payment_methods.filter(pm => pm.customer_id === c.id);
  if (pms.length === 0) continue;

  const pm = pick(pms);
  const pr = pick(warehouse.prices);
  // Bias 90% of payments towards 2025 (recent data for time filters)
  const use2025 = Math.random() < 0.9;
  const startDate = use2025 ? new Date(2025, 0, 1) : new Date(c.created);
  const created = randomDate(startDate, END_DATE);

  const payment = {
    id: stripeId('pi', 12),
    customer_id: c.id,
    payment_method_id: pm.id,
    amount: faker.number.int({ min: 500, max: 20000 }),
    currency: pr.currency,
    status: pick(['succeeded', 'succeeded', 'succeeded', 'processing', 'requires_payment_method', 'canceled']), // bias toward succeeded
    product_id: pr.product_id,
    created: iso(created),
  };
  warehouse.payments.push(payment);

  // NOTE: Refunds from payments are not created here - we'll create them
  // after charges are generated so that all refunds have proper charge_id linkage
}

// 6️⃣ Generate Invoices (for subscriptions)
console.log(`6️⃣  Generating invoices for subscriptions...`);
for (const sub of warehouse.subscriptions) {
  // Generate 1-6 invoices per subscription
  const invoiceCount = faker.number.int({ min: 1, max: 6 });
  const subStart = new Date(sub.created);
  const subEnd = sub.canceled_at ? new Date(sub.canceled_at) : END_DATE;

  for (let i = 0; i < invoiceCount; i++) {
    const created = randomDate(subStart, subEnd);
    const price = warehouse.prices.find(p => p.id === sub.price_id);
    const total = price?.unit_amount || faker.number.int({ min: 500, max: 20000 });
    const status = pick(['paid', 'paid', 'paid', 'open', 'draft', 'void', 'uncollectible']); // bias toward paid

    warehouse.invoices.push({
      id: stripeId('in'),
      customer_id: sub.customer_id,
      subscription_id: sub.id,
      total: total,
      amount_paid: status === 'paid' ? total : (status === 'open' ? Math.round(total * faker.number.float({ min: 0, max: 0.5 })) : 0), // Paid invoices have full amount paid
      currency: price?.currency || 'usd',
      status: status,
      created: iso(created),
    });
  }
}

// 7️⃣ Generate Charges (one-time charges, similar to payments)
console.log(`7️⃣  Generating charges...`);
const chargeCount = Math.floor(PAYMENTS * 0.1); // 10% of payments are charges
for (let i = 0; i < chargeCount; i++) {
  const c = pick(warehouse.customers);
  const created = randomDate(new Date(c.created), END_DATE);
  const prod = pick(warehouse.products);

  const charge = {
    id: stripeId('ch'),
    customer_id: c.id,
    product_id: prod.id,
    amount: faker.number.int({ min: 500, max: 50000 }),
    currency: pick(['usd', 'eur', 'gbp']),
    status: pick(['succeeded', 'succeeded', 'succeeded', 'pending', 'failed']), // bias toward succeeded
    created: iso(created),
  };
  warehouse.charges.push(charge);

  // 25% chance of refund for succeeded charges
  if (charge.status === 'succeeded' && Math.random() < 0.25) {
    const refundCreated = randomDate(new Date(created), END_DATE);
    // Find a payment from the same customer to link to the refund
    const customerPayments = warehouse.payments.filter(p => p.customer_id === charge.customer_id && p.status === 'succeeded');
    const linkedPayment = customerPayments.length > 0 ? pick(customerPayments) : pick(warehouse.payments.filter(p => p.status === 'succeeded'));
    
    warehouse.refunds.push({
      id: stripeId('re'),
      payment_id: linkedPayment.id, // Link to a payment from same customer
      charge_id: charge.id, // Link to this charge
      amount: Math.round(charge.amount * faker.number.float({ min: 0.1, max: 1.0 })),
      currency: charge.currency,
      status: pick(['succeeded', 'succeeded', 'pending', 'canceled']), // bias toward succeeded
      reason: pick(['requested_by_customer', 'duplicate', 'fraudulent']),
      created: iso(refundCreated),
    });
  }
}

// 8️⃣ Generate Payouts (aggregate succeeded payments by month)
console.log(`8️⃣  Generating payouts from succeeded payments...`);
const succeededPayments = warehouse.payments.filter(p => p.status === 'succeeded');
const byMonth = new Map();

for (const p of succeededPayments) {
  const month = p.created.slice(0, 7); // YYYY-MM
  const existing = byMonth.get(month) || { amount: 0, currency: p.currency };
  existing.amount += p.amount;
  byMonth.set(month, existing);
}

for (const [month, data] of byMonth.entries()) {
  const payoutDate = new Date(`${month}-28`); // Payout on 28th of each month
  warehouse.payouts.push({
    id: stripeId('po'),
    amount: Math.round(data.amount * 0.95), // 5% fee simulation
    currency: data.currency,
    destination: faker.finance.iban(),
    status: pick(['paid', 'paid', 'paid', 'pending', 'canceled']), // bias toward paid
    created: iso(payoutDate),
  });
}

// ============================================================================
// Save to File
// ============================================================================

console.log('\n📝 Writing warehouse data to file...');

const outputPath = path.join(__dirname, '..', 'src', 'data', 'warehouse-data.ts');
const content = `/**
 * Auto-generated synthetic Stripe-like dataset
 * Generated: ${new Date().toISOString()}
 * Run: npm run generate-warehouse
 */

import type {
  Customer,
  PaymentMethod,
  Product,
  Price,
  Payment,
  Refund,
  Subscription,
  Invoice,
  Charge,
  Payout,
  Warehouse,
} from './warehouse';

export const warehouseData: Warehouse = ${JSON.stringify(warehouse, null, 2)};
`;

fs.writeFileSync(outputPath, content, 'utf-8');

// ============================================================================
// Summary
// ============================================================================

console.log('\n✅ Warehouse generated successfully!');
console.log('\n📊 Dataset Summary:');
console.log(`   Customers:         ${warehouse.customers.length.toLocaleString()}`);
console.log(`   Payment Methods:   ${warehouse.payment_methods.length.toLocaleString()}`);
console.log(`   Products:          ${warehouse.products.length.toLocaleString()}`);
console.log(`   Prices:            ${warehouse.prices.length.toLocaleString()}`);
console.log(`   Payments:          ${warehouse.payments.length.toLocaleString()}`);
console.log(`   Refunds:           ${warehouse.refunds.length.toLocaleString()}`);
console.log(`   Subscriptions:     ${warehouse.subscriptions.length.toLocaleString()}`);
console.log(`   Subscription Items: ${warehouse.subscription_items.length.toLocaleString()}`);
console.log(`   Invoices:          ${warehouse.invoices.length.toLocaleString()}`);
console.log(`   Charges:           ${warehouse.charges.length.toLocaleString()}`);
console.log(`   Payouts:           ${warehouse.payouts.length.toLocaleString()}`);
console.log(`\n📅 Date Range: ${iso(START_DATE)} to ${iso(END_DATE)} (${YEARS} years)`);
console.log(`\n💾 Output: ${outputPath}`);
console.log('\n🔍 Next steps:');
console.log('   1. Restart dev server: npm run dev');
console.log('   2. Refresh browser');
console.log('   3. Test 1M, 3M, YTD buttons\n');
