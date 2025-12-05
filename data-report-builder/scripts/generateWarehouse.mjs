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

// Scaled up for realistic business metrics while keeping file size manageable
const CUSTOMERS = 10000;      // Increased for realistic customer base
const PRODUCTS = 25;          // More product variety
const PAYMENTS = 50000;       // Higher payment volume
const SUBSCRIPTIONS = 12000;  // Target ~10k active subscriptions for realistic MRR

// Safety limits to prevent runaway generation
const SAFETY_LIMITS = {
  MAX_CUSTOMERS: 100000,
  MAX_SUBSCRIPTIONS: 50000,
  MAX_PAYMENTS: 200000,
  GENERATION_TIMEOUT_MS: 300000, // 5 minutes
  MAX_FILE_SIZE_MB: 50,
};

// Estimated bytes per record for file size calculation
const BYTES_PER_RECORD = {
  customer: 150,
  subscription: 200,
  payment: 180,
  price: 120,
  product: 150,
};

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
// Validation Functions
// ============================================================================

function validateConfig() {
  console.log('🔍 Validating configuration...');
  if (CUSTOMERS > SAFETY_LIMITS.MAX_CUSTOMERS) {
    throw new Error(`CUSTOMERS (${CUSTOMERS}) exceeds limit (${SAFETY_LIMITS.MAX_CUSTOMERS})`);
  }
  if (SUBSCRIPTIONS > SAFETY_LIMITS.MAX_SUBSCRIPTIONS) {
    throw new Error(`SUBSCRIPTIONS (${SUBSCRIPTIONS}) exceeds limit (${SAFETY_LIMITS.MAX_SUBSCRIPTIONS})`);
  }
  if (PAYMENTS > SAFETY_LIMITS.MAX_PAYMENTS) {
    throw new Error(`PAYMENTS (${PAYMENTS}) exceeds limit (${SAFETY_LIMITS.MAX_PAYMENTS})`);
  }
  
  // Estimate output size
  const estimatedMB = (
    CUSTOMERS * BYTES_PER_RECORD.customer +
    SUBSCRIPTIONS * BYTES_PER_RECORD.subscription +
    PAYMENTS * BYTES_PER_RECORD.payment +
    PRODUCTS * BYTES_PER_RECORD.product * 3 // ~3 prices per product
  ) / 1024 / 1024;
  
  console.log(`   📦 Estimated output: ${estimatedMB.toFixed(2)} MB`);
  if (estimatedMB > SAFETY_LIMITS.MAX_FILE_SIZE_MB) {
    throw new Error(`Estimated size ${estimatedMB.toFixed(2)}MB exceeds ${SAFETY_LIMITS.MAX_FILE_SIZE_MB}MB limit`);
  }
  console.log('   ✅ Config validation passed\n');
}

function validateRelationalIntegrity(warehouse) {
  console.log('\n🔍 Validating relational integrity...');
  const errors = [];
  
  // Check payments have valid customers
  warehouse.payments.forEach(p => {
    if (!warehouse.customers.find(c => c.id === p.customer_id)) {
      errors.push(`Payment ${p.id} -> invalid customer_id`);
    }
  });
  
  // Check subscriptions have valid price and customer
  warehouse.subscriptions.forEach(sub => {
    if (!warehouse.prices.find(pr => pr.id === sub.price_id)) {
      errors.push(`Subscription ${sub.id} -> invalid price_id`);
    }
    if (!warehouse.customers.find(c => c.id === sub.customer_id)) {
      errors.push(`Subscription ${sub.id} -> invalid customer_id`);
    }
  });
  
  // Check prices have valid products
  warehouse.prices.forEach(pr => {
    if (!warehouse.products.find(p => p.id === pr.product_id)) {
      errors.push(`Price ${pr.id} -> invalid product_id`);
    }
  });
  
  // Check subscription_items have valid subscription and price
  warehouse.subscription_items.forEach(item => {
    if (!warehouse.subscriptions.find(s => s.id === item.subscription_id)) {
      errors.push(`SubscriptionItem ${item.id} -> invalid subscription_id`);
    }
    if (!warehouse.prices.find(p => p.id === item.price_id)) {
      errors.push(`SubscriptionItem ${item.id} -> invalid price_id`);
    }
  });
  
  // Check charges have valid customer and product
  warehouse.charges.forEach(ch => {
    if (!warehouse.customers.find(c => c.id === ch.customer_id)) {
      errors.push(`Charge ${ch.id} -> invalid customer_id`);
    }
    if (!warehouse.products.find(p => p.id === ch.product_id)) {
      errors.push(`Charge ${ch.id} -> invalid product_id`);
    }
    // Check price_id if it exists (will be added in Phase 2)
    if (ch.price_id && !warehouse.prices.find(p => p.id === ch.price_id)) {
      errors.push(`Charge ${ch.id} -> invalid price_id`);
    }
  });
  
  if (errors.length > 0) {
    console.error('   ❌ Relational integrity errors:');
    errors.slice(0, 5).forEach(e => console.error(`      ${e}`));
    if (errors.length > 5) console.error(`      ... and ${errors.length - 5} more`);
    throw new Error(`${errors.length} integrity errors found`);
  }
  console.log('   ✅ All foreign keys valid');
}

