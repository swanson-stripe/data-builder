'use client';
import { MetricBlock, MetricOp, MetricType, FilterCondition, BlockResult, FieldType } from '@/types';
import { getFieldLabel } from '@/data/schema';
import { useState, useMemo, useEffect } from 'react';
import { formatValueByUnit, getUnitLabel } from '@/lib/unitTypes';
import schema from '@/data/schema';
import { FieldFilter } from './FieldFilter';
import { CustomSelect } from './CustomSelect';

type MetricBlockCardProps = {
  block: MetricBlock;
  fieldOptions: { value: string; label: string; plainName: string; object: string; field: string }[];
  onUpdate: (blockId: string, updates: Partial<MetricBlock>) => void;
  onRemove: (blockId: string) => void;
  result?: BlockResult;
  isExposed?: boolean;
  onToggleExpose?: (blockId: string) => void;
};

const metricOps: { value: MetricOp; label: string }[] = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'median', label: 'Median' },
  { value: 'mode', label: 'Mode' },
  { value: 'count', label: 'Count' },
  { value: 'distinct_count', label: 'Distinct Count' },
];

const metricTypes: { value: MetricType; label: string }[] = [
  { value: 'sum_over_period', label: 'Sum over period' },
  { value: 'average_over_period', label: 'Average over period' },
  { value: 'latest', label: 'Latest value' },
  { value: 'first', label: 'First value' },
];

// Helper function to format filter description (matches DataTab)
function formatFilterDescription(filter: FilterCondition, fieldDef: any): string {
  const { operator, value } = filter;
  
  // Check for blank/empty values
  if (value === '' || value === null || value === undefined || 
      (Array.isArray(value) && value.length === 0)) {
    return 'Filter for blank';
  }
  
  // Boolean filters
  if (fieldDef.type === 'boolean') {
    return value === true ? 'Filter for true' : 'Filter for false';
  }
  
  // Date filters
  if (fieldDef.type === 'date') {
    if (operator === 'between' && Array.isArray(value)) {
      return `Filter between dates`;
    }
    if (operator === 'less_than') return `Filter before ${value}`;
    if (operator === 'greater_than') return `Filter after ${value}`;
    return `Filter for ${value}`;
  }
  
  // Number filters
  if (fieldDef.type === 'number') {
    if (operator === 'between' && Array.isArray(value)) {
      return `Filter between ${value[0]} and ${value[1]}`;
    }
    if (operator === 'greater_than') return `Filter > ${value}`;
    if (operator === 'less_than') return `Filter < ${value}`;
    if (operator === 'not_equals') return `Filter ≠ ${value}`;
    return `Filter for ${value}`;
  }
  
  // String/ID/Enum filters
  if (Array.isArray(value)) {
    // Multiple values selected
    if (value.length === 1) {
      return `Filter for ${value[0]}`;
    }
    return `Filter for ${value.length} values`;
  }
  
  // Single value
  if (typeof value === 'string') {
    // Truncate long strings
    const displayValue = value.length > 20 ? `${value.substring(0, 20)}...` : value;
    return `Filter for ${displayValue}`;
  }
  
  return 'Filter';
}

