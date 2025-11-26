/**
 * Normalized Data Warehouse
 * Single source of truth for all entities
 */

// ============================================================================
// Entity Interfaces
// ============================================================================

export interface Customer {
  id: string;
  email: string;
  name: string;
  country: string;
  address_country: string; // Alias for country to match schema
  created: string;
  balance: number;
  delinquent: boolean;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  brand?: string;
  last4?: string;
  exp_month?: number;
  exp_year?: number;
  customer_id: string;
  created: string;
}

export interface Product {
  id: string;
  name: string;
  active: boolean;
  description: string;
  created: string;
}

export interface Price {
  id: string;
  product_id: string;
  unit_amount: number;
  currency: string;
  recurring_interval?: 'month' | 'year' | 'week';
  active: boolean;
  created: string;
}

export interface Payment {
  id: string;
  customer_id: string;
  payment_method_id: string;
  price_id?: string;
  invoice_id?: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'processing' | 'requires_payment_method' | 'canceled' | 'pending' | 'failed';
  product_id: string;
  created: string;
}

export interface Refund {
  id: string;
  payment_id: string;
  charge_id?: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'canceled';
  reason?: string;
  created: string;
}

export interface Subscription {
  id: string;
  customer_id: string;
  price_id: string;
  status: 'active' | 'trialing' | 'canceled' | 'past_due' | 'incomplete';
  created: string;
  current_period_start: string;
  current_period_end: string;
  canceled_at?: string;
  cancel_at_period_end?: boolean;
  cancellation_details_reason?: 'payment_failed' | 'customer_request' | 'other';
  trial_start?: string;
  trial_end?: string;
}

export interface SubscriptionItem {
  id: string;
  subscription_id: string;
  price_id: string;
  quantity: number;
  created: string;
}

export interface Invoice {
  id: string;
  customer_id: string;
  subscription_id?: string;
  total?: number;
  amount_due?: number;
  amount_paid?: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  created: string;
}

export interface Charge {
  id: string;
  customer_id: string;
  payment_method_id?: string;
  payment_intent_id?: string;
  invoice_id?: string;
  product_id?: string;
  price_id?: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed';
  paid?: boolean;
  created: string;
  payment_method_details_type?: 'card' | 'bank_account' | 'us_bank_account';
  payment_method_details_card_brand?: 'visa' | 'mastercard' | 'amex' | 'discover' | 'diners' | 'jcb' | 'unionpay';
  billing_details_address_country?: string;
}

export interface Payout {
  id: string;
  amount: number;
  currency: string;
  destination: string;
  status: 'paid' | 'pending' | 'canceled';
  arrival_date?: string;
  created: string;
}

export interface BalanceTransaction {
  id: string;
  amount: number; // Gross amount in cents
  net: number; // Net amount after fees
  fee: number; // Fee amount in cents
  currency: string;
  type: 'charge' | 'refund' | 'adjustment' | 'payout' | 'payout_cancel' | 'transfer';
  reporting_category: string; // e.g., 'charge', 'charge_fee', 'refund', etc.
  source_id?: string; // ID of the charge, refund, etc.
  created: string;
}

export interface Coupon {
  id: string;
  name: string;
  amount_off?: number; // Amount off in cents
  percent_off?: number; // Percent off (0-100)
  currency?: string;
  duration: 'forever' | 'once' | 'repeating';
  duration_in_months?: number;
  max_redemptions?: number;
  times_redeemed: number;
  valid: boolean;
  created: string;
}

// ============================================================================
// Warehouse Container
// ============================================================================

export interface Warehouse {
  customers: Customer[];
  payment_methods: PaymentMethod[];
  products: Product[];
  prices: Price[];
  payments: Payment[];
  refunds: Refund[];
  subscriptions: Subscription[];
  subscription_items: SubscriptionItem[];
  invoices: Invoice[];
  charges: Charge[];
  payouts: Payout[];
  balance_transactions: BalanceTransaction[];
  coupons: Coupon[];
}

// ============================================================================
// Data Generation
// ============================================================================

/**
 * Generate realistic 2025 data for the warehouse
 * All dates will be in the range 2025-01-01 to 2025-10-29
 */
