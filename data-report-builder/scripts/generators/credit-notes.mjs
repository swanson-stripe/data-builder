import { faker } from '@faker-js/faker';
import {
  stripeId,
  dateAfter,
  pickRandom,
  maybe,
  toISODate,
  logProgress,
} from './base.mjs';

/**
 * Generate credit note records for invoices (~3% of paid invoices)
 */
export function generateCreditNotes(invoices) {
  logProgress(`Generating credit notes...`);
  
  const creditNotes = [];
  const paidInvoices = invoices.filter(i => i.status === 'paid');

  // Generate credit notes for ~3% of paid invoices
  const creditNoteCount = Math.floor(paidInvoices.length * 0.03);
  const invoicesWithCreditNotes = [...paidInvoices]
    .sort(() => Math.random() - 0.5)
    .slice(0, creditNoteCount);

  for (const invoice of invoicesWithCreditNotes) {
    const createdDate = dateAfter(new Date(invoice.created), Math.floor(Math.random() * 60) + 1);

    // Credit note type: full or partial
    const isFull = Math.random() < 0.4; // 40% full credit notes
    const amount = isFull 
      ? invoice.amount_paid 
      : Math.floor(invoice.amount_paid * (0.2 + Math.random() * 0.6)); // 20-80% of invoice

    // Subtotal and total
    const subtotal = Math.floor(amount * 0.9); // Approximate subtotal
    const total = amount;

    // Status: mostly issued
    const status = Math.random() < 0.95 ? 'issued' : 'void';

    // Reason distribution
    const reason = pickRandom([
      'order_change',
      'order_change',
      'product_unsatisfactory',
      'product_unsatisfactory',
      'duplicate',
      'fraudulent',
    ]);

    creditNotes.push({
      id: stripeId('cn'),
      customer_id: invoice.customer_id,
      invoice_id: invoice.id,
      amount,
      subtotal,
      total,
      currency: invoice.currency,
      status,
      created: toISODate(createdDate),
      reason,
      memo: maybe(faker.lorem.sentence(), 0.6),
    });
  }

  logProgress(`✓ Generated ${creditNotes.length} credit notes`);
  return creditNotes;
}

