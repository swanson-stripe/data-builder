import type { SchemaCatalog, SchemaField } from '@/types';
import type { Warehouse } from '@/data/warehouse';

/**
 * Grouping utilities for segmenting data by categorical fields
 */

/**
 * Relationship definitions for joining tables
 * Maps: sourceObject -> { targetObject: { sourceField, targetField } }
 */
const RELATIONSHIPS: Record<string, Record<string, { sourceField: string; targetField: string }>> = {
  subscription: {
    price: { sourceField: 'price_id', targetField: 'id' },
    customer: { sourceField: 'customer_id', targetField: 'id' },
  },
  subscription_item: {
    subscription: { sourceField: 'subscription_id', targetField: 'id' },
    price: { sourceField: 'price_id', targetField: 'id' },
  },
  price: {
    product: { sourceField: 'product_id', targetField: 'id' },
  },
  charge: {
    customer: { sourceField: 'customer_id', targetField: 'id' },
    product: { sourceField: 'product_id', targetField: 'id' },
    price: { sourceField: 'price_id', targetField: 'id' },
  },
  invoice: {
    customer: { sourceField: 'customer_id', targetField: 'id' },
    subscription: { sourceField: 'subscription_id', targetField: 'id' },
  },
  refund: {
    charge: { sourceField: 'charge_id', targetField: 'id' },
  },
  payment_intent: {
    customer: { sourceField: 'customer_id', targetField: 'id' },
  },
};

// Cache for lookup indexes - maps objectName -> fieldName -> value -> row
// Also tracks the data length to detect when data has been loaded/changed
const indexCache = new WeakMap<any, Map<string, { index: Map<any, any>; dataLength: number }>>();

/**
 * Build or get a cached index for fast lookups
 * Invalidates cache if data length has changed (new data loaded)
 */
function getIndex(store: any, objectName: string, fieldName: string): Map<any, any> {
  let storeCache = indexCache.get(store);
  if (!storeCache) {
    storeCache = new Map();
    indexCache.set(store, storeCache);
  }
  
  const cacheKey = `${objectName}.${fieldName}`;
  const cached = storeCache.get(cacheKey);
  const data = store[objectName];
  const currentLength = Array.isArray(data) ? data.length : 0;
  
  // Return cached index if data length hasn't changed
  if (cached && cached.dataLength === currentLength) {
    return cached.index;
  }
  
  // Build the index
  const index = new Map();
  if (Array.isArray(data)) {
    for (const row of data) {
      const key = row[fieldName];
      if (key !== null && key !== undefined) {
        index.set(key, row);
      }
    }
  }
  
  storeCache.set(cacheKey, { index, dataLength: currentLength });
  return index;
}

/**
 * Resolve a field value from a row by following foreign key relationships if needed.
 * For example, if row is from 'subscription' and we want 'product.name',
 * we follow: subscription -> price (via price_id) -> product (via product_id) -> name
 * 
 * Uses cached indexes for O(1) lookups instead of O(n) Array.find()
 */
export function resolveFieldValue(
  row: any,
  sourceObject: string,
  targetField: { object: string; field: string },
  store: any
): string | null {
  // If the field is on the same object, just return it directly
  if (sourceObject === targetField.object) {
    const value = row[targetField.field];
    return value !== null && value !== undefined ? String(value) : null;
  }

  // Need to traverse relationships to get to the target object
  // Use BFS to find a path from sourceObject to targetField.object
  const visited = new Set<string>();
  const queue: { object: string; currentRow: any }[] = [{ object: sourceObject, currentRow: row }];
  
  while (queue.length > 0) {
    const { object, currentRow } = queue.shift()!;
    
    if (visited.has(object)) continue;
    visited.add(object);
    
    // Check if we can go directly to target
    const relationships = RELATIONSHIPS[object];
    if (!relationships) continue;
    
    for (const [targetObject, rel] of Object.entries(relationships)) {
      if (visited.has(targetObject)) continue;
      
      // Get the foreign key value from current row
      const fkValue = currentRow[rel.sourceField];
      if (fkValue === null || fkValue === undefined) continue;
      
      // Look up the target row using cached index (O(1) instead of O(n))
      const index = getIndex(store, targetObject, rel.targetField);
      const targetRow = index.get(fkValue);
      if (!targetRow) continue;
      
      // If this is our target object, return the field value
      if (targetObject === targetField.object) {
        const value = targetRow[targetField.field];
        return value !== null && value !== undefined ? String(value) : null;
      }
      
      // Otherwise, continue searching from this object
      queue.push({ object: targetObject, currentRow: targetRow });
    }
  }
  
  return null;
}

/**
 * Batch resolve field values for all rows at once.
 * Much more efficient than calling resolveFieldValue for each row individually.
 * Returns a Map from row to resolved value.
 */
export function batchResolveFieldValues(
  rows: any[],
  sourceObject: string,
  targetField: { object: string; field: string },
  store: any
): Map<any, string | null> {
  const results = new Map<any, string | null>();
  
  // If the field is on the same object, just map directly
  if (sourceObject === targetField.object) {
    for (const row of rows) {
      const value = row[targetField.field];
      results.set(row, value !== null && value !== undefined ? String(value) : null);
    }
    return results;
  }
  
  // For cross-object resolution, we still need to traverse but can use cached indexes
  for (const row of rows) {
    results.set(row, resolveFieldValue(row, sourceObject, targetField, store));
  }
  
  return results;
}

