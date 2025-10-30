import { faker } from '@faker-js/faker';
import {
  stripeId,
  dateAfter,
  pickRandom,
  maybe,
  toISODate,
  logProgress,
} from './base.mjs';

const FAILURE_CODES = [
  'card_declined',
  'insufficient_funds',
  'lost_card',
  'stolen_card',
  'expired_card',
  'incorrect_cvc',
  'processing_error',
  'rate_limit',
];

const FAILURE_MESSAGES = [
  'Your card was declined.',
  'Your card has insufficient funds.',
  'Your card has been reported lost.',
  'Your card has been reported stolen.',
  'Your card has expired.',
  'Your card\'s security code is incorrect.',
  'An error occurred while processing your card.',
  'Rate limit exceeded.',
];

/**
 * Generate charge records for successful payment intents
 */
export function generateCharges(paymentIntents) {
  logProgress(`Generating charges for payment intents...`);
  
  const charges = [];

  for (const intent of paymentIntents) {
    // Only create charges for certain statuses
    if (!['succeeded', 'requires_capture'].includes(intent.status)) {
      continue;
    }

    const createdDate = dateAfter(new Date(intent.created), 0.1); // Charges created shortly after intent

    // Status based on intent status
    const status = intent.status === 'succeeded' ? 'succeeded' : 'pending';
    const paid = status === 'succeeded';
    
    // Capture info
    const captured = intent.capture_method === 'automatic' || Math.random() < 0.9;
    const amountCaptured = captured ? intent.amount : 0;

    // Refund info (will be updated by refunds generator)
    const refunded = false;
    const amountRefunded = 0;

    // Failure info (for failed charges, but we're only creating successful ones here)
    const failureCode = null;
    const failureMessage = null;

    charges.push({
      id: stripeId('ch'),
      customer_id: intent.customer_id,
      payment_intent_id: intent.id,
      invoice_id: intent.invoice_id,
      payment_method_id: intent.payment_method_id,
      amount: intent.amount,
      amount_captured: amountCaptured,
      amount_refunded: amountRefunded,
      currency: intent.currency,
      created: toISODate(createdDate),
      status,
      paid,
      refunded,
      captured,
      failure_code: failureCode,
      failure_message: failureMessage,
      description: intent.description,
    });
  }

  // Generate some failed charges (5% of succeeded charges)
  const failedChargeCount = Math.floor(charges.length * 0.05);
  for (let i = 0; i < failedChargeCount; i++) {
    const successfulCharge = pickRandom(charges);
    const createdDate = dateAfter(new Date(successfulCharge.created), -1); // Failed before success

    const failureIndex = Math.floor(Math.random() * FAILURE_CODES.length);

    charges.push({
      id: stripeId('ch'),
      customer_id: successfulCharge.customer_id,
      payment_intent_id: successfulCharge.payment_intent_id,
      invoice_id: successfulCharge.invoice_id,
      payment_method_id: successfulCharge.payment_method_id,
      amount: successfulCharge.amount,
      amount_captured: 0,
      amount_refunded: 0,
      currency: successfulCharge.currency,
      created: toISODate(createdDate),
      status: 'failed',
      paid: false,
      refunded: false,
      captured: false,
      failure_code: FAILURE_CODES[failureIndex],
      failure_message: FAILURE_MESSAGES[failureIndex],
      description: successfulCharge.description,
    });
  }

  logProgress(`✓ Generated ${charges.length} charges (${failedChargeCount} failed)`);
  return charges;
}

