import { ReportKey } from '@/types';
import { actions } from '@/state/app';

export type PresetOption = {
  key: ReportKey;
  label: string;
};

export const PRESET_OPTIONS: PresetOption[] = [
  { key: 'mrr', label: 'MRR' },
  { key: 'gross_volume', label: 'Gross Volume' },
  { key: 'active_subscribers', label: 'Active Subscribers' },
  { key: 'refund_count', label: 'Refund Count' },
  { key: 'subscriber_ltv', label: 'Subscriber LTV' },
];

/**
 * Get date range based on preset key
 */
function getDateRange(key: ReportKey): { start: string; end: string } {
  const end = new Date();
  const start = new Date();

  switch (key) {
    case 'mrr':
      // Year to date for MRR
      start.setMonth(0); // January 1st
      start.setDate(1);
      break;

    case 'gross_volume':
    case 'active_subscribers':
    case 'subscriber_ltv':
      // Last 1 year
      start.setFullYear(start.getFullYear() - 1);
      break;

    case 'refund_count':
      // Last 6 months
      start.setMonth(start.getMonth() - 6);
      break;
  }

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

/**
 * Get relevant objects for each preset (optional - helps guide user)
 */
function getRelevantObjects(key: ReportKey): string[] {
  switch (key) {
    case 'mrr':
    case 'active_subscribers':
      return ['subscription', 'customer'];

    case 'gross_volume':
      return ['payment', 'charge', 'invoice'];

    case 'refund_count':
      return ['refund', 'charge'];

    case 'subscriber_ltv':
      return ['subscription', 'customer', 'payment'];

    default:
      return [];
  }
}

/**
 * Apply a preset configuration to the app state
 */
export function applyPreset(
  key: ReportKey,
  dispatch: React.Dispatch<any>
): void {
  // 1. Set the report type
  dispatch(actions.setReport(key));

  // 2. Set appropriate date range
  const { start, end } = getDateRange(key);
  dispatch(actions.setRange(start, end));

  // 3. Optionally select relevant objects
  const relevantObjects = getRelevantObjects(key);

  // Clear existing selections first to ensure clean state
  // Then add relevant objects one by one
  // Note: This is optional - user can still manually adjust
  relevantObjects.forEach((obj) => {
    dispatch(actions.toggleObject(obj));
  });

  console.log(
    `[Preset] Applied "${key}" preset:`,
    { dateRange: `${start} to ${end}`, objects: relevantObjects }
  );
}
