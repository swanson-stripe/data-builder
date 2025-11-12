import { UnitType, MetricOp, CalculationOperator } from '@/types';
import schema from '@/data/schema';

/**
 * Currency fields - fields that represent monetary amounts in pennies/cents
 */
const CURRENCY_FIELDS = new Set([
  'amount',
  'unit_amount',
  'amount_received',
  'amount_refunded',
  'amount_captured',
  'balance',
  'amount_due',
  'subtotal',
  'total',
  'starting_balance',
  'ending_balance',
]);

/**
 * Date/timestamp fields
 */
const DATE_FIELDS = new Set([
  'created',
  'updated',
  'canceled_at',
  'current_period_start',
  'current_period_end',
  'trial_start',
  'trial_end',
  'paid_at',
]);

/**
 * Infer the unit type from a field
 */
export function inferUnitType(objectName: string, fieldName: string, op: MetricOp): UnitType {
  // Count operations always return count
  if (op === 'count' || op === 'distinct_count') {
    return 'count';
  }
  
  // Check if it's a currency field
  if (CURRENCY_FIELDS.has(fieldName)) {
    return 'currency';
  }
  
  // Check if it's a date field
  if (DATE_FIELDS.has(fieldName)) {
    return 'date';
  }
  
  // Check schema for field type
  const object = schema.objects.find(o => o.name === objectName);
  if (object) {
    const field = object.fields.find(f => f.name === fieldName);
    if (field) {
      if (field.type === 'date') {
        return 'date';
      }
    }
  }
  
  // Default to count for numeric operations
  return 'count';
}

/**
 * Get the display label for a unit type
 */
export function getUnitLabel(unitType: UnitType): string {
  switch (unitType) {
    case 'currency':
      return 'Volume ($)';
    case 'count':
      return 'Count';
    case 'date':
      return 'Date/Timestamp';
    case 'rate':
      return 'Rate (%)';
  }
}

/**
 * Validate that a formula calculation is valid based on unit types
 */
export function validateFormulaUnits(
  operator: CalculationOperator,
  leftUnitType: UnitType,
  rightUnitType: UnitType
): { valid: boolean; error?: string } {
  // Addition and subtraction require matching unit types
  if (operator === 'add' || operator === 'subtract') {
    if (leftUnitType !== rightUnitType) {
      return {
        valid: false,
        error: `${operator === 'add' ? 'Addition' : 'Subtraction'} requires matching unit types. Left is ${getUnitLabel(leftUnitType)}, right is ${getUnitLabel(rightUnitType)}.`,
      };
    }
  }
  
  // Multiplication and division allow different unit types
  // The result unit type will be selected by the user
  
  return { valid: true };
}

/**
 * Get available result unit types for a calculation
 */
export function getAvailableResultUnitTypes(
  operator: CalculationOperator,
  leftUnitType: UnitType,
  rightUnitType: UnitType
): UnitType[] {
  // For addition/subtraction, result must match operands (already validated to be the same)
  if (operator === 'add' || operator === 'subtract') {
    return [leftUnitType];
  }
  
  // For multiplication/division, offer:
  // 1. Unique unit types from the blocks
  // 2. Rate (%) as an option
  const uniqueTypes = new Set<UnitType>([leftUnitType, rightUnitType]);
  const availableTypes = Array.from(uniqueTypes);
  
  // Always add rate as an option for mult/div
  if (!availableTypes.includes('rate')) {
    availableTypes.push('rate');
  }
  
  return availableTypes;
}

/**
 * Format a value based on its unit type
 * Note: Currency values are stored in pennies/cents and need to be divided by 100
 */
export function formatValueByUnit(value: number | null, unitType: UnitType): string {
  if (value === null) return 'N/A';
  
  switch (unitType) {
    case 'currency':
      // Convert from pennies to dollars
      return `$${(value / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    
    case 'count':
      return value.toLocaleString();
    
    case 'date':
      // For date values (timestamps), format as date
      return new Date(value * 1000).toLocaleDateString();
    
    case 'rate':
      // Format as percentage
      return `${(value * 100).toFixed(2)}%`;
  }
}