function generateWarehouseData(): Warehouse {
  const customers: Customer[] = [];
  const payment_methods: PaymentMethod[] = [];
  const products: Product[] = [];
  const prices: Price[] = [];
  const payments: Payment[] = [];
  const refunds: Refund[] = [];
  const subscriptions: Subscription[] = [];
  const invoices: Invoice[] = [];
  const charges: Charge[] = [];
  const payouts: Payout[] = [];
  const balance_transactions: BalanceTransaction[] = [];
  const coupons: Coupon[] = [];

  // Helper to generate dates in 2025
  const randomDate2025 = (seed: number): string => {
    const start = new Date('2025-01-01');
    const end = new Date('2025-10-29');
    const range = end.getTime() - start.getTime();
    const timestamp = start.getTime() + (range * (seed % 1000) / 1000);
    return new Date(timestamp).toISOString().split('T')[0];
  };

  // Generate 50 customers
  const customerNames = [
    'Acme Corp', 'TechStart Inc', 'Global Ventures', 'Innovation Labs', 'Digital Solutions',
    'Cloud Services Co', 'Data Systems Ltd', 'Smart Tech', 'Future Industries', 'Prime Enterprise',
    'Elite Business', 'Summit Group', 'Vertex Solutions', 'Nexus Corp', 'Apex Industries',
    'Zenith Tech', 'Quantum Labs', 'Stellar Systems', 'Phoenix Group', 'Atlas Services',
    'Titan Enterprises', 'Omega Solutions', 'Delta Corp', 'Sigma Tech', 'Alpha Industries',
    'Beta Systems', 'Gamma Group', 'Epsilon Labs', 'Zeta Solutions', 'Theta Corp',
    'Lambda Tech', 'Kappa Industries', 'Iota Services', 'Eta Systems', 'Mu Group',
    'Nu Solutions', 'Xi Corp', 'Omicron Tech', 'Rho Labs', 'Tau Industries',
    'Upsilon Group', 'Phi Systems', 'Chi Solutions', 'Psi Corp', 'Nova Tech',
    'Pulse Industries', 'Spark Ventures', 'Bright Future Co', 'Clear Vision Ltd', 'Swift Progress Inc'
  ];

  const countries = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE'];

  for (let i = 0; i < 50; i++) {
    const id = `cus_${String(i + 1).padStart(3, '0')}`;
    const name = customerNames[i];
    const email = `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com`;

    const country = countries[i % countries.length];
    customers.push({
      id,
      email,
      name,
      country,
      address_country: country, // Same value for schema compatibility
      created: randomDate2025(i * 13),
      balance: [0, -50, -100, 200, 500][i % 5],
      delinquent: i % 10 === 0,
    });

    // 1 payment method per customer
    payment_methods.push({
      id: `pm_${String(i + 1).padStart(3, '0')}`,
      type: i % 5 === 0 ? 'bank_account' : 'card',
      brand: i % 5 === 0 ? undefined : ['visa', 'mastercard', 'amex'][i % 3],
      last4: String(1000 + (i * 17) % 9000),
      exp_month: (i % 12) + 1,
      exp_year: 2027 + (i % 3),
      customer_id: id,
      created: randomDate2025(i * 13 + 1),
    });
  }

  // Generate 15 products
  const productNames = [
    'Starter Plan', 'Professional Plan', 'Enterprise Plan', 'API Access', 'Premium Support',
    'Data Analytics', 'Cloud Storage', 'Security Suite', 'Monitoring Tools', 'Integration Pack',
    'Advanced Features', 'Custom Reports', 'Priority Queue', 'Extended Limits', 'White Label'
  ];

  for (let i = 0; i < 15; i++) {
    const id = `prod_${String(i + 1).padStart(3, '0')}`;

    products.push({
      id,
      name: productNames[i],
      active: i < 12, // First 12 active
      description: `${productNames[i]} - comprehensive solution for your business needs`,
      created: '2025-01-01',
    });

    // 2-3 prices per product (different intervals)
    const baseAmount = [2900, 9900, 29900, 99900, 4900][i % 5];

    prices.push({
      id: `price_${String(i * 2 + 1).padStart(3, '0')}`,
      product_id: id,
      unit_amount: baseAmount,
      currency: 'usd',
      recurring_interval: 'month',
      active: true,
      created: '2025-01-01',
    });

    if (i < 10) {
      prices.push({
        id: `price_${String(i * 2 + 2).padStart(3, '0')}`,
        product_id: id,
        unit_amount: Math.floor(baseAmount * 10 * 0.85), // 15% discount for annual
        currency: 'usd',
        recurring_interval: 'year',
        active: true,
        created: '2025-01-01',
      });
    }
  }

  // Generate 80 subscriptions (spread across 2025)
  for (let i = 0; i < 80; i++) {
    const customerId = customers[i % 50].id;
    const priceId = prices[i % prices.length].id;
    const createdDate = randomDate2025(i * 37);
    const periodStart = new Date(createdDate);
    periodStart.setDate(periodStart.getDate() + 1);
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + (prices.find(p => p.id === priceId)?.recurring_interval === 'year' ? 12 : 1));

    const isCanceled = i % 15 === 0;

    subscriptions.push({
      id: `sub_${String(i + 1).padStart(3, '0')}`,
      customer_id: customerId,
      price_id: priceId,
      status: isCanceled ? 'canceled' : (i % 20 === 0 ? 'past_due' : 'active'),
      created: createdDate,
      current_period_start: periodStart.toISOString().split('T')[0],
      current_period_end: periodEnd.toISOString().split('T')[0],
      canceled_at: isCanceled ? randomDate2025(i * 37 + 100) : undefined,
      cancel_at_period_end: i % 25 === 0,
    });
  }

  // Generate 120 invoices (more than subscriptions, includes one-time)
  for (let i = 0; i < 120; i++) {
    const customerId = customers[i % 50].id;
    const hasSubscription = i < 80;
    const subscriptionId = hasSubscription ? subscriptions[i].id : undefined;
    const amount = [2900, 4900, 9900, 14900, 29900, 49900, 99900][i % 7];

    invoices.push({
      id: `in_${String(i + 1).padStart(3, '0')}`,
      customer_id: customerId,
      subscription_id: subscriptionId,
      amount_due: amount,
      amount_paid: i % 10 === 0 ? 0 : amount,
      currency: 'usd',
      status: i % 10 === 0 ? 'open' : (i % 20 === 0 ? 'void' : 'paid'),
      created: randomDate2025(i * 29),
    });
  }

  // Generate 150 payments (spread throughout 2025)
  for (let i = 0; i < 150; i++) {
    const customerId = customers[i % 50].id;
    const invoiceId = i < 120 ? invoices[i].id : undefined;
    const amount = [2900, 4900, 9900, 14900, 19900, 29900, 49900, 99900, 149900][i % 9];

    payments.push({
      id: `pi_${String(i + 1).padStart(3, '0')}`,
      customer_id: customerId,
      payment_method_id: payment_methods[i % 50].id,
      invoice_id: invoiceId,
      amount,
      currency: 'usd',
      status: i % 30 === 0 ? 'processing' : (i % 50 === 0 ? 'requires_payment_method' : 'succeeded'),
      product_id: products[i % 10].id,
      created: randomDate2025(i * 23),
    });
  }

  // Generate 25 refunds
  for (let i = 0; i < 25; i++) {
    const paymentIdx = i * 6;
    if (paymentIdx < payments.length) {
      const payment = payments[paymentIdx];
      const refundAmount = i % 3 === 0 ? payment.amount : Math.floor(payment.amount / 2);

      refunds.push({
        id: `re_${String(i + 1).padStart(3, '0')}`,
        payment_id: payment.id,
        amount: refundAmount,
        currency: 'usd',
        status: i % 10 === 0 ? 'pending' : 'succeeded',
        reason: ['requested_by_customer', 'duplicate', 'fraudulent'][i % 3],
        created: randomDate2025(i * 23 + 500),
      });
    }
  }

  // Generate 30 charges
  for (let i = 0; i < 30; i++) {
    const customerId = customers[i % 50].id;
    const amount = [1900, 3900, 5900, 8900, 12900][i % 5];

    charges.push({
      id: `ch_${String(i + 1).padStart(3, '0')}`,
      customer_id: customerId,
      payment_method_id: payment_methods[i % 50].id,
      product_id: products[i % 10].id,
      amount,
      currency: 'usd',
      status: i % 15 === 0 ? 'failed' : 'succeeded',
      created: randomDate2025(i * 31),
    });
  }

  // Generate 15 payouts
  for (let i = 0; i < 15; i++) {
    const amount = [50000, 75000, 100000, 150000, 200000][i % 5];
    const createdDate = randomDate2025(i * 67);
    const arrivalDate = new Date(createdDate);
    arrivalDate.setDate(arrivalDate.getDate() + 3);

    payouts.push({
      id: `po_${String(i + 1).padStart(3, '0')}`,
      amount,
      currency: 'usd',
      destination: `ba_${String(i + 1).padStart(3, '0')}`,
      status: i % 10 === 0 ? 'pending' : 'paid',
      arrival_date: arrivalDate.toISOString().split('T')[0],
      created: createdDate,
    });
  }

  // Generate balance transactions for charges (with fees)
  // Stripe fee structure: 2.9% + $0.30 for cards, 0.8% for ACH (capped at $5)
  charges.forEach((charge, i) => {
    if (charge.status === 'succeeded') {
      const isCard = payment_methods.find(pm => pm.id === charge.payment_method_id)?.type === 'card';
      const feePercent = isCard ? 0.029 : 0.008;
      const feeFixed = isCard ? 30 : 0; // $0.30 in cents
      const fee = Math.min(
        Math.round(charge.amount * feePercent) + feeFixed,
        isCard ? charge.amount : 500 // Cap ACH at $5
      );
      const net = charge.amount - fee;

      // Charge transaction
      balance_transactions.push({
        id: `txn_charge_${String(i + 1).padStart(3, '0')}`,
        amount: charge.amount,
        net: charge.amount, // Gross amount before fees
        fee: 0,
        currency: 'usd',
        type: 'charge',
        reporting_category: 'charge',
        source_id: charge.id,
        created: charge.created,
      });

      // Fee transaction
      balance_transactions.push({
        id: `txn_fee_${String(i + 1).padStart(3, '0')}`,
        amount: -fee,
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
  refunds.forEach((refund, i) => {
    if (refund.status === 'succeeded') {
      // Find the original charge to calculate refunded fee
      const payment = payments.find(p => p.id === refund.payment_id);
      if (payment) {
        const isCard = payment_methods.find(pm => pm.id === payment.payment_method_id)?.type === 'card';
        const feePercent = isCard ? 0.029 : 0.008;
        const feeFixed = isCard ? 30 : 0;
        const refundedFee = Math.min(
          Math.round(refund.amount * feePercent) + feeFixed,
          isCard ? refund.amount : 500
        );

        balance_transactions.push({
          id: `txn_refund_${String(i + 1).padStart(3, '0')}`,
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
  payouts.forEach((payout, i) => {
    balance_transactions.push({
      id: `txn_payout_${String(i + 1).padStart(3, '0')}`,
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

  // Generate 10 coupons
  const couponNames = [
    'SUMMER2025', 'WELCOME10', 'ANNUAL20', 'FLASH50', 'LOYALTY15',
    'FIRSTTIME', 'UPGRADE25', 'FRIENDS30', 'EARLYBIRD', 'BLACKFRIDAY'
  ];

  for (let i = 0; i < 10; i++) {
    const isPercentOff = i % 2 === 0;
    const duration = ['forever', 'once', 'repeating'][i % 3] as 'forever' | 'once' | 'repeating';

    coupons.push({
      id: `coup_${String(i + 1).padStart(3, '0')}`,
      name: couponNames[i],
      amount_off: isPercentOff ? undefined : [500, 1000, 2000, 5000][i % 4],
      percent_off: isPercentOff ? [10, 15, 20, 25, 30, 50][i % 6] : undefined,
      currency: isPercentOff ? undefined : 'usd',
      duration,
      duration_in_months: duration === 'repeating' ? [3, 6, 12][i % 3] : undefined,
      max_redemptions: i % 3 === 0 ? [50, 100, 200][i % 3] : undefined,
      times_redeemed: Math.floor(Math.random() * 50),
      valid: i < 8, // First 8 are valid
      created: '2025-01-01',
    });
  }

  return {
    customers,
    payment_methods,
    products,
    prices,
    payments,
    refunds,
    subscriptions,
    subscription_items: [],
    invoices,
    charges,
    payouts,
    balance_transactions,
    coupons,
  };
}

// ============================================================================
// Warehouse Instance
// ============================================================================

// Import generated synthetic dataset
import { warehouseData } from './warehouse-fresh';
export const warehouse: Warehouse = warehouseData;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a table from the warehouse
 */
export function getWarehouseTable(tableName: keyof Warehouse): any[] {
  return warehouse[tableName] || [];
}

/**
 * Get warehouse statistics
 */
export function getWarehouseStats() {
  return {
    customers: warehouse.customers.length,
    payment_methods: warehouse.payment_methods.length,
    products: warehouse.products.length,
    prices: warehouse.prices.length,
    payments: warehouse.payments.length,
    refunds: warehouse.refunds.length,
    subscriptions: warehouse.subscriptions.length,
    invoices: warehouse.invoices.length,
    charges: warehouse.charges.length,
    payouts: warehouse.payouts.length,
    balance_transactions: warehouse.balance_transactions.length,
    coupons: warehouse.coupons.length,
  };
}

// Run validation on module load (development only)
if (process.env.NODE_ENV === 'development') {
  import('./validate').then(({ validateWarehouse }) => {
    validateWarehouse();
  });
}
