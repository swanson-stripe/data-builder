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

  // First object is the primary object (the base table)
  if (selectedObjects.length === 0) return rows;
  
  const primaryObject = selectedObjects[0];
  
  // Get the primary table
  // @ts-ignore - dynamic property access on Warehouse
  let primaryTable = store[primaryObject];
  if (!primaryTable) {
    const pluralKey = primaryObject + 's' as keyof Warehouse;
    primaryTable = store[pluralKey];
  }
  
  if (!primaryTable || !Array.isArray(primaryTable)) {
    return rows;
  }

  // Build lookup maps for related objects
  const relatedMaps = new Map<string, Map<string, any>>();
  
  // Build reverse lookup maps for bridge tables (e.g., subscription_item by subscription_id)
  const bridgeMaps = new Map<string, Map<string, any[]>>();
  
  for (const relatedObject of selectedObjects.slice(1)) {
    // @ts-ignore
    let relatedTable = store[relatedObject];
    if (!relatedTable) {
      const pluralKey = relatedObject + 's' as keyof Warehouse;
      relatedTable = store[pluralKey];
    }
    
    if (relatedTable && Array.isArray(relatedTable)) {
      const lookupMap = new Map(relatedTable.map((r: any) => [r.id, r]));
      relatedMaps.set(relatedObject, lookupMap);
      
      // Build reverse indexes for foreign keys in this table
      // This enables multi-hop joins (e.g., subscription -> subscription_item -> price)
      if (relatedTable.length > 0) {
        const sampleRecord = relatedTable[0];
        for (const key of Object.keys(sampleRecord)) {
          if (key.endsWith('_id') && key !== 'id') {
            const foreignObject = key.replace(/_id$/, '');
            const bridgeKey = `${relatedObject}_by_${foreignObject}`;
            const reverseMap = new Map<string, any[]>();
            
            for (const r of relatedTable) {
              const fkValue = r[key];
              if (fkValue) {
                if (!reverseMap.has(fkValue)) {
                  reverseMap.set(fkValue, []);
                }
                reverseMap.get(fkValue)!.push(r);
              }
            }
            
            bridgeMaps.set(bridgeKey, reverseMap);
          }
        }
      }
    }
  }

  // Build a row for each primary record
  for (const record of primaryTable) {
    const row: RowView = {
      display: {},
      pk: { object: primaryObject, id: record.id },
      ts: pickTimestamp(primaryObject, record),
    };

    // Add all selected fields to display
    for (const f of selectedFields) {
      const qualifiedKey = qualify(f.object, f.field);
      
      if (f.object === primaryObject) {
        // Direct field from primary object
        row.display[qualifiedKey] = record[f.field];
      } else {
        // Try 1-hop join first (direct foreign key)
        const foreignKey = `${f.object}_id`;
        const relatedId = record[foreignKey];
        const relatedMap = relatedMaps.get(f.object);
        
        if (relatedId && relatedMap) {
          const relatedRecord = relatedMap.get(relatedId);
          row.display[qualifiedKey] = relatedRecord ? relatedRecord[f.field] : null;
        } else {
          // Try 2-hop join through bridge table
          // e.g., subscription -> subscription_item -> price
          let foundValue = null;
          
          // Look for bridge tables that connect primary object to target
          const bridgeKey = `${f.object}_by_${primaryObject}`;
          const bridgeRecords = bridgeMaps.get(bridgeKey);
          
          if (bridgeRecords) {
            // Direct bridge: target_object has primary_object_id
            const records = bridgeRecords.get(record.id);
            if (records && records.length > 0) {
              foundValue = records[0][f.field];
            }
          } else {
            // Indirect bridge: look for intermediate table
            // e.g., subscription -> subscription_item (bridge) -> price
            for (const intermediateObject of selectedObjects.slice(1)) {
              if (intermediateObject === f.object) continue;
              
              // Strategy 1: Use reverse bridge map (intermediate_by_primary)
              const primaryToBridge = `${intermediateObject}_by_${primaryObject}`;
              const bridgeToTarget = relatedMaps.get(f.object);
              
              const primaryBridgeRecords = bridgeMaps.get(primaryToBridge);
              if (primaryBridgeRecords && bridgeToTarget) {
                const bridgeRecords = primaryBridgeRecords.get(record.id);
                if (bridgeRecords && bridgeRecords.length > 0) {
                  // Check if bridge record has FK to target
                  const targetFk = `${f.object}_id`;
                  for (const bridgeRecord of bridgeRecords) {
                    if (bridgeRecord[targetFk]) {
                      const targetRecord = bridgeToTarget.get(bridgeRecord[targetFk]);
                      if (targetRecord) {
                        foundValue = targetRecord[f.field];
                        break; // Use first match
                      }
                    }
                  }
                  if (foundValue !== null) break;
                }
              }
              
              // Strategy 2: Forward traversal (primary.intermediate_id -> intermediate -> target)
              // e.g., refund.charge_id -> charge -> charge.customer_id -> customer
              if (foundValue === null) {
                const intermediateFk = `${intermediateObject}_id`;
                const intermediateId = record[intermediateFk];
                const intermediateMap = relatedMaps.get(intermediateObject);
                
                if (intermediateId && intermediateMap) {
                  const intermediateRecord = intermediateMap.get(intermediateId);
                  if (intermediateRecord) {
                    const targetFk = `${f.object}_id`;
                    const targetId = intermediateRecord[targetFk];
                    const targetMap = relatedMaps.get(f.object);
                    
                    if (targetId && targetMap) {
                      const targetRecord = targetMap.get(targetId);
                      if (targetRecord) {
                        foundValue = targetRecord[f.field];
                        break;
                      }
                    }
                  }
                }
              }
            }
          }
          
          row.display[qualifiedKey] = foundValue;
        }
      }
    }

    rows.push(row);
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
