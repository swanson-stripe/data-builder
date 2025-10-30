import { faker } from '@faker-js/faker';
import {
  stripeId,
  randomDate,
  dateAfter,
  pickRandom,
  maybe,
  toISODate,
  CURRENCIES,
  logProgress,
} from './base.mjs';

/**
 * Generate subscription records
 */
export function generateSubscriptions(customers, prices, count = 1000) {
  logProgress(`Generating ${count} subscriptions...`);
  
  const subscriptions = [];
  const activePrices = prices.filter(p => p.active);

  // Ensure we have active prices
  if (activePrices.length === 0) {
    logProgress('Warning: No active prices found, using all prices');
    activePrices.push(...prices);
  }

  for (let i = 0; i < count; i++) {
    const customer = pickRandom(customers);
    const price = pickRandom(activePrices);
    
    // Created date (90% in 2025)
    const createdDate = randomDate(0.9);
    
    // Start date is usually same as created, but can be future
    const startDate = Math.random() < 0.9 ? createdDate : dateAfter(createdDate, 30);
    
    // Billing cycle anchor is usually start date
    const billingCycleAnchor = startDate;
    
    // Current period start (for active subscriptions, this is recent)
    let currentPeriodStart = startDate;
    const monthsSinceStart = Math.floor((new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24 * 30));
    if (monthsSinceStart > 0 && Math.random() < 0.7) {
      const periodsElapsed = Math.min(monthsSinceStart, Math.floor(Math.random() * monthsSinceStart) + 1);
      currentPeriodStart = new Date(startDate);
      currentPeriodStart.setMonth(currentPeriodStart.getMonth() + periodsElapsed);
    }
    
    // Current period end (based on recurring interval)
    const currentPeriodEnd = new Date(currentPeriodStart);
    switch (price.recurring_interval) {
      case 'day':
        currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 1);
        break;
      case 'week':
        currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 7);
        break;
      case 'month':
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
        break;
      case 'year':
        currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
        break;
    }
    
    // Status distribution
    const statusRoll = Math.random();
    let status;
    if (statusRoll < 0.65) {
      status = 'active';
    } else if (statusRoll < 0.75) {
      status = 'canceled';
    } else if (statusRoll < 0.85) {
      status = 'trialing';
    } else if (statusRoll < 0.90) {
      status = 'past_due';
    } else if (statusRoll < 0.95) {
      status = 'incomplete';
    } else {
      status = pickRandom(['incomplete_expired', 'unpaid', 'paused']);
    }
    
    // Trial dates (for trialing subscriptions or past trials)
    let trialStart = null;
    let trialEnd = null;
    if (status === 'trialing' || Math.random() < 0.3) {
      trialStart = toISODate(startDate);
      const trialEndDate = dateAfter(startDate, Math.floor(Math.random() * 30) + 7); // 7-37 days
      trialEnd = toISODate(trialEndDate);
    }
    
    // Canceled/ended dates (for canceled subscriptions)
    let canceledAt = null;
    let cancelAt = null;
    let endedAt = null;
    let cancelAtPeriodEnd = false;
    
    if (status === 'canceled') {
      const cancelDate = dateAfter(startDate, Math.floor(Math.random() * 365));
      canceledAt = toISODate(cancelDate);
      endedAt = toISODate(cancelDate);
      cancelAtPeriodEnd = Math.random() < 0.5;
    } else if (Math.random() < 0.1) {
      // Some active subscriptions are scheduled to cancel
      const futureCancelDate = dateAfter(currentPeriodEnd, Math.floor(Math.random() * 90));
      cancelAt = toISODate(futureCancelDate);
      cancelAtPeriodEnd = true;
    }
    
    // Collection method
    const collectionMethod = pickRandom(['charge_automatically', 'charge_automatically', 'charge_automatically', 'send_invoice']);
    
    // Days until due (for send_invoice)
    const daysUntilDue = collectionMethod === 'send_invoice' ? Math.floor(Math.random() * 30) + 1 : null;

    subscriptions.push({
      id: stripeId('sub'),
      customer_id: customer.id,
      status,
      created: toISODate(createdDate),
      current_period_start: toISODate(currentPeriodStart),
      current_period_end: toISODate(currentPeriodEnd),
      cancel_at: cancelAt,
      canceled_at: canceledAt,
      cancel_at_period_end: cancelAtPeriodEnd,
      currency: price.currency,
      default_payment_method_id: null, // Will be populated after payment methods
      default_source_id: null,
      billing: collectionMethod,
      billing_cycle_anchor: toISODate(billingCycleAnchor),
      collection_method: collectionMethod,
      days_until_due: daysUntilDue,
      ended_at: endedAt,
      start_date: toISODate(startDate),
      trial_start: trialStart,
      trial_end: trialEnd,
      application_fee_percent: maybe(Math.floor(Math.random() * 10) + 1, 0.1), // 10% have application fees
      automatic_tax_enabled: Math.random() < 0.3,
      description: maybe(faker.commerce.productDescription(), 0.2),
      discount_coupon_id: null, // Will be populated in discount generator
      discount_customer_id: null,
      discount_end: null,
      discount_start: null,
      discount_subscription: null,
    });
  }

  logProgress(`✓ Generated ${subscriptions.length} subscriptions`);
  return subscriptions;
}