export function MetricBlockCard({
  block,
  fieldOptions,
  onUpdate,
  onRemove,
  result,
  isExposed,
  onToggleExpose,
}: MetricBlockCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [selectedFilterFieldName, setSelectedFilterFieldName] = useState<string>('');
  
  const currentSourceValue = block.source ? `${block.source.object}.${block.source.field}` : '';
  
  const handleSourceChange = (value: string) => {
    if (!value) {
      onUpdate(block.id, { source: undefined });
      return;
    }
    
    const selected = fieldOptions.find(opt => opt.value === value);
    if (selected) {
      onUpdate(block.id, {
        source: {
          object: selected.object,
          field: selected.field,
        },
      });
    }
  };
  
  // Get all fields from selected objects for filter options
  const availableFilterFields = useMemo(() => {
    const fields: Array<{ name: string; label: string; type: FieldType; object: string; objectLabel: string; enum?: string[] }> = [];
    
    // Get all fields from fieldOptions (which come from selectedFields in the parent)
    fieldOptions.forEach(option => {
      const schemaObj = schema.objects.find(o => o.name === option.object);
      const field = schemaObj?.fields.find(f => f.name === option.field);
      
      if (field) {
        fields.push({
          name: field.name,
          label: field.label || field.name,
          type: field.type as FieldType,
          object: option.object,
          objectLabel: schemaObj?.label || option.object,
          enum: field.enum, // Include enum values for fields that have them
        });
      }
    });
    
    return fields;
  }, [fieldOptions]);
  
  // Handler to update block filters
  const handleFilterChange = (condition: FilterCondition | null) => {
    if (condition) {
      onUpdate(block.id, { filters: [condition] });
    } else {
      onUpdate(block.id, { filters: [] });
    }
    setIsFilterExpanded(false);
  };
  
  // Get current filter (only one allowed per block)
  const currentFilter = block.filters.length > 0 ? block.filters[0] : undefined;
  
  // Initialize selectedFilterFieldName when expanding a filter
  useEffect(() => {
    if (isFilterExpanded) {
      if (currentFilter) {
        // Editing existing filter - use its qualified field name (object.field)
        setSelectedFilterFieldName(`${currentFilter.field.object}.${currentFilter.field.field}`);
      } else if (availableFilterFields.length > 0) {
        // Adding new filter - default to first field
        setSelectedFilterFieldName(`${availableFilterFields[0].object}.${availableFilterFields[0].name}`);
      }
    }
  }, [isFilterExpanded, currentFilter, availableFilterFields]);
  
  return (
    <div
      style={{
        border: '1px solid var(--border-default)',
        borderRadius: '10px',
        padding: '12px',
        backgroundColor: 'var(--bg-primary)',
        marginBottom: '8px',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center flex-1" style={{ gap: '4px', minWidth: 0 }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex-shrink-0"
            style={{ cursor: 'pointer' }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            >
              <path d="M4 2L8 6L4 10" stroke="var(--text-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <input
            type="text"
            value={block.name}
            onChange={(e) => onUpdate(block.id, { name: e.target.value })}
            className="text-sm font-medium outline-none flex-1"
            style={{ 
              color: 'var(--text-primary)', 
              backgroundColor: 'transparent',
              paddingTop: '4px',
              paddingBottom: '4px',
              paddingLeft: '4px',
              paddingRight: '4px',
              borderRadius: '4px',
              border: 'none',
              transition: 'background-color 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              if (document.activeElement !== e.currentTarget) {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (document.activeElement !== e.currentTarget) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            onFocus={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              e.currentTarget.style.boxShadow = 'inset 0 0 0 1px #675DFF';
            }}
            onBlur={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.boxShadow = 'none';
            }}
            placeholder="Block name"
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onRemove(block.id)}
            className="p-1 rounded transition-colors"
            style={{ cursor: 'pointer' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Remove block"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5.5 3V2.5C5.5 1.67157 6.17157 1 7 1H9C9.82843 1 10.5 1.67157 10.5 2.5V3M2 3H14M12.5 3V13C12.5 13.8284 11.8284 14.5 11 14.5H5C4.17157 14.5 3.5 13.8284 3.5 13V3M6.5 6.5V11M9.5 6.5V11" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      
      {/* Collapsed content */}
      {isExpanded && (
        <div className="space-y-3 mt-3">
          {/* Source Field */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)', paddingLeft: '12px' }}>
              Source field
            </label>
            <div style={{ paddingLeft: '8px' }}>
              <CustomSelect
                value={currentSourceValue}
                onChange={handleSourceChange}
                options={[
                  { value: '', label: '— Select a field —', schemaName: '' },
                  ...fieldOptions.map((option) => ({
                    value: option.value,
                    label: option.plainName,
                    schemaName: option.value,
                  })),
                ]}
                disabled={fieldOptions.length === 0}
                placeholder="— Select a field —"
                showSchemaName={true}
              />
            </div>
          </div>
          
          {/* Operation */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)', paddingLeft: '12px' }}>
              Operation
            </label>
            <div style={{ paddingLeft: '8px' }}>
              <CustomSelect
                value={block.op}
                onChange={(value) => onUpdate(block.id, { op: value as MetricOp })}
                options={metricOps}
              />
            </div>
          </div>
          
          {/* Aggregation Type */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)', paddingLeft: '12px' }}>
              Aggregation basis
            </label>
            <div style={{ paddingLeft: '8px' }}>
              <CustomSelect
                value={block.type}
                onChange={(value) => onUpdate(block.id, { type: value as MetricType })}
                options={metricTypes}
              />
            </div>
          </div>
          
          {/* Filters */}
          <div style={{ paddingLeft: '8px' }}>
            {availableFilterFields.length === 0 && (
              <div className="text-xs" style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                Select fields in the Data tab to add filters
              </div>
            )}
            
            {availableFilterFields.length > 0 && !currentFilter && !isFilterExpanded && (
              <button
                onClick={() => setIsFilterExpanded(true)}
                className="filter-add-button"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '14px',
                  fontWeight: 300,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background-color 0.2s',
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
                Add filter
              </button>
            )}
            
            {availableFilterFields.length > 0 && currentFilter && !isFilterExpanded && (
              <div
                onClick={() => setIsFilterExpanded(true)}
                className="filter-chip"
                style={{
                  backgroundColor: 'var(--data-chip-filter-bg)',
                  border: '2px solid var(--data-chip-filter-border)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  color: 'var(--data-chip-filter-text)',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--data-chip-field-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--data-chip-filter-border)';
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect x="1" y="3" width="14" height="1.5" rx="0.75" fill="var(--data-chip-filter-icon)"/>
                  <rect x="3" y="7" width="10" height="1.5" rx="0.75" fill="var(--data-chip-filter-icon)"/>
                  <rect x="5" y="11" width="6" height="1.5" rx="0.75" fill="var(--data-chip-filter-icon)"/>
                </svg>
                <span>
                  {(() => {
                    const fieldDef = availableFilterFields.find(f => 
                      f.object === currentFilter.field.object && f.name === currentFilter.field.field
                    );
                    return fieldDef ? formatFilterDescription(currentFilter, fieldDef) : 'Filter';
                  })()}
                </span>
              </div>
            )}
            
            {isFilterExpanded && availableFilterFields.length > 0 && (
              <div 
                style={{ 
                  marginTop: '8px',
                  backgroundColor: 'var(--data-chip-filter-bg)',
                  border: '1px solid var(--data-chip-filter-border)',
                  borderRadius: '16px',
                  padding: '12px',
                }}
              >
                {/* Field Selector */}
                <div style={{ marginBottom: '12px' }}>
                  <label 
                    htmlFor="field-to-filter"
                    className="block text-xs font-medium mb-1"
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                  >
                    Field to filter
                  </label>
                  <CustomSelect
                    value={selectedFilterFieldName}
                    onChange={(value) => setSelectedFilterFieldName(value)}
                    options={availableFilterFields.map((field) => ({
                      value: `${field.object}.${field.name}`,
                      label: `${field.label} (${field.objectLabel})`,
                    }))}
                    hoverBackgroundColor="white"
                  />
                </div>
                
                {/* Filter Configuration */}
                {selectedFilterFieldName && (
                  <FieldFilter
                    field={(() => {
                      const [objectName, fieldName] = selectedFilterFieldName.split('.');
                      const filterField = availableFilterFields.find(f => f.object === objectName && f.name === fieldName);
                      return filterField || availableFilterFields[0];
                    })()}
                    objectName={selectedFilterFieldName.split('.')[0]}
                    currentFilter={currentFilter && `${currentFilter.field.object}.${currentFilter.field.field}` === selectedFilterFieldName ? currentFilter : undefined}
                    onFilterChange={handleFilterChange}
                    distinctValues={undefined}
                    onCancel={() => setIsFilterExpanded(false)}
                    isAddingNew={!currentFilter || `${currentFilter.field.object}.${currentFilter.field.field}` !== selectedFilterFieldName}
                  />
                )}
              </div>
            )}
          </div>
          
          {/* Value, Unit Type, and Toggle at bottom */}
          {result && result.value !== null && result.unitType && (
            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-default)' }}>
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
                    {formatValueByUnit(result.value, result.unitType)}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
                    ({getUnitLabel(result.unitType)})
                  </span>
                </div>
                
                {/* Display toggle */}
                {onToggleExpose && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleExpose(block.id)}
                      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                      style={{
                        backgroundColor: isExposed ? '#675DFF' : 'var(--bg-surface)',
                      }}
                    >
                      <span
                        className="inline-block h-3 w-3 transform rounded-full bg-white transition-transform"
                        style={{
                          transform: isExposed ? 'translateX(1.375rem)' : 'translateX(0.375rem)',
                        }}
                      />
                    </button>
                    <label className="text-xs" style={{ color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => onToggleExpose && onToggleExpose(block.id)}>
                      Display this value
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