/**
 * Get available grouping fields from enabled objects
 * Only returns categorical fields (string type or fields with enum values)
 */
export function getAvailableGroupFields(
  selectedObjects: string[],
  schema: SchemaCatalog
): { object: string; field: string; label: string }[] {
  const groupFields: { object: string; field: string; label: string }[] = [];

  for (const objectName of selectedObjects) {
    const schemaObject = schema.objects.find(o => o.name === objectName);
    if (!schemaObject) continue;

    // Find categorical fields (string type or fields with enum values)
    const categoricalFields = schemaObject.fields.filter(field =>
      field.type === 'string' || field.enum !== undefined
    );

    for (const field of categoricalFields) {
      groupFields.push({
        object: objectName,
        field: field.name,
        label: `${schemaObject.label}.${field.label}`,
      });
    }
  }

  return groupFields;
}

/**
 * Get unique values for a field from the dataset
 * Returns up to `limit` most common values
 * 
 * If primaryObject is provided and differs from field.object, 
 * values are resolved by traversing relationships from primaryObject rows.
 */
export function getGroupValues(
  store: any, // Accept any type since warehouse store is Partial
  field: { object: string; field: string },
  limit: number = 100,
  primaryObject?: string
): string[] {
  // If no primaryObject or same as field object, use direct lookup
  if (!primaryObject || primaryObject === field.object) {
    const data = store[field.object];
    if (!data || !Array.isArray(data)) return [];

    // Count occurrences of each value
    const valueCounts = new Map<string, number>();
    
    for (const row of data) {
      const value = row[field.field];
      if (value === null || value === undefined) continue;
      
      const stringValue = String(value);
      valueCounts.set(stringValue, (valueCounts.get(stringValue) || 0) + 1);
    }

    // Sort by frequency (descending) and return top N
    const sortedValues = Array.from(valueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([value]) => value);

    return sortedValues;
  }

  // Cross-object resolution: get values by traversing from primaryObject
  const primaryData = store[primaryObject];
  if (!primaryData || !Array.isArray(primaryData)) return [];

  // Use batch resolution to get all values efficiently
  const resolvedValues = batchResolveFieldValues(primaryData, primaryObject, field, store);
  
  // Count occurrences of each resolved value
  const valueCounts = new Map<string, number>();
  for (const value of resolvedValues.values()) {
    if (value === null) continue;
    valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
  }

  // Sort by frequency (descending) and return top N
  const sortedValues = Array.from(valueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);

  return sortedValues;
}

/**
 * Group data rows by field value
 * Only includes rows where the field value is in selectedValues
 */
export function groupData(
  rows: any[],
  groupField: { object: string; field: string },
  selectedValues: string[]
): Map<string, any[]> {
  const grouped = new Map<string, any[]>();
  
  // Initialize groups
  for (const value of selectedValues) {
    grouped.set(value, []);
  }

  // Distribute rows into groups
  for (const row of rows) {
    const value = row[groupField.field];
    if (value === null || value === undefined) continue;
    
    const stringValue = String(value);
    if (grouped.has(stringValue)) {
      grouped.get(stringValue)!.push(row);
    }
  }

  return grouped;
}

/**
 * Create a filtered warehouse where related tables are filtered based on 
 * the primary object's filtered rows.
 * 
 * For example, if primaryObject is 'subscription' and we filter to certain subscriptions,
 * this will also filter 'price' to only include prices referenced by those subscriptions,
 * and 'product' to only include products referenced by those prices.
 */
export function createFilteredWarehouse(
  baseWarehouse: any,
  primaryObject: string,
  filteredPrimaryRows: any[]
): any {
  const result = { ...baseWarehouse, [primaryObject]: filteredPrimaryRows };
  
  // Collect all foreign key values from the filtered primary rows
  const relationships = RELATIONSHIPS[primaryObject];
  if (!relationships) return result;
  
  // For each relationship, filter the target table
  for (const [targetObject, rel] of Object.entries(relationships)) {
    const fkValues = new Set(
      filteredPrimaryRows
        .map(row => row[rel.sourceField])
        .filter(v => v !== null && v !== undefined)
    );
    
    const targetData = baseWarehouse[targetObject];
    if (!Array.isArray(targetData)) continue;
    
    // Filter target table to only include rows referenced by primary
    const filteredTarget = targetData.filter(row => fkValues.has(row[rel.targetField]));
    result[targetObject] = filteredTarget;
    
    // Recursively filter tables related to this target
    const nestedRelationships = RELATIONSHIPS[targetObject];
    if (nestedRelationships) {
      for (const [nestedTarget, nestedRel] of Object.entries(nestedRelationships)) {
        if (result[nestedTarget] !== undefined) continue; // Already filtered
        
        const nestedFkValues = new Set(
          filteredTarget
            .map(row => row[nestedRel.sourceField])
            .filter(v => v !== null && v !== undefined)
        );
        
        const nestedData = baseWarehouse[nestedTarget];
        if (!Array.isArray(nestedData)) continue;
        
        result[nestedTarget] = nestedData.filter(row => nestedFkValues.has(row[nestedRel.targetField]));
      }
    }
  }
  
  return result;
}

