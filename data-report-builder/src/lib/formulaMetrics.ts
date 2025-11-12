import { MetricFormula, MetricBlock, BlockResult, MetricResult, SeriesPoint, FilterCondition, SchemaCatalog, UnitType } from '@/types';
import { Granularity, rangeByGranularity, bucketLabel } from '@/lib/time';
import { Warehouse } from '@/data/warehouse';
import { buildDataListView } from '@/lib/views';
import { applyFilters } from '@/lib/filters';
import { computeMetric } from '@/lib/metrics';
import { inferUnitType, validateFormulaUnits, getAvailableResultUnitTypes } from '@/lib/unitTypes';

/**
 * Parameters for computing a metric formula
 */
export type ComputeFormulaParams = {
  formula: MetricFormula;
  start: string;
  end: string;
  granularity: Granularity;
  store: Warehouse | Partial<Record<string, any[]>>;
  schema?: SchemaCatalog;
  selectedObjects: string[];
  selectedFields: { object: string; field: string }[];
};

/**
 * Compute a single metric block with its own filters
 */
function computeBlock(
  block: MetricBlock,
  start: string,
  end: string,
  granularity: Granularity,
  store: Warehouse | Partial<Record<string, any[]>>,
  schema: SchemaCatalog | undefined,
  selectedObjects: string[],
  selectedFields: { object: string; field: string }[]
): BlockResult {
  // Build PK include set from block's filters
  let includeSet: Set<string> | undefined = undefined;
  
  if (block.filters.length > 0 && selectedObjects.length > 0 && selectedFields.length > 0) {
    const rawRows = buildDataListView({
      store,
      selectedObjects,
      selectedFields,
    });
    
    const filteredRows = applyFilters(rawRows, {
      conditions: block.filters,
      logic: 'AND', // Blocks use AND logic for their filters
    });
    
    includeSet = new Set(filteredRows.map(row => `${row.pk.object}:${row.pk.id}`));
  }
  
  // Compute the metric for this block
  const result = computeMetric({
    def: {
      name: block.name,
      source: block.source,
      op: block.op,
      type: block.type,
    },
    start,
    end,
    granularity,
    store,
    include: includeSet,
    schema,
    objects: selectedObjects,
  });
  
  // Infer unit type from the block's source field and operation
  let unitType: UnitType = 'count'; // default
  if (block.source) {
    unitType = block.unitType || inferUnitType(block.source.object, block.source.field, block.op);
  } else if (block.op === 'count' || block.op === 'distinct_count') {
    unitType = 'count';
  }
  
  return {
    blockId: block.id,
    blockName: block.name,
    value: result.value,
    series: result.series,
    unitType,
  };
}

/**
 * Apply a calculation operator to two series point-by-point
 */
function applySeriescalculation(
  left: SeriesPoint[],
  right: SeriesPoint[],
  operator: 'add' | 'subtract' | 'multiply' | 'divide'
): SeriesPoint[] {
  // Create a map of dates from both series
  const dateSet = new Set<string>();
  left.forEach(p => dateSet.add(p.date));
  right.forEach(p => dateSet.add(p.date));
  
  const dates = Array.from(dateSet).sort();
  
  // Create maps for quick lookup
  const leftMap = new Map(left.map(p => [p.date, p.value]));
  const rightMap = new Map(right.map(p => [p.date, p.value]));
  
  return dates.map(date => {
    const leftVal = leftMap.get(date) ?? 0;
    const rightVal = rightMap.get(date) ?? 0;
    
    let value: number;
    switch (operator) {
      case 'add':
        value = leftVal + rightVal;
        break;
      case 'subtract':
        value = leftVal - rightVal;
        break;
      case 'multiply':
        value = leftVal * rightVal;
        break;
      case 'divide':
        // Handle division by zero
        value = rightVal !== 0 ? leftVal / rightVal : 0;
        break;
    }
    
    return { date, value };
  });
}

