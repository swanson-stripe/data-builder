'use client';
import { useState } from 'react';
import { SchemaField } from '@/types';
import { FilterCondition, FilterOperator } from '@/types';

type FieldFilterProps = {
  field: SchemaField;
  objectName: string;
  currentFilter?: FilterCondition;
  onFilterChange: (condition: FilterCondition | null) => void;
};

export function FieldFilter({
  field,
  objectName,
  currentFilter,
  onFilterChange,
}: FieldFilterProps) {
  // Initialize state from currentFilter if it exists
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
  const [selectedEnumValues, setSelectedEnumValues] = useState<string[]>(
    currentFilter?.operator === 'in' && Array.isArray(currentFilter.value)
      ? currentFilter.value
      : []
  );

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
    let filterValue: string | number | boolean | string[] | [number, number];

    // Build value based on field type and operator
    if (field.type === 'boolean') {
      filterValue = operator === 'is_true';
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

  // Render based on field type
  if (field.type === 'boolean') {
    return (
      <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
        <div className="space-y-2">
          <div className="flex gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={operator === 'is_true'}
                onChange={() => setOperator('is_true')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">True</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={operator === 'is_false'}
                onChange={() => setOperator('is_false')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">False</span>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleApply}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Apply
            </button>
            {currentFilter && (
              <button
                onClick={handleClear}
                className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
        <div className="space-y-2">
          <select
            value={operator}
            onChange={(e) => handleOperatorChange(e.target.value as FilterOperator)}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
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
                className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
              />
              <input
                type="number"
                placeholder="Max"
                value={betweenMax}
                onChange={(e) => setBetweenMax(e.target.value)}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
              />
            </div>
          ) : (
            <input
              type="number"
              placeholder="Value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
            />
          )}

          <div className="flex gap-2">
            <button
              onClick={handleApply}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Apply
            </button>
            {currentFilter && (
              <button
                onClick={handleClear}
                className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (field.enum) {
    // Categorical string with multi-select
    const handleToggleEnum = (enumValue: string) => {
      setSelectedEnumValues(prev => 
        prev.includes(enumValue)
          ? prev.filter(v => v !== enumValue)
          : [...prev, enumValue]
      );
    };

    return (
      <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
        <div className="space-y-2">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Select one or more:
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {field.enum.map(enumValue => (
              <label
                key={enumValue}
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded"
              >
                <input
                  type="checkbox"
                  checked={selectedEnumValues.includes(enumValue)}
                  onChange={() => handleToggleEnum(enumValue)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">{enumValue}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleApply}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Apply
            </button>
            {currentFilter && (
              <button
                onClick={handleClear}
                className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // String or ID fields - single text input with comma-separated support
  return (
    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
      <div className="space-y-2">
        <input
          type="text"
          placeholder={field.type === 'id' ? 'Enter IDs (comma-separated)' : 'Contains text...'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
        />
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {field.type === 'id' ? 'Separate multiple IDs with commas' : 'Case-insensitive search'}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleApply}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Apply
          </button>
          {currentFilter && (
            <button
              onClick={handleClear}
              className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getDefaultOperator(field: SchemaField): FilterOperator {
  if (field.type === 'boolean') return 'is_true';
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

