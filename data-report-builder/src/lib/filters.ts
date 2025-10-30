import { FilterGroup, FilterCondition, FilterOperator } from '@/types';
import { RowView } from './views';

/**
 * Gets the value of a field from a row, handling qualified field names
 */
export function getFieldValue(
  row: RowView,
  field: { object: string; field: string }
): any {
  const qualifiedKey = `${field.object}.${field.field}`;
  return row.display[qualifiedKey];
}

/**
 * Tests if a row value matches a filter condition
 */
export function matchesCondition(
  rowValue: any,
  condition: FilterCondition
): boolean {
  const { operator, value } = condition;

  // Handle null/undefined row values
  if (rowValue === null || rowValue === undefined) {
    return false;
  }

  switch (operator) {
    case 'equals':
      return rowValue === value;

    case 'not_equals':
      return rowValue !== value;

    case 'greater_than':
      return typeof rowValue === 'number' && rowValue > (value as number);

    case 'less_than':
      return typeof rowValue === 'number' && rowValue < (value as number);

    case 'between':
      if (typeof rowValue === 'number' && Array.isArray(value) && value.length === 2) {
        return rowValue >= value[0] && rowValue <= value[1];
      }
      return false;

    case 'contains':
      if (typeof rowValue === 'string') {
        if (typeof value === 'string') {
          return rowValue.toLowerCase().includes(value.toLowerCase());
        }
        if (Array.isArray(value)) {
          // Check if any of the values are contained in the string
          return value.some(v => 
            typeof v === 'string' && rowValue.toLowerCase().includes(v.toLowerCase())
          );
        }
      }
      return false;

    case 'in':
      if (Array.isArray(value)) {
        return value.includes(rowValue);
      }
      return false;

    case 'is_true':
      return rowValue === true;

    case 'is_false':
      return rowValue === false;

    default:
      return false;
  }
}

/**
 * Applies filter conditions to a list of rows
 */
export function applyFilters(
  rows: RowView[],
  filterGroup: FilterGroup
): RowView[] {
  const { conditions, logic } = filterGroup;

  // No filters, return all rows
  if (conditions.length === 0) {
    return rows;
  }

  return rows.filter(row => {
    // Test each condition
    const results = conditions.map(condition => {
      const rowValue = getFieldValue(row, condition.field);
      return matchesCondition(rowValue, condition);
    });

    // Combine results based on logic
    if (logic === 'AND') {
      return results.every(r => r);
    } else {
      return results.some(r => r);
    }
  });
}

