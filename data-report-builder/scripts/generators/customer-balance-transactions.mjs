import { faker } from '@faker-js/faker';
import {
  stripeId,
  dateAfter,
  dateBefore,
  pickRandom,
  maybe,
  toISODate,
  logProgress,
} from './base.mjs';

/**
 * Generate customer balance transaction records
 */
export function generateCustomerBalanceTransactions(customers, invoices) {
  logProgress(`Generating customer balance transactions...`);
  
  const transactions = [];

  // Create index of invoices by customer_id
  const invoicesByCustomer = {};
  for (const invoice of invoices) {
    if (!invoicesByCustomer[invoice.customer_id]) {
      invoicesByCustomer[invoice.customer_id] = [];
    }
    invoicesByCustomer[invoice.customer_id].push(invoice);
  }

  // Generate transactions for customers with non-zero balance
  const customersWithBalance = customers.filter(c => c.balance !== 0);

  for (const customer of customersWithBalance) {
    const customerInvoices = invoicesByCustomer[customer.id] || [];

    // Determine transaction type based on balance
    let type;
    let amount;
    
    if (customer.balance < 0) {
      // Negative balance = customer has credit
      type = pickRandom(['credit_note', 'adjustment', 'initial']);
      amount = customer.balance; // Negative amount
    } else {
      // Positive balance = customer owes money
      type = pickRandom(['invoice_too_large', 'invoice_too_small', 'adjustment', 'unapplied_from_invoice']);
      amount = customer.balance; // Positive amount
    }

    // Created date based on customer age
    const createdDate = dateAfter(new Date(customer.created), Math.floor(Math.random() * 90));

    // Ending balance is current balance
    const endingBalance = customer.balance;

    // Find related invoice if applicable
    let invoiceId = null;
    if (['applied_to_invoice', 'unapplied_from_invoice', 'invoice_too_large', 'invoice_too_small'].includes(type) && customerInvoices.length > 0) {
      invoiceId = pickRandom(customerInvoices).id;
    }

    transactions.push({
      id: stripeId('cbtxn'),
      customer_id: customer.id,
      amount,
      currency: customer.currency,
      type,
      description: maybe(faker.finance.transactionDescription(), 0.4),
      created: toISODate(createdDate),
      ending_balance: endingBalance,
      invoice_id: invoiceId,
    });
  }

  // Generate some additional applied_to_invoice transactions (20% of paid invoices)
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const additionalTxnCount = Math.floor(paidInvoices.length * 0.2);
  
  for (let i = 0; i < additionalTxnCount; i++) {
    const invoice = pickRandom(paidInvoices);
    const customer = customers.find(c => c.id === invoice.customer_id);
    if (!customer) continue;

    const createdDate = dateAfter(new Date(invoice.created), Math.floor(Math.random() * 3));
    const amount = -invoice.amount_paid; // Negative = applied to invoice

    transactions.push({
      id: stripeId('cbtxn'),
      customer_id: customer.id,
      amount,
      currency: customer.currency,
      type: 'applied_to_invoice',
      description: maybe(faker.finance.transactionDescription(), 0.4),
      created: toISODate(createdDate),
      ending_balance: customer.balance,
      invoice_id: invoice.id,
    });
  }

  logProgress(`✓ Generated ${transactions.length} customer balance transactions`);
  return transactions;
}

