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
 * Generate invoice item (line item) records for invoices
 */
export function generateInvoiceItems(invoices, subscriptionItems, prices) {
  logProgress(`Generating invoice items for ${invoices.length} invoices...`);
  
  const items = [];

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

  for (const invoice of invoices) {
    // Get subscription items for this invoice's subscription
    const subItems = itemsBySubscription[invoice.subscription_id] || [];

    // If no subscription items, create a generic line item
    if (subItems.length === 0) {
      items.push({
        id: stripeId('il'),
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        subscription_id: invoice.subscription_id,
        price_id: null,
        amount: invoice.subtotal,
        currency: invoice.currency,
        quantity: 1,
        description: maybe(faker.commerce.productDescription(), 0.5) || 'Subscription',
        created: invoice.created,
        period_start: invoice.period_start,
        period_end: invoice.period_end,
      });
      continue;
    }

    // Create line items for each subscription item
    for (const subItem of subItems) {
      const price = priceIndex[subItem.price_id];
      if (!price) continue;

      // Calculate line item amount (distribute invoice total across items)
      const lineAmount = Math.floor((invoice.subtotal / subItems.length) * (0.95 + Math.random() * 0.1));

      items.push({
        id: stripeId('il'),
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        subscription_id: invoice.subscription_id,
        price_id: price.id,
        amount: lineAmount,
        currency: invoice.currency,
        quantity: subItem.quantity,
        description: maybe(faker.commerce.productDescription(), 0.3),
        created: invoice.created,
        period_start: invoice.period_start,
        period_end: invoice.period_end,
      });
    }

    // Occasionally add one-time charges
    if (Math.random() < 0.1) {
      items.push({
        id: stripeId('il'),
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        subscription_id: null,
        price_id: null,
        amount: Math.floor(Math.random() * 5000) + 500, // $5-$55
        currency: invoice.currency,
        quantity: 1,
        description: pickRandom([
          'Setup fee',
          'One-time charge',
          'Additional service',
          'Consulting fee',
          'Support hours',
        ]),
        created: invoice.created,
        period_start: invoice.period_start,
        period_end: invoice.period_end,
      });
    }
  }

  logProgress(`✓ Generated ${items.length} invoice items`);
  return items;
}

