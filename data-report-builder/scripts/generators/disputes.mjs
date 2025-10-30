import {
  stripeId,
  dateAfter,
  pickRandom,
  toISODate,
  logProgress,
} from './base.mjs';

/**
 * Generate dispute records for charges (~1% of succeeded charges)
 */
export function generateDisputes(charges) {
  logProgress(`Generating disputes for charges...`);
  
  const disputes = [];
  const successfulCharges = charges.filter(c => c.status === 'succeeded' && c.paid);

  // Generate disputes for ~1% of successful charges
  const disputeCount = Math.floor(successfulCharges.length * 0.01);
  const chargesToDispute = [...successfulCharges]
    .sort(() => Math.random() - 0.5)
    .slice(0, disputeCount);

  for (const charge of chargesToDispute) {
    const createdDate = dateAfter(new Date(charge.created), Math.floor(Math.random() * 30) + 5); // 5-35 days after charge

    // Status distribution
    const statusRoll = Math.random();
    let status;
    if (statusRoll < 0.3) {
      status = pickRandom(['needs_response', 'under_review']);
    } else if (statusRoll < 0.5) {
      status = 'won';
    } else if (statusRoll < 0.7) {
      status = 'lost';
    } else {
      status = pickRandom(['warning_needs_response', 'warning_under_review', 'warning_closed', 'charge_refunded']);
    }

    // Reason distribution
    const reason = pickRandom([
      'fraudulent',
      'fraudulent',
      'credit_not_processed',
      'duplicate',
      'product_not_received',
      'product_unacceptable',
      'subscription_canceled',
      'unrecognized',
      'general',
    ]);

    // Evidence due date (14 days from creation for disputes needing response)
    const evidenceDueBy = ['needs_response', 'warning_needs_response'].includes(status)
      ? dateAfter(createdDate, 14)
      : null;

    disputes.push({
      id: stripeId('dp'),
      charge_id: charge.id,
      amount: charge.amount,
      currency: charge.currency,
      status,
      reason,
      created: toISODate(createdDate),
      evidence_due_by: evidenceDueBy ? toISODate(evidenceDueBy) : null,
    });
  }

  logProgress(`✓ Generated ${disputes.length} disputes`);
  return disputes;
}

