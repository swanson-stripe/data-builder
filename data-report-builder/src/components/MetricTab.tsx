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
  const [groupBySearchQuery, setGroupBySearchQuery] = useState('');
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

  // Available fields for grouping with categorization
  const availableGroupFields = useMemo(() => {
    const allFields = getAvailableGroupFields(state.selectedObjects, schema);
    
    // Common field names to prioritize (status, currency, type, etc.)
    const commonFieldNames = ['status', 'currency', 'type', 'country', 'brand', 'category', 'method', 'tier'];
    
    // Categorize into common and other
    const common: typeof allFields = [];
    const other: typeof allFields = [];
    
    allFields.forEach(field => {
      const fieldName = field.field.toLowerCase();
      if (commonFieldNames.some(commonName => fieldName.includes(commonName))) {
        common.push(field);
      } else {
        other.push(field);
      }
    });
    
    return { common, other, all: allFields };
  }, [state.selectedObjects]);
  
  // Filtered group by fields based on search
  const filteredGroupFields = useMemo(() => {
    if (!groupBySearchQuery) {
      return availableGroupFields;
    }
    
    const query = groupBySearchQuery.toLowerCase();
    const filterFields = (fields: typeof availableGroupFields.all) => 
      fields.filter(f => 
        f.label.toLowerCase().includes(query) ||
        f.object.toLowerCase().includes(query) ||
        f.field.toLowerCase().includes(query)
      );
    
    return {
      common: filterFields(availableGroupFields.common),
      other: filterFields(availableGroupFields.other),
      all: filterFields(availableGroupFields.all),
    };
  }, [availableGroupFields, groupBySearchQuery]);

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
              {state.groupBy ? (
                // Icon when grouping is applied
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1.3125 3.1875C1.82812 3.1875 2.25 2.76562 2.25 2.25C2.25 1.73438 1.82812 1.3125 1.3125 1.3125C0.796875 1.3125 0.375 1.73438 0.375 2.25C0.375 2.775 0.796875 3.1875 1.3125 3.1875Z" fill="currentColor"/>
                  <path d="M1.3125 6.9375C1.82812 6.9375 2.25 6.51562 2.25 6C2.25 5.48438 1.82812 5.0625 1.3125 5.0625C0.796875 5.0625 0.375 5.48438 0.375 6C0.375 6.525 0.796875 6.9375 1.3125 6.9375Z" fill="currentColor"/>
                  <path d="M1.3125 10.6875C1.82812 10.6875 2.25 10.2656 2.25 9.75C2.25 9.23438 1.82812 8.8125 1.3125 8.8125C0.796875 8.8125 0.375 9.23438 0.375 9.75C0.375 10.275 0.796875 10.6875 1.3125 10.6875Z" fill="currentColor"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M3 2.15625C3 1.79381 3.29381 1.5 3.65625 1.5H10.9688C11.3312 1.5 11.625 1.79381 11.625 2.15625C11.625 2.51869 11.3312 2.8125 10.9688 2.8125H3.65625C3.29381 2.8125 3 2.51869 3 2.15625Z" fill="currentColor"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M3 6.00073C3 5.6383 3.29381 5.34448 3.65625 5.34448H10.9688C11.3312 5.34448 11.625 5.6383 11.625 6.00073C11.625 6.36317 11.3312 6.65698 10.9688 6.65698H3.65625C3.29381 6.65698 3 6.36317 3 6.00073Z" fill="currentColor"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M3 9.84375C3 9.48131 3.29381 9.1875 3.65625 9.1875H10.9688C11.3312 9.1875 11.625 9.48131 11.625 9.84375C11.625 10.2062 11.3312 10.5 10.9688 10.5H3.65625C3.29381 10.5 3 10.2062 3 9.84375Z" fill="currentColor"/>
                </svg>
              ) : (
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
                className="absolute py-1 z-50"
                style={{
                  top: 0,
                  left: 0,
                  minWidth: '240px',
                  maxHeight: '360px',
                  backgroundColor: 'var(--bg-elevated)',
                  borderRadius: '16px',
                  boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Search bar */}
                <div style={{ padding: '12px', borderBottom: '1px solid var(--border-default)' }}>
                  <div style={{ position: 'relative' }}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                      }}
                    >
                      <path
                        d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10.5 10.5L14 14"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
              <input
                      type="text"
                      placeholder="Search fields..."
                      value={groupBySearchQuery}
                      onChange={(e) => setGroupBySearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px 8px 36px',
                        border: '1px solid var(--border-default)',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
                
                {/* Scrollable field list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                  {filteredGroupFields.all.length === 0 ? (
                    <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                      No matching fields
                    </div>
                  ) : (
                    <>
                      {/* Common section */}
                      {filteredGroupFields.common.length > 0 && (
                        <>
                          <div className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Common
                          </div>
                          {filteredGroupFields.common.map((field) => (
                            <button
                              key={`${field.object}.${field.field}`}
                              onClick={() => {
                                // Set the field and get top 10 values, then open value selector
                                const values = getGroupValues(warehouse, { object: field.object, field: field.field }, 10);
                                
                                dispatch(actions.setGroupBy({
                                  field: { object: field.object, field: field.field },
                                  selectedValues: values,
                                  autoAddedField: false,
                                }));
                                
                                // Transition to value selector
                                setIsGroupByFieldSelectorOpen(false);
                                setGroupBySearchQuery(''); // Clear search
                                setTimeout(() => setIsGroupByValueSelectorOpen(true), 100);
                              }}
                              className="w-full text-left transition-colors flex flex-col gap-1"
                              style={{
                                paddingLeft: '16px',
                                paddingRight: '16px',
                                paddingTop: '8px',
                                paddingBottom: '8px',
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
                          ))}
                        </>
                      )}
                      
                      {/* Other section */}
                      {filteredGroupFields.other.length > 0 && (
                        <>
                          <div className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {filteredGroupFields.common.length > 0 ? 'Other' : 'All Fields'}
                          </div>
                          {filteredGroupFields.other.map((field) => (
                            <button
                              key={`${field.object}.${field.field}`}
                              onClick={() => {
                                // Set the field and get top 10 values, then open value selector
                                const values = getGroupValues(warehouse, { object: field.object, field: field.field }, 10);
                                
                                dispatch(actions.setGroupBy({
                                  field: { object: field.object, field: field.field },
                                  selectedValues: values,
                                  autoAddedField: false,
                                }));
                                
                                // Transition to value selector
                                setIsGroupByFieldSelectorOpen(false);
                                setGroupBySearchQuery(''); // Clear search
                                setTimeout(() => setIsGroupByValueSelectorOpen(true), 100);
                              }}
                              className="w-full text-left transition-colors flex flex-col gap-1"
                              style={{
                                paddingLeft: '16px',
                                paddingRight: '16px',
                                paddingTop: '8px',
                                paddingBottom: '8px',
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
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Value Selector Popover */}
            {isGroupByValueSelectorOpen && state.groupBy && (
              <div
                ref={groupByPopoverRef}
                className="absolute py-1 z-50"
                style={{
                  top: 0,
                  left: 0,
                  minWidth: '240px',
                  maxHeight: '360px',
                  backgroundColor: 'var(--bg-elevated)',
                  borderRadius: '16px',
                  boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <GroupBySelector
                  availableValues={availableGroupValues}
                  selectedValues={state.groupBy.selectedValues}
                  onApply={(selectedValues) => {
                    dispatch(actions.updateGroupValues(selectedValues));
                    setIsGroupByValueSelectorOpen(false);
                  }}
                  onRemove={() => {
                    dispatch(actions.clearGroupBy());
                    setIsGroupByValueSelectorOpen(false);
                  }}
                  onCancel={() => {
                    setIsGroupByValueSelectorOpen(false);
                  }}
                  maxSelections={10}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

