import {
  stripeId,
  dateAfter,
  pickRandom,
  toISODate,
  logProgress,
} from './base.mjs';

/**
 * Generate discount records (coupons applied to customers/subscriptions/invoices)
 */
export function generateDiscounts(customers, subscriptions, invoices, coupons) {
  logProgress(`Generating discounts for coupons...`);
  
  const discounts = [];
  const validCoupons = coupons.filter(c => c.valid);

  if (validCoupons.length === 0) {
    logProgress('Warning: No valid coupons found');
    return discounts;
  }

  // Apply discounts to ~20% of subscriptions
  const subscriptionsToDiscount = subscriptions.filter(() => Math.random() < 0.2);
  
  for (const subscription of subscriptionsToDiscount) {
    const coupon = pickRandom(validCoupons);
    const startDate = new Date(subscription.created);
    
    // End date depends on coupon duration
    let endDate = null;
    if (coupon.duration === 'once') {
      // Ends after first billing cycle
      endDate = new Date(subscription.current_period_end);
    } else if (coupon.duration === 'repeating' && coupon.duration_in_months) {
      // Ends after specified months
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + coupon.duration_in_months);
    }
    // If 'forever', endDate stays null

    discounts.push({
      id: stripeId('di'),
      customer_id: subscription.customer_id,
      coupon_id: coupon.id,
      subscription_id: subscription.id,
      invoice_id: null,
      start: toISODate(startDate),
      end: endDate ? toISODate(endDate) : null,
    });
  }

  // Apply discounts to ~10% of invoices (one-time discounts)
  const invoicesToDiscount = invoices.filter(() => Math.random() < 0.1);
  
  for (const invoice of invoicesToDiscount) {
    const coupon = pickRandom(validCoupons.filter(c => c.duration === 'once'));
    if (!coupon) continue;

    const startDate = new Date(invoice.created);
    const endDate = new Date(invoice.period_end);

    discounts.push({
      id: stripeId('di'),
      customer_id: invoice.customer_id,
      coupon_id: coupon.id,
      subscription_id: invoice.subscription_id,
      invoice_id: invoice.id,
      start: toISODate(startDate),
      end: toISODate(endDate),
    });
  }

  // Apply customer-level discounts (5% of customers)
  const customersToDiscount = customers.filter(() => Math.random() < 0.05);
  
  for (const customer of customersToDiscount) {
    const coupon = pickRandom(validCoupons);
    const startDate = new Date(customer.created);
    
    // End date for customer discounts
    let endDate = null;
    if (coupon.duration === 'repeating' && coupon.duration_in_months) {
      endDate = dateAfter(startDate, coupon.duration_in_months * 30);
    }

    discounts.push({
      id: stripeId('di'),
      customer_id: customer.id,
      coupon_id: coupon.id,
      subscription_id: null,
      invoice_id: null,
      start: toISODate(startDate),
      end: endDate ? toISODate(endDate) : null,
    });
  }

  logProgress(`✓ Generated ${discounts.length} discounts`);
  return discounts;
}

