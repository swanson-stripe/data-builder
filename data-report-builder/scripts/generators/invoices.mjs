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
 * Generate invoice records for subscriptions
 */
export function generateInvoices(subscriptions, subscriptionItems, prices) {
  logProgress(`Generating invoices for ${subscriptions.length} subscriptions...`);
  
  const invoices = [];
  let invoiceNumber = 1000;

  // Create index of subscription items by subscription_id
  const itemsBySubscription = {};
  for (const item of subscriptionItems) {
    if (!itemsBySubscription[item.subscription_id]) {
      itemsBySubscription[item.subscription_id] = [];
    }
    itemsBySubscription[item.subscription_id].push(item);
  }

  // Create index of prices
  const priceIndex = {};
  for (const price of prices) {
    priceIndex[price.id] = price;
  }

  for (const subscription of subscriptions) {
    // Determine how many invoices to generate based on subscription age
    const createdDate = new Date(subscription.created);
    const monthsSinceCreated = Math.floor((new Date() - createdDate) / (1000 * 60 * 60 * 24 * 30));
    
    // Generate 1-12 invoices per subscription (based on age)
    let invoiceCount;
    if (subscription.status === 'canceled' || subscription.status === 'incomplete') {
      invoiceCount = Math.min(monthsSinceCreated, Math.floor(Math.random() * 3) + 1);
    } else if (subscription.status === 'active' || subscription.status === 'past_due') {
      invoiceCount = Math.min(monthsSinceCreated + 1, Math.floor(Math.random() * 12) + 1);
    } else {
      invoiceCount = 1; // At least one invoice
    }

    // Get subscription items for this subscription
    const subItems = itemsBySubscription[subscription.id] || [];
    
    // Calculate base amount from subscription items
    let baseAmount = 0;
    for (const item of subItems) {
      const price = priceIndex[item.price_id];
      if (price) {
        baseAmount += price.unit_amount * item.quantity;
      }
    }
    if (baseAmount === 0) {
      baseAmount = 2000; // Fallback amount
    }

    for (let i = 0; i < invoiceCount; i++) {
      // Invoice date progresses from subscription start
      let invoiceDate = new Date(createdDate);
      invoiceDate.setMonth(invoiceDate.getMonth() + i);
      
      // Ensure we don't go past current date
      if (invoiceDate > new Date()) {
        break;
      }

      // Period dates
      const periodStart = new Date(invoiceDate);
      const periodEnd = new Date(invoiceDate);
      switch (subscription.billing) {
        case 'charge_automatically':
        default:
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          break;
      }

      // Due date (7-30 days after invoice date)
      const dueDate = dateAfter(invoiceDate, subscription.days_until_due || 7);

      // Calculate amounts (with small variation)
      const variation = 0.9 + Math.random() * 0.2; // 90%-110%
      const subtotal = Math.floor(baseAmount * variation);
      const tax = Math.floor(subtotal * (Math.random() * 0.15)); // 0-15% tax
      const total = subtotal + tax;

      // Status determination
      let status;
      let paid;
      let amountPaid;
      let amountRemaining;
      let attemptCount = 0;
      let attempted = false;

      if (subscription.status === 'past_due' && i === invoiceCount - 1) {
        // Latest invoice for past_due subscription is open/unpaid
        status = 'open';
        paid = false;
        amountPaid = 0;
        amountRemaining = total;
        attemptCount = Math.floor(Math.random() * 3) + 1;
        attempted = true;
      } else if (subscription.status === 'incomplete' && i === 0) {
        // First invoice for incomplete subscription is draft
        status = 'draft';
        paid = false;
        amountPaid = 0;
        amountRemaining = total;
      } else if (i === invoiceCount - 1 && subscription.status === 'active') {
        // Latest invoice for active subscription (might be open or paid)
        if (Math.random() < 0.7) {
          status = 'paid';
          paid = true;
          amountPaid = total;
          amountRemaining = 0;
          attemptCount = 1;
          attempted = true;
        } else {
          status = 'open';
          paid = false;
          amountPaid = 0;
          amountRemaining = total;
        }
      } else {
        // Historical invoices are usually paid
        const statusRoll = Math.random();
        if (statusRoll < 0.85) {
          status = 'paid';
          paid = true;
          amountPaid = total;
          amountRemaining = 0;
          attemptCount = 1;
          attempted = true;
        } else if (statusRoll < 0.95) {
          status = 'open';
          paid = false;
          amountPaid = 0;
          amountRemaining = total;
          attemptCount = Math.floor(Math.random() * 2);
          attempted = attemptCount > 0;
        } else {
          status = pickRandom(['void', 'uncollectible']);
          paid = false;
          amountPaid = 0;
          amountRemaining = status === 'void' ? 0 : total;
        }
      }

      invoices.push({
        id: stripeId('in'),
        customer_id: subscription.customer_id,
        subscription_id: subscription.id,
        amount_due: total,
        amount_paid: amountPaid,
        amount_remaining: amountRemaining,
        subtotal,
        total,
        tax,
        created: toISODate(invoiceDate),
        due_date: toISODate(dueDate),
        period_start: toISODate(periodStart),
        period_end: toISODate(periodEnd),
        status,
        paid,
        currency: subscription.currency,
        description: maybe(faker.commerce.productDescription(), 0.2),
        number: `INV-${invoiceNumber++}`,
        collection_method: subscription.collection_method,
        default_payment_method_id: null, // Will be populated after payment methods
        attempt_count: attemptCount,
        attempted,
        auto_advance: subscription.collection_method === 'charge_automatically',
      });
    }
  }

  logProgress(`✓ Generated ${invoices.length} invoices`);
  return invoices;
}

