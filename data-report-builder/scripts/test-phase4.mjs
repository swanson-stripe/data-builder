#!/usr/bin/env node

/**
 * Test script for Phase 4 - Payment Tables
 */

import { setFakerSeed } from './generators/base.mjs';
import { generateCustomers } from './generators/customers.mjs';
import { generateProducts } from './generators/products.mjs';
import { generatePrices } from './generators/prices.mjs';
import { generateSubscriptions } from './generators/subscriptions.mjs';
import { generateSubscriptionItems } from './generators/subscription-items.mjs';
import { generateInvoices } from './generators/invoices.mjs';
import { generatePaymentMethods, linkPaymentMethodsToCustomers } from './generators/payment-methods.mjs';
import { generatePaymentIntents, linkPaymentIntentsToInvoices } from './generators/payment-intents.mjs';
import { generateCharges } from './generators/charges.mjs';
import { generateRefunds } from './generators/refunds.mjs';
import { generateBalanceTransactions } from './generators/balance-transactions.mjs';

console.log('=== Testing Phase 4 - Payment Tables ===\n');

// Set seed for deterministic results
setFakerSeed(12345);

// Generate prerequisite data
const customers = generateCustomers(200);
const products = generateProducts(10);
const prices = generatePrices(products);
const subscriptions = generateSubscriptions(customers, prices, 300);
const subscriptionItems = generateSubscriptionItems(subscriptions, prices);
const invoices = generateInvoices(subscriptions, subscriptionItems, prices);

// Generate payment flow
const paymentMethods = generatePaymentMethods(customers);
linkPaymentMethodsToCustomers(customers, paymentMethods);

const paymentIntents = generatePaymentIntents(invoices, paymentMethods);
linkPaymentIntentsToInvoices(invoices, paymentIntents);

const charges = generateCharges(paymentIntents);
const refunds = generateRefunds(charges);
const balanceTransactions = generateBalanceTransactions(charges, refunds);

// Validation
console.log('\n=== Validation ===\n');

// Check foreign keys
const customerIds = new Set(customers.map(c => c.id));
const paymentMethodIds = new Set(paymentMethods.map(pm => pm.id));
const invoiceIds = new Set(invoices.map(i => i.id));
const paymentIntentIds = new Set(paymentIntents.map(pi => pi.id));
const chargeIds = new Set(charges.map(ch => ch.id));

// Validate payment methods reference customers
const invalidPMCustomers = paymentMethods.filter(pm => !customerIds.has(pm.customer_id));
console.log(invalidPMCustomers.length === 0 
  ? `✓ All payment methods have valid customer_id references`
  : `❌ Found ${invalidPMCustomers.length} payment methods with invalid customer_id`
);

// Validate payment intents reference invoices and payment methods
const invalidPIInvoices = paymentIntents.filter(pi => pi.invoice_id && !invoiceIds.has(pi.invoice_id));
const invalidPIPMs = paymentIntents.filter(pi => pi.payment_method_id && !paymentMethodIds.has(pi.payment_method_id));
console.log(invalidPIInvoices.length === 0 
  ? `✓ All payment intents have valid invoice_id references`
  : `❌ Found ${invalidPIInvoices.length} payment intents with invalid invoice_id`
);
console.log(invalidPIPMs.length === 0 
  ? `✓ All payment intents have valid payment_method_id references`
  : `❌ Found ${invalidPIPMs.length} payment intents with invalid payment_method_id`
);

// Validate charges reference payment intents
const invalidCharges = charges.filter(ch => !paymentIntentIds.has(ch.payment_intent_id));
console.log(invalidCharges.length === 0 
  ? `✓ All charges have valid payment_intent_id references`
  : `❌ Found ${invalidCharges.length} charges with invalid payment_intent_id`
);

// Validate refunds reference charges
const invalidRefunds = refunds.filter(r => !chargeIds.has(r.charge_id));
console.log(invalidRefunds.length === 0 
  ? `✓ All refunds have valid charge_id references`
  : `❌ Found ${invalidRefunds.length} refunds with invalid charge_id`
);

// Check amount consistency
let amountErrors = 0;
for (const charge of charges) {
  if (charge.refunded && charge.amount_refunded > charge.amount) {
    amountErrors++;
  }
  if (charge.amount_captured > charge.amount) {
    amountErrors++;
  }
}
console.log(amountErrors === 0 
  ? `✓ All charge amounts are consistent`
  : `❌ Found ${amountErrors} charge amount inconsistencies`
);

// Check balance transaction totals
let txnErrors = 0;
for (const txn of balanceTransactions) {
  const expectedNet = txn.amount - txn.fee;
  if (txn.net !== expectedNet) {
    txnErrors++;
  }
}
console.log(txnErrors === 0 
  ? `✓ All balance transaction net amounts are correct`
  : `❌ Found ${txnErrors} balance transaction calculation errors`
);

// Check payment flow integrity
let flowErrors = 0;
for (const invoice of invoices) {
  if (invoice.status === 'paid') {
    // Paid invoices should have at least one payment intent
    const invoiceIntents = paymentIntents.filter(pi => pi.invoice_id === invoice.id);
    if (invoiceIntents.length === 0) {
      flowErrors++;
    }
  }
}
console.log(flowErrors === 0 
  ? `✓ All paid invoices have payment intents`
  : `❌ Found ${flowErrors} paid invoices without payment intents`
);

// Summary
console.log('\n=== Summary ===\n');
console.log(`Generated:`);
console.log(`  • ${customers.length} customers`);
console.log(`  • ${paymentMethods.length} payment methods`);
console.log(`  • ${invoices.length} invoices`);
console.log(`  • ${paymentIntents.length} payment intents`);
console.log(`  • ${charges.length} charges`);
console.log(`  • ${refunds.length} refunds`);
console.log(`  • ${balanceTransactions.length} balance transactions`);

// Payment method distribution
const pmTypeCounts = {};
for (const pm of paymentMethods) {
  pmTypeCounts[pm.type] = (pmTypeCounts[pm.type] || 0) + 1;
}
console.log(`\nPayment method type distribution:`);
for (const [type, count] of Object.entries(pmTypeCounts)) {
  const pct = ((count / paymentMethods.length) * 100).toFixed(1);
  console.log(`  • ${type}: ${count} (${pct}%)`);
}

// Charge status distribution
const chargeStatusCounts = {};
for (const charge of charges) {
  chargeStatusCounts[charge.status] = (chargeStatusCounts[charge.status] || 0) + 1;
}
console.log(`\nCharge status distribution:`);
for (const [status, count] of Object.entries(chargeStatusCounts)) {
  const pct = ((count / charges.length) * 100).toFixed(1);
  console.log(`  • ${status}: ${count} (${pct}%)`);
}

// Refund statistics
const refundRate = ((refunds.length / charges.filter(c => c.status === 'succeeded').length) * 100).toFixed(1);
console.log(`\nRefund rate: ${refundRate}%`);

console.log('\n✅ Phase 4 test complete!\n');

