'use client';

import { Handle, Position } from 'reactflow';
import { useState, useCallback, useMemo } from 'react';
import { FieldFilter } from '../FieldFilter';
import { getObject } from '@/data/schema';
import type { FilterElementData } from '@/types/mapElements';
import type { FilterCondition } from '@/types';
import { useMapView, mapActions } from '@/state/mapView';
import { useApp } from '@/state/app';

interface FilterNodeProps {
  data: FilterElementData & { isSelected?: boolean };
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

  // Get the parent DataList to determine available fields
  const parentDataList = useMemo(() => {
    if (!data.parentDataListId) return null;
    return mapState.elements.find(el => el.id === data.parentDataListId);
  }, [data.parentDataListId, mapState.elements]);

  // Get available fields from parent DataList or fall back to appState
  const availableFields = useMemo(() => {
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

  // Debug logs (after variables are defined)
  console.log('[FilterNode] parentDataListId:', data.parentDataListId);
  console.log('[FilterNode] availableFields:', availableFields);
  console.log('[FilterNode] firstAvailableField:', firstAvailableField);
  console.log('[FilterNode] editingIndex:', editingIndex);
  console.log('[FilterNode] selectedFieldForNew:', selectedFieldForNew);
  console.log('[FilterNode] data.isSelected:', data.isSelected);

  const handleFilterChange = useCallback((index: number | 'new', condition: FilterCondition | null) => {
    let newConditions = [...conditions];

    if (condition === null) {
      // Remove condition
      if (index !== 'new') {
        newConditions.splice(index as number, 1);
      }
    } else if (index === 'new') {
      // Add new condition
      newConditions.push(condition);
    } else {
      // Update existing condition
      newConditions[index as number] = condition;
    }

    // Update the element in mapState
    dispatch(mapActions.updateElement({
      id,
      data: {
        ...data,
        conditions: newConditions,
      },
    }));

    setEditingIndex(null);
    setSelectedFieldForNew(null);
  }, [conditions, data, dispatch, id]);

  return (
    <div
      onClick={(e) => {
        // Stop propagation to prevent React Flow from capturing clicks
        e.stopPropagation();
      }}
      style={{
        minWidth: '320px',
        maxWidth: '400px',
        backgroundColor: 'var(--bg-elevated)',
        border: data.isSelected ? '2px solid #675DFF' : '1px solid var(--border-default)',
        borderRadius: '12px',
        overflow: 'visible',
        position: 'relative',
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
                const obj = getObject(condition.object);
                const fieldDef = obj?.fields.find(f => f.name === condition.field);

                return (
                  <div key={idx} style={{ position: 'relative', marginBottom: idx < conditions.length - 1 ? '8px' : '0' }}>
                    {editingIndex === idx && fieldDef ? (
                      <div
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
                          objectName={condition.object}
                          currentFilter={condition}
                          onFilterChange={(newCondition) => handleFilterChange(idx, newCondition)}
                          onCancel={() => setEditingIndex(null)}
                          distinctValues={[]}
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
                          {condition.qualifiedField || `${condition.object}.${condition.field}`}
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
                  console.log('[FilterNode] Add filter clicked, firstAvailableField:', firstAvailableField);
                  console.log('[FilterNode] Setting editingIndex to "new"');
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
                              value={selectedFieldForNew ? `${selectedFieldForNew.object}.${selectedFieldForNew.field}` : ''}
                              onChange={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const value = e.target.value;
                                console.log('[FilterNode] Select onChange, value:', value);
                                if (!value) return;
                                const parts = value.split('.');
                                if (parts.length >= 2) {
                                  const object = parts[0];
                                  const field = parts.slice(1).join('.');
                                  console.log('[FilterNode] Field selected:', { object, field });
                                  setSelectedFieldForNew({ object, field });
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('[FilterNode] Select clicked');
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                console.log('[FilterNode] Select mousedown');
                              }}
                              onFocus={(e) => {
                                e.stopPropagation();
                                console.log('[FilterNode] Select focused');
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
                          return fieldDef ? (
                            <FieldFilter
                              field={fieldDef}
                              objectName={selectedFieldForNew.object}
                              currentFilter={null}
                              onFilterChange={(newCondition) => handleFilterChange('new', newCondition)}
                              onCancel={() => {
                                setEditingIndex(null);
                                setSelectedFieldForNew(null);
                              }}
                              distinctValues={[]}
                              isAddingNew={true}
                            />
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
                              value={selectedFieldForNew ? `${selectedFieldForNew.object}.${selectedFieldForNew.field}` : ''}
                              onChange={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const value = e.target.value;
                                console.log('[FilterNode] Select onChange, value:', value);
                                if (!value) return;
                                const parts = value.split('.');
                                if (parts.length >= 2) {
                                  const object = parts[0];
                                  const field = parts.slice(1).join('.');
                                  console.log('[FilterNode] Field selected:', { object, field });
                                  setSelectedFieldForNew({ object, field });
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('[FilterNode] Select clicked');
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                console.log('[FilterNode] Select mousedown');
                              }}
                              onFocus={(e) => {
                                e.stopPropagation();
                                console.log('[FilterNode] Select focused');
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
                          return fieldDef ? (
                            <FieldFilter
                              field={fieldDef}
                              objectName={selectedFieldForNew.object}
                              currentFilter={null}
                              onFilterChange={(newCondition) => handleFilterChange('new', newCondition)}
                              onCancel={() => {
                                setEditingIndex(null);
                                setSelectedFieldForNew(null);
                              }}
                              distinctValues={[]}
                              isAddingNew={true}
                            />
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
    </div>
  );
}
