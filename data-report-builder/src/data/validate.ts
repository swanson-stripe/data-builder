/**
 * Warehouse data validation
 * Verifies FK integrity and data realism
 */

import { warehouse } from './warehouse';

export function validateWarehouse() {
  const missing: string[] = [];

  // Helper to safely get array (handles both singular and plural property names)
  const getArray = (name: string): any[] => {
    const w = warehouse as any;
    return w[name] || w[name + 's'] || w[name.replace(/s$/, '')] || [];
  };

  // Validate payment foreign keys (legacy table - usually empty)
  const payments = getArray('payment');
  for (const p of payments) {
    if (!getArray('customer').find((c: any) => c.id === p.customer_id)) {
      missing.push(`payment ${p.id} missing customer ${p.customer_id}`);
    }
    if (p.payment_method_id && !getArray('payment_method').find((pm: any) => pm.id === p.payment_method_id)) {
      missing.push(`payment ${p.id} missing payment_method ${p.payment_method_id}`);
    }
  }

  // Validate refund foreign keys
  const refunds = getArray('refund');
  const charges = getArray('charge');
  for (const r of refunds) {
    // Refunds link to charges, not payments
    if (!charges.find((c: any) => c.id === r.charge_id)) {
      missing.push(`refund ${r.id} missing charge ${r.charge_id}`);
    }
  }

  // Validate subscription foreign keys
  const subscriptions = getArray('subscription');
  const customers = getArray('customer');
  for (const s of subscriptions) {
    if (!customers.find((c: any) => c.id === s.customer_id)) {
      missing.push(`subscription ${s.id} missing customer ${s.customer_id}`);
    }
  }

  // Validate invoice foreign keys
  const invoices = getArray('invoice');
  for (const inv of invoices) {
    if (!customers.find((c: any) => c.id === inv.customer_id)) {
      missing.push(`invoice ${inv.id} missing customer ${inv.customer_id}`);
    }
    if (inv.subscription_id && !subscriptions.find((s: any) => s.id === inv.subscription_id)) {
      missing.push(`invoice ${inv.id} missing subscription ${inv.subscription_id}`);
    }
  }

  // Validate price foreign keys
  const prices = getArray('price');
  const products = getArray('product');
  for (const price of prices) {
    if (!products.find((prod: any) => prod.id === price.product_id)) {
      missing.push(`price ${price.id} missing product ${price.product_id}`);
    }
  }

  // Validate charge foreign keys
  for (const charge of charges) {
    if (!customers.find((c: any) => c.id === charge.customer_id)) {
      missing.push(`charge ${charge.id} missing customer ${charge.customer_id}`);
    }
  }

  console.log(`✅ Validation complete. Issues: ${missing.length}`);
  if (missing.length > 0) {
    console.warn(`⚠️ FK integrity issues found:`);
    console.warn(missing.slice(0, 10));
    if (missing.length > 10) {
      console.warn(`... and ${missing.length - 10} more`);
    }
  }

  return {
    valid: missing.length === 0,
    issues: missing,
  };
}
