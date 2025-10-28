'use client';
import { useMemo, useState } from 'react';
import { useApp } from '@/state/app';
import { mockRowsForDataList } from '@/data/mock';
import { getObject } from '@/data/schema';

type SortDirection = 'asc' | 'desc' | null;

type SortState = {
  column: string | null;
  direction: SortDirection;
};

export function DataList() {
  const { state } = useApp();
  const [sortState, setSortState] = useState<SortState>({
    column: null,
    direction: null,
  });

  // Derive columns from selectedFields
  const columns = useMemo(() => {
    if (state.selectedFields.length === 0) {
      return [];
    }

    return state.selectedFields.map((field) => {
      const obj = getObject(field.object);
      const fieldDef = obj?.fields.find((f) => f.name === field.field);

      return {
        key: `${field.object}.${field.field}`,
        label: fieldDef?.label || field.field,
        type: fieldDef?.type || 'string',
      };
    });
  }, [state.selectedFields]);

  // Generate mock data rows
  const rawRows = useMemo(() => {
    if (state.selectedObjects.length === 0) {
      return [];
    }

    return mockRowsForDataList({
      objectsSelected: state.selectedObjects,
      count: 50,
    });
  }, [state.selectedObjects]);

  // Sort rows based on current sort state
  const sortedRows = useMemo(() => {
    if (!sortState.column || !sortState.direction) {
      return rawRows;
    }

    const sorted = [...rawRows].sort((a, b) => {
      const aVal = a[sortState.column!];
      const bVal = b[sortState.column!];

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Compare based on type
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return aVal - bVal;
      }

      if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        return aVal === bVal ? 0 : aVal ? 1 : -1;
      }

      // Default string comparison
      return String(aVal).localeCompare(String(bVal));
    });

    return sortState.direction === 'desc' ? sorted.reverse() : sorted;
  }, [rawRows, sortState]);

  // Handle column header click for sorting
  const handleSort = (columnKey: string) => {
    setSortState((prev) => {
      if (prev.column !== columnKey) {
        // New column, start with ascending
        return { column: columnKey, direction: 'asc' };
      }

      if (prev.direction === 'asc') {
        // Toggle to descending
        return { column: columnKey, direction: 'desc' };
      }

      // Reset sorting
      return { column: null, direction: null };
    });
  };

  // Get sort indicator for column
  const getSortIndicator = (columnKey: string) => {
    if (sortState.column !== columnKey) {
      return '⇅';
    }
    return sortState.direction === 'asc' ? '↑' : '↓';
  };

  // Format cell value for display
  const formatValue = (value: string | number | boolean) => {
    if (value === null || value === undefined) {
      return '-';
    }

    if (typeof value === 'boolean') {
      return value ? '✓' : '✗';
    }

    if (typeof value === 'number') {
      return value.toLocaleString();
    }

    return String(value);
  };

  // Empty state
  if (state.selectedObjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="text-gray-400 text-4xl mb-3">📊</div>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          No Data Selected
        </h3>
        <p className="text-xs text-gray-500 max-w-xs">
          Select objects and fields from the Data tab to see sample data here.
        </p>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="text-gray-400 text-4xl mb-3">📋</div>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          No Fields Selected
        </h3>
        <p className="text-xs text-gray-500 max-w-xs">
          Expand objects in the Data tab and select specific fields to display.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-2">
        <h3 className="text-sm font-semibold">Data Preview</h3>
        <p className="text-xs text-gray-500" role="status" aria-live="polite">
          {sortedRows.length} rows • {columns.length} columns
          {sortState.column && (
            <span className="ml-2">
              • Sorted by{' '}
              {columns.find((c) => c.key === sortState.column)?.label}{' '}
              {sortState.direction === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </p>
      </div>

      {/* Table container with scroll */}
      <div className="flex-1 overflow-auto border rounded">
        <table className="w-full text-xs border-collapse" role="table" aria-label="Data preview table">
          {/* Sticky header */}
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr className="border-b">
              <th className="text-left py-2 px-3 font-medium text-gray-500 w-12 border-r">
                #
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="text-left py-2 px-3 font-semibold text-gray-700 select-none whitespace-nowrap"
                >
                  <button
                    onClick={() => handleSort(column.key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSort(column.key);
                      }
                    }}
                    className="w-full text-left cursor-pointer hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1"
                    aria-label={`Sort by ${column.label}`}
                    aria-sort={
                      sortState.column === column.key
                        ? sortState.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <div className="flex items-center gap-1">
                      <span>{column.label}</span>
                      <span className="text-gray-400 text-xs" aria-hidden="true">
                        {getSortIndicator(column.key)}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 font-normal">
                      {column.type}
                    </div>
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {sortedRows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b hover:bg-blue-50 transition-colors"
              >
                <td className="py-2 px-3 text-gray-400 border-r font-mono">
                  {rowIndex + 1}
                </td>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="py-2 px-3 whitespace-nowrap overflow-hidden text-ellipsis max-w-xs"
                  >
                    {formatValue(row[column.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      <div className="mt-2 text-xs text-gray-500">
        Click column headers to sort • Showing sample data
      </div>
    </div>
  );
}
