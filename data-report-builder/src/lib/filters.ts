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

  // Helper to normalize dates for comparison
  const normalizeDate = (val: any): Date | null => {
    if (val instanceof Date) return val;
    if (typeof val === 'string') {
      const parsed = new Date(val);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof val === 'number') return new Date(val * 1000); // Unix timestamp
    return null;
  };

  switch (operator) {
    case 'equals':
      // Check if we're comparing dates
      const rowDate = normalizeDate(rowValue);
      const valueDate = normalizeDate(value);
      if (rowDate && valueDate) {
        // Compare dates by day (ignore time)
        return rowDate.toISOString().split('T')[0] === valueDate.toISOString().split('T')[0];
      }
      return rowValue === value;

    case 'not_equals':
      return rowValue !== value;

    case 'greater_than':
      // Handle date comparison
      const rowDateGt = normalizeDate(rowValue);
      const valueDateGt = normalizeDate(value);
      if (rowDateGt && valueDateGt) {
        return rowDateGt.getTime() > valueDateGt.getTime();
      }
      return typeof rowValue === 'number' && rowValue > (value as number);

    case 'less_than':
      // Handle date comparison
      const rowDateLt = normalizeDate(rowValue);
      const valueDateLt = normalizeDate(value);
      if (rowDateLt && valueDateLt) {
        return rowDateLt.getTime() < valueDateLt.getTime();
      }
      return typeof rowValue === 'number' && rowValue < (value as number);

    case 'between':
      // Handle date range
      if (Array.isArray(value) && value.length === 2) {
        const rowDateBt = normalizeDate(rowValue);
        const startDate = normalizeDate(value[0]);
        const endDate = normalizeDate(value[1]);
        
        if (rowDateBt && startDate && endDate) {
          return rowDateBt.getTime() >= startDate.getTime() && rowDateBt.getTime() <= endDate.getTime();
        }
        
        // Handle numeric range
        if (typeof rowValue === 'number' && typeof value[0] === 'number' && typeof value[1] === 'number') {
          return rowValue >= value[0] && rowValue <= value[1];
        }
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
        return (value as Array<any>).includes(rowValue);
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

