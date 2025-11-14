'use client';
import { useApp, actions } from '@/state/app';
import { MetricOp, MetricType, MetricBlock, MetricFormula } from '@/types';
import { getFieldLabel } from '@/data/schema';
import { MetricBlockCard } from './MetricBlockCard';
import { FormulaBuilder } from './FormulaBuilder';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useWarehouseStore } from '@/lib/useWarehouse';
import { computeFormula } from '@/lib/formulaMetrics';
import schema from '@/data/schema';
import { getAvailableGroupFields, getGroupValues } from '@/lib/grouping';
import GroupBySelector from './GroupBySelector';

export function MetricTab() {
  const { state, dispatch } = useApp();
  const { store: warehouse, version } = useWarehouseStore();

  // Track draft formula for multi-block calculations (to prevent broken states)
  const [draftFormula, setDraftFormula] = useState<MetricFormula | null>(null);
  const [hasUnappliedChanges, setHasUnappliedChanges] = useState(false);

  // Group By state
  const [isGroupByFieldSelectorOpen, setIsGroupByFieldSelectorOpen] = useState(false);
  const [isGroupByValueSelectorOpen, setIsGroupByValueSelectorOpen] = useState(false);
  const groupByButtonRef = useRef<HTMLButtonElement>(null);
  const groupByPopoverRef = useRef<HTMLDivElement>(null);

  // Build list of qualified field names from selected fields
  const fieldOptions = state.selectedFields.map((field) => ({
    value: `${field.object}.${field.field}`,
    label: `${field.object}.${field.field}`,
    plainName: getFieldLabel(field.object, field.field),
    object: field.object,
    field: field.field,
  }));

  // Determine if we're in multi-block mode (based on state OR draft)
  const isMultiBlock = state.metricFormula.blocks.length >= 2 || (draftFormula && draftFormula.blocks.length >= 2);

  // Use draft formula for display if it exists, otherwise use state
  const activeFormula = draftFormula || state.metricFormula;

  // Available fields for grouping
  const availableGroupFields = useMemo(() => {
    return getAvailableGroupFields(state.selectedObjects, schema);
  }, [state.selectedObjects]);

  // Available values for the selected group field
  const availableGroupValues = useMemo(() => {
    if (!state.groupBy || !warehouse) return [];
    return getGroupValues(warehouse, state.groupBy.field, 50); // Get top 50, user can select max 10
  }, [state.groupBy?.field, version]);

  // Close Group By popovers when clicking outside
  useEffect(() => {
    if (!isGroupByFieldSelectorOpen && !isGroupByValueSelectorOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't close if clicking the button
      if (groupByButtonRef.current?.contains(target)) {
        return;
      }
      
      // Close if clicking outside the popover
      if (groupByPopoverRef.current && !groupByPopoverRef.current.contains(target)) {
        setIsGroupByFieldSelectorOpen(false);
        setIsGroupByValueSelectorOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isGroupByFieldSelectorOpen, isGroupByValueSelectorOpen]);

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
    
    // Always work with the current state formula (not draft)
    const currentBlocks = state.metricFormula.blocks;
    const newBlock: MetricBlock = {
      id: blockId,
      name: `Block ${currentBlocks.length + 1}`,
      source: undefined,
      op: 'sum',
      type: 'sum_over_period',
      filters: [],
    };
    
    // Check if this will create a multi-block situation
    const willBeMultiBlock = currentBlocks.length + 1 >= 2;
    
    if (willBeMultiBlock) {
      // Create draft formula with the new block
      const updatedDraft = {
        ...state.metricFormula,
        blocks: [...currentBlocks, newBlock],
      };
      setDraftFormula(updatedDraft);
      setHasUnappliedChanges(true);
    } else {
      // Single block - update directly (shouldn't happen since we start with 1 block)
      dispatch(actions.addMetricBlock(newBlock));
    }
  };

  const handleUpdateBlock = (blockId: string, updates: Partial<MetricBlock>) => {
    if (isMultiBlock && draftFormula) {
      // Update draft formula
      const updatedBlocks = draftFormula.blocks.map(block =>
        block.id === blockId ? { ...block, ...updates } : block
      );
      setDraftFormula({ ...draftFormula, blocks: updatedBlocks });
      setHasUnappliedChanges(true);
    } else {
      // Single block - update directly
      dispatch(actions.updateMetricBlock(blockId, updates));
    }
  };

  const handleRemoveBlock = (blockId: string) => {
    if (isMultiBlock && draftFormula) {
      // Remove from draft formula
      const updatedBlocks = draftFormula.blocks.filter(block => block.id !== blockId);
      const updatedDraft = { ...draftFormula, blocks: updatedBlocks };
      
      // If this brings us back to single block, apply immediately
      if (updatedBlocks.length === 1) {
        // Apply the removal directly
        dispatch(actions.removeMetricBlock(blockId));
        setDraftFormula(null);
        setHasUnappliedChanges(false);
      } else {
        setDraftFormula(updatedDraft);
        setHasUnappliedChanges(true);
      }
    } else {
      // Single block - remove directly
      dispatch(actions.removeMetricBlock(blockId));
    }
  };

  const handleCalculationChange = (calculation: any) => {
    if (isMultiBlock && draftFormula) {
      // Update draft formula
      setDraftFormula({ ...draftFormula, calculation });
      setHasUnappliedChanges(true);
    } else {
      dispatch(actions.setCalculation(calculation));
    }
  };

  const handleToggleExposeBlock = (blockId: string) => {
    // Always apply expose block changes immediately (not part of draft)
    // This allows users to see exposed values in the main content area right away
    dispatch(actions.toggleExposeBlock(blockId));
    
    // Also update draft formula if it exists to keep it in sync
    if (draftFormula) {
      const currentExposeBlocks = draftFormula.exposeBlocks || [];
      const updatedExposeBlocks = currentExposeBlocks.includes(blockId)
        ? currentExposeBlocks.filter(id => id !== blockId)
        : [...currentExposeBlocks, blockId];
      setDraftFormula({ ...draftFormula, exposeBlocks: updatedExposeBlocks });
    }
  };

  const handleApplyChanges = () => {
    if (draftFormula) {
      // Apply all changes from draft to state
      draftFormula.blocks.forEach((block, index) => {
        if (index < state.metricFormula.blocks.length) {
          // Update existing block
          dispatch(actions.updateMetricBlock(block.id, block));
        } else {
          // Add new block
          dispatch(actions.addMetricBlock(block));
        }
      });
      
      // Remove blocks that were deleted
      state.metricFormula.blocks.forEach(block => {
        if (!draftFormula.blocks.find(b => b.id === block.id)) {
          dispatch(actions.removeMetricBlock(block.id));
        }
      });
      
      // Update calculation
      if (draftFormula.calculation) {
        dispatch(actions.setCalculation(draftFormula.calculation));
      }
      
      // Note: expose blocks are managed separately and apply immediately
      // so we don't need to sync them here
      
      setHasUnappliedChanges(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="space-y-4">
        {/* Calculation Blocks - always visible */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Build a metric
            </label>
            {isMultiBlock && hasUnappliedChanges && (
              <button
                onClick={handleApplyChanges}
                className="transition-colors"
                style={{
                  backgroundColor: '#675DFF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#5548E0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#675DFF';
                }}
              >
                Apply
              </button>
            )}
          </div>

          {activeFormula.blocks.map((block) => {
            const blockResult = blockResults.find((r) => r.blockId === block.id);
            return (
              <MetricBlockCard
                key={block.id}
                block={block}
                fieldOptions={fieldOptions}
                onUpdate={handleUpdateBlock}
                onRemove={handleRemoveBlock}
                result={blockResult}
                isExposed={activeFormula.exposeBlocks?.includes(block.id)}
                onToggleExpose={handleToggleExposeBlock}
              />
            );
          })}
          
          {/* Add Block Button - moved below blocks */}
          <button
            onClick={handleAddBlock}
            className="w-auto transition-colors"
            style={{
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '14px',
              fontWeight: 300,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '8px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1V13M1 7H13" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Add block
          </button>
        </div>

        {/* Formula Builder - only shown when 2+ blocks */}
        {activeFormula.blocks.length >= 2 && (
          <FormulaBuilder
            blocks={activeFormula.blocks}
            calculation={activeFormula.calculation}
            onCalculationChange={handleCalculationChange}
            finalValue={result.value}
            blockResults={blockResults}
            resultUnitType={result.unitType}
          />
        )}

        {/* Group By Section */}
        <div>
          <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-primary)' }}>
            Group by
          </label>
          <div className="relative inline-flex items-center gap-2">
            <button
              ref={groupByButtonRef}
              onClick={() => {
                if (!state.groupBy) {
                  // Open field selector
                  setIsGroupByFieldSelectorOpen(true);
                } else {
                  // Open value selector
                  setIsGroupByValueSelectorOpen(true);
                }
              }}
              className="text-sm border-none focus:outline-none cursor-pointer flex items-center transition-colors gap-2"
              style={{
                backgroundColor: 'var(--bg-surface)',
                color: state.groupBy ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: 400,
                borderRadius: '50px',
                padding: '6px 12px',
                height: '32px',
                whiteSpace: 'nowrap',
              }}
            >
              {!state.groupBy && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
              <span>
                {state.groupBy 
                  ? `${schema.objects.find(o => o.name === state.groupBy.field.object)?.label}.${schema.objects.find(o => o.name === state.groupBy.field.object)?.fields.find(f => f.name === state.groupBy.field.field)?.label} (${state.groupBy.selectedValues.length})`
                  : 'Add grouping'}
              </span>
              {state.groupBy && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>

            {/* Field Selector Popover */}
            {isGroupByFieldSelectorOpen && (
              <div
                ref={groupByPopoverRef}
                className="absolute z-50"
                style={{
                  top: '40px',
                  left: 0,
                  minWidth: '240px',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  padding: '4px',
                }}
              >
                {availableGroupFields.length === 0 ? (
                  <div className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                    No categorical fields available
                  </div>
                ) : (
                  availableGroupFields.map((field) => (
                    <button
                      key={`${field.object}.${field.field}`}
                      onClick={() => {
                        const values = getGroupValues(warehouse, { object: field.object, field: field.field }, 10);
                        dispatch(actions.setGroupBy({
                          field: { object: field.object, field: field.field },
                          selectedValues: values,
                          autoAddedField: false,
                        }));
                        setIsGroupByFieldSelectorOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 transition-colors flex flex-col gap-1"
                      style={{
                        borderRadius: '6px',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <span className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {field.label}
                      </span>
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>
                        {field.object}.{field.field}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Value Selector Popover */}
            {isGroupByValueSelectorOpen && state.groupBy && (
              <div
                ref={groupByPopoverRef}
                className="absolute z-50"
                style={{
                  top: '40px',
                  left: 0,
                }}
              >
                <GroupBySelector
                  availableValues={availableGroupValues}
                  selectedValues={state.groupBy.selectedValues}
                  onApply={(selectedValues) => {
                    dispatch(actions.updateGroupValues(selectedValues));
                    setIsGroupByValueSelectorOpen(false);
                  }}
                  onCancel={() => {
                    setIsGroupByValueSelectorOpen(false);
                  }}
                  maxSelections={10}
                />
              </div>
            )}

            {/* Clear button - show when grouping is active */}
            {state.groupBy && (
              <button
                onClick={() => {
                  dispatch(actions.clearGroupBy());
                }}
                className="flex items-center justify-center transition-colors"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: '50px',
                  color: 'var(--text-muted)',
                  width: '32px',
                  height: '32px',
                }}
                aria-label="Clear grouping"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

