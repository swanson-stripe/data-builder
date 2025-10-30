import { AppState } from '@/state/app';
import { SchemaCatalog, FilterOperator } from '@/types';
import { pickTimestamp } from './fields';

/**
 * Generate realistic Stripe Sigma-style SQL from app state
 */
export function generateSQL(state: AppState, schema: SchemaCatalog): string {
  const {
    selectedObjects,
    selectedFields,
    filters,
    metric,
    start,
    end,
  } = state;

  // If no objects selected, return empty query
  if (selectedObjects.length === 0) {
    return '-- Select objects in the Data tab to generate SQL';
  }

  const lines: string[] = [];

  // Build SELECT clause
  lines.push('SELECT');
  
  const selectItems: string[] = [];
  
  // Add selected fields
  if (selectedFields.length > 0) {
    for (const field of selectedFields) {
      selectItems.push(`  ${field.object}.${field.field}`);
    }
  }
  
  // Add metric aggregation if present
  if (metric.source && metric.source.object && metric.source.field) {
    const aggFunc = getAggregationFunction(metric.op);
    const metricName = metric.name.toLowerCase().replace(/\s+/g, '_');
    selectItems.push(`  ${aggFunc}(${metric.source.object}.${metric.source.field}) AS ${metricName}`);
  }
  
  // If no fields or metric, select all from primary
  if (selectItems.length === 0 && selectedObjects.length > 0) {
    selectItems.push(`  ${selectedObjects[0]}.*`);
  }
  
  lines.push(selectItems.join(',\n'));

  // Build FROM clause
  const primaryObject = selectedObjects[0];
  lines.push(`FROM ${primaryObject}`);

  // Build JOIN clauses for additional objects
  if (selectedObjects.length > 1) {
    for (let i = 1; i < selectedObjects.length; i++) {
      const joinObject = selectedObjects[i];
      const joinClause = buildJoinClause(primaryObject, joinObject, schema);
      if (joinClause) {
        lines.push(joinClause);
      }
    }
  }

  // Build WHERE clause
  const whereConditions: string[] = [];
  
  // Add date range filter
  const timestampField = pickTimestamp(primaryObject, {} as any);
  if (timestampField && start && end) {
    whereConditions.push(`${primaryObject}.${timestampField} >= '${start}'`);
    whereConditions.push(`${primaryObject}.${timestampField} <= '${end}'`);
  }
  
  // Add field filters
  if (filters.conditions.length > 0) {
    const filterSQL = buildFilterConditions(filters.conditions, filters.logic);
    if (filterSQL) {
      whereConditions.push(filterSQL);
    }
  }
  
  if (whereConditions.length > 0) {
    lines.push('WHERE ' + whereConditions.join('\n  AND '));
  }

  // Add GROUP BY if we have aggregation
  if (metric.source && selectedFields.length > 0) {
    const groupByFields = selectedFields.map(f => `${f.object}.${f.field}`);
    if (groupByFields.length > 0) {
      lines.push('GROUP BY ' + groupByFields.join(', '));
    }
  }

  // Add ORDER BY
  if (timestampField) {
    lines.push(`ORDER BY ${primaryObject}.${timestampField} DESC`);
  }

  return lines.join('\n');
}

/**
 * Map metric operation to SQL aggregation function
 */
function getAggregationFunction(op: string): string {
  switch (op) {
    case 'sum':
      return 'SUM';
    case 'avg':
      return 'AVG';
    case 'count':
      return 'COUNT';
    case 'min':
      return 'MIN';
    case 'max':
      return 'MAX';
    default:
      return 'SUM';
  }
}

/**
 * Build JOIN clause between two objects using schema relationships
 */
