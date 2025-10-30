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
 * Generate refund records for charges (~5% of successful charges)
 */
export function generateRefunds(charges) {
  logProgress(`Generating refunds for charges...`);
  
  const refunds = [];
  const successfulCharges = charges.filter(c => c.status === 'succeeded' && c.paid);

  // Refund ~5% of successful charges
  const refundCount = Math.floor(successfulCharges.length * 0.05);
  const chargesToRefund = [...successfulCharges]
    .sort(() => Math.random() - 0.5)
    .slice(0, refundCount);

  for (const charge of chargesToRefund) {
    const createdDate = dateAfter(new Date(charge.created), Math.floor(Math.random() * 30) + 1);

    // Refund type: full or partial
    const isFullRefund = Math.random() < 0.7; // 70% full refunds
    const refundAmount = isFullRefund 
      ? charge.amount 
      : Math.floor(charge.amount * (0.2 + Math.random() * 0.6)); // 20-80% partial refund

    // Status: mostly succeeded
    const status = Math.random() < 0.95 ? 'succeeded' : pickRandom(['pending', 'failed']);

    // Reason distribution
    const reason = pickRandom([
      'requested_by_customer',
      'requested_by_customer',
      'requested_by_customer',
      'duplicate',
      'fraudulent',
      'expired_uncaptured_charge',
    ]);

    const failureReason = status === 'failed' 
      ? pickRandom(['lost_or_stolen_card', 'expired_or_canceled_card', 'unknown'])
      : null;

    refunds.push({
      id: stripeId('re'),
      charge_id: charge.id,
      payment_intent_id: charge.payment_intent_id,
      amount: refundAmount,
      currency: charge.currency,
      created: toISODate(createdDate),
      status,
      reason,
      description: maybe(faker.commerce.productDescription(), 0.3),
      failure_reason: failureReason,
    });

    // Update charge with refund info
    if (status === 'succeeded') {
      charge.amount_refunded += refundAmount;
      charge.refunded = charge.amount_refunded === charge.amount;
    }
  }

  logProgress(`✓ Generated ${refunds.length} refunds`);
  return refunds;
}

