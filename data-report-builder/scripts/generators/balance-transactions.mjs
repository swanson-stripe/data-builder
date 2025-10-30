import {
  stripeId,
  dateAfter,
  pickRandom,
  toISODate,
  logProgress,
} from './base.mjs';

/**
 * Generate balance transaction records for charges and refunds
 */
export function generateBalanceTransactions(charges, refunds) {
  logProgress(`Generating balance transactions...`);
  
  const transactions = [];

  // Generate balance transactions for charges
  for (const charge of charges) {
    // Only create transactions for succeeded charges
    if (charge.status !== 'succeeded') continue;

    const createdDate = dateAfter(new Date(charge.created), 0.1);
    
    // Stripe fees (2.9% + $0.30 for US cards)
    const feePercent = 0.029;
    const feeFixed = 30; // 30 cents in cents
    const fee = Math.floor(charge.amount * feePercent) + feeFixed;
    const net = charge.amount - fee;

    // Available date (usually 2-7 days after charge)
    const availableOn = dateAfter(new Date(charge.created), Math.floor(Math.random() * 5) + 2);

    transactions.push({
      id: stripeId('txn'),
      amount: charge.amount,
      currency: charge.currency,
      type: 'charge',
      source_id: charge.id,
      status: 'available',
      fee,
      net,
      created: toISODate(createdDate),
      available_on: toISODate(availableOn),
    });
  }

  // Generate balance transactions for refunds
  for (const refund of refunds) {
    // Only create transactions for succeeded refunds
    if (refund.status !== 'succeeded') continue;

    const createdDate = dateAfter(new Date(refund.created), 0.1);
    
    // Refund fee (Stripe refunds the processing fee for full refunds)
    const fee = 0; // No fee for refunds
    const net = -refund.amount; // Negative amount for refunds

    // Available date (usually immediately)
    const availableOn = dateAfter(new Date(refund.created), 1);

    transactions.push({
      id: stripeId('txn'),
      amount: -refund.amount, // Negative for refunds
      currency: refund.currency,
      type: 'refund',
      source_id: refund.id,
      status: 'available',
      fee,
      net,
      created: toISODate(createdDate),
      available_on: toISODate(availableOn),
    });
  }

  // Generate some adjustment transactions (1% of total)
  const adjustmentCount = Math.floor(transactions.length * 0.01);
  for (let i = 0; i < adjustmentCount; i++) {
    const existingTxn = pickRandom(transactions);
    const createdDate = dateAfter(new Date(existingTxn.created), Math.floor(Math.random() * 10) + 1);
    
    // Small adjustment amount
    const amount = Math.floor(Math.random() * 1000) + 100; // $1-$11
    const fee = 0;
    const net = amount;

    transactions.push({
      id: stripeId('txn'),
      amount,
      currency: existingTxn.currency,
      type: 'adjustment',
      source_id: null,
      status: 'available',
      fee,
      net,
      created: toISODate(createdDate),
      available_on: toISODate(createdDate),
    });
  }

  logProgress(`✓ Generated ${transactions.length} balance transactions`);
  return transactions;
}

