'use client';
import { MetricBlock, MetricOp, MetricType, FilterCondition, BlockResult } from '@/types';
import { getFieldLabel } from '@/data/schema';
import { useState, useMemo, useEffect } from 'react';
import { formatValueByUnit, getUnitLabel } from '@/lib/unitTypes';
import schema from '@/data/schema';
import { FieldFilter } from './FieldFilter';

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

// Helper function to format filter summary
function formatFilterSummary(filter: FilterCondition): string {
  const { field, operator, value } = filter;
  const fieldName = `${field.object}.${field.field}`;
  
  if (operator === 'in' && Array.isArray(value)) {
    return `${fieldName} in [${value.map(v => `'${v}'`).join(', ')}]`;
  }
  if (operator === 'between' && Array.isArray(value)) {
    return `${fieldName} between ${value[0]} and ${value[1]}`;
  }
  if (operator === 'is_true' || operator === 'is_false') {
    return `${fieldName} is ${operator === 'is_true' ? 'true' : 'false'}`;
  }
  return `${fieldName} ${operator} ${value}`;
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
  
  // Get source object fields for filter options
  const sourceObjectFields = useMemo(() => {
    if (!block.source) return [];
    const schemaObj = schema.objects.find(o => o.name === block.source!.object);
    return schemaObj?.fields || [];
  }, [block.source]);
  
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
        // Editing existing filter - use its field
        setSelectedFilterFieldName(currentFilter.field.field);
      } else if (sourceObjectFields.length > 0) {
        // Adding new filter - default to first field
        setSelectedFilterFieldName(sourceObjectFields[0].name);
      }
    }
  }, [isFilterExpanded, currentFilter, sourceObjectFields]);
  
  return (
    <div
      style={{
        border: '1px solid var(--border-default)',
        borderRadius: '8px',
        padding: '12px',
        backgroundColor: 'var(--bg-primary)',
        marginBottom: '8px',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
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
            className="text-sm font-medium bg-transparent border-none outline-none"
            style={{ color: 'var(--text-primary)', minWidth: '150px' }}
            placeholder="Block name"
          />
          {result && result.value !== null && result.unitType && (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              → {formatValueByUnit(result.value, result.unitType)} <span style={{ opacity: 0.6 }}>({getUnitLabel(result.unitType)})</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onToggleExpose && (
            <button
              onClick={() => onToggleExpose(block.id)}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{
                backgroundColor: isExposed ? '#675DFF' : 'var(--bg-surface)',
                color: isExposed ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              title={isExposed ? 'Hide intermediate value' : 'Show intermediate value'}
            >
              {isExposed ? 'Exposed' : 'Hidden'}
            </button>
          )}
          <button
            onClick={() => onRemove(block.id)}
            className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            style={{ cursor: 'pointer' }}
            title="Remove block"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Collapsed content */}
      {isExpanded && (
        <div className="space-y-3 mt-3">
          {/* Source Field */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Source Field
            </label>
            <select
              value={currentSourceValue}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none"
              style={{
                borderColor: 'var(--border-default)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#675DFF'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border-default)'; }}
              disabled={fieldOptions.length === 0}
            >
              <option value="">— Select a field —</option>
              {fieldOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.plainName}
                </option>
              ))}
            </select>
          </div>
          
          {/* Operation */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Operation
            </label>
            <select
              value={block.op}
              onChange={(e) => onUpdate(block.id, { op: e.target.value as MetricOp })}
              className="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none"
              style={{
                borderColor: 'var(--border-default)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#675DFF'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border-default)'; }}
            >
              {metricOps.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Aggregation Type */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Aggregation Basis
            </label>
            <select
              value={block.type}
              onChange={(e) => onUpdate(block.id, { type: e.target.value as MetricType })}
              className="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none"
              style={{
                borderColor: 'var(--border-default)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#675DFF'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border-default)'; }}
            >
              {metricTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Filters */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Filter
            </label>
            
            {!block.source && (
              <div className="text-xs" style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                Select a source field to add filters
              </div>
            )}
            
            {block.source && !currentFilter && !isFilterExpanded && (
              <button
                onClick={() => setIsFilterExpanded(true)}
                className="filter-add-button"
                style={{
                  backgroundColor: 'white',
                  color: '#596171',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '14px',
                  fontWeight: 300,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f5f6f8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1V13M1 7H13" stroke="#596171" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Add filter
              </button>
            )}
            
            {block.source && currentFilter && !isFilterExpanded && (
              <div
                onClick={() => setIsFilterExpanded(true)}
                className="filter-chip"
                style={{
                  backgroundColor: '#E2FBFE',
                  border: '2px solid #6DC9FC',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  color: '#045AD0',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#0072E9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#6DC9FC';
                }}
              >
                <span>{formatFilterSummary(currentFilter)}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFilterChange(null);
                  }}
                  style={{
                    marginLeft: '8px',
                    cursor: 'pointer',
                    backgroundColor: 'transparent',
                    border: 'none',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Remove filter"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 3L11 11M11 3L3 11" stroke="#045AD0" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}
            
            {block.source && isFilterExpanded && sourceObjectFields.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                {/* Field Selector */}
                <div style={{ marginBottom: '12px' }}>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Field to filter
                  </label>
                  <select
                    value={selectedFilterFieldName}
                    onChange={(e) => setSelectedFilterFieldName(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none"
                    style={{
                      borderColor: 'var(--border-default)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      borderRadius: '8px',
                      paddingLeft: '12px',
                      paddingRight: '12px',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = '#675DFF'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border-default)'; }}
                  >
                    {sourceObjectFields.map((field) => (
                      <option key={field.name} value={field.name}>
                        {field.label || field.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Filter Configuration */}
                {selectedFilterFieldName && (
                  <FieldFilter
                    field={sourceObjectFields.find(f => f.name === selectedFilterFieldName) || sourceObjectFields[0]}
                    objectName={block.source.object}
                    currentFilter={currentFilter?.field.field === selectedFilterFieldName ? currentFilter : undefined}
                    onFilterChange={handleFilterChange}
                    distinctValues={undefined}
                    onCancel={() => setIsFilterExpanded(false)}
                    isAddingNew={!currentFilter || currentFilter.field.field !== selectedFilterFieldName}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

