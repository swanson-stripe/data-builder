/**
 * Shared library for qualified/unqualified field names and canonical timestamp mapping
 */

/**
 * Create a qualified field name (e.g., "payment.amount")
 */
export const qualify = (object: string, field: string): string => `${object}.${field}`;

/**
 * Parse a qualified field name back to object and field
 * Examples:
 *   "payment.amount" → { object: "payment", field: "amount" }
 *   "subscription.current_period_start" → { object: "subscription", field: "current_period_start" }
 *   "amount" → { object: "", field: "amount" }
 */
export const unqualify = (qualified: string): { object: string; field: string } => {
  const i = qualified.indexOf('.');
  return i < 0
    ? { object: '', field: qualified }
    : {
        object: qualified.slice(0, i),
        field: qualified.slice(i + 1),
      };
};

/**
 * Canonical timestamp fields for each object type
 * Listed in priority order - first available field will be used
 */
export const TIMESTAMP_FIELD_BY_OBJECT: Record<string, string[]> = {
  // Core entities
  customer: ['created'],
  customers: ['created'],
  product: ['created'],
  products: ['created'],
  price: ['created'],
  prices: ['created'],
  
  // Subscriptions
  subscription: ['created', 'current_period_start'],
  subscriptions: ['created', 'current_period_start'],
  subscription_item: ['created'],
  subscription_items: ['created'],
  subscription_schedule: ['created', 'current_phase_start'],
  subscription_schedules: ['created', 'current_phase_start'],
  
  // Invoices
  invoice: ['created', 'period_start'],
  invoices: ['created', 'period_start'],
  invoice_item: ['created', 'period_start'],
  invoice_items: ['created', 'period_start'],
  
  // Discounts & Coupons
  coupon: ['created'],
  coupons: ['created'],
  discount: ['start'],
  discounts: ['start'],
  
  // Payments
  payment: ['created'],
  payments: ['created'],
  payment_method: ['created'],
  payment_methods: ['created'],
  payment_intent: ['created'],
  payment_intents: ['created'],
  
  // Charges & Refunds
  charge: ['created'],
  charges: ['created'],
  refund: ['created'],
  refunds: ['created'],
  
  // Balance & Transactions
  balance_transaction: ['created', 'available_on'],
  balance_transactions: ['created', 'available_on'],
  customer_balance_transaction: ['created'],
  customer_balance_transactions: ['created'],
  
  // Customer related
  customer_tax_id: ['created'],
  customer_tax_ids: ['created'],
  
  // Quotes & Credit Notes
  quote: ['created'],
  quotes: ['created'],
  credit_note: ['created'],
  credit_notes: ['created'],
  
  // Disputes
  dispute: ['created'],
  disputes: ['created'],
  
  // Checkout
  checkout_session: ['created', 'expires_at'],
  checkout_sessions: ['created', 'expires_at'],
  
  // Legacy/Additional
  plan: ['created'],
  plans: ['created'],
  payout: ['arrival_date', 'created'],
  payouts: ['arrival_date', 'created'],
};

/**
 * Pick the canonical timestamp from a record
 * Returns the first available timestamp field value, or null if none found
 *
 * @param object - The object type (e.g., "payment", "subscription")
 * @param record - The data record with potential timestamp fields
 * @returns ISO date string or null
 *
 * @example
 * pickTimestamp('payment', { id: 'pi_001', created: '2025-03-15', amount: 1000 })
 * // Returns: '2025-03-15'
 *
 * @example
 * pickTimestamp('subscription', { id: 'sub_001', current_period_start: '2025-03-01', created: '2025-02-15' })
 * // Returns: '2025-03-01' (current_period_start takes priority)
 */
export function pickTimestamp(object: string, record: Record<string, any>): string | null {
  const candidates = TIMESTAMP_FIELD_BY_OBJECT[object] || [];
  for (const f of candidates) {
    if (record[f]) return record[f];
  }
  return null;
}

/**
 * Get the primary timestamp field name for an object type
 * Returns the first (highest priority) timestamp field
 *
 * @param object - The object type
 * @returns Field name or 'created' as default
 *
 * @example
 * getPrimaryTimestampField('subscription')
 * // Returns: 'current_period_start'
 *
 * @example
 * getPrimaryTimestampField('payment')
 * // Returns: 'created'
 */
export function getPrimaryTimestampField(object: string): string {
  const candidates = TIMESTAMP_FIELD_BY_OBJECT[object] || [];
  return candidates[0] || 'created';
}

/**
 * Check if a field name is a timestamp field for a given object
 *
 * @param object - The object type
 * @param field - The field name to check
 * @returns true if the field is a timestamp field
 */
export function isTimestampField(object: string, field: string): boolean {
  const candidates = TIMESTAMP_FIELD_BY_OBJECT[object] || [];
  return candidates.includes(field);
}
