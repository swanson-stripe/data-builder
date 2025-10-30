import {
  stripeId,
  dateAfter,
  dateBefore,
  pickRandom,
  toISODate,
  logProgress,
} from './base.mjs';

/**
 * Generate subscription schedule records (~10% of subscriptions)
 */
export function generateSubscriptionSchedules(subscriptions) {
  logProgress(`Generating subscription schedules...`);
  
  const schedules = [];

  // Generate schedules for ~10% of subscriptions
  const subscriptionsWithSchedules = subscriptions.filter(() => Math.random() < 0.1);

  for (const subscription of subscriptionsWithSchedules) {
    const createdDate = dateBefore(new Date(subscription.created), Math.floor(Math.random() * 10));

    // Status distribution
    let status;
    if (subscription.status === 'active') {
      status = pickRandom(['active', 'active', 'active', 'completed']);
    } else if (subscription.status === 'canceled') {
      status = pickRandom(['completed', 'canceled', 'released']);
    } else {
      status = 'not_started';
    }

    // Phase dates
    let currentPhaseStart;
    let currentPhaseEnd;

    if (status === 'active') {
      currentPhaseStart = new Date(subscription.current_period_start);
      currentPhaseEnd = new Date(subscription.current_period_end);
    } else if (status === 'completed') {
      // Completed: phase ended in the past
      currentPhaseStart = dateBefore(new Date(subscription.created), 30);
      currentPhaseEnd = dateBefore(new Date(), 1);
    } else if (status === 'not_started') {
      // Not started: phase in the future
      currentPhaseStart = dateAfter(new Date(), Math.floor(Math.random() * 30) + 1);
      currentPhaseEnd = dateAfter(currentPhaseStart, 30);
    } else {
      // Canceled/released: use subscription dates
      currentPhaseStart = new Date(subscription.current_period_start);
      currentPhaseEnd = new Date(subscription.current_period_end);
    }

    // End behavior
    const endBehavior = pickRandom(['release', 'release', 'cancel']);

    schedules.push({
      id: stripeId('sub_sched'),
      customer_id: subscription.customer_id,
      subscription_id: subscription.id,
      status,
      created: toISODate(createdDate),
      current_phase_start: toISODate(currentPhaseStart),
      current_phase_end: toISODate(currentPhaseEnd),
      end_behavior: endBehavior,
    });
  }

  logProgress(`✓ Generated ${schedules.length} subscription schedules`);
  return schedules;
}

