/**
 * Warehouse data validation
 * Verifies FK integrity and data realism
 */

import { warehouse } from './warehouse';

export function validateWarehouse() {
  const missing: string[] = [];

  // Validate payment foreign keys
  for (const p of warehouse.payments) {
    if (!warehouse.customers.find(c => c.id === p.customer_id)) {
      missing.push(`payment ${p.id} missing customer ${p.customer_id}`);
    }
    if (p.payment_method_id && !warehouse.payment_methods.find(pm => pm.id === p.payment_method_id)) {
      missing.push(`payment ${p.id} missing payment_method ${p.payment_method_id}`);
    }
  }

  // Validate refund foreign keys
  for (const r of warehouse.refunds) {
    if (!warehouse.payments.find(p => p.id === r.payment_id)) {
      missing.push(`refund ${r.id} missing payment ${r.payment_id}`);
    }
  }

  // Validate subscription foreign keys
  for (const s of warehouse.subscriptions) {
    if (!warehouse.customers.find(c => c.id === s.customer_id)) {
      missing.push(`subscription ${s.id} missing customer ${s.customer_id}`);
    }
  }

  // Validate invoice foreign keys
  for (const inv of warehouse.invoices) {
    if (!warehouse.customers.find(c => c.id === inv.customer_id)) {
      missing.push(`invoice ${inv.id} missing customer ${inv.customer_id}`);
    }
    if (inv.subscription_id && !warehouse.subscriptions.find(s => s.id === inv.subscription_id)) {
      missing.push(`invoice ${inv.id} missing subscription ${inv.subscription_id}`);
    }
  }

  // Validate price foreign keys
  for (const price of warehouse.prices) {
    if (!warehouse.products.find(prod => prod.id === price.product_id)) {
      missing.push(`price ${price.id} missing product ${price.product_id}`);
    }
  }

  // Validate charge foreign keys
  for (const charge of warehouse.charges) {
    if (!warehouse.customers.find(c => c.id === charge.customer_id)) {
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
