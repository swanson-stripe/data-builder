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
 * Generate payment intent records for paid invoices
 */
export function generatePaymentIntents(invoices, paymentMethods) {
  logProgress(`Generating payment intents for invoices...`);
  
  const intents = [];

  // Create index of payment methods by customer_id
  const methodsByCustomer = {};
  for (const method of paymentMethods) {
    if (!methodsByCustomer[method.customer_id]) {
      methodsByCustomer[method.customer_id] = [];
    }
    methodsByCustomer[method.customer_id].push(method);
  }

  // Generate payment intents for invoices that were attempted
  for (const invoice of invoices) {
    // Only create payment intents for attempted invoices
    if (!invoice.attempted || invoice.attempt_count === 0) continue;

    // Get payment methods for this customer
    const customerMethods = methodsByCustomer[invoice.customer_id] || [];

    // Create payment intents (one per attempt)
    for (let attempt = 0; attempt < invoice.attempt_count; attempt++) {
      const createdDate = dateAfter(new Date(invoice.created), attempt * 2); // Spread attempts over days

      // Status determination
      let status;
      if (invoice.status === 'paid' && attempt === invoice.attempt_count - 1) {
        // Last attempt for paid invoice succeeded
        status = 'succeeded';
      } else if (invoice.status === 'open' && attempt === invoice.attempt_count - 1) {
        // Last attempt for open invoice may be pending/failed
        status = pickRandom(['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing']);
      } else {
        // Previous attempts failed
        status = pickRandom(['canceled', 'requires_payment_method']);
      }

      // Payment method (if customer has one)
      const paymentMethodId = customerMethods.length > 0 
        ? pickRandom(customerMethods).id 
        : null;

      // Capture method: mostly automatic
      const captureMethod = Math.random() < 0.95 ? 'automatic' : 'manual';
      const confirmationMethod = Math.random() < 0.9 ? 'automatic' : 'manual';

      intents.push({
        id: stripeId('pi'),
        customer_id: invoice.customer_id,
        invoice_id: invoice.id,
        amount: invoice.amount_due,
        currency: invoice.currency,
        status,
        created: toISODate(createdDate),
        payment_method_id: paymentMethodId,
        description: maybe(faker.commerce.productDescription(), 0.3),
        capture_method: captureMethod,
        confirmation_method: confirmationMethod,
      });
    }
  }

  logProgress(`✓ Generated ${intents.length} payment intents`);
  return intents;
}

/**
 * Link payment intents back to invoices (update default_payment_method_id)
 */
export function linkPaymentIntentsToInvoices(invoices, paymentIntents) {
  logProgress('Linking payment intents to invoices...');
  
  // Create index of payment intents by invoice_id
  const intentsByInvoice = {};
  for (const intent of paymentIntents) {
    if (!intentsByInvoice[intent.invoice_id]) {
      intentsByInvoice[intent.invoice_id] = [];
    }
    intentsByInvoice[intent.invoice_id].push(intent);
  }

  // Update invoice records with latest payment method
  let linkedCount = 0;
  for (const invoice of invoices) {
    const invoiceIntents = intentsByInvoice[invoice.id];
    if (invoiceIntents && invoiceIntents.length > 0) {
      // Set last payment method as default
      const lastIntent = invoiceIntents[invoiceIntents.length - 1];
      if (lastIntent.payment_method_id) {
        invoice.default_payment_method_id = lastIntent.payment_method_id;
        linkedCount++;
      }
    }
  }

  logProgress(`✓ Linked ${linkedCount} invoices to payment methods`);
}