function buildJoinClause(
  fromObject: string,
  toObject: string,
  schema: SchemaCatalog
): string | null {
  // Find relationship in schema
  const relationship = schema.relationships?.find(
    (rel) =>
      (rel.from === fromObject && rel.to === toObject) ||
      (rel.from === toObject && rel.to === fromObject)
  );

  if (!relationship) {
    // Fallback: try standard naming convention (object_id)
    return `LEFT JOIN ${toObject} ON ${fromObject}.${toObject}_id = ${toObject}.id`;
  }

  // Build JOIN based on relationship
  if (relationship.from === fromObject) {
    // Forward relationship: fromObject has foreign key to toObject
    return `LEFT JOIN ${toObject} ON ${fromObject}.${relationship.via} = ${toObject}.id`;
  } else {
    // Reverse relationship: toObject has foreign key to fromObject
    return `LEFT JOIN ${toObject} ON ${toObject}.${relationship.via} = ${fromObject}.id`;
  }
}

/**
 * Convert filter conditions to SQL WHERE clauses
 */
function buildFilterConditions(
  conditions: Array<{
    field: { object: string; field: string };
    operator: FilterOperator;
    value: string | number | boolean | string[] | [number, number];
  }>,
  logic: 'AND' | 'OR'
): string {
  if (conditions.length === 0) return '';

  const sqlConditions = conditions.map((condition) => {
    const fieldRef = `${condition.field.object}.${condition.field.field}`;
    return buildSingleCondition(fieldRef, condition.operator, condition.value);
  });

  if (sqlConditions.length === 1) {
    return sqlConditions[0];
  }

  // Wrap multiple conditions in parentheses and join with logic
  return '(' + sqlConditions.join(` ${logic} `) + ')';
}

/**
 * Build a single SQL condition from a filter
 */
function buildSingleCondition(
  fieldRef: string,
  operator: FilterOperator,
  value: string | number | boolean | string[] | [number, number]
): string {
  switch (operator) {
    case 'equals':
      if (Array.isArray(value)) {
        // If value is an array, treat like 'in' operator
        if (value.length > 0) {
          const values = value.map(v => formatValue(v as string | number | boolean)).join(', ');
          return `${fieldRef} IN (${values})`;
        }
        return `${fieldRef} IS NOT NULL`;
      }
      return `${fieldRef} = ${formatValue(value as string | number | boolean)}`;
    
    case 'not_equals':
      if (Array.isArray(value)) {
        // If value is an array, treat like 'not in' operator
        if (value.length > 0) {
          const values = value.map(v => formatValue(v as string | number | boolean)).join(', ');
          return `${fieldRef} NOT IN (${values})`;
        }
        return `${fieldRef} IS NULL`;
      }
      return `${fieldRef} != ${formatValue(value as string | number | boolean)}`;
    
    case 'greater_than':
      if (!Array.isArray(value)) {
        return `${fieldRef} > ${formatValue(value)}`;
      }
      return `${fieldRef} IS NOT NULL`;
    
    case 'less_than':
      if (!Array.isArray(value)) {
        return `${fieldRef} < ${formatValue(value)}`;
      }
      return `${fieldRef} IS NOT NULL`;
    
    case 'between':
      if (Array.isArray(value) && value.length === 2) {
        return `${fieldRef} BETWEEN ${formatValue(value[0])} AND ${formatValue(value[1])}`;
      }
      return `${fieldRef} IS NOT NULL`;
    
    case 'contains':
      if (typeof value === 'string') {
        return `${fieldRef} LIKE '%${value}%'`;
      }
      if (Array.isArray(value) && value.length > 0) {
        const likeConditions = value.map(v => `${fieldRef} LIKE '%${v}%'`);
        return '(' + likeConditions.join(' OR ') + ')';
      }
      return `${fieldRef} IS NOT NULL`;
    
    case 'in':
      if (Array.isArray(value) && value.length > 0) {
        const values = value.map(v => formatValue(v)).join(', ');
        return `${fieldRef} IN (${values})`;
      }
      return `${fieldRef} IS NOT NULL`;
    
    case 'is_true':
      return `${fieldRef} = TRUE`;
    
    case 'is_false':
      return `${fieldRef} = FALSE`;
    
    default:
      return `${fieldRef} IS NOT NULL`;
  }
}

/**
 * Format a value for SQL (add quotes for strings, etc.)
 */
function formatValue(value: string | number | boolean): string {
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`; // Escape single quotes
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  return String(value);
}

