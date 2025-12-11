// src/lib/dataPackages.ts
// Dataset packages organize schema tables into user-friendly groupings.
// The underlying schema (src/data/schema.ts) remains unchanged - packages
// are a presentation layer that references tables/fields by name.

export type CuratedField = {
  object: string;
  field: string;
};

export type DataPackage = {
  id: string;
  label: string;
  description: string;
  icon: 'subscriptions' | 'payments' | 'balances' | 'customers' | 'refunds' | 'products';
  tables: string[]; // Schema object names included in this package
  curatedFields: CuratedField[]; // Fields shown by default (others available via search)
};

/**
 * Dataset packages group related tables and fields for specific use cases.
 * Each package:
 * - Has a user-friendly name and description
 * - Includes multiple related tables from the schema
 * - Defines "curated" fields shown by default (commonly useful)
 * - All other fields from included tables are searchable
 * 
 * Packages can overlap - the same table/field may appear in multiple packages.
 */
export const DATA_PACKAGES: Record<string, DataPackage> = {
  subscriptions: {
    id: 'subscriptions',
    label: 'Subscriptions',
    description: 'Track recurring revenue, subscriber counts, and subscription lifecycle',
    icon: 'subscriptions',
    tables: ['subscription', 'customer', 'invoice', 'subscription_item', 'price'],
    curatedFields: [
      // Subscription fields
      { object: 'subscription', field: 'id' },
      { object: 'subscription', field: 'status' },
      { object: 'subscription', field: 'current_period_start' },
      { object: 'subscription', field: 'current_period_end' },
      { object: 'subscription', field: 'cancel_at_period_end' },
      { object: 'subscription', field: 'created' },
      { object: 'subscription', field: 'currency' },
      // Customer fields
      { object: 'customer', field: 'id' },
      { object: 'customer', field: 'email' },
      { object: 'customer', field: 'name' },
      { object: 'customer', field: 'created' },
      // Invoice fields
      { object: 'invoice', field: 'id' },
      { object: 'invoice', field: 'amount_paid' },
      { object: 'invoice', field: 'amount_due' },
      { object: 'invoice', field: 'status' },
      { object: 'invoice', field: 'created' },
      // Subscription Item fields
      { object: 'subscription_item', field: 'id' },
      { object: 'subscription_item', field: 'quantity' },
      // Price fields
      { object: 'price', field: 'unit_amount' },
      { object: 'price', field: 'currency' },
      { object: 'price', field: 'recurring_interval' },
    ],
  },

  payments: {
    id: 'payments',
    label: 'Payments',
    description: 'Analyze payment volume, success rates, and transaction details',
    icon: 'payments',
    tables: ['charge', 'customer', 'payment_method'],
    curatedFields: [
      // Charge fields
      { object: 'charge', field: 'id' },
      { object: 'charge', field: 'amount' },
      { object: 'charge', field: 'amount_captured' },
      { object: 'charge', field: 'amount_refunded' },
      { object: 'charge', field: 'status' },
      { object: 'charge', field: 'currency' },
      { object: 'charge', field: 'created' },
      { object: 'charge', field: 'payment_method_details_type' },
      { object: 'charge', field: 'payment_method_details_card_brand' },
      { object: 'charge', field: 'billing_details_address_country' },
      // Customer fields
      { object: 'customer', field: 'id' },
      { object: 'customer', field: 'email' },
      { object: 'customer', field: 'name' },
      { object: 'customer', field: 'created' },
      // Payment Method fields
      { object: 'payment_method', field: 'id' },
      { object: 'payment_method', field: 'type' },
      { object: 'payment_method', field: 'card_brand' },
      { object: 'payment_method', field: 'card_last4' },
    ],
  },

  balances: {
    id: 'balances',
    label: 'Balances',
    description: 'Track balance activity, fees, and cash flow across your account',
    icon: 'balances',
    tables: ['balance_transaction', 'customer_balance_transaction'],
    curatedFields: [
      // Balance Transaction fields
      { object: 'balance_transaction', field: 'id' },
      { object: 'balance_transaction', field: 'amount' },
      { object: 'balance_transaction', field: 'net' },
      { object: 'balance_transaction', field: 'fee' },
      { object: 'balance_transaction', field: 'type' },
      { object: 'balance_transaction', field: 'reporting_category' },
      { object: 'balance_transaction', field: 'currency' },
      { object: 'balance_transaction', field: 'status' },
      { object: 'balance_transaction', field: 'created' },
      { object: 'balance_transaction', field: 'available_on' },
      // Customer Balance Transaction fields
      { object: 'customer_balance_transaction', field: 'id' },
      { object: 'customer_balance_transaction', field: 'amount' },
      { object: 'customer_balance_transaction', field: 'type' },
      { object: 'customer_balance_transaction', field: 'ending_balance' },
      { object: 'customer_balance_transaction', field: 'created' },
    ],
  },

  customers: {
    id: 'customers',
    label: 'Customers',
    description: 'Analyze your customer base, geography, and acquisition patterns',
    icon: 'customers',
    tables: ['customer', 'charge', 'subscription'],
    curatedFields: [
      // Customer fields (comprehensive for customer analysis)
      { object: 'customer', field: 'id' },
      { object: 'customer', field: 'email' },
      { object: 'customer', field: 'name' },
      { object: 'customer', field: 'phone' },
      { object: 'customer', field: 'created' },
      { object: 'customer', field: 'address_city' },
      { object: 'customer', field: 'address_country' },
      { object: 'customer', field: 'address_state' },
      { object: 'customer', field: 'address_postal_code' },
      { object: 'customer', field: 'currency' },
      { object: 'customer', field: 'delinquent' },
      { object: 'customer', field: 'balance' },
      // Charge fields (for acquisition analysis)
      { object: 'charge', field: 'id' },
      { object: 'charge', field: 'amount' },
      { object: 'charge', field: 'status' },
      { object: 'charge', field: 'created' },
      // Subscription fields (for subscriber status)
      { object: 'subscription', field: 'id' },
      { object: 'subscription', field: 'status' },
      { object: 'subscription', field: 'created' },
    ],
  },

  refunds_disputes: {
    id: 'refunds_disputes',
    label: 'Refunds & Disputes',
    description: 'Track refunds, disputes, and their resolution',
    icon: 'refunds',
    tables: ['refund', 'dispute', 'charge', 'customer'],
    curatedFields: [
      // Refund fields
      { object: 'refund', field: 'id' },
      { object: 'refund', field: 'amount' },
      { object: 'refund', field: 'status' },
      { object: 'refund', field: 'reason' },
      { object: 'refund', field: 'created' },
      // Dispute fields
      { object: 'dispute', field: 'id' },
      { object: 'dispute', field: 'amount' },
      { object: 'dispute', field: 'status' },
      { object: 'dispute', field: 'reason' },
      { object: 'dispute', field: 'created' },
      { object: 'dispute', field: 'evidence_due_by' },
      // Charge fields
      { object: 'charge', field: 'id' },
      { object: 'charge', field: 'amount' },
      { object: 'charge', field: 'status' },
      { object: 'charge', field: 'created' },
      // Customer fields
      { object: 'customer', field: 'id' },
      { object: 'customer', field: 'email' },
    ],
  },

  products: {
    id: 'products',
    label: 'Products',
    description: 'Analyze product performance, pricing, and sales',
    icon: 'products',
    tables: ['product', 'price', 'invoice_item', 'subscription_item', 'charge'],
    curatedFields: [
      // Product fields
      { object: 'product', field: 'id' },
      { object: 'product', field: 'name' },
      { object: 'product', field: 'description' },
      { object: 'product', field: 'active' },
      { object: 'product', field: 'created' },
      // Price fields
      { object: 'price', field: 'id' },
      { object: 'price', field: 'unit_amount' },
      { object: 'price', field: 'currency' },
      { object: 'price', field: 'recurring_interval' },
      { object: 'price', field: 'active' },
      // Invoice Item fields
      { object: 'invoice_item', field: 'id' },
      { object: 'invoice_item', field: 'amount' },
      { object: 'invoice_item', field: 'quantity' },
      { object: 'invoice_item', field: 'description' },
      // Subscription Item fields
      { object: 'subscription_item', field: 'id' },
      { object: 'subscription_item', field: 'quantity' },
      // Charge fields (for product sales)
      { object: 'charge', field: 'id' },
      { object: 'charge', field: 'amount' },
      { object: 'charge', field: 'product_id' },
      { object: 'charge', field: 'created' },
    ],
  },
};

/**
 * Get a package by ID
 */
export function getPackage(packageId: string): DataPackage | undefined {
  return DATA_PACKAGES[packageId];
}

/**
 * Get all available packages as an array
 */
export function getAllPackages(): DataPackage[] {
  return Object.values(DATA_PACKAGES);
}

/**
 * Check if a field is curated (shown by default) in a package
 */
export function isCuratedField(packageId: string, object: string, field: string): boolean {
  const pkg = DATA_PACKAGES[packageId];
  if (!pkg) return false;
  return pkg.curatedFields.some(f => f.object === object && f.field === field);
}

/**
 * Check if a table is included in a package
 */
export function isTableInPackage(packageId: string, tableName: string): boolean {
  const pkg = DATA_PACKAGES[packageId];
  if (!pkg) return false;
  return pkg.tables.includes(tableName);
}

/**
 * Get curated fields for a specific table within a package
 */
export function getCuratedFieldsForTable(packageId: string, tableName: string): CuratedField[] {
  const pkg = DATA_PACKAGES[packageId];
  if (!pkg) return [];
  return pkg.curatedFields.filter(f => f.object === tableName);
}

