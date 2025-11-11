'use client';
import { useState, useEffect } from 'react';
import { SchemaField } from '@/types';
import { FilterCondition, FilterOperator } from '@/types';

type FieldFilterProps = {
  field: SchemaField;
  objectName: string;
  currentFilter?: FilterCondition;
  onFilterChange: (condition: FilterCondition | null) => void;
  distinctValues?: string[]; // Dynamic distinct values from actual data
  onCancel?: () => void;
  isAddingNew?: boolean; // Indicates we're adding a new filter, not editing existing
};

export function FieldFilter({
  field,
  objectName,
  currentFilter,
  onFilterChange,
  distinctValues,
  onCancel,
  isAddingNew = false,
}: FieldFilterProps) {
  // Initialize state from currentFilter if it exists
  const [filterType, setFilterType] = useState<'include' | 'exclude'>('include');
  const [operator, setOperator] = useState<FilterOperator>(
    currentFilter?.operator || getDefaultOperator(field)
  );
  const [value, setValue] = useState<string>(
    currentFilter ? formatValue(currentFilter.value) : ''
  );
  const [betweenMin, setBetweenMin] = useState<string>(
    currentFilter?.operator === 'between' && Array.isArray(currentFilter.value)
      ? String(currentFilter.value[0])
      : ''
  );
  const [betweenMax, setBetweenMax] = useState<string>(
    currentFilter?.operator === 'between' && Array.isArray(currentFilter.value)
      ? String(currentFilter.value[1])
      : ''
  );
  const [selectedEnumValues, setSelectedEnumValues] = useState<string[]>(() => {
    if (!currentFilter) return [];
    if (currentFilter.operator === 'in' && Array.isArray(currentFilter.value) && currentFilter.value.every(v => typeof v === 'string')) {
      return currentFilter.value as string[];
    }
    if (field.enum && typeof currentFilter.value === 'string') {
      return [currentFilter.value];
    }
    return [];
  });

  // Sync state with currentFilter prop when it changes
  useEffect(() => {
    if (currentFilter) {
      setOperator(currentFilter.operator);
      setValue(formatValue(currentFilter.value));
      
      if (currentFilter.operator === 'between' && Array.isArray(currentFilter.value)) {
        setBetweenMin(String(currentFilter.value[0]));
        setBetweenMax(String(currentFilter.value[1]));
      } else {
        setBetweenMin('');
        setBetweenMax('');
      }
      
      // Handle enum values - support both 'in' operator with array and 'equals' with single value
      if (field.enum) {
        if (currentFilter.operator === 'in' && Array.isArray(currentFilter.value)) {
          setSelectedEnumValues(currentFilter.value as string[]);
        } else if (currentFilter.operator === 'equals' && typeof currentFilter.value === 'string') {
          setSelectedEnumValues([currentFilter.value]);
        } else if (typeof currentFilter.value === 'string') {
          // Handle any other operator with string value for enum fields
          setSelectedEnumValues([currentFilter.value]);
        } else {
          setSelectedEnumValues([]);
        }
      } else {
        setSelectedEnumValues([]);
      }
    } else {
      // Reset to defaults when no filter
      setOperator(getDefaultOperator(field));
      setValue('');
      setBetweenMin('');
      setBetweenMax('');
      setSelectedEnumValues([]);
    }
  }, [currentFilter, field]);

  // Handle operator change
  const handleOperatorChange = (newOp: FilterOperator) => {
    setOperator(newOp);
    // Reset values when operator changes
    setValue('');
    setBetweenMin('');
    setBetweenMax('');
  };

  // Handle apply filter
  const handleApply = () => {
    let filterValue: string | number | boolean | string[] | [number, number] | [string, string];

    // Build value based on field type and operator
    if (field.type === 'boolean') {
      filterValue = operator === 'is_true';
    } else if (field.type === 'date') {
      if (operator === 'between') {
        if (!betweenMin || !betweenMax) return;
        filterValue = [betweenMin, betweenMax];
      } else {
        if (!value.trim()) return;
        filterValue = value;
      }
    } else if (field.type === 'number') {
      if (operator === 'between') {
        const min = parseFloat(betweenMin);
        const max = parseFloat(betweenMax);
        if (isNaN(min) || isNaN(max)) return;
        filterValue = [min, max];
      } else {
        const num = parseFloat(value);
        if (isNaN(num)) return;
        filterValue = num;
      }
    } else if (field.enum) {
      // Categorical string - use 'in' operator with selected values
      if (selectedEnumValues.length === 0) return;
      filterValue = selectedEnumValues;
    } else if (field.type === 'string' || field.type === 'id') {
      // Non-categorical string or ID - support comma-separated values
      if (!value.trim()) return;
      const values = value.split(',').map(v => v.trim()).filter(v => v);
      if (values.length === 0) return;
      filterValue = values.length === 1 ? values[0] : values;
    } else {
      return;
    }

    const condition: FilterCondition = {
      field: { object: objectName, field: field.name },
      operator: field.enum ? 'in' : operator,
      value: filterValue,
    };

    onFilterChange(condition);
  };

  // Handle clear filter
  const handleClear = () => {
    onFilterChange(null);
    setValue('');
    setBetweenMin('');
    setBetweenMax('');
    setSelectedEnumValues([]);
  };

  // Render Filter Type selector component
  const renderFilterTypeSelector = () => (
    <div className="space-y-2">
      <label 
        htmlFor="filter-type" 
        style={{ 
          fontSize: '14px', 
          fontWeight: 600, 
          color: 'var(--text-primary)',
          display: 'block'
        }}
      >
        Filter type
      </label>
      <div style={{ position: 'relative' }}>
        <select
          id="filter-type"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as 'include' | 'exclude')}
          style={{
            width: '100%',
            height: '40px',
            paddingLeft: '12px',
            paddingRight: '36px',
            fontSize: '14px',
            fontWeight: 400,
            color: 'var(--text-primary)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px',
            appearance: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="include">Include</option>
          <option value="exclude">Exclude</option>
        </select>
        <svg
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none'
          }}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );

  // Render based on field type
  if (field.type === 'boolean') {
    return (
      <div className="mb-2">
        <div className="space-y-4">
          {renderFilterTypeSelector()}
          
          <div style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-primary)' }}>
            Apply a filter
          </div>
          <div className="flex gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={operator === 'is_true'}
                onChange={() => setOperator('is_true')}
              />
              <span className="text-sm">True</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={operator === 'is_false'}
                onChange={() => setOperator('is_false')}
              />
              <span className="text-sm">False</span>
            </label>
          </div>
          <div className="flex gap-2">
            {currentFilter ? (
              <>
                <button
                  onClick={handleClear}
                  className="flex-1 text-sm font-semibold transition-colors"
                  style={{ 
                    backgroundColor: 'var(--bg-surface)',
                    border: 'none',
                    borderRadius: '6px',
                    height: '28px',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                >
                  Clear
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 text-sm text-white font-semibold border transition-colors"
                  style={{ 
                    backgroundColor: 'var(--button-primary-bg)', 
                    borderColor: 'var(--button-primary-border)', 
                    borderRadius: '6px',
                    height: '28px',
                    fontSize: '14px'
                  }}
                >
                  Apply
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onCancel}
                  className="flex-1 text-sm font-semibold transition-colors"
                  style={{ 
                    backgroundColor: 'var(--bg-surface)',
                    border: 'none',
                    borderRadius: '6px',
                    height: '28px',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 text-sm text-white font-semibold border transition-colors"
                  style={{ 
                    backgroundColor: 'var(--button-primary-bg)', 
                    borderColor: 'var(--button-primary-border)', 
                    borderRadius: '6px',
                    height: '28px',
                    fontSize: '14px'
                  }}
                >
                  Apply
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (field.type === 'date') {
    return (
      <div className="mb-2">
        <div className="space-y-4">
          {renderFilterTypeSelector()}
          
          <div style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-primary)' }}>
            Apply a filter
          </div>
          <select
            value={operator}
            onChange={(e) => handleOperatorChange(e.target.value as FilterOperator)}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#675DFF]"
            style={{ borderRadius: '8px' }}
          >
            <option value="equals">On</option>
            <option value="less_than">Before</option>
            <option value="greater_than">After</option>
            <option value="between">Between</option>
          </select>

          {operator === 'between' ? (
            <div className="flex gap-2">
              <input
                type="date"
                value={betweenMin}
                onChange={(e) => setBetweenMin(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#675DFF]"
                style={{ borderRadius: '8px' }}
              />
              <input
                type="date"
                value={betweenMax}
                onChange={(e) => setBetweenMax(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#675DFF]"
                style={{ borderRadius: '8px' }}
              />
            </div>
          ) : (
            <input
              type="date"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#675DFF]"
              style={{ borderRadius: '8px' }}
            />
          )}

          <div className="flex gap-2" style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '12px' }}>
            {currentFilter ? (
              <>
                <button
                  onClick={handleClear}
                  className="flex-1 text-sm font-semibold transition-colors"
                  style={{ 
                    backgroundColor: 'var(--bg-surface)',
                    border: 'none',
                    borderRadius: '6px',
                    height: '28px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 text-sm text-white font-semibold border transition-colors"
                  style={{ 
                    backgroundColor: 'var(--button-primary-bg)', 
                    borderColor: 'var(--button-primary-border)', 
                    borderRadius: '6px',
                    height: '28px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Apply
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onCancel}
                  className="flex-1 text-sm font-semibold transition-colors"
                  style={{ 
                    backgroundColor: 'var(--bg-surface)',
                    border: 'none',
                    borderRadius: '6px',
                    height: '28px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 text-sm text-white font-semibold border transition-colors"
                  style={{ 
                    backgroundColor: 'var(--button-primary-bg)', 
                    borderColor: 'var(--button-primary-border)', 
                    borderRadius: '6px',
                    height: '28px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Apply
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <div className="mb-2">
        <div className="space-y-4">
          {renderFilterTypeSelector()}
          
          <div style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-primary)' }}>
            Apply a filter
          </div>
          <select
            value={operator}
            onChange={(e) => handleOperatorChange(e.target.value as FilterOperator)}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#675DFF]"
            style={{ borderRadius: '8px' }}
          >
            <option value="equals">Equals</option>
            <option value="not_equals">Not Equals</option>
            <option value="greater_than">Greater Than</option>
            <option value="less_than">Less Than</option>
            <option value="between">Between</option>
          </select>

          {operator === 'between' ? (
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min"
                value={betweenMin}
                onChange={(e) => setBetweenMin(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#675DFF]"
                style={{ borderRadius: '8px' }}
              />
              <input
                type="number"
                placeholder="Max"
                value={betweenMax}
                onChange={(e) => setBetweenMax(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#675DFF]"
                style={{ borderRadius: '8px' }}
              />
            </div>
          ) : (
            <input
              type="number"
              placeholder="Value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#675DFF]"
              style={{ borderRadius: '8px' }}
            />
          )}

          <div className="flex gap-2">
            {currentFilter ? (
              <>
                <button
                  onClick={handleClear}
                  className="flex-1 text-sm font-semibold transition-colors"
                  style={{ 
                    backgroundColor: 'var(--bg-surface)',
                    border: 'none',
                    borderRadius: '6px',
                    height: '28px',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                >
                  Clear
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 text-sm text-white font-semibold border transition-colors"
                  style={{ 
                    backgroundColor: 'var(--button-primary-bg)', 
                    borderColor: 'var(--button-primary-border)', 
                    borderRadius: '6px',
                    height: '28px',
                    fontSize: '14px'
                  }}
                >
                  Apply
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onCancel}
                  className="flex-1 text-sm font-semibold transition-colors"
                  style={{ 
                    backgroundColor: 'var(--bg-surface)',
                    border: 'none',
                    borderRadius: '6px',
                    height: '28px',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 text-sm text-white font-semibold border transition-colors"
                  style={{ 
                    backgroundColor: 'var(--button-primary-bg)', 
                    borderColor: 'var(--button-primary-border)', 
                    borderRadius: '6px',
                    height: '28px',
                    fontSize: '14px'
                  }}
                >
                  Apply
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Use distinctValues if provided, otherwise fall back to schema enum
  const enumValues = distinctValues || field.enum;
  
  if (enumValues) {
    // Categorical string with multi-select
    const handleToggleEnum = (enumValue: string) => {
      setSelectedEnumValues(prev => 
        prev.includes(enumValue)
          ? prev.filter(v => v !== enumValue)
          : [...prev, enumValue]
      );
    };

    return (
      <div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ paddingLeft: '16px', paddingRight: '16px', marginBottom: '12px' }}>
            {renderFilterTypeSelector()}
          </div>
          
          <div style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-primary)', paddingLeft: '16px', paddingRight: '16px', marginBottom: '8px' }}>
            Apply a filter
          </div>
          <div>
            {enumValues.map(enumValue => (
              <label
                key={enumValue}
                className="flex items-center cursor-pointer transition-colors"
                style={{
                  paddingLeft: '16px',
                  paddingRight: '16px',
                  height: '32px',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  fontWeight: 400
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <input
                  type="checkbox"
                  checked={selectedEnumValues.includes(enumValue)}
                  onChange={() => handleToggleEnum(enumValue)}
                  style={{ marginRight: '8px' }}
                />
                <span className="text-sm">{enumValue}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-2" style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '12px' }}>
            {currentFilter ? (
              <>
                <button
                  onClick={handleClear}
                  className="flex-1 text-sm font-semibold transition-colors"
                  style={{ 
                    backgroundColor: 'var(--bg-surface)',
                    border: 'none',
                    borderRadius: '6px',
                    height: '32px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 text-sm text-white font-semibold border transition-colors"
                  style={{ 
                    backgroundColor: 'var(--button-primary-bg)', 
                    borderColor: 'var(--button-primary-border)', 
                    borderRadius: '6px',
                    height: '32px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Apply
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onCancel}
                  className="flex-1 text-sm font-semibold transition-colors"
                  style={{ 
                    backgroundColor: 'var(--bg-surface)',
                    border: 'none',
                    borderRadius: '6px',
                    height: '32px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 text-sm text-white font-semibold border transition-colors"
                  style={{ 
                    backgroundColor: 'var(--button-primary-bg)', 
                    borderColor: 'var(--button-primary-border)', 
                    borderRadius: '6px',
                    height: '32px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Apply
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // String or ID fields - single text input with comma-separated support
  return (
    <div className="mb-2">
      <div className="space-y-4">
        {renderFilterTypeSelector()}
        
        <div style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-primary)' }}>
          Apply a filter
        </div>
        <input
          type="text"
          placeholder={field.type === 'id' ? 'Enter IDs (comma-separated)' : 'Contains text...'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#675DFF]"
          style={{ borderRadius: '8px' }}
        />

        <div className="flex gap-2">
          {currentFilter ? (
            <>
              <button
                onClick={handleClear}
                className="flex-1 text-sm font-semibold transition-colors"
                style={{ 
                  backgroundColor: 'var(--bg-surface)',
                  border: 'none',
                  borderRadius: '6px',
                  height: '28px',
                  color: 'var(--text-primary)',
                  fontSize: '14px'
                }}
              >
                Clear
              </button>
              <button
                onClick={handleApply}
                className="flex-1 text-sm text-white font-semibold border transition-colors"
                style={{ 
                  backgroundColor: 'var(--button-primary-bg)', 
                  borderColor: 'var(--button-primary-border)', 
                  borderRadius: '6px',
                  height: '28px',
                  fontSize: '14px'
                }}
              >
                Apply
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onCancel}
                className="flex-1 text-sm font-semibold transition-colors"
                style={{ 
                  backgroundColor: 'var(--bg-surface)',
                  border: 'none',
                  borderRadius: '6px',
                  height: '28px',
                  color: 'var(--text-primary)',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="flex-1 text-sm text-white font-semibold border transition-colors"
                style={{ 
                  backgroundColor: 'var(--button-primary-bg)', 
                  borderColor: 'var(--button-primary-border)', 
                  borderRadius: '6px',
                  height: '28px',
                  fontSize: '14px'
                }}
              >
                Apply
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getDefaultOperator(field: SchemaField): FilterOperator {
  if (field.type === 'boolean') return 'is_true';
  if (field.type === 'date') return 'equals';
  if (field.type === 'number') return 'equals';
  if (field.enum) return 'in';
  return 'contains';
}

function formatValue(value: any): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return String(value);
}