function validateMetrics(warehouse) {
  console.log('\n📊 Validating metrics...');
  
  const activeSubscriptions = warehouse.subscriptions.filter(s => 
    s.status === 'active' && new Date(s.current_period_end) > new Date()
  );
  
  let calculatedMRR = 0;
  let missingPrices = 0;
  
  activeSubscriptions.forEach(sub => {
    const price = warehouse.prices.find(p => p.id === sub.price_id);
    if (!price) {
      missingPrices++;
      return;
    }
    
    let monthlyAmount = price.unit_amount;
    if (price.recurring_interval === 'year') {
      monthlyAmount = Math.round(price.unit_amount / 12);
    } else if (price.recurring_interval === 'week') {
      monthlyAmount = Math.round(price.unit_amount * 4.33);
    }
    calculatedMRR += monthlyAmount;
  });
  
  const mrrDollars = calculatedMRR / 100;
  console.log(`   Active subscriptions: ${activeSubscriptions.length.toLocaleString()}`);
  console.log(`   Calculated MRR: $${mrrDollars.toLocaleString()}`);
  
  if (activeSubscriptions.length === 0) {
    throw new Error('No active subscriptions generated');
  }
  if (missingPrices > 0) {
    throw new Error(`${missingPrices} active subscriptions have invalid price_id`);
  }
  if (mrrDollars < 1000) {
    console.warn(`   ⚠️  MRR is very low ($${mrrDollars.toFixed(2)})`);
  }
  
  console.log('   ✅ Metrics validation passed');
}

// ============================================================================
// Main Generation
// ============================================================================

console.log('🚀 Generating realistic synthetic dataset...\n');

// Validate configuration before starting
validateConfig();

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
  balance_transactions: [],
  coupons: [],
};

