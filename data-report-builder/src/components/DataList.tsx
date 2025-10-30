'use client';
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useApp, actions } from '@/state/app';
import { warehouse } from '@/data/warehouse';
import { getObject } from '@/data/schema';
import { buildDataListView, filterRowsByDate, getRowKey, sortRowsByField, type RowView } from '@/lib/views';
import { applyFilters } from '@/lib/filters';

type SortDirection = 'asc' | 'desc' | null;

type SortState = {
  column: string | null;
  direction: SortDirection;
};

type SelectionMode = 'cell' | 'row' | 'column' | 'multi-cell';

export function DataList() {
  const { state, dispatch } = useApp();
  const [sortState, setSortState] = useState<SortState>({
    column: null,
    direction: null,
  });
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

  // Selection state
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('cell');
  const [isSelecting, setIsSelecting] = useState(false);
  const [anchorCell, setAnchorCell] = useState<{ rowIndex: number; colKey: string } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Derive columns from selectedFields with qualified names, ordered by fieldOrder
  const columns = useMemo(() => {
    if (state.selectedFields.length === 0) {
      return [];
    }

    // Create a map of qualified names to column info
    const columnMap = new Map(
      state.selectedFields.map((field) => {
        const obj = getObject(field.object);
        const fieldDef = obj?.fields.find((f) => f.name === field.field);
        const qualifiedName = `${field.object}.${field.field}`;

        return [
          qualifiedName,
          {
            key: qualifiedName,
            label: qualifiedName,
            type: fieldDef?.type || 'string',
            object: field.object,
            field: field.field,
          },
        ];
      })
    );

    // Order columns according to fieldOrder, fallback to selectedFields order
    if (state.fieldOrder.length > 0) {
      return state.fieldOrder
        .map((qualifiedName) => columnMap.get(qualifiedName))
        .filter((col) => col !== undefined);
    }

    return Array.from(columnMap.values());
  }, [state.selectedFields, state.fieldOrder]);

  // Generate data rows using buildDataListView with RowView[]
  const rawRows: RowView[] = useMemo(() => {
    if (state.selectedObjects.length === 0 || state.selectedFields.length === 0) {
      return [];
    }

    return buildDataListView({
      store: warehouse,
      selectedObjects: state.selectedObjects,
      selectedFields: state.selectedFields,
    });
  }, [state.selectedObjects, state.selectedFields]);

  // Filter rows by selected bucket using filterRowsByDate
  const dateFilteredRows = useMemo(() => {
    if (!state.selectedBucket) {
      return rawRows;
    }

    return filterRowsByDate(rawRows, state.selectedBucket.start, state.selectedBucket.end);
  }, [rawRows, state.selectedBucket]);

  // Apply field filters
  const fieldFilteredRows = useMemo(() => {
    if (state.filters.conditions.length === 0) {
      return dateFilteredRows;
    }

    return applyFilters(dateFilteredRows, state.filters);
  }, [dateFilteredRows, state.filters]);

  // Sort rows based on current sort state using sortRowsByField
  const sortedRows = useMemo(() => {
    if (!sortState.column || !sortState.direction) {
      return fieldFilteredRows;
    }

    return sortRowsByField(fieldFilteredRows, sortState.column, sortState.direction);
  }, [fieldFilteredRows, sortState]);

  // Check if cell is selected
  const isCellSelected = useCallback((rowIndex: number, colKey: string): boolean => {
    if (!state.selectedGrid) return false;
    const row = sortedRows[rowIndex];
    const rowKey = getRowKey(row);
    return state.selectedGrid.cells.some(c => {
      const cellRowKey = `${c.rowId.object}:${c.rowId.id}`;
      return cellRowKey === rowKey && c.col === colKey;
    });
  }, [state.selectedGrid, sortedRows]);

  // Check if row is selected
  const isRowSelected = useCallback((rowIndex: number): boolean => {
    if (!state.selectedGrid) return false;
    const row = sortedRows[rowIndex];
    const rowKey = getRowKey(row);
    return state.selectedGrid.rowIds.some(pk => `${pk.object}:${pk.id}` === rowKey);
  }, [state.selectedGrid, sortedRows]);

  // Check if column is selected
  const isColumnSelected = useCallback((colKey: string): boolean => {
    if (!state.selectedGrid) return false;
    return state.selectedGrid.columns.includes(colKey);
  }, [state.selectedGrid]);

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

  // Drag-and-drop handlers
  const handleDragStart = (e: React.DragEvent, columnKey: string) => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetColumnKey: string) => {
    e.preventDefault();

    if (!draggedColumn || draggedColumn === targetColumnKey) {
      setDraggedColumn(null);
      return;
    }

    // Use current fieldOrder or create one from columns
    const currentOrder = state.fieldOrder.length > 0
      ? [...state.fieldOrder]
      : columns.map(col => col.key);

    const draggedIndex = currentOrder.indexOf(draggedColumn);
    const targetIndex = currentOrder.indexOf(targetColumnKey);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedColumn(null);
      return;
    }

    // Reorder the array
    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedColumn);

    dispatch(actions.reorderFields(newOrder));
    setDraggedColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
  };

  // Handle column removal
  const handleRemoveColumn = (object: string, field: string) => {
    dispatch(actions.toggleField(object, field));
  };

  // Selection handlers using PKs
  const handleCellMouseDown = useCallback((e: React.MouseEvent, rowIndex: number, colKey: string) => {
    // Don't interfere with drag-and-drop on headers
    if ((e.target as HTMLElement).closest('th')) return;

    e.preventDefault();
    setIsSelecting(true);
    setAnchorCell({ rowIndex, colKey });
    setSelectionMode('cell');

    const row = sortedRows[rowIndex];
    dispatch(actions.setGridSelection({
      rowIds: [row.pk],
      columns: [colKey],
      cells: [{ rowId: row.pk, col: colKey }],
      isRectangular: false,
    }));
  }, [dispatch, sortedRows]);

  const handleCellMouseEnter = useCallback((rowIndex: number, colKey: string) => {
    if (!isSelecting || !anchorCell || selectionMode !== 'cell') return;

    // Compute rectangular selection
    const minRow = Math.min(anchorCell.rowIndex, rowIndex);
    const maxRow = Math.max(anchorCell.rowIndex, rowIndex);
    const colIndices = columns.map(c => c.key);
    const minCol = Math.min(colIndices.indexOf(anchorCell.colKey), colIndices.indexOf(colKey));
    const maxCol = Math.max(colIndices.indexOf(anchorCell.colKey), colIndices.indexOf(colKey));

    const selectedRowIds: { object: string; id: string }[] = [];
    const selectedColumns: string[] = [];
    const selectedCells: { rowId: { object: string; id: string }; col: string }[] = [];

    for (let r = minRow; r <= maxRow; r++) {
      const row = sortedRows[r];
      selectedRowIds.push(row.pk);
      for (let c = minCol; c <= maxCol; c++) {
        const cKey = columns[c].key;
        if (!selectedColumns.includes(cKey)) {
          selectedColumns.push(cKey);
        }
        selectedCells.push({ rowId: row.pk, col: cKey });
      }
    }

    dispatch(actions.setGridSelection({
      rowIds: selectedRowIds,
      columns: selectedColumns,
      cells: selectedCells,
      isRectangular: true,
    }));
  }, [isSelecting, anchorCell, selectionMode, dispatch, sortedRows, columns]);

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
  }, []);

  const handleColumnHeaderClick = useCallback((e: React.MouseEvent, colKey: string) => {
    // If this is the sort button, don't handle selection
    if ((e.target as HTMLElement).closest('button')) return;

    e.stopPropagation();
    setSelectionMode('column');

    const selectedRowIds: { object: string; id: string }[] = [];
    const selectedCells: { rowId: { object: string; id: string }; col: string }[] = [];

    sortedRows.forEach((row) => {
      selectedRowIds.push(row.pk);
      selectedCells.push({ rowId: row.pk, col: colKey });
    });

    dispatch(actions.setGridSelection({
      rowIds: selectedRowIds,
      columns: [colKey],
      cells: selectedCells,
      isRectangular: false,
    }));
  }, [dispatch, sortedRows]);

  const handleRowClick = useCallback((e: React.MouseEvent, rowIndex: number) => {
    e.stopPropagation();
    setSelectionMode('row');

    const row = sortedRows[rowIndex];
    const selectedCells: { rowId: { object: string; id: string }; col: string }[] = [];

    columns.forEach(col => {
      selectedCells.push({ rowId: row.pk, col: col.key });
    });

    dispatch(actions.setGridSelection({
      rowIds: [row.pk],
      columns: columns.map(c => c.key),
      cells: selectedCells,
      isRectangular: false,
    }));
  }, [dispatch, sortedRows, columns]);

  // Copy to clipboard (Cmd/Ctrl+C) using row.display
  const handleCopy = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'c' && state.selectedGrid) {
      e.preventDefault();

      const { cells, isRectangular } = state.selectedGrid;
      if (cells.length === 0) return;

      if (isRectangular) {
        // Build rectangular grid for TSV export
        const cellMap = new Map<string, Map<string, string>>();

        cells.forEach(({ rowId, col }) => {
          const rowKey = `${rowId.object}:${rowId.id}`;
          if (!cellMap.has(rowKey)) {
            cellMap.set(rowKey, new Map());
          }
          const row = sortedRows.find(r => getRowKey(r) === rowKey);
          if (row) {
            cellMap.get(rowKey)!.set(col, formatValue(row.display[col]));
          }
        });

        // Get unique rows and columns in order
        const uniqueRowKeys = Array.from(new Set(cells.map(c => `${c.rowId.object}:${c.rowId.id}`)));
        const uniqueColKeys = Array.from(new Set(cells.map(c => c.col)));

        // Sort by original order
        uniqueRowKeys.sort((a, b) => {
          const aIdx = sortedRows.findIndex(r => getRowKey(r) === a);
          const bIdx = sortedRows.findIndex(r => getRowKey(r) === b);
          return aIdx - bIdx;
        });

        uniqueColKeys.sort((a, b) => {
          const aIdx = columns.findIndex(c => c.key === a);
          const bIdx = columns.findIndex(c => c.key === b);
          return aIdx - bIdx;
        });

        // Build TSV
        const tsvRows = uniqueRowKeys.map(rowKey => {
          return uniqueColKeys.map(colKey => {
            return cellMap.get(rowKey)?.get(colKey) || '';
          }).join('\t');
        });

        const tsv = tsvRows.join('\n');
        navigator.clipboard.writeText(tsv);
      } else {
        // Single cell or non-rectangular: copy values separated by newlines
        const values = cells.map(({ rowId, col }) => {
          const rowKey = `${rowId.object}:${rowId.id}`;
          const row = sortedRows.find(r => getRowKey(r) === rowKey);
          return row ? formatValue(row.display[col]) : '';
        });
        navigator.clipboard.writeText(values.join('\n'));
      }
    }
  }, [state.selectedGrid, sortedRows, columns]);

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleCopy);
    return () => {
      document.removeEventListener('keydown', handleCopy);
    };
  }, [handleCopy]);

  // Add mouseup listener for drag selection
  useEffect(() => {
    if (isSelecting) {
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isSelecting, handleMouseUp]);

  // Format cell value for display
  const formatValue = (value: string | number | boolean | null | undefined) => {
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
        <div className="text-gray-400 dark:text-gray-500 text-4xl mb-3">📊</div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
          No Data Selected
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
          Select objects and fields from the Data tab to see sample data here.
        </p>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="text-gray-400 dark:text-gray-500 text-4xl mb-3">📋</div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
          No Fields Selected
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
          Expand objects in the Data tab and select specific fields to display.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Data Preview</h3>
          <div className="flex items-center gap-2">
            {/* Selection chip */}
            {state.selectedGrid && state.selectedGrid.cells.length > 0 && (
              <div className="inline-flex items-center gap-2 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                <span className="font-medium">
                  Selection: {state.selectedGrid.rowIds.length}R × {state.selectedGrid.columns.length}C
                </span>
                <button
                  onClick={() => dispatch(actions.clearGridSelection())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      dispatch(actions.clearGridSelection());
                    }
                  }}
                  className="hover:bg-green-200 rounded p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                  aria-label="Clear selection"
                >
                  ✕
                </button>
              </div>
            )}
            {/* Filter chip */}
            {state.selectedBucket && (
              <div className="inline-flex items-center gap-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                <span className="font-medium">
                  Period: {state.selectedBucket.label}
                </span>
                <button
                  onClick={() => dispatch(actions.clearSelectedBucket())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      dispatch(actions.clearSelectedBucket());
                    }
                  }}
                  className="hover:bg-blue-200 rounded p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Clear period filter"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400" role="status" aria-live="polite">
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
      <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded">
        <table className="w-full text-xs border-collapse" role="table" aria-label="Data preview table">
          {/* Sticky header */}
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400 w-12 border-r border-gray-200 dark:border-gray-700">
                #
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  draggable
                  onDragStart={(e) => handleDragStart(e, column.key)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, column.key)}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => handleColumnHeaderClick(e, column.key)}
                  className={`text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300 select-none whitespace-nowrap cursor-move ${
                    draggedColumn === column.key ? 'opacity-50' : ''
                  } ${isColumnSelected(column.key) ? 'ring-1 ring-blue-500 bg-blue-50 dark:bg-blue-900/30' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleSort(column.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSort(column.key);
                        }
                      }}
                      className="flex-1 text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1"
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
                        <span className="font-mono text-[11px]">{column.label}</span>
                        <span className="text-gray-400 dark:text-gray-500 text-xs" aria-hidden="true">
                          {getSortIndicator(column.key)}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">
                        {column.type}
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveColumn(column.object, column.field);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveColumn(column.object, column.field);
                        }
                      }}
                      className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                      aria-label={`Remove column ${column.label}`}
                      title="Remove column"
                    >
                      ✕
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {sortedRows.map((row, rowIndex) => (
              <tr
                key={getRowKey(row)}
                className={`border-b border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors ${
                  isRowSelected(rowIndex) ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                }`}
              >
                <td
                  className={`py-2 px-3 text-gray-400 dark:text-gray-500 border-r border-gray-200 dark:border-gray-700 font-mono cursor-pointer ${
                    isRowSelected(rowIndex) ? 'ring-1 ring-blue-500' : ''
                  }`}
                  onClick={(e) => handleRowClick(e, rowIndex)}
                >
                  {rowIndex + 1}
                </td>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`py-2 px-3 whitespace-nowrap overflow-hidden text-ellipsis max-w-xs cursor-cell ${
                      isCellSelected(rowIndex, column.key) ? 'ring-1 ring-blue-500 bg-blue-100 dark:bg-blue-900/50' : ''
                    }`}
                    onMouseDown={(e) => handleCellMouseDown(e, rowIndex, column.key)}
                    onMouseEnter={() => handleCellMouseEnter(rowIndex, column.key)}
                  >
                    {formatValue(row.display[column.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Click headers to sort • Drag headers to reorder • Click ✕ to remove • Click/drag cells to select • Cmd/Ctrl+C to copy • Showing sample data
      </div>
    </div>
  );
}
