/**
 * Data store layer - provides normalized access to catalog data
 */

import { warehouse, type Warehouse } from './warehouse';
import { qualify, unqualify, getPrimaryTimestampField } from '@/lib/fields';
import type { Catalog, RowKey, DisplayRow, RowMeta } from '@/types';

/**
 * Load the catalog from the warehouse
 */
export function loadCatalog(): Catalog {
  return warehouse as unknown as Catalog;
}

/**
 * Generate a row key from object and ID
 */
export function rowKey(object: string, id: string): RowKey {
  return `${object}:${id}`;
}

/**
 * Create a qualified key (e.g., "payment.amount")
 * @deprecated Use qualify from @/lib/fields instead
 */
export function qualifyKey(object: string, field: string): string {
  return qualify(object, field);
}

/**
 * Parse a qualified key back to object and field
 * @deprecated Use unqualify from @/lib/fields instead
 */
export function unqualifyKey(qualified: string): { object: string; field: string } {
  return unqualify(qualified);
}

/**
 * Get the canonical timestamp field for an object type
 * @deprecated Use getPrimaryTimestampField from @/lib/fields instead
 */
export function canonicalTimestamp(object: string): string {
  return getPrimaryTimestampField(object);
}

/**
 * Get a table from the catalog
 */
export function getTable(object: string, catalog?: Catalog): any[] {
  const cat = catalog || loadCatalog();
  const pluralKey = object + 's' as keyof Catalog;
  return cat[pluralKey] || [];
}

/**
 * Join tables for display with qualified keys
 * Returns rows with qualified keys (e.g., "payment.id") and __meta
 */
export function joinForDisplay({
  objects,
  fields,
  catalog,
}: {
  objects: string[];
  fields: { object: string; field: string }[];
  catalog?: Catalog;
}): { rows: DisplayRow[]; rowKeys: RowKey[] } {
  const cat = catalog || loadCatalog();

  if (objects.length === 0) {
    return { rows: [], rowKeys: [] };
  }

  // Get the primary object (first one)
  const primaryObject = objects[0];
  const primaryTable = getTable(primaryObject, cat);

  // Create display rows with qualified keys
  const rows: DisplayRow[] = primaryTable.map((row: any) => {
    const displayRow: any = {};

    // Add meta information
    const meta: RowMeta = {
      object: primaryObject,
      id: row.id,
      rowKey: rowKey(primaryObject, row.id),
    };
    displayRow.__meta = meta;

    // Qualify all fields from the primary object
    Object.keys(row).forEach((field) => {
      displayRow[qualifyKey(primaryObject, field)] = row[field];
    });

    return displayRow as DisplayRow;
  });

  const rowKeys = rows.map(r => r.__meta.rowKey);

  return { rows, rowKeys };
}

/**
 * Get unqualified rows for metric computation
 * Returns rows with simple field names (e.g., "id", "amount")
 */
export function getRows(object: string, catalog?: Catalog): any[] {
  return getTable(object, catalog);
}