// 1️⃣ Generate Customers
console.log(`1️⃣  Generating ${CUSTOMERS} customers...`);
// Use realistic country distribution with valid ISO codes
const COUNTRIES = ['US', 'US', 'US', 'US', 'US', 'CA', 'CA', 'MX', 'GB', 'DE', 'FR', 'AU', 'JP', 'BR']; // Bias toward North America
for (let i = 0; i < CUSTOMERS; i++) {
  const created = randomDate(START_DATE, END_DATE);
  const country = pick(COUNTRIES);
  warehouse.customers.push({
    id: stripeId('cus'),
    email: faker.internet.email().toLowerCase(),
    name: faker.person.fullName(),
    country, // Use valid ISO country codes with North America bias
    address_country: country, // Same value for schema compatibility
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

  // Each product has 2-4 prices with realistic tiered pricing
  const priceTiers = [
    { amount: 2900, weight: 0.40 },   // $29/mo - 40% of prices
    { amount: 4900, weight: 0.25 },   // $49/mo - 25%
    { amount: 9900, weight: 0.20 },   // $99/mo - 20%
    { amount: 19900, weight: 0.10 },  // $199/mo - 10%
    { amount: 49900, weight: 0.05 },  // $499/mo - 5%
  ];
  
  const priceCount = faker.number.int({ min: 2, max: 4 });
  for (let j = 0; j < priceCount; j++) {
    // Weighted random selection for realistic distribution
    const rand = Math.random();
    let cumulativeWeight = 0;
    let selectedAmount = 2900; // default
    
    for (const tier of priceTiers) {
      cumulativeWeight += tier.weight;
      if (rand <= cumulativeWeight) {
        selectedAmount = tier.amount;
        break;
      }
    }
    
    const currency = pick(['usd', 'usd', 'usd', 'eur', 'gbp']); // Bias toward USD
    warehouse.prices.push({
      id: stripeId('price'),
      product_id: pid,
      unit_amount: selectedAmount,
      currency,
      recurring_interval: pick(['month', 'month', 'month', 'year']), // Bias toward monthly
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
  const status = isCanceled ? 'canceled' : pick(['active', 'active', 'active', 'trialing', 'past_due']); // Bias toward active
  const isTrialing = status === 'trialing';

  const subId = stripeId('sub');
  warehouse.subscriptions.push({
    id: subId,
    customer_id: c.id,
    price_id: pr.id,
    status,
    created: iso(created),
    current_period_start: iso(periodStart),
    current_period_end: iso(periodEnd),
    canceled_at: canceledAt ? iso(canceledAt) : undefined,
    cancellation_details_reason: canceledAt ? pick(['payment_failed', 'customer_request', 'other']) : undefined,
    trial_start: isTrialing ? iso(periodStart) : undefined,
    trial_end: isTrialing ? iso(new Date(periodStart.getTime() + 14 * 24 * 60 * 60 * 1000)) : undefined, // 14 day trial
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
    price_id: pr.id,  // Explicit price link for consistency
    amount: pr.unit_amount,  // Use price's amount for consistency
    currency: pr.currency,
    status: pick(['succeeded', 'succeeded', 'succeeded', 'succeeded', 'succeeded', 'pending', 'failed']), // Heavy bias toward succeeded for realistic data
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
  
  // Get a valid price for this product
  const productPrices = warehouse.prices.filter(p => p.product_id === prod.id);
  if (productPrices.length === 0) continue; // Skip if no prices for this product
  const pr = pick(productPrices);

  // Determine payment method type and card brand
  const methodType = pick(['card', 'card', 'card', 'bank_account', 'us_bank_account']); // bias toward card
  const cardBrand = methodType === 'card' ? pick(['visa', 'mastercard', 'amex', 'discover', 'diners', 'jcb', 'unionpay']) : undefined;
  
  const status = pick(['succeeded', 'succeeded', 'succeeded', 'pending', 'failed']); // bias toward succeeded
  const charge = {
    id: stripeId('ch'),
    customer_id: c.id,
    product_id: prod.id,
    price_id: pr.id,  // Link to price for consistency
    amount: pr.unit_amount,  // Use price's amount for consistency
    currency: pr.currency,  // Use price's currency
    status,
    paid: status === 'succeeded', // Set paid to true if status is succeeded
    created: iso(created),
    payment_method_details_type: methodType,
    payment_method_details_card_brand: cardBrand,
    billing_details_address_country: c.country, // Use customer's country
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

// 1️⃣1️⃣ Generate Balance Transactions
console.log('1️⃣1️⃣ Generating balance transactions...');
// Generate balance transactions for charges (with fees)
// Stripe fee structure: 2.9% + $0.30 for cards, 0.8% for ACH (capped at $5)
warehouse.charges.forEach((charge, i) => {
  if (charge.status === 'succeeded') {
    const paymentMethod = warehouse.payment_methods.find(pm => pm.id === charge.payment_method_id);
    const isCard = paymentMethod?.type === 'card';
    const feePercent = isCard ? 0.029 : 0.008;
    const feeFixed = isCard ? 30 : 0; // $0.30 in cents
    const fee = Math.min(
      Math.round(charge.amount * feePercent) + feeFixed,
      isCard ? charge.amount : 500 // Cap ACH at $5
    );

    // Charge transaction
    warehouse.balance_transactions.push({
      id: stripeId('txn'),
      amount: charge.amount,
      net: charge.amount, // Gross amount before fees
      fee: 0,
      currency: 'usd',
      type: 'charge',
      reporting_category: 'charge',
      source_id: charge.id,
      created: charge.created,
    });

    // Fee transaction (amount is positive for reporting purposes)
    warehouse.balance_transactions.push({
      id: stripeId('txn'),
      amount: fee,
      net: -fee,
      fee: fee,
      currency: 'usd',
      type: 'charge',
      reporting_category: 'charge_fee',
      source_id: charge.id,
      created: charge.created,
    });
  }
});

// Generate balance transactions for refunds
warehouse.refunds.forEach((refund, i) => {
  if (refund.status === 'succeeded') {
    // Find the original payment to calculate refunded fee
    const payment = warehouse.payments.find(p => p.id === refund.payment_id);
    if (payment) {
      const paymentMethod = warehouse.payment_methods.find(pm => pm.id === payment.payment_method_id);
      const isCard = paymentMethod?.type === 'card';
      const feePercent = isCard ? 0.029 : 0.008;
      const feeFixed = isCard ? 30 : 0;
      const refundedFee = Math.min(
        Math.round(refund.amount * feePercent) + feeFixed,
        isCard ? refund.amount : 500
      );

      warehouse.balance_transactions.push({
        id: stripeId('txn'),
        amount: -refund.amount,
        net: -(refund.amount - refundedFee), // Stripe keeps the fee on refunds
        fee: refundedFee,
        currency: 'usd',
        type: 'refund',
        reporting_category: 'refund',
        source_id: refund.id,
        created: refund.created,
      });
    }
  }
});

// Generate balance transactions for payouts
warehouse.payouts.forEach((payout, i) => {
  warehouse.balance_transactions.push({
    id: stripeId('txn'),
    amount: -payout.amount,
    net: -payout.amount,
    fee: 0,
    currency: 'usd',
    type: 'payout',
    reporting_category: 'payout',
    source_id: payout.id,
    created: payout.created,
  });
});

console.log(`   Generated ${warehouse.balance_transactions.length} balance transactions`);

// 1️⃣2️⃣ Generate Coupons
console.log('1️⃣2️⃣ Generating coupons...');
const COUPON_NAMES = [
  'SUMMER2025', 'WELCOME10', 'ANNUAL20', 'FLASH50', 'LOYALTY15',
  'FIRSTTIME', 'UPGRADE25', 'FRIENDS30', 'EARLYBIRD', 'BLACKFRIDAY',
  'NEWYEAR', 'SPRING15', 'FALL20', 'WINTER25', 'REFER30',
  'SAVE10', 'DISCOUNT20', 'PROMO50', 'SPECIAL', 'VIP'
];

for (let i = 0; i < 20; i++) {
  const isPercentOff = i % 2 === 0;
  const duration = pick(['forever', 'once', 'repeating']);

  warehouse.coupons.push({
    id: stripeId('coup'),
    name: COUPON_NAMES[i],
    amount_off: isPercentOff ? undefined : pick([500, 1000, 2000, 5000, 10000]),
    percent_off: isPercentOff ? pick([10, 15, 20, 25, 30, 50]) : undefined,
    currency: isPercentOff ? undefined : 'usd',
    duration,
    duration_in_months: duration === 'repeating' ? pick([3, 6, 12]) : undefined,
    max_redemptions: i % 3 === 0 ? pick([50, 100, 200, 500]) : undefined,
    times_redeemed: Math.floor(Math.random() * 100),
    valid: i < 16, // First 16 are valid
    created: '2025-01-01',
  });
}

console.log(`   Generated ${warehouse.coupons.length} coupons`);

// ============================================================================
// Validate Before Saving
// ============================================================================

validateRelationalIntegrity(warehouse);
validateMetrics(warehouse);

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
  BalanceTransaction,
  Coupon,
  Warehouse,
} from './warehouse';

export const warehouseData: Warehouse = ${JSON.stringify(warehouse, null, 2)};
`;

fs.writeFileSync(outputPath, content, 'utf-8');

// ============================================================================
// Export JSON Files for Browser
// ============================================================================

console.log('\n📦 Exporting JSON files for browser...');
const publicDataDir = path.join(__dirname, '..', 'public', 'data');
fs.mkdirSync(publicDataDir, { recursive: true });

// Export each entity as a JSON file
Object.keys(warehouse).forEach(entityName => {
  const data = warehouse[entityName];
  const filepath = path.join(publicDataDir, `${entityName}.json`);
  fs.writeFileSync(filepath, JSON.stringify(data), 'utf-8');
  const sizeKB = (Buffer.byteLength(JSON.stringify(data)) / 1024).toFixed(0);
  console.log(`   ✅ ${entityName.padEnd(18)} ${String(data.length).padStart(6)} records  ${sizeKB.padStart(6)} KB`);
});

// Create singular symlinks for compatibility with presets that use singular names
const singularMappings = {
  'customers': 'customer',
  'payments': 'payment',
  'refunds': 'refund',
  'subscriptions': 'subscription',
  'subscription_items': 'subscription_item',
  'invoices': 'invoice',
  'charges': 'charge',
  'payouts': 'payout',
  'prices': 'price',
  'products': 'product',
  'payment_methods': 'payment_method',
  'balance_transactions': 'balance_transaction',
  'coupons': 'coupon',
  'disputes': 'dispute',
};

console.log('\n📎 Creating singular symlinks...');
Object.entries(singularMappings).forEach(([plural, singular]) => {
  const symlinkPath = path.join(publicDataDir, `${singular}.json`);
  const targetFile = `${plural}.json`;
  
  // Remove existing symlink if it exists
  try {
    fs.unlinkSync(symlinkPath);
  } catch (e) {
    // File doesn't exist, that's fine
  }
  
  // Create symlink
  try {
    fs.symlinkSync(targetFile, symlinkPath);
    console.log(`   🔗 ${singular}.json -> ${targetFile}`);
  } catch (e) {
    console.log(`   ⚠️  Could not create symlink for ${singular}: ${e.message}`);
  }
});

// Create manifest
const manifest = {
  generated: new Date().toISOString(),
  entities: Object.keys(warehouse),
  counts: Object.keys(warehouse).reduce((acc, name) => {
    acc[name] = warehouse[name].length;
    return acc;
  }, {})
};
fs.writeFileSync(path.join(publicDataDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

// ============================================================================
// Summary
// ============================================================================

console.log('\n✅ Warehouse generated successfully!');
console.log('\n📊 Dataset Summary:');
console.log(`   Customers:            ${warehouse.customers.length.toLocaleString()}`);
console.log(`   Payment Methods:      ${warehouse.payment_methods.length.toLocaleString()}`);
console.log(`   Products:             ${warehouse.products.length.toLocaleString()}`);
console.log(`   Prices:               ${warehouse.prices.length.toLocaleString()}`);
console.log(`   Payments:             ${warehouse.payments.length.toLocaleString()}`);
console.log(`   Refunds:              ${warehouse.refunds.length.toLocaleString()}`);
console.log(`   Subscriptions:        ${warehouse.subscriptions.length.toLocaleString()}`);
console.log(`   Subscription Items:   ${warehouse.subscription_items.length.toLocaleString()}`);
console.log(`   Invoices:             ${warehouse.invoices.length.toLocaleString()}`);
console.log(`   Charges:              ${warehouse.charges.length.toLocaleString()}`);
console.log(`   Payouts:              ${warehouse.payouts.length.toLocaleString()}`);
console.log(`   Balance Transactions: ${warehouse.balance_transactions.length.toLocaleString()}`);
console.log(`   Coupons:              ${warehouse.coupons.length.toLocaleString()}`);
console.log(`\n📅 Date Range: ${iso(START_DATE)} to ${iso(END_DATE)} (${YEARS} years)`);
console.log(`\n💾 Output: ${outputPath}`);
console.log('\n🔍 Next steps:');
console.log('   1. Restart dev server: npm run dev');
console.log('   2. Refresh browser');
console.log('   3. Test all reports with new data\n');
