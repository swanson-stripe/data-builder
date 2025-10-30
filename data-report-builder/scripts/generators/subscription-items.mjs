import {
  stripeId,
  dateAfter,
  toISODate,
  logProgress,
  pickRandom,
} from './base.mjs';

/**
 * Generate subscription item records
 */
export function generateSubscriptionItems(subscriptions, prices) {
  logProgress(`Generating subscription items for ${subscriptions.length} subscriptions...`);
  
  const items = [];

  for (const subscription of subscriptions) {
    // Most subscriptions have 1 item, some have 2-3
    const itemCount = Math.random() < 0.8 ? 1 : (Math.random() < 0.7 ? 2 : 3);
    
    // Get prices with matching currency
    const matchingPrices = prices.filter(p => p.currency === subscription.currency && p.active);
    if (matchingPrices.length === 0) continue;

    for (let i = 0; i < itemCount; i++) {
      const price = pickRandom(matchingPrices);
      const quantity = Math.random() < 0.9 ? 1 : Math.floor(Math.random() * 5) + 1; // Mostly qty 1
      
      // Created date is same or slightly after subscription created
      const createdDate = dateAfter(new Date(subscription.created), 1);

      items.push({
        id: stripeId('si'),
        subscription_id: subscription.id,
        price_id: price.id,
        quantity,
        created: toISODate(createdDate),
      });
    }
  }

  logProgress(`✓ Generated ${items.length} subscription items`);
  return items;
}

