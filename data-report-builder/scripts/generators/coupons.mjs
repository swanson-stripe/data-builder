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

const COUPON_NAMES = [
  'WELCOME10',
  'SAVE20',
  'FIRSTMONTH',
  'SPRING2025',
  'SUMMER25',
  'BLACKFRIDAY',
  'CYBER50',
  'NEWYEAR',
  'EARLYBIRD',
  'LOYALTY',
  'REFERRAL',
  'STUDENT',
  'NONPROFIT',
  'UPGRADE',
  'COMEBACK',
];

/**
 * Generate coupon records
 */
export function generateCoupons(count = 20) {
  logProgress(`Generating ${count} coupons...`);
  
  const coupons = [];

  for (let i = 0; i < count; i++) {
    const createdDate = randomDate(0.7); // 70% in 2025
    
    // Either percent off or amount off (not both)
    const isPercentOff = Math.random() < 0.6; // 60% are percent off
    
    const percentOff = isPercentOff ? Math.floor(Math.random() * 50) + 10 : null; // 10-60% off
    const amountOff = !isPercentOff ? Math.floor(Math.random() * 5000) + 500 : null; // $5-$55 off
    const currency = !isPercentOff ? pickRandom(CURRENCIES) : null;
    
    // Duration
    const duration = pickRandom(['forever', 'once', 'repeating', 'repeating']);
    const durationInMonths = duration === 'repeating' ? Math.floor(Math.random() * 12) + 1 : null;
    
    // Redemption limits
    const hasMaxRedemptions = Math.random() < 0.3;
    const maxRedemptions = hasMaxRedemptions ? Math.floor(Math.random() * 1000) + 100 : null;
    const timesRedeemed = hasMaxRedemptions ? Math.floor(Math.random() * maxRedemptions * 0.7) : Math.floor(Math.random() * 500);
    
    // Expiration
    const hasExpiration = Math.random() < 0.4;
    const redeemBy = hasExpiration ? toISODate(dateAfter(createdDate, Math.floor(Math.random() * 365) + 30)) : null;
    
    // Valid status (some coupons are invalid/expired)
    const valid = Math.random() < 0.85;
    
    // Generate unique coupon name
    const baseName = COUPON_NAMES[i % COUPON_NAMES.length];
    const name = i >= COUPON_NAMES.length ? `${baseName}_${Math.floor(i / COUPON_NAMES.length)}` : baseName;

    coupons.push({
      id: stripeId('coup'),
      name,
      amount_off: amountOff,
      percent_off: percentOff,
      currency,
      duration,
      duration_in_months: durationInMonths,
      max_redemptions: maxRedemptions,
      redeem_by: redeemBy,
      times_redeemed: timesRedeemed,
      valid,
      created: toISODate(createdDate),
    });
  }

  logProgress(`✓ Generated ${coupons.length} coupons`);
  return coupons;
}

