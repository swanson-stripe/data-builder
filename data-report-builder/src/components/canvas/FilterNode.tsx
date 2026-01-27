'use client';

import { Handle, Position } from 'reactflow';
import { useState, useCallback, useMemo } from 'react';
import { FieldFilter } from '../FieldFilter';
import { getObject } from '@/data/schema';
import type { FilterElementData, DataListElementData } from '@/types/mapElements';
import type { FilterCondition } from '@/types';
import { useMapView, mapActions } from '@/state/mapView';
import { useApp } from '@/state/app';
import { createDataListElement, generateConnectionId } from '@/lib/mapElementCreation';
import { AddElementButton } from './AddElementButton';

interface FilterNodeProps {
  data: FilterElementData & { isSelected?: boolean; onHoverChange?: (isHovered: boolean, elementId: string) => void };
  id: string;
}

/**
 * FilterNode - Shows filter conditions with inline FilterPopover
 */
export function FilterNode({ data, id }: FilterNodeProps) {
  const { state: mapState, dispatch } = useMapView();
  const { state: appState } = useApp();
  const conditions = data.conditions || [];
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | 'new' | null>(null);
  const [selectedFieldForNew, setSelectedFieldForNew] = useState<{ object: string; field: string } | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [openMenuCount, setOpenMenuCount] = useState(0);

  // Get the parent DataList to determine available fields
  const parentDataList = useMemo(() => {
    if (!data.parentDataListId) return null;
    return mapState.elements.find(el => el.id === data.parentDataListId);
  }, [data.parentDataListId, mapState.elements]);

  // Get available fields from parent DataList or fall back to appState
  const availableFields = useMemo((): { object: string; field: string }[] => {
    // Try parent DataList first
    if (parentDataList && parentDataList.type === 'dataList') {
      const parentData = parentDataList.data as any;
      if (parentData.selectedFields && parentData.selectedFields.length > 0) {
        return parentData.selectedFields;
      }
    }
    // Fall back to appState
    if (appState.selectedFields && appState.selectedFields.length > 0) {
      return appState.selectedFields;
    }
    return [];
  }, [parentDataList, appState.selectedFields]);

  // Get the first available field for new filters
  const firstAvailableField = useMemo(() => {
    if (availableFields.length === 0) return null;
    const firstField = availableFields[0];
    const obj = getObject(firstField.object);
    return obj?.fields.find(f => f.name === firstField.field);
  }, [availableFields]);

  // Debug logs (after variables are defined) - REMOVED TO REDUCE NOISE
  // console.log('[FilterNode] parentDataListId:', data.parentDataListId);
  // console.log('[FilterNode] availableFields:', availableFields);
  // console.log('[FilterNode] firstAvailableField:', firstAvailableField);
  // console.log('[FilterNode] editingIndex:', editingIndex);
  // console.log('[FilterNode] selectedFieldForNew:', selectedFieldForNew);
  // console.log('[FilterNode] data.isSelected:', data.isSelected);

  const handleFilterChange = useCallback((index: number | 'new', condition: FilterCondition | null) => {
    let newConditions = [...conditions];

    if (condition === null) {
      // Remove condition
      if (index !== 'new') {
        newConditions.splice(index as number, 1);
      }
    } else if (index === 'new') {
      // Add new condition
      const normalizedCondition = (condition as any).field
        ? {
            ...condition,
            object: condition.field.object,
            field: condition.field.field,
          }
        : condition;
      newConditions.push(normalizedCondition);
    } else {
      // Update existing condition
      const normalizedCondition = (condition as any).field
        ? {
            ...condition,
            object: condition.field.object,
            field: condition.field.field,
          }
        : condition;
      newConditions[index as number] = normalizedCondition;
    }

    console.log('[FilterNode] Updating filter with conditions:', newConditions);

    // Update the filter element with new conditions
    dispatch(mapActions.updateElement(id, {
      data: {
        type: 'filter',
        parentDataListId: data.parentDataListId,
        conditions: newConditions,
        label: data.label,
      },
    }));

    // Create a new filtered DataList element
    if (parentDataList && parentDataList.type === 'dataList') {
      const parentData = parentDataList.data as DataListElementData;
      
      // Position the new DataList to the right of this filter
      const newDataList = createDataListElement(
        mapState.elements,
        parentData.selectedFields,
        parentData.selectedObjects
      );
      
      // Position it below this filter element
      const filterElement = mapState.elements.find(el => el.id === id);
      if (filterElement) {
        newDataList.position = {
          x: filterElement.position.x,
          y: filterElement.position.y + 300, // Place below
        };
      }

      // Add the new DataList element
      dispatch(mapActions.addElement(newDataList));

      // Create connection from this filter to the new DataList
      dispatch(mapActions.addConnection({
        id: generateConnectionId(id, newDataList.id),
        source: id,
        target: newDataList.id,
      }));
    }

    setEditingIndex(null);
    setSelectedFieldForNew(null);
  }, [conditions, data, dispatch, id, mapState.elements, parentDataList]);

  return (
    <div
      onMouseEnter={() => {
        setIsHovered(true);
        data.onHoverChange?.(true, id);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        data.onHoverChange?.(false, id);
      }}
      onClick={(e) => {
        // Stop propagation to prevent React Flow from capturing clicks
        e.stopPropagation();
      }}
      style={{
        position: 'relative',
        padding: '110px', // Extend hover area to include button + menu space
        margin: '-110px', // Offset the padding so the element position stays the same
      }}
    >
      <div
        style={{
          position: 'relative', // Add relative positioning for button placement
          minWidth: '320px',
          maxWidth: '400px',
          backgroundColor: 'var(--bg-elevated)',
          border: data.isSelected 
            ? '1px solid #675DFF' 
            : isHovered 
            ? '1px solid #b8b3ff' 
            : '1px solid var(--border-default)',
          borderRadius: '12px',
          overflow: 'visible',
          transition: 'border 0.15s ease',
          cursor: 'pointer',
        }}
      >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: 'var(--chart-line-primary)',
          width: '8px',
          height: '8px',
          border: '2px solid var(--bg-elevated)',
        }}
      />

      <div style={{ padding: '16px' }}>
        {/* Header */}
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🔍</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
              {data.label}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {conditions.length} condition{conditions.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Filter list */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {conditions.length > 0 ? (
            <div style={{ padding: '12px' }}>
              {conditions.slice(0, isExpanded ? undefined : 3).map((condition: FilterCondition, idx: number) => {
                const conditionObject = (condition as any).object ?? condition.field?.object;
                const conditionField = (condition as any).field?.field ?? (condition as any).field;
                const obj = conditionObject ? getObject(conditionObject) : undefined;
                const fieldDef = conditionField ? obj?.fields.find(f => f.name === conditionField) : undefined;

                return (
                  <div key={idx} style={{ position: 'relative', marginBottom: idx < conditions.length - 1 ? '8px' : '0' }}>
                    {editingIndex === idx && fieldDef ? (
                      <div
                        className="nodrag nowheel"
                        style={{
                          backgroundColor: 'var(--bg-elevated)',
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-default)',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        }}
                      >
                        <FieldFilter
                          field={fieldDef}
                          objectName={conditionObject}
                          currentFilter={condition}
                          onFilterChange={(newCondition) => handleFilterChange(idx, newCondition)}
                          onCancel={() => setEditingIndex(null)}
                          distinctValues={undefined}
                        />
                      </div>
                    ) : (
                      <div
                        onClick={() => setEditingIndex(idx)}
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-primary)',
                          padding: '10px 12px',
                          backgroundColor: 'var(--bg-primary)',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#675DFF';
                          e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                        }}
                      >
                        <div style={{ fontWeight: 500, marginBottom: '4px', fontFamily: 'monospace', fontSize: '11px' }}>
                          {condition.qualifiedField || (conditionObject && conditionField ? `${conditionObject}.${conditionField}` : 'Unknown field')}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <span style={{ fontWeight: 500 }}>{condition.operator || '='}</span>
                          <span>
                            {Array.isArray(condition.value) 
                              ? condition.value.slice(0, 2).join(', ') + (condition.value.length > 2 ? '...' : '')
                              : String(condition.value || 'value')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {conditions.length > 3 && !isExpanded && (
                <button
                  onClick={() => setIsExpanded(true)}
                  style={{
                    marginTop: '8px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  +{conditions.length - 3} more
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setEditingIndex('new');
                }}
                style={{
                  marginTop: '8px',
                  width: '100%',
                  padding: '8px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#675DFF';
                  e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                }}
              >
                + Add filter
              </button>

              {/* FieldFilter for adding new condition */}
              {editingIndex === 'new' && (
                <div style={{ marginTop: '12px', position: 'relative' }}>
                  {availableFields.length > 0 ? (
                    <div
                      className="nodrag nowheel"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-default)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        maxHeight: '600px',
                        overflowY: 'auto',
                      }}
                    >
                      {!selectedFieldForNew ? (
                        // Field selector
                        <div 
                          className="nodrag nowheel" 
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                        >
                          <div style={{ marginBottom: '12px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
                              Select field to filter
                            </label>
                            <select
                              className="nodrag"
                              value=""
                              onChange={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const value = e.target.value;
                                if (!value) return;
                                const parts = value.split('.');
                                if (parts.length >= 2) {
                                  const object = parts[0];
                                  const field = parts.slice(1).join('.');
                                  console.log('[FilterNode] Setting selectedFieldForNew:', { object, field });
                                  setSelectedFieldForNew({ object, field });
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                              }}
                              onFocus={(e) => {
                                e.stopPropagation();
                              }}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                fontSize: '13px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-default)',
                                backgroundColor: 'var(--bg-surface)',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                              }}
                            >
                              <option value="">Choose a field...</option>
                              {availableFields.map((field) => (
                                <option key={`${field.object}.${field.field}`} value={`${field.object}.${field.field}`}>
                                  {field.object}.{field.field}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            onClick={() => setEditingIndex(null)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border-default)',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        // Filter configuration
                        (() => {
                          const obj = getObject(selectedFieldForNew.object);
                          const fieldDef = obj?.fields.find(f => f.name === selectedFieldForNew.field);
                          console.log('[FilterNode] Rendering FieldFilter with:', {
                            object: selectedFieldForNew.object,
                            field: selectedFieldForNew.field,
                            fieldDef,
                            fieldType: fieldDef?.type,
                            fieldEnum: fieldDef?.enum,
                          });
                          return fieldDef ? (
                            <div style={{ width: '100%', minHeight: '200px' }}>
                              <FieldFilter
                                field={fieldDef}
                                objectName={selectedFieldForNew.object}
                                currentFilter={undefined}
                                onFilterChange={(newCondition) => handleFilterChange('new', newCondition)}
                                onCancel={() => {
                                  setEditingIndex(null);
                                  setSelectedFieldForNew(null);
                                }}
                                distinctValues={undefined}
                                isAddingNew={true}
                              />
                            </div>
                          ) : null;
                        })()
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '16px',
                        backgroundColor: 'var(--bg-elevated)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-default)',
                        textAlign: 'center',
                      }}
                    >
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        No fields available. Connect this filter to a DataList element.
                      </p>
                      <button
                        onClick={() => setEditingIndex(null)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-default)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '16px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  console.log('[FilterNode] Add filter condition clicked (no conditions), firstAvailableField:', firstAvailableField);
                  console.log('[FilterNode] Setting editingIndex to "new"');
                  setEditingIndex('new');
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px dashed var(--border-default)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#675DFF';
                  e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                }}
              >
                + Add filter condition
              </button>
              
              {/* FieldFilter for new condition when no conditions exist */}
              {editingIndex === 'new' && (
                <div style={{ marginTop: '12px', position: 'relative' }}>
                  {availableFields.length > 0 ? (
                    <div
                      className="nodrag nowheel"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-default)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        maxHeight: '600px',
                        overflowY: 'auto',
                      }}
                    >
                      {!selectedFieldForNew ? (
                        // Field selector
                        <div 
                          className="nodrag nowheel" 
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                        >
                          <div style={{ marginBottom: '12px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
                              Select field to filter
                            </label>
                            <select
                              className="nodrag"
                              value=""
                              onChange={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const value = e.target.value;
                                if (!value) return;
                                const parts = value.split('.');
                                if (parts.length >= 2) {
                                  const object = parts[0];
                                  const field = parts.slice(1).join('.');
                                  console.log('[FilterNode] Setting selectedFieldForNew:', { object, field });
                                  setSelectedFieldForNew({ object, field });
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                              }}
                              onFocus={(e) => {
                                e.stopPropagation();
                              }}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                fontSize: '13px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-default)',
                                backgroundColor: 'var(--bg-surface)',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                              }}
                            >
                              <option value="">Choose a field...</option>
                              {availableFields.map((field) => (
                                <option key={`${field.object}.${field.field}`} value={`${field.object}.${field.field}`}>
                                  {field.object}.{field.field}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            onClick={() => setEditingIndex(null)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border-default)',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        // Filter configuration
                        (() => {
                          const obj = getObject(selectedFieldForNew.object);
                          const fieldDef = obj?.fields.find(f => f.name === selectedFieldForNew.field);
                          console.log('[FilterNode] Rendering FieldFilter with:', {
                            object: selectedFieldForNew.object,
                            field: selectedFieldForNew.field,
                            fieldDef,
                            fieldType: fieldDef?.type,
                            fieldEnum: fieldDef?.enum,
                          });
                          return fieldDef ? (
                            <div style={{ width: '100%', minHeight: '200px' }}>
                              <FieldFilter
                                field={fieldDef}
                                objectName={selectedFieldForNew.object}
                                currentFilter={undefined}
                                onFilterChange={(newCondition) => handleFilterChange('new', newCondition)}
                                onCancel={() => {
                                  setEditingIndex(null);
                                  setSelectedFieldForNew(null);
                                }}
                                distinctValues={undefined}
                                isAddingNew={true}
                              />
                            </div>
                          ) : null;
                        })()
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '16px',
                        backgroundColor: 'var(--bg-elevated)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-default)',
                        textAlign: 'center',
                      }}
                    >
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        No fields available. Connect this filter to a DataList element.
                      </p>
                      <button
                        onClick={() => setEditingIndex(null)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-default)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: 'var(--chart-line-primary)',
          width: '8px',
          height: '8px',
          border: '2px solid var(--bg-elevated)',
        }}
      />
      
        {/* Add Element Buttons - only show on hover, when selected, or when a menu is open */}
        {(isHovered || data.isSelected || openMenuCount > 0) && (
          <>
            <AddElementButton 
              parentElementId={id} 
              position="left" 
              onHoverChange={data.onHoverChange}
              onMenuStateChange={(isOpen) => setOpenMenuCount(prev => isOpen ? prev + 1 : Math.max(0, prev - 1))}
            />
            <AddElementButton 
              parentElementId={id} 
              position="right" 
              onHoverChange={data.onHoverChange}
              onMenuStateChange={(isOpen) => setOpenMenuCount(prev => isOpen ? prev + 1 : Math.max(0, prev - 1))}
            />
            <AddElementButton 
              parentElementId={id} 
              position="bottom" 
              onHoverChange={data.onHoverChange}
              onMenuStateChange={(isOpen) => setOpenMenuCount(prev => isOpen ? prev + 1 : Math.max(0, prev - 1))}
            />
          </>
        )}
      </div>
    </div>
  );
}
