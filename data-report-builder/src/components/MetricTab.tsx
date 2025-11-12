'use client';
import { useApp, actions } from '@/state/app';
import { MetricOp, MetricType, MetricBlock } from '@/types';
import { getFieldLabel } from '@/data/schema';
import { MetricBlockCard } from './MetricBlockCard';
import { FormulaBuilder } from './FormulaBuilder';
import { useState, useMemo } from 'react';
import { useWarehouseStore } from '@/lib/useWarehouse';
import { computeFormula } from '@/lib/formulaMetrics';
import schema from '@/data/schema';

export function MetricTab() {
  const { state, dispatch } = useApp();
  const { store: warehouse, version } = useWarehouseStore();

  // Build list of qualified field names from selected fields
  const fieldOptions = state.selectedFields.map((field) => ({
    value: `${field.object}.${field.field}`,
    label: `${field.object}.${field.field}`,
    plainName: getFieldLabel(field.object, field.field),
    object: field.object,
    field: field.field,
  }));

  // Compute block results for live preview
  const { result, blockResults } = useMemo(() => {
    if (state.metricFormula.blocks.length === 0) {
      return { result: { value: null, series: null }, blockResults: [] };
    }
    
    return computeFormula({
      formula: state.metricFormula,
      start: state.start,
      end: state.end,
      granularity: state.granularity,
      store: warehouse,
      schema,
      selectedObjects: state.selectedObjects,
      selectedFields: state.selectedFields,
    });
  }, [
    state.metricFormula,
    state.start,
    state.end,
    state.granularity,
    state.selectedObjects,
    state.selectedFields,
    warehouse,
    version,
  ]);

  const handleAddBlock = () => {
    const blockId = `block_${Date.now()}`;
    const newBlock: MetricBlock = {
      id: blockId,
      name: `Block ${state.metricFormula.blocks.length + 1}`,
      source: undefined,
      op: 'sum',
      type: 'sum_over_period',
      filters: [],
    };
    dispatch(actions.addMetricBlock(newBlock));
  };

  const handleUpdateBlock = (blockId: string, updates: Partial<MetricBlock>) => {
    dispatch(actions.updateMetricBlock(blockId, updates));
  };

  const handleRemoveBlock = (blockId: string) => {
    dispatch(actions.removeMetricBlock(blockId));
  };

  const handleCalculationChange = (calculation: any) => {
    dispatch(actions.setCalculation(calculation));
  };

  const handleToggleExposeBlock = (blockId: string) => {
    dispatch(actions.toggleExposeBlock(blockId));
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="space-y-4 p-4">
        {/* Calculation Blocks - always visible */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Calculation Blocks
            </label>
            <button
              onClick={handleAddBlock}
              className="text-xs px-3 py-1.5 rounded transition-colors"
              style={{
                backgroundColor: '#675DFF',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              + Add Block
            </button>
          </div>

          {state.metricFormula.blocks.map((block) => {
            const blockResult = blockResults.find((r) => r.blockId === block.id);
            return (
              <MetricBlockCard
                key={block.id}
                block={block}
                fieldOptions={fieldOptions}
                onUpdate={handleUpdateBlock}
                onRemove={handleRemoveBlock}
                result={blockResult}
                isExposed={state.metricFormula.exposeBlocks?.includes(block.id)}
                onToggleExpose={handleToggleExposeBlock}
              />
            );
          })}
        </div>

        {/* Formula Builder - only shown when 2+ blocks */}
        {state.metricFormula.blocks.length >= 2 && (
          <FormulaBuilder
            blocks={state.metricFormula.blocks}
            calculation={state.metricFormula.calculation}
            onCalculationChange={handleCalculationChange}
            finalValue={result.value}
            blockResults={blockResults}
            resultUnitType={result.unitType}
          />
        )}
      </div>
    </div>
  );
}

