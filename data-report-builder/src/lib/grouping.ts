import type { SchemaCatalog, SchemaField } from '@/types';
import type { Warehouse } from '@/data/warehouse';

/**
 * Grouping utilities for segmenting data by categorical fields
 */

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
 */
export function getGroupValues(
  store: any, // Accept any type since warehouse store is Partial
  field: { object: string; field: string },
  limit: number = 100
): string[] {
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