/**
 * Compute a metric formula with multiple blocks and optional calculation
 */
export function computeFormula(params: ComputeFormulaParams): {
  result: MetricResult;
  blockResults: BlockResult[];
} {
  const { formula, start, end, granularity, store, schema, selectedObjects, selectedFields } = params;
  
  // If no blocks, return empty result
  if (formula.blocks.length === 0) {
    return {
      result: {
        value: null,
        series: null,
        note: 'No metric blocks defined',
        kind: 'number', // Default for error case
      },
      blockResults: [],
    };
  }
  
  // Compute all blocks
  const blockResults = formula.blocks.map(block =>
    computeBlock(block, start, end, granularity, store, schema, selectedObjects, selectedFields)
  );
  
  // If no calculation is defined, use the first block as the result (backward compatible)
  if (!formula.calculation || formula.blocks.length === 1) {
    const firstBlock = blockResults[0];
    // Map unitType to kind for backward compatibility with chart rendering
    const kind = firstBlock.unitType === 'currency' ? 'currency' : 'number';
    return {
      result: {
        value: firstBlock.value,
        series: firstBlock.series,
        unitType: firstBlock.unitType,
        kind,
      },
      blockResults,
    };
  }
  
  // Apply calculation
  const { operator, leftOperand, rightOperand, resultUnitType } = formula.calculation;
  
  const leftBlock = blockResults.find(b => b.blockId === leftOperand);
  const rightBlock = blockResults.find(b => b.blockId === rightOperand);
  
  if (!leftBlock || !rightBlock) {
    return {
      result: {
        value: null,
        series: null,
        note: `Calculation references missing blocks: ${leftOperand}, ${rightOperand}`,
        kind: 'number', // Default for error case
      },
      blockResults,
    };
  }
  
  // Validate unit types
  const leftUnitType = leftBlock.unitType || 'count';
  const rightUnitType = rightBlock.unitType || 'count';
  const validation = validateFormulaUnits(operator, leftUnitType, rightUnitType);
  
  if (!validation.valid) {
    return {
      result: {
        value: null,
        series: null,
        note: validation.error,
        kind: 'number', // Default for error case
      },
      blockResults,
    };
  }
  
  // Determine result unit type
  let finalUnitType: UnitType;
  if (resultUnitType) {
    // User has explicitly selected a result unit type
    finalUnitType = resultUnitType;
  } else if (operator === 'add' || operator === 'subtract') {
    // For add/subtract, result matches operands (already validated to be the same)
    finalUnitType = leftUnitType;
  } else {
    // For mult/div, default to the first available option
    const availableTypes = getAvailableResultUnitTypes(operator, leftUnitType, rightUnitType);
    finalUnitType = availableTypes[0];
  }
  
  // Calculate final value
  let finalValue: number | null = null;
  if (leftBlock.value !== null && rightBlock.value !== null) {
    switch (operator) {
      case 'add':
        finalValue = leftBlock.value + rightBlock.value;
        break;
      case 'subtract':
        finalValue = leftBlock.value - rightBlock.value;
        break;
      case 'multiply':
        finalValue = leftBlock.value * rightBlock.value;
        break;
      case 'divide':
        finalValue = rightBlock.value !== 0 ? leftBlock.value / rightBlock.value : 0;
        break;
    }
  }
  
  // Calculate series if both blocks have series
  let finalSeries: SeriesPoint[] | null = null;
  if (leftBlock.series && rightBlock.series) {
    finalSeries = applySeriescalculation(leftBlock.series, rightBlock.series, operator);
  }
  
  // Map unitType to kind for backward compatibility with chart rendering
  const kind = finalUnitType === 'currency' ? 'currency' : 'number';
  
  return {
    result: {
      value: finalValue,
      series: finalSeries,
      unitType: finalUnitType,
      kind,
    },
    blockResults,
  };
}

