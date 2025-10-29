/**
 * Generate realistic synthetic Stripe-like dataset
 * Run with: npm run generate-warehouse
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
// Types (matching warehouse.ts)
// ============================================================================

interface Customer {
  id: string;
  email: string;
  name: string;
  country: string;
  created: string;
  balance: number;
  delinquent: boolean;
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  brand?: string;
  last4?: string;
  exp_month?: number;
  exp_year?: number;
  customer_id: string;
  created: string;
}

interface Product {
  id: string;
  name: string;
  active: boolean;
  description: string;
  created: string;
}

interface Price {
  id: string;
  product_id: string;
  unit_amount: number;
  currency: string;
  recurring_interval?: 'month' | 'year' | 'week';
  active: boolean;
  created: string;
}

interface Payment {
  id: string;
  customer_id: string;
  payment_method_id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'processing' | 'requires_payment_method' | 'canceled';
  product_id: string;
  created: string;
}

interface Refund {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'canceled';
  reason: string;
  created: string;
}

interface Subscription {
  id: string;
  customer_id: string;
  price_id: string;
  status: 'active' | 'trialing' | 'canceled' | 'past_due' | 'incomplete';
  created: string;
  current_period_start: string;
  current_period_end: string;
  canceled_at?: string;
}

interface Invoice {
  id: string;
  customer_id: string;
  subscription_id: string;
  total: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  created: string;
}

interface Charge {
  id: string;
  customer_id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed';
  created: string;
}

interface Payout {
  id: string;
  amount: number;
  currency: string;
  destination: string;
  status: 'paid' | 'pending' | 'canceled';
  created: string;
}

interface Warehouse {
  customers: Customer[];
  payment_methods: PaymentMethod[];
  products: Product[];
  prices: Price[];
  payments: Payment[];
  refunds: Refund[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  charges: Charge[];
  payouts: Payout[];
}

// ============================================================================
// Configuration
// ============================================================================

const YEARS = 5;
const START_DATE = new Date(2020, 0, 1); // Jan 1, 2020
const END_DATE = new Date(2024, 11, 31); // Dec 31, 2024

const CUSTOMERS = 5000;
const PRODUCTS = 20;
const PAYMENTS = 50000;
const SUBSCRIPTIONS = 4000;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate random date between start and end
 */
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/**
 * Convert Date to ISO date string (YYYY-MM-DD)
 */
function iso(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Pick random element from array
 */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate Stripe-style ID with prefix
 */
function stripeId(prefix: string, length: number = 10): string {
  return `${prefix}_${faker.string.alphanumeric({ length, casing: 'lower' })}`;
}

// ============================================================================
// Main Generation
// ============================================================================

console.log('🚀 Generating realistic synthetic dataset...\n');

const warehouse: Warehouse = {
  customers: [],
  payment_methods: [],
  products: [],
  prices: [],
  payments: [],
  refunds: [],
  subscriptions: [],
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
  const created = randomDate(new Date(c.created), END_DATE);

  const periodLength = pr.recurring_interval === 'year' ? 12 : pr.recurring_interval === 'week' ? 0.25 : 1;
  const periodEnd = new Date(created);
  periodEnd.setMonth(periodEnd.getMonth() + periodLength);

  const isCanceled = faker.datatype.boolean({ probability: 0.2 });
  const canceledAt = isCanceled ? randomDate(created, new Date(Math.min(periodEnd.getTime(), END_DATE.getTime()))) : undefined;

  warehouse.subscriptions.push({
    id: stripeId('sub'),
    customer_id: c.id,
    price_id: pr.id,
    status: isCanceled ? 'canceled' : pick(['active', 'trialing', 'past_due', 'incomplete']),
    created: iso(created),
    current_period_start: iso(created),
    current_period_end: iso(periodEnd),
    canceled_at: canceledAt ? iso(canceledAt) : undefined,
  });
}

// 5️⃣ Generate Payments
console.log(`5️⃣  Generating ${PAYMENTS} payments...`);
for (let i = 0; i < PAYMENTS; i++) {
  const c = pick(warehouse.customers);
  const pms = warehouse.payment_methods.filter(pm => pm.customer_id === c.id);
  if (pms.length === 0) continue;

  const pm = pick(pms);
  const pr = pick(warehouse.prices);
  const created = randomDate(new Date(c.created), END_DATE);

  const payment: Payment = {
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

  // 5% chance of refund for succeeded payments
  if (payment.status === 'succeeded' && Math.random() < 0.05) {
    const refundCreated = randomDate(created, END_DATE);
    warehouse.refunds.push({
      id: stripeId('re'),
      payment_id: payment.id,
      amount: Math.round(payment.amount * faker.number.float({ min: 0.1, max: 1.0 })),
      currency: payment.currency,
      status: pick(['succeeded', 'succeeded', 'pending', 'canceled']), // bias toward succeeded
      reason: pick(['requested_by_customer', 'duplicate', 'fraudulent']),
      created: iso(refundCreated),
    });
  }
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

    warehouse.invoices.push({
      id: stripeId('in'),
      customer_id: sub.customer_id,
      subscription_id: sub.id,
      total: price?.unit_amount || faker.number.int({ min: 500, max: 20000 }),
      currency: price?.currency || 'usd',
      status: pick(['paid', 'paid', 'paid', 'open', 'draft', 'void', 'uncollectible']), // bias toward paid
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

  warehouse.charges.push({
    id: stripeId('ch'),
    customer_id: c.id,
    amount: faker.number.int({ min: 500, max: 50000 }),
    currency: pick(['usd', 'eur', 'gbp']),
    status: pick(['succeeded', 'succeeded', 'succeeded', 'pending', 'failed']), // bias toward succeeded
    created: iso(created),
  });
}

// 8️⃣ Generate Payouts (aggregate succeeded payments by month)
console.log(`8️⃣  Generating payouts from succeeded payments...`);
const succeededPayments = warehouse.payments.filter(p => p.status === 'succeeded');
const byMonth = new Map<string, { amount: number; currency: string }>();

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
console.log(`   Customers:        ${warehouse.customers.length.toLocaleString()}`);
console.log(`   Payment Methods:  ${warehouse.payment_methods.length.toLocaleString()}`);
console.log(`   Products:         ${warehouse.products.length.toLocaleString()}`);
console.log(`   Prices:           ${warehouse.prices.length.toLocaleString()}`);
console.log(`   Payments:         ${warehouse.payments.length.toLocaleString()}`);
console.log(`   Refunds:          ${warehouse.refunds.length.toLocaleString()}`);
console.log(`   Subscriptions:    ${warehouse.subscriptions.length.toLocaleString()}`);
console.log(`   Invoices:         ${warehouse.invoices.length.toLocaleString()}`);
console.log(`   Charges:          ${warehouse.charges.length.toLocaleString()}`);
console.log(`   Payouts:          ${warehouse.payouts.length.toLocaleString()}`);
console.log(`\n📅 Date Range: ${iso(START_DATE)} to ${iso(END_DATE)} (${YEARS} years)`);
console.log(`\n💾 Output: ${outputPath}`);
console.log('\n🔍 Next steps:');
console.log('   1. Update warehouse.ts to import from warehouse-data.ts');
console.log('   2. Run: npm run dev');
console.log('   3. Check console for validation results\n');
