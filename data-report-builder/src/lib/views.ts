/**
 * Transform normalized warehouse data into RowView[] for the UI
 * Provides a unified shape for DataList, sorting, filtering, and charts
 */

import { Warehouse } from '@/data/warehouse';
import { qualify, pickTimestamp } from './fields';

/**
 * RowView - Unified row structure for UI components
 *
 * @property display - Qualified field names for display (e.g., "payment.amount")
 * @property pk - Primary key { object: "payment", id: "pi_001" }
 * @property ts - Canonical timestamp for this row (ISO date string or null)
 *
 * @example
 * {
 *   display: {
 *     "payment.id": "pi_001",
 *     "payment.amount": 29900,
 *     "payment.created": "2025-03-15"
 *   },
 *   pk: { object: "payment", id: "pi_001" },
 *   ts: "2025-03-15"
 * }
 */
export type RowView = {
  display: Record<string, string | number | boolean | null>;
  pk: { object: string; id: string };
  ts: string | null;
};

/**
 * Build a DataList view from warehouse data
 * Converts normalized warehouse records into qualified RowView[] for UI display
 *
 * @param opts - Configuration options
 * @param opts.store - The warehouse data store
 * @param opts.selectedObjects - Array of object types to include (e.g., ["payment", "customer"])
 * @param opts.selectedFields - Array of fields to include with object+field pairs
 * @returns Array of RowView objects with qualified keys
 *
 * @example
 * buildDataListView({
 *   store: warehouse,
 *   selectedObjects: ["payment"],
 *   selectedFields: [
 *     { object: "payment", field: "id" },
 *     { object: "payment", field: "amount" }
 *   ]
 * })
 * // Returns:
 * // [
 * //   {
 * //     display: { "payment.id": "pi_001", "payment.amount": 29900 },
 * //     pk: { object: "payment", id: "pi_001" },
 * //     ts: "2025-03-15"
 * //   },
 * //   ...
 * // ]
 */
export function buildDataListView(opts: {
  store: Warehouse;
  selectedObjects: string[];
  selectedFields: { object: string; field: string }[];
}): RowView[] {
  const { store, selectedObjects, selectedFields } = opts;
  const rows: RowView[] = [];

  for (const object of selectedObjects) {
    // Get the table for this object type (handle both singular and plural)
    // @ts-ignore - dynamic property access on Warehouse
    let table = store[object];

    // If singular form doesn't work, try plural form
    if (!table) {
      const pluralKey = object + 's' as keyof Warehouse;
      table = store[pluralKey];
    }

    if (!table || !Array.isArray(table)) {
      continue;
    }

    // Build a row for each record in the table
    for (const record of table) {
      const row: RowView = {
        display: {},
        pk: { object, id: record.id },
        ts: pickTimestamp(object, record),
      };

      // Add qualified fields to display
      for (const f of selectedFields.filter(s => s.object === object)) {
        const qualifiedKey = qualify(object, f.field);
        row.display[qualifiedKey] = record[f.field];
      }

      rows.push(row);
    }
  }

  return rows;
}

/**
 * Filter RowView[] by date range
 * Uses the canonical timestamp (ts) field for filtering
 *
 * @param rows - Array of RowView objects
 * @param start - Start date (ISO string)
 * @param end - End date (ISO string)
 * @returns Filtered array of rows within the date range
 *
 * @example
 * filterRowsByDate(rows, "2025-01-01", "2025-03-31")
 */
export function filterRowsByDate(
  rows: RowView[],
  start: string,
  end: string
): RowView[] {
  const startDate = new Date(start);
  const endDate = new Date(end);

  return rows.filter(row => {
    if (!row.ts) return false;
    const rowDate = new Date(row.ts);
    return rowDate >= startDate && rowDate <= endDate;
  });
}

/**
 * Get rowKey from RowView for selection/filtering
 * Format: "object:id" (e.g., "payment:pi_001")
 *
 * @param row - RowView object
 * @returns Row key string
 *
 * @example
 * getRowKey({ pk: { object: "payment", id: "pi_001" }, ... })
 * // Returns: "payment:pi_001"
 */
export function getRowKey(row: RowView): string {
  return `${row.pk.object}:${row.pk.id}`;
}

/**
 * Sort RowView[] by a qualified field
 *
 * @param rows - Array of RowView objects
 * @param qualifiedField - Qualified field name (e.g., "payment.amount")
 * @param direction - Sort direction
 * @returns Sorted array of rows
 *
 * @example
 * sortRowsByField(rows, "payment.amount", "desc")
 */
export function sortRowsByField(
  rows: RowView[],
  qualifiedField: string,
  direction: 'asc' | 'desc'
): RowView[] {
  const sorted = [...rows].sort((a, b) => {
    const aVal = a.display[qualifiedField];
    const bVal = b.display[qualifiedField];

    // Handle null/undefined
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    // Compare based on type
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return aVal - bVal;
    }

    if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
      return aVal === bVal ? 0 : aVal ? 1 : -1;
    }

    // Default string comparison
    return String(aVal).localeCompare(String(bVal));
  });

  return direction === 'desc' ? sorted.reverse() : sorted;
}

/**
 * Convert RowView back to unqualified record for metric computation
 * Extracts the raw data with unqualified field names
 *
 * @param row - RowView object
 * @param object - Object type to extract
 * @returns Unqualified record
 *
 * @example
 * toUnqualifiedRecord(row, "payment")
 * // Returns: { id: "pi_001", amount: 29900, created: "2025-03-15" }
 */
export function toUnqualifiedRecord(row: RowView, object: string): Record<string, any> {
  const record: Record<string, any> = { id: row.pk.id };

  for (const [qualifiedKey, value] of Object.entries(row.display)) {
    if (qualifiedKey.startsWith(`${object}.`)) {
      const field = qualifiedKey.slice(object.length + 1);
      record[field] = value;
    }
  }

  return record;
}
