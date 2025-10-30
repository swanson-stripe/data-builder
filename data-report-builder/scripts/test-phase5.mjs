#!/usr/bin/env node

/**
 * Test script for Phase 5 - Customer Tables & Remaining Billing
 */

import { setFakerSeed } from './generators/base.mjs';
import { generateCustomers } from './generators/customers.mjs';
import { generateProducts } from './generators/products.mjs';
import { generatePrices } from './generators/prices.mjs';
import { generateSubscriptions } from './generators/subscriptions.mjs';
import { generateSubscriptionItems } from './generators/subscription-items.mjs';
import { generateInvoices } from './generators/invoices.mjs';
import { generateCustomerBalanceTransactions } from './generators/customer-balance-transactions.mjs';
import { generateCustomerTaxIds } from './generators/customer-tax-ids.mjs';
import { generateQuotes } from './generators/quotes.mjs';
import { generateCreditNotes } from './generators/credit-notes.mjs';
import { generateSubscriptionSchedules } from './generators/subscription-schedules.mjs';

console.log('=== Testing Phase 5 - Customer Tables & Remaining Billing ===\n');

// Set seed for deterministic results
setFakerSeed(12345);

// Generate prerequisite data
const customers = generateCustomers(200);
const products = generateProducts(10);
const prices = generatePrices(products);
const subscriptions = generateSubscriptions(customers, prices, 300);
const subscriptionItems = generateSubscriptionItems(subscriptions, prices);
const invoices = generateInvoices(subscriptions, subscriptionItems, prices);

// Generate Phase 5 data
const customerBalanceTransactions = generateCustomerBalanceTransactions(customers, invoices);
const customerTaxIds = generateCustomerTaxIds(customers);
const quotes = generateQuotes(customers, 100);
const creditNotes = generateCreditNotes(invoices);
const subscriptionSchedules = generateSubscriptionSchedules(subscriptions);

// Validation
console.log('\n=== Validation ===\n');

// Check foreign keys
const customerIds = new Set(customers.map(c => c.id));
const invoiceIds = new Set(invoices.map(i => i.id));
const subscriptionIds = new Set(subscriptions.map(s => s.id));

// Validate customer balance transactions
const invalidCBTCustomers = customerBalanceTransactions.filter(t => !customerIds.has(t.customer_id));
const invalidCBTInvoices = customerBalanceTransactions.filter(t => t.invoice_id && !invoiceIds.has(t.invoice_id));
console.log(invalidCBTCustomers.length === 0 
  ? `✓ All customer balance transactions have valid customer_id references`
  : `❌ Found ${invalidCBTCustomers.length} CBTs with invalid customer_id`
);
console.log(invalidCBTInvoices.length === 0 
  ? `✓ All customer balance transactions have valid invoice_id references`
  : `❌ Found ${invalidCBTInvoices.length} CBTs with invalid invoice_id`
);

// Validate customer tax IDs
const invalidTaxIds = customerTaxIds.filter(t => !customerIds.has(t.customer_id));
console.log(invalidTaxIds.length === 0 
  ? `✓ All customer tax IDs have valid customer_id references`
  : `❌ Found ${invalidTaxIds.length} tax IDs with invalid customer_id`
);

// Validate quotes
const invalidQuotes = quotes.filter(q => !customerIds.has(q.customer_id));
console.log(invalidQuotes.length === 0 
  ? `✓ All quotes have valid customer_id references`
  : `❌ Found ${invalidQuotes.length} quotes with invalid customer_id`
);

// Validate credit notes
const invalidCNCustomers = creditNotes.filter(cn => !customerIds.has(cn.customer_id));
const invalidCNInvoices = creditNotes.filter(cn => !invoiceIds.has(cn.invoice_id));
console.log(invalidCNCustomers.length === 0 
  ? `✓ All credit notes have valid customer_id references`
  : `❌ Found ${invalidCNCustomers.length} credit notes with invalid customer_id`
);
console.log(invalidCNInvoices.length === 0 
  ? `✓ All credit notes have valid invoice_id references`
  : `❌ Found ${invalidCNInvoices.length} credit notes with invalid invoice_id`
);

// Validate subscription schedules
const invalidSSCustomers = subscriptionSchedules.filter(ss => !customerIds.has(ss.customer_id));
const invalidSSSubscriptions = subscriptionSchedules.filter(ss => !subscriptionIds.has(ss.subscription_id));
console.log(invalidSSCustomers.length === 0 
  ? `✓ All subscription schedules have valid customer_id references`
  : `❌ Found ${invalidSSCustomers.length} schedules with invalid customer_id`
);
console.log(invalidSSSubscriptions.length === 0 
  ? `✓ All subscription schedules have valid subscription_id references`
  : `❌ Found ${invalidSSSubscriptions.length} schedules with invalid subscription_id`
);

// Check credit note amounts don't exceed invoice amounts
let cnAmountErrors = 0;
for (const cn of creditNotes) {
  const invoice = invoices.find(i => i.id === cn.invoice_id);
  if (invoice && cn.amount > invoice.amount_paid) {
    cnAmountErrors++;
  }
}
console.log(cnAmountErrors === 0 
  ? `✓ All credit note amounts are valid`
  : `❌ Found ${cnAmountErrors} credit notes exceeding invoice amounts`
);

// Summary
console.log('\n=== Summary ===\n');
console.log(`Generated:`);
console.log(`  • ${customers.length} customers`);
console.log(`  • ${customerBalanceTransactions.length} customer balance transactions`);
console.log(`  • ${customerTaxIds.length} customer tax IDs`);
console.log(`  • ${quotes.length} quotes`);
console.log(`  • ${creditNotes.length} credit notes`);
console.log(`  • ${subscriptionSchedules.length} subscription schedules`);

// Tax ID coverage
const taxIdCoverage = ((customerTaxIds.length / customers.length) * 100).toFixed(1);
console.log(`\nCustomer tax ID coverage: ${taxIdCoverage}%`);

// Quote status distribution
const quoteStatusCounts = {};
for (const quote of quotes) {
  quoteStatusCounts[quote.status] = (quoteStatusCounts[quote.status] || 0) + 1;
}
console.log(`\nQuote status distribution:`);
for (const [status, count] of Object.entries(quoteStatusCounts)) {
  const pct = ((count / quotes.length) * 100).toFixed(1);
  console.log(`  • ${status}: ${count} (${pct}%)`);
}

// Credit note statistics
const creditNoteRate = ((creditNotes.length / invoices.filter(i => i.status === 'paid').length) * 100).toFixed(1);
console.log(`\nCredit note rate: ${creditNoteRate}%`);

// Subscription schedule coverage
const scheduleCoverage = ((subscriptionSchedules.length / subscriptions.length) * 100).toFixed(1);
console.log(`Subscription schedule coverage: ${scheduleCoverage}%`);

console.log('\n✅ Phase 5 test complete!\n');

