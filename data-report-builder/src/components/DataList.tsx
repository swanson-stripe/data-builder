'use client';
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useApp, actions } from '@/state/app';
import { useWarehouseStore } from '@/lib/useWarehouse';
import { getObject, getFieldLabel } from '@/data/schema';
import { buildDataListView, filterRowsByDate, getRowKey, sortRowsByField, type RowView } from '@/lib/views';
import { applyFilters } from '@/lib/filters';
import { FilterPopover } from './FilterPopover';
import { FieldFilter } from './FieldFilter';
import { FilterCondition } from '@/types';
import { Toast } from './Toast';

type SortDirection = 'asc' | 'desc' | null;

type SortState = {
  column: string | null;
  direction: SortDirection;
};

type SelectionMode = 'cell' | 'row' | 'column' | 'multi-cell';

export function DataList() {
  const { state, dispatch } = useApp();
  const { store: warehouse, version, loadEntity, has } = useWarehouseStore();
  
  // Remove the mount-only effect - we'll track loading based on data readiness instead
  
  // Use sort from global state if available, otherwise use local state for backwards compatibility
  const [localSortState, setLocalSortState] = useState<SortState>({
    column: null,
    direction: null,
  });
  
  // Determine which sort state to use
  const sortState = state.dataListSort 
    ? { column: state.dataListSort.column, direction: state.dataListSort.direction }
    : localSortState;
  
  // Function to update sort state (updates global state if it exists)
  const setSortState = (newSort: SortState) => {
    if (newSort.column && newSort.direction) {
      dispatch(actions.setDataListSort(newSort.column, newSort.direction));
    }
    setLocalSortState(newSort);
  };
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [columnDropdownOpen, setColumnDropdownOpen] = useState<string | null>(null);
  const [showFilterOptions, setShowFilterOptions] = useState(false);
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const columnDropdownRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const rowsPerPage = 20;

  // Selection state
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('cell');
  const [isSelecting, setIsSelecting] = useState(false);
  const [anchorCell, setAnchorCell] = useState<{ rowIndex: number; colKey: string } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-load selected objects that aren't yet loaded
  useEffect(() => {
    state.selectedObjects.forEach((objectName) => {
      if (!has(objectName as any)) {
        console.log(`[DataList] Auto-loading missing entity: ${objectName}`);
        loadEntity(objectName as any).catch((err) => {
          console.error(`[DataList] Failed to load ${objectName}:`, err);
        });
      }
    });
  }, [state.selectedObjects, has, loadEntity]);

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
            fieldDef, // Include the full field definition for filtering
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

  // Set default sort when columns change
  useEffect(() => {
    if (columns.length > 0 && sortState.column === null) {
      // Get the first column
      const firstColumn = columns[0];
      
      // Determine default sort direction based on field type
      let defaultDirection: 'asc' | 'desc' = 'asc';
      
      if (firstColumn.type === 'number') {
        defaultDirection = 'desc'; // Numbers: highest first
      } else if (firstColumn.type === 'date') {
        defaultDirection = 'desc'; // Dates: most recent first
      } else {
        defaultDirection = 'asc'; // Strings: alphabetical
      }
      
      setSortState({
        column: firstColumn.key,
        direction: defaultDirection,
      });
    }
  }, [columns, sortState.column]);

  // Compute distinct values for enum fields from actual warehouse data
  const distinctValuesCache = useMemo(() => {
    const cache: Record<string, string[]> = {};
    
    // Group columns by object to minimize data array lookups
    const columnsByObject = new Map<string, typeof columns>();
    columns.forEach(col => {
      if (!columnsByObject.has(col.object)) {
        columnsByObject.set(col.object, []);
      }
      columnsByObject.get(col.object)!.push(col);
    });
    
    // For each object, get data and compute distinct values for enum fields
    columnsByObject.forEach((cols, objectName) => {
      const dataArray = warehouse[objectName as keyof typeof warehouse];
      if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0) {
        return;
      }
      
      cols.forEach(col => {
        if (col.fieldDef?.enum && col.fieldDef.type === 'string') {
          const distinctSet = new Set<string>();
          dataArray.forEach((item: any) => {
            const value = item[col.field];
            if (value && typeof value === 'string') {
              distinctSet.add(value);
            }
          });
          // Sort alphabetically for consistent display
          cache[col.key] = Array.from(distinctSet).sort();
        }
      });
    });
    
    return cache;
  }, [columns, warehouse, version]);

  // Generate data rows using buildDataListView with RowView[]
  const rawRows: RowView[] = useMemo(() => {
    if (state.selectedObjects.length === 0 || state.selectedFields.length === 0) {
      return [];
    }

    const rows = buildDataListView({
      store: warehouse,
      selectedObjects: state.selectedObjects,
      selectedFields: state.selectedFields,
    });
    
    console.log('[DataList] rawRows:', 
      'selectedObjects:', state.selectedObjects,
      'selectedFields:', state.selectedFields,
      'rowCount:', rows.length,
      'sampleRow:', rows[0],
      'warehouseKeys:', Object.keys(warehouse)
    );
    
    return rows;
  }, [state.selectedObjects, state.selectedFields, version]);

  // First, filter rows by global date range (state.start, state.end)
  const globalDateFilteredRows = useMemo(() => {
    // Always filter by global date range to match metric computation
    return filterRowsByDate(rawRows, state.start, state.end);
  }, [rawRows, state.start, state.end]);

  // Then, filter by selected bucket if one exists
  const dateFilteredRows = useMemo(() => {
    if (!state.selectedBucket) {
      return globalDateFilteredRows;
    }

    // Intersect bucket range with global date range to match metric computation
    // If global range is Jan 1 - Nov 4, and bucket is Nov 2 - Nov 9,
    // we should only show Nov 2 - Nov 4 (not Nov 5-9)
    const bucketStart = state.selectedBucket.start > state.start ? state.selectedBucket.start : state.start;
    const bucketEnd = state.selectedBucket.end < state.end ? state.selectedBucket.end : state.end;

    return filterRowsByDate(globalDateFilteredRows, bucketStart, bucketEnd);
  }, [globalDateFilteredRows, state.selectedBucket, state.start, state.end]);

  // Apply field filters
  // Special handling for multi-block metrics: when drilling down via bucket selection,
  // show ALL source records (not filtered by block-specific filters) so users can see
  // the complete data that contributed to the calculated metric (e.g., all payments for a success rate)
  const fieldFilteredRows = useMemo(() => {
    const hasMultipleBlocks = state.metricFormula.blocks.length > 1;
    const isMultiBlockDrilldown = hasMultipleBlocks && state.selectedBucket;
    
    console.log('[DataList] Before filtering:',
      'dateFilteredRowCount:', dateFilteredRows.length,
      'filterConditions:', state.filters.conditions,
      'sampleRow.display:', dateFilteredRows[0]?.display,
      'availableFields:', dateFilteredRows[0] ? Object.keys(dateFilteredRows[0].display) : []
    );
    
    // For multi-block metrics with bucket selection, skip field filters
    // (only apply date filter so user sees all records that went into the calculation)
    if (isMultiBlockDrilldown) {
      return dateFilteredRows;
    }
    
    // For single-block metrics or when not drilling down, apply field filters normally
    if (state.filters.conditions.length === 0) {
      return dateFilteredRows;
    }

    const filtered = applyFilters(dateFilteredRows, state.filters);
    
    console.log('[DataList] After filtering:',
      'filteredRowCount:', filtered.length,
      'sampleFilteredRow:', filtered[0]
    );
    
    return filtered;
  }, [dateFilteredRows, state.filters, state.metricFormula.blocks, state.selectedBucket]);

  // Sort rows based on current sort state using sortRowsByField
  const sortedRows = useMemo(() => {
    if (!sortState.column || !sortState.direction) {
      return fieldFilteredRows;
    }

    return sortRowsByField(fieldFilteredRows, sortState.column, sortState.direction);
  }, [fieldFilteredRows, sortState]);

  // Paginated rows (moved before early returns to fix hook order)
  const paginatedRows = useMemo(() => {
    const startIndex = currentPage * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return sortedRows.slice(startIndex, endIndex);
  }, [sortedRows, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);

  // Reset to first page when sorting or filtering changes (moved before early returns to fix hook order)
  useEffect(() => {
    setCurrentPage(0);
  }, [sortState.column, sortState.direction, state.filters, state.selectedBucket]);
  
  // Track DataList loading based on data readiness
  useEffect(() => {
    if (paginatedRows.length > 0 || sortedRows.length === 0) {
      // Start loading when we begin rendering
      dispatch(actions.startComponentLoading('datalist'));
      
      // Rows are ready to display (or there are no rows)
      // Longer delay to account for heavy DOM rendering and browser paint
      // Console logs show 6-8 seconds of activity for 7568 rows
      const timer = setTimeout(() => {
        dispatch(actions.finishComponentLoading('datalist'));
      }, 5000); // 5 second buffer for heavy row rendering and filtering
      
      return () => {
        clearTimeout(timer);
        // Ensure we clean up loading state if effect re-runs
        dispatch(actions.finishComponentLoading('datalist'));
      };
    }
  }, [paginatedRows.length, sortedRows.length, dispatch]);

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
    if (sortState.column !== columnKey) {
      // New column, start with ascending
      setSortState({ column: columnKey, direction: 'asc' });
    } else if (sortState.direction === 'asc') {
      // Toggle to descending
      setSortState({ column: columnKey, direction: 'desc' });
    } else {
      // Reset sorting
      setSortState({ column: null, direction: null });
    }
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
    // Set drag image to be more transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    }
  };

  const handleDragOver = (e: React.DragEvent, targetColumnKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedColumn && draggedColumn !== targetColumnKey) {
      setDragOverColumn(targetColumnKey);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetColumnKey: string) => {
    e.preventDefault();
    setDragOverColumn(null);

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
    setDragOverColumn(null);
  };

  // Handle column removal
  const handleRemoveColumn = (object: string, field: string) => {
    dispatch(actions.toggleField(object, field));
  };

  // Handle filter change for a column
  const handleFilterChange = (objectName: string, fieldName: string, condition: FilterCondition | null) => {
    if (condition) {
      // Check if filter already exists for this field
      const existingIndex = state.filters.conditions.findIndex(
        c => c.field.object === objectName && c.field.field === fieldName
      );
      
      if (existingIndex >= 0) {
        // Update existing filter
        dispatch(actions.updateFilter(existingIndex, condition));
      } else {
        // Add new filter
        dispatch(actions.addFilter(condition));
      }
    } else {
      // Remove filter
      const existingIndex = state.filters.conditions.findIndex(
        c => c.field.object === objectName && c.field.field === fieldName
      );
      if (existingIndex >= 0) {
        dispatch(actions.removeFilter(existingIndex));
      }
    }
  };

  // Check if a column has an active filter
  const hasActiveFilter = (objectName: string, fieldName: string): boolean => {
    return state.filters.conditions.some(
      c => c.field.object === objectName && c.field.field === fieldName
    );
  };

  // Get active filter for a column
  const getActiveFilter = (objectName: string, fieldName: string): FilterCondition | undefined => {
    return state.filters.conditions.find(
      c => c.field.object === objectName && c.field.field === fieldName
    );
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
      rowIds: [], // Don't select entire row, only the specific cell
      columns: [],
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

    const selectedCells: { rowId: { object: string; id: string }; col: string }[] = [];

    for (let r = minRow; r <= maxRow; r++) {
      const row = sortedRows[r];
      for (let c = minCol; c <= maxCol; c++) {
        const cKey = columns[c].key;
        selectedCells.push({ rowId: row.pk, col: cKey });
      }
    }

    dispatch(actions.setGridSelection({
      rowIds: [], // Don't select entire rows, only specific cells
      columns: [], // Don't select entire columns
      cells: selectedCells,
      isRectangular: true,
    }));
  }, [isSelecting, anchorCell, selectionMode, dispatch, sortedRows, columns]);

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
  }, []);

  // Remove a single row from selection
  const handleRemoveRowFromSelection = useCallback((e: React.MouseEvent, rowIndex: number) => {
    e.stopPropagation();
    if (!state.selectedGrid) return;

    const row = sortedRows[rowIndex];
    const rowKey = `${row.pk.object}:${row.pk.id}`;

    // Filter out this row from the selection
    const newRowIds = state.selectedGrid.rowIds.filter(pk => `${pk.object}:${pk.id}` !== rowKey);
    const newCells = state.selectedGrid.cells.filter(cell => `${cell.rowId.object}:${cell.rowId.id}` !== rowKey);

    if (newRowIds.length === 0) {
      // No rows left, clear selection
      dispatch(actions.clearGridSelection());
    } else {
      dispatch(actions.setGridSelection({
        rowIds: newRowIds,
        columns: state.selectedGrid.columns,
        cells: newCells,
        isRectangular: state.selectedGrid.isRectangular,
      }));
    }
  }, [state.selectedGrid, sortedRows, dispatch]);

  // Clear all selections
  const handleClearAllSelections = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(actions.clearGridSelection());
  }, [dispatch]);

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

  const handleRowMouseDown = useCallback((e: React.MouseEvent, rowIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSelecting(true);
    setAnchorCell({ rowIndex, colKey: '__row__' }); // Use special marker for row selection
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

  const handleRowMouseEnter = useCallback((rowIndex: number) => {
    if (!isSelecting || !anchorCell || selectionMode !== 'row') return;

    // Compute row range selection
    const minRow = Math.min(anchorCell.rowIndex, rowIndex);
    const maxRow = Math.max(anchorCell.rowIndex, rowIndex);

    const selectedRowIds: { object: string; id: string }[] = [];
    const selectedCells: { rowId: { object: string; id: string }; col: string }[] = [];

    for (let r = minRow; r <= maxRow; r++) {
      const row = sortedRows[r];
      selectedRowIds.push(row.pk);
      columns.forEach(col => {
        selectedCells.push({ rowId: row.pk, col: col.key });
      });
    }

    dispatch(actions.setGridSelection({
      rowIds: selectedRowIds,
      columns: columns.map(c => c.key),
      cells: selectedCells,
      isRectangular: true,
    }));
  }, [isSelecting, anchorCell, selectionMode, dispatch, sortedRows, columns]);

  // Copy to clipboard (Cmd/Ctrl+C) using row.display
  const handleCopy = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'c' && state.selectedGrid) {
      e.preventDefault();

      const { cells, rowIds, isRectangular } = state.selectedGrid;
      if (cells.length === 0) return;

      // Determine if this is a row selection or cell selection
      const isRowSelection = rowIds.length > 0 && cells.length === rowIds.length * columns.length;

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

        // Show toast notification
        if (isRowSelection) {
          setToastMessage(`${uniqueRowKeys.length} row${uniqueRowKeys.length === 1 ? '' : 's'} copied`);
        } else {
          setToastMessage(`${cells.length} cell${cells.length === 1 ? '' : 's'} copied`);
        }
      } else {
        // Single cell or non-rectangular: copy values separated by newlines
        const values = cells.map(({ rowId, col }) => {
          const rowKey = `${rowId.object}:${rowId.id}`;
          const row = sortedRows.find(r => getRowKey(r) === rowKey);
          return row ? formatValue(row.display[col]) : '';
        });
        navigator.clipboard.writeText(values.join('\n'));

        // Show toast notification
        setToastMessage(`${cells.length} cell${cells.length === 1 ? '' : 's'} copied`);
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
  const formatValue = (value: string | number | boolean | null | undefined, columnKey?: string) => {
    if (value === null || value === undefined) {
      return '-';
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    if (typeof value === 'number') {
      // Check if this is a currency field (amount, price, balance, etc.)
      const isCurrencyField = columnKey && (
        columnKey.includes('amount') || 
        columnKey.includes('price') || 
        columnKey.includes('balance') || 
        columnKey.includes('total') ||
        columnKey.includes('subtotal')
      );
      
      if (isCurrencyField) {
        // Format as currency (value is in cents)
        const dollars = value / 100;
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(dollars);
      }
      
      return value.toLocaleString();
    }

    // Format date/timestamp strings
    if (typeof value === 'string') {
      // Check if it's an ISO timestamp (contains 'T' or 'Z')
      if (value.includes('T') || value.includes('Z')) {
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            // Format as readable date-time
            return new Intl.DateTimeFormat('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'UTC',
            }).format(date);
          }
        } catch {
          // If parsing fails, return as-is
        }
      }
    }

    return String(value);
  };

  // Check if a value is numeric (number or currency)
  const isNumericValue = (value: string | number | boolean | null | undefined): boolean => {
    return typeof value === 'number';
  };

  // Get icon for data type
  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'string':
      case 'text':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.947 10.4151C14.157 10.4151 14.3091 10.3536 14.4032 10.2305C14.5046 10.1002 14.5806 9.94448 14.6313 9.76345H15.9999C15.9709 10.0314 15.9021 10.2848 15.7935 10.5238C15.6849 10.7555 15.5401 10.9582 15.359 11.132C15.1852 11.3058 14.9752 11.4434 14.7291 11.5448C14.4901 11.6461 14.233 11.6968 13.9579 11.6968H13.0238C12.7341 11.6968 12.459 11.6425 12.1983 11.5339C11.9376 11.418 11.7095 11.2624 11.514 11.0668C11.3185 10.8713 11.1628 10.6432 11.047 10.3826C10.9383 10.1219 10.884 9.8431 10.884 9.54622V6.46151C10.884 6.16463 10.9383 5.88585 11.047 5.62517C11.1628 5.35725 11.3185 5.12553 11.514 4.93002C11.7095 4.73451 11.9376 4.58245 12.1983 4.47384C12.459 4.35798 12.7341 4.30005 13.0238 4.30005H13.9579C14.2403 4.30005 14.501 4.35074 14.7399 4.45211C14.9789 4.55349 15.1852 4.69469 15.359 4.87572C15.5401 5.0495 15.6849 5.25587 15.7935 5.49483C15.9021 5.73378 15.9709 5.99084 15.9999 6.266H14.6313C14.5951 6.07774 14.5263 5.91843 14.4249 5.78809C14.3235 5.65775 14.1642 5.59258 13.947 5.59258H13.0346C12.7812 5.59258 12.5784 5.6831 12.4264 5.86412C12.2816 6.04515 12.2092 6.266 12.2092 6.52668V9.47019C12.2092 9.73087 12.2816 9.95534 12.4264 10.1436C12.5784 10.3246 12.7812 10.4151 13.0346 10.4151H13.947Z" fill="var(--text-primary)"/>
            <path d="M10.563 6.71133C10.563 6.95029 10.5159 7.182 10.4218 7.40648C10.3277 7.63095 10.2009 7.82646 10.0416 7.993C10.2589 8.15231 10.4145 8.34782 10.5087 8.57953C10.6028 8.80401 10.6499 9.03934 10.6499 9.28554V9.74173C10.6499 10.0459 10.6064 10.321 10.5195 10.5672C10.4327 10.8134 10.3096 11.0198 10.1502 11.1863C9.99819 11.3529 9.81354 11.4796 9.59631 11.5665C9.38631 11.6534 9.15098 11.6968 8.8903 11.6968H5.52319V4.30005H8.79254C9.05322 4.30005 9.29218 4.3435 9.50941 4.43039C9.72664 4.51728 9.91129 4.64038 10.0634 4.79968C10.2227 4.95899 10.3458 5.15088 10.4327 5.37535C10.5195 5.59982 10.563 5.84602 10.563 6.11394V6.71133ZM6.80487 7.37389H8.56445C8.65858 7.37389 8.7491 7.35217 8.83599 7.30872C8.92288 7.26527 8.99892 7.20735 9.06409 7.13494C9.1365 7.06252 9.1908 6.97925 9.22701 6.88512C9.26322 6.78374 9.28132 6.67875 9.28132 6.57013V6.46151C9.28132 6.34566 9.26322 6.24066 9.22701 6.14653C9.1908 6.05239 9.1365 5.96912 9.06409 5.89671C8.99892 5.81706 8.92288 5.75551 8.83599 5.71206C8.7491 5.66861 8.65858 5.64689 8.56445 5.64689H6.80487V7.37389ZM9.37907 9.4376C9.37907 9.32898 9.35735 9.22761 9.3139 9.13348C9.2777 9.0321 9.22701 8.94521 9.16184 8.8728C9.09667 8.80039 9.01702 8.74246 8.92288 8.69901C8.83599 8.65556 8.74548 8.63384 8.65134 8.63384H6.80487V10.3283H8.65134C8.74548 10.3283 8.83599 10.3065 8.92288 10.2631C9.01702 10.2196 9.09667 10.1617 9.16184 10.0893C9.22701 10.0169 9.2777 9.93362 9.3139 9.83948C9.35735 9.73811 9.37907 9.62949 9.37907 9.51363V9.4376Z" fill="var(--text-primary)"/>
            <path d="M3.57348 10.5672H1.5858L1.31426 11.6968H0L1.90079 4.30005H3.3128L5.13755 11.6968H3.83416L3.57348 10.5672ZM1.84648 9.47019H3.32366L2.63938 6.45065H2.56335L1.84648 9.47019Z" fill="var(--text-primary)"/>
          </svg>
        );
      case 'number':
      case 'integer':
      case 'float':
      case 'decimal':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14.2615 5.66007C14.389 6.03556 14.4173 6.40397 14.3465 6.76529C14.2827 7.11953 14.0985 7.4348 13.7939 7.7111L13.7301 7.78549L13.7939 7.84925C13.9852 8.04763 14.1269 8.26371 14.219 8.49751C14.4882 9.14222 14.4882 9.78693 14.219 10.4316C14.1269 10.6583 13.9958 10.8638 13.8258 11.048C13.6628 11.2251 13.4715 11.3633 13.2519 11.4625C13.089 11.5404 12.926 11.5971 12.7631 11.6325C12.6001 11.6608 12.4372 11.6785 12.2742 11.6856C12.1113 11.6998 11.9483 11.7033 11.7854 11.6963C11.6224 11.6963 11.4524 11.6963 11.2753 11.6963C11.0202 11.6963 10.7793 11.6467 10.5526 11.5475C10.3259 11.4483 10.1275 11.3137 9.95751 11.1437C9.78748 10.9665 9.65287 10.7646 9.55368 10.5379C9.46158 10.3041 9.41553 10.0597 9.41553 9.80464V9.5921H10.5633C10.5633 9.71254 10.5845 9.82235 10.627 9.92154C10.6695 10.042 10.7368 10.1376 10.8289 10.2085C10.921 10.2793 11.0273 10.336 11.1477 10.3785C11.2682 10.421 11.3922 10.4493 11.5197 10.4635C11.6472 10.4706 11.7641 10.4706 11.8704 10.4635C12.0192 10.4493 12.1679 10.4281 12.3167 10.3998C12.4726 10.3714 12.6143 10.3112 12.7418 10.2191C12.8977 10.0987 12.9969 9.92862 13.0394 9.709C13.089 9.48937 13.0854 9.27328 13.0287 9.06074C12.9296 8.69234 12.6674 8.46917 12.2423 8.39124C12.0723 8.34873 11.8456 8.32747 11.5622 8.32747H11.1903V7.23288H11.5622C11.8456 7.23288 12.0723 7.21163 12.2423 7.16912C12.4549 7.14078 12.6214 7.07702 12.7418 6.97783C12.8268 6.90699 12.8941 6.82197 12.9437 6.72278C12.9933 6.61651 13.0181 6.5067 13.0181 6.39334C13.0252 6.27999 13.0039 6.17017 12.9543 6.0639C12.9118 5.95055 12.841 5.84782 12.7418 5.75572C12.6639 5.68487 12.5541 5.62819 12.4124 5.58568C12.2778 5.54317 12.129 5.51838 11.966 5.51129C11.8102 5.50421 11.6472 5.51484 11.4772 5.54317C11.3071 5.56443 11.1548 5.61048 11.0202 5.68133C10.8856 5.75217 10.7758 5.84782 10.6908 5.96826C10.6058 6.0887 10.5633 6.23394 10.5633 6.40397H9.41553V6.1808C9.41553 5.87616 9.47929 5.60694 9.60681 5.37314C9.73434 5.13226 9.90083 4.93389 10.1063 4.77802C10.3117 4.62216 10.5455 4.50526 10.8077 4.42733C11.0769 4.34231 11.3461 4.2998 11.6153 4.2998C11.7499 4.2998 11.8562 4.2998 11.9341 4.2998C12.0192 4.2998 12.0829 4.30335 12.1254 4.31043C12.1679 4.31043 12.1963 4.31043 12.2105 4.31043C12.2317 4.31043 12.2423 4.31043 12.2423 4.31043C12.3274 4.31752 12.4124 4.3246 12.4974 4.33169C12.5895 4.33877 12.678 4.3494 12.7631 4.36357C12.9189 4.39899 13.0748 4.45567 13.2307 4.5336C13.3936 4.60445 13.5353 4.69301 13.6557 4.79928C13.7903 4.91263 13.9108 5.0437 14.0171 5.19248C14.1233 5.34126 14.2048 5.49712 14.2615 5.66007Z" fill="var(--text-primary)"/>
            <path d="M4.56267 10.0491C5.0586 9.67357 5.53682 9.28391 5.99733 8.88008C6.46492 8.47625 6.91126 8.07597 7.33634 7.67922C7.4497 7.57295 7.54534 7.47731 7.62327 7.39229C7.70829 7.30019 7.7756 7.20809 7.82519 7.11598C7.87478 7.02388 7.91021 6.9247 7.93146 6.81843C7.9598 6.70507 7.97397 6.56692 7.97397 6.40397C7.97397 6.29061 7.95271 6.1808 7.91021 6.07453C7.8677 5.96117 7.80393 5.86553 7.71892 5.7876C7.64099 5.70967 7.54888 5.64945 7.44261 5.60694C7.34343 5.55734 7.23716 5.53255 7.1238 5.53255H6.52868C6.40824 5.53255 6.29489 5.55734 6.18862 5.60694C6.08235 5.64945 5.99024 5.70967 5.91231 5.7876C5.83438 5.86553 5.77062 5.96117 5.72102 6.07453C5.67852 6.1808 5.65726 6.29061 5.65726 6.40397V6.65902H4.48828V6.19143C4.48828 5.92929 4.53787 5.68487 4.63706 5.45816C4.73625 5.22436 4.87086 5.02245 5.04089 4.85241C5.21801 4.68238 5.41992 4.54777 5.64663 4.44858C5.88043 4.3494 6.1284 4.2998 6.39053 4.2998H7.31509C7.57722 4.2998 7.82165 4.3494 8.04836 4.44858C8.28215 4.54777 8.48407 4.68238 8.6541 4.85241C8.82414 5.02245 8.95875 5.22436 9.05793 5.45816C9.15712 5.68487 9.20671 5.92929 9.20671 6.19143V6.35083C9.20671 6.56338 9.19608 6.75821 9.17483 6.93532C9.16066 7.11244 9.12524 7.28248 9.06856 7.44542C9.01188 7.60129 8.92686 7.75361 8.81351 7.90239C8.70724 8.04408 8.56909 8.19641 8.39905 8.35935C7.99522 8.74901 7.57014 9.13513 7.1238 9.51771C6.68455 9.8932 6.23821 10.2439 5.78479 10.5698H9.07919V11.6538H4.56267V10.0491Z" fill="var(--text-primary)"/>
            <path d="M1.57495 5.63813L2.42759 4.2998H3.87385V11.6498H2.62187V5.63813H1.57495Z" fill="var(--text-primary)"/>
          </svg>
        );
      case 'date':
      case 'datetime':
      case 'timestamp':
        return (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M4.75562 0.5625C4.75562 0.25184 4.50378 0 4.19312 0C3.88245 0 3.63062 0.25184 3.63062 0.5625V1.125H2.625C1.38236 1.125 0.375 2.13236 0.375 3.375V9.75C0.375 10.9926 1.38236 12 2.625 12H9.375C10.6176 12 11.625 10.9926 11.625 9.75V3.375C11.625 2.13236 10.6176 1.125 9.375 1.125H8.36206V0.5625C8.36206 0.25184 8.11022 0 7.79956 0C7.4889 0 7.23706 0.25184 7.23706 0.5625V1.125H4.75562V0.5625ZM7.23706 2.8125V2.25H4.75562V2.8125C4.75562 3.12316 4.50378 3.375 4.19312 3.375C3.88245 3.375 3.63062 3.12316 3.63062 2.8125V2.25H2.625C2.00368 2.25 1.5 2.75368 1.5 3.375V4.125H10.5V3.375C10.5 2.75368 9.99632 2.25 9.375 2.25H8.36206V2.8125C8.36206 3.12316 8.11022 3.375 7.79956 3.375C7.4889 3.375 7.23706 3.12316 7.23706 2.8125ZM10.5 5.25H1.5V9.75C1.5 10.3713 2.00368 10.875 2.625 10.875H9.375C9.99632 10.875 10.5 10.3713 10.5 9.75V5.25Z" fill="var(--text-primary)"/>
            <path d="M4.5 6H3V7.5H4.5V6Z" fill="var(--text-primary)"/>
            <path d="M4.5 8.25H3V9.75H4.5V8.25Z" fill="var(--text-primary)"/>
            <path d="M6.75 8.25H5.25V9.75H6.75V8.25Z" fill="var(--text-primary)"/>
            <path d="M7.5 8.25H9V9.75H7.5V8.25Z" fill="var(--text-primary)"/>
            <path d="M5.25 6H6.75V7.5H5.25V6Z" fill="var(--text-primary)"/>
            <path d="M9 6H7.5V7.5H9V6Z" fill="var(--text-primary)"/>
          </svg>
        );
      case 'boolean':
      case 'bool':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M3.87276 3.78503C1.69561 3.78503 0 5.71188 0 8.00057C0 10.2893 1.69592 12.2161 3.87276 12.2161H12.1272C14.3044 12.2161 16 10.2893 16 8.00057C16 5.7118 14.3041 3.78503 12.1272 3.78503H3.87276ZM1.32087 8.00057C1.32087 6.38799 2.50019 5.15178 3.87276 5.15178H12.1272C13.4996 5.15178 14.6791 6.38799 14.6791 8.00057C14.6791 9.61316 13.4998 10.8494 12.1272 10.8494H3.87276C2.50043 10.8494 1.32087 9.61316 1.32087 8.00057ZM3.96564 5.29882C2.55066 5.29882 1.47239 6.54931 1.47239 8.00057C1.47239 9.45084 2.54975 10.7023 3.96564 10.7023C5.37987 10.7023 6.46871 9.45267 6.46871 8.00057C6.46871 6.54947 5.38077 5.29882 3.96564 5.29882ZM2.79755 8.00057C2.79755 7.2245 3.35608 6.66556 3.96564 6.66556C4.57693 6.66556 5.14356 7.22637 5.14356 8.00057C5.14356 8.77519 4.57655 9.33558 3.96564 9.33558C3.3557 9.33558 2.79755 8.77623 2.79755 8.00057Z" fill="var(--text-primary)"/>
          </svg>
        );
      case 'varchar':
        return (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1.3125 3.1875C1.82812 3.1875 2.25 2.76562 2.25 2.25C2.25 1.73438 1.82812 1.3125 1.3125 1.3125C0.796875 1.3125 0.375 1.73438 0.375 2.25C0.375 2.775 0.796875 3.1875 1.3125 3.1875Z" fill="var(--text-primary)"/>
            <path d="M1.3125 6.9375C1.82812 6.9375 2.25 6.51562 2.25 6C2.25 5.48438 1.82812 5.0625 1.3125 5.0625C0.796875 5.0625 0.375 5.48438 0.375 6C0.375 6.525 0.796875 6.9375 1.3125 6.9375Z" fill="var(--text-primary)"/>
            <path d="M1.3125 10.6875C1.82812 10.6875 2.25 10.2656 2.25 9.75C2.25 9.23438 1.82812 8.8125 1.3125 8.8125C0.796875 8.8125 0.375 9.23438 0.375 9.75C0.375 10.275 0.796875 10.6875 1.3125 10.6875Z" fill="var(--text-primary)"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M3 2.15625C3 1.79381 3.29381 1.5 3.65625 1.5H10.9688C11.3312 1.5 11.625 1.79381 11.625 2.15625C11.625 2.51869 11.3312 2.8125 10.9688 2.8125H3.65625C3.29381 2.8125 3 2.51869 3 2.15625Z" fill="var(--text-primary)"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M3 6.00073C3 5.6383 3.29381 5.34448 3.65625 5.34448H10.9688C11.3312 5.34448 11.625 5.6383 11.625 6.00073C11.625 6.36317 11.3312 6.65698 10.9688 6.65698H3.65625C3.29381 6.65698 3 6.36317 3 6.00073Z" fill="var(--text-primary)"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M3 9.84375C3 9.48131 3.29381 9.1875 3.65625 9.1875H10.9688C11.3312 9.1875 11.625 9.48131 11.625 9.84375C11.625 10.2062 11.3312 10.5 10.9688 10.5H3.65625C3.29381 10.5 3 10.2062 3 9.84375Z" fill="var(--text-primary)"/>
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.947 10.4151C14.157 10.4151 14.3091 10.3536 14.4032 10.2305C14.5046 10.1002 14.5806 9.94448 14.6313 9.76345H15.9999C15.9709 10.0314 15.9021 10.2848 15.7935 10.5238C15.6849 10.7555 15.5401 10.9582 15.359 11.132C15.1852 11.3058 14.9752 11.4434 14.7291 11.5448C14.4901 11.6461 14.233 11.6968 13.9579 11.6968H13.0238C12.7341 11.6968 12.459 11.6425 12.1983 11.5339C11.9376 11.418 11.7095 11.2624 11.514 11.0668C11.3185 10.8713 11.1628 10.6432 11.047 10.3826C10.9383 10.1219 10.884 9.8431 10.884 9.54622V6.46151C10.884 6.16463 10.9383 5.88585 11.047 5.62517C11.1628 5.35725 11.3185 5.12553 11.514 4.93002C11.7095 4.73451 11.9376 4.58245 12.1983 4.47384C12.459 4.35798 12.7341 4.30005 13.0238 4.30005H13.9579C14.2403 4.30005 14.501 4.35074 14.7399 4.45211C14.9789 4.55349 15.1852 4.69469 15.359 4.87572C15.5401 5.0495 15.6849 5.25587 15.7935 5.49483C15.9021 5.73378 15.9709 5.99084 15.9999 6.266H14.6313C14.5951 6.07774 14.5263 5.91843 14.4249 5.78809C14.3235 5.65775 14.1642 5.59258 13.947 5.59258H13.0346C12.7812 5.59258 12.5784 5.6831 12.4264 5.86412C12.2816 6.04515 12.2092 6.266 12.2092 6.52668V9.47019C12.2092 9.73087 12.2816 9.95534 12.4264 10.1436C12.5784 10.3246 12.7812 10.4151 13.0346 10.4151H13.947Z" fill="var(--text-primary)"/>
            <path d="M10.563 6.71133C10.563 6.95029 10.5159 7.182 10.4218 7.40648C10.3277 7.63095 10.2009 7.82646 10.0416 7.993C10.2589 8.15231 10.4145 8.34782 10.5087 8.57953C10.6028 8.80401 10.6499 9.03934 10.6499 9.28554V9.74173C10.6499 10.0459 10.6064 10.321 10.5195 10.5672C10.4327 10.8134 10.3096 11.0198 10.1502 11.1863C9.99819 11.3529 9.81354 11.4796 9.59631 11.5665C9.38631 11.6534 9.15098 11.6968 8.8903 11.6968H5.52319V4.30005H8.79254C9.05322 4.30005 9.29218 4.3435 9.50941 4.43039C9.72664 4.51728 9.91129 4.64038 10.0634 4.79968C10.2227 4.95899 10.3458 5.15088 10.4327 5.37535C10.5195 5.59982 10.563 5.84602 10.563 6.11394V6.71133ZM6.80487 7.37389H8.56445C8.65858 7.37389 8.7491 7.35217 8.83599 7.30872C8.92288 7.26527 8.99892 7.20735 9.06409 7.13494C9.1365 7.06252 9.1908 6.97925 9.22701 6.88512C9.26322 6.78374 9.28132 6.67875 9.28132 6.57013V6.46151C9.28132 6.34566 9.26322 6.24066 9.22701 6.14653C9.1908 6.05239 9.1365 5.96912 9.06409 5.89671C8.99892 5.81706 8.92288 5.75551 8.83599 5.71206C8.7491 5.66861 8.65858 5.64689 8.56445 5.64689H6.80487V7.37389ZM9.37907 9.4376C9.37907 9.32898 9.35735 9.22761 9.3139 9.13348C9.2777 9.0321 9.22701 8.94521 9.16184 8.8728C9.09667 8.80039 9.01702 8.74246 8.92288 8.69901C8.83599 8.65556 8.74548 8.63384 8.65134 8.63384H6.80487V10.3283H8.65134C8.74548 10.3283 8.83599 10.3065 8.92288 10.2631C9.01702 10.2196 9.09667 10.1617 9.16184 10.0893C9.22701 10.0169 9.2777 9.93362 9.3139 9.83948C9.35735 9.73811 9.37907 9.62949 9.37907 9.51363V9.4376Z" fill="var(--text-primary)"/>
            <path d="M3.57348 10.5672H1.5858L1.31426 11.6968H0L1.90079 4.30005H3.3128L5.13755 11.6968H3.83416L3.57348 10.5672ZM1.84648 9.47019H3.32366L2.63938 6.45065H2.56335L1.84648 9.47019Z" fill="var(--text-primary)"/>
          </svg>
        );
    }
  };

  // Close column dropdown when clicking outside
  useEffect(() => {
    if (!columnDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't close if clicking on a header button (let the button's onClick handle it)
      if (target.closest('button[aria-label^="Column options"]')) {
        return;
      }
      
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(target)) {
        setColumnDropdownOpen(null);
        setShowFilterOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [columnDropdownOpen]);

  // Track horizontal scroll to add border to pinned column
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setIsScrolled(container.scrollLeft > 0);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle Escape key to clear selection
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.selectedGrid) {
        dispatch(actions.clearGridSelection());
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [state.selectedGrid, dispatch]);

  // Handle click outside to clear cell selection (but not row selection)
  useEffect(() => {
    if (!state.selectedGrid) return;

    // Only clear on click outside for cell selections, not row selections
    const isCellSelection = state.selectedGrid.rowIds.length === 0;
    if (!isCellSelection) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't clear if clicking within the table
      if (tableRef.current && tableRef.current.contains(target)) {
        return;
      }
      
      // Clear selection
      dispatch(actions.clearGridSelection());
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [state.selectedGrid, dispatch]);

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

  // Format selected bucket label to match the period display format
  const formatBucketLabel = (bucket: typeof state.selectedBucket): string => {
    if (!bucket) return '';
    
    const start = new Date(bucket.start);
    const end = new Date(bucket.end);
    
    // Determine granularity based on date range
    const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) {
      // Day granularity
      return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } else if (diffDays <= 7) {
      // Week granularity
      const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endDate = new Date(end.getTime() - 1); // Subtract 1 day since end is exclusive
      const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${startStr} – ${endStr}`;
    } else if (diffDays <= 31) {
      // Month granularity
      return start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } else if (diffDays <= 100) {
      // Quarter granularity
      const quarter = Math.floor(start.getMonth() / 3) + 1;
      return `Q${quarter} ${start.getFullYear()}`;
    } else {
      // Year granularity
      return start.getFullYear().toString();
    }
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div>
        {/* Title */}
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
          Data
        </h2>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 mb-3">
          {/* All chip - selected when no bucket filter */}
          <button
            className="inline-flex items-center transition-colors"
            style={{
              backgroundColor: 'transparent',
              border: state.selectedBucket ? '1px solid #f5f6f8' : '2px solid #675DFF',
              borderRadius: '50px',
              paddingLeft: '12px',
              paddingRight: '12px',
              paddingTop: '6px',
              paddingBottom: '6px',
              height: '30px',
              fontSize: '14px',
              fontWeight: 600,
              color: state.selectedBucket ? '#374151' : '#533AFD',
              gap: '6px',
            }}
          >
            <span>All</span>
            <span style={{ fontWeight: 400, color: state.selectedBucket ? '#374151' : '#533AFD' }}>{sortedRows.length.toLocaleString()}</span>
          </button>

          {/* Top spend chip */}
          <button
            className="inline-flex items-center transition-colors hover:bg-gray-100"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--border-default)',
              borderRadius: '50px',
              paddingLeft: '12px',
              paddingRight: '12px',
              paddingTop: '6px',
              paddingBottom: '6px',
              height: '30px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              gap: '6px',
            }}
          >
            <span>Top spend</span>
            <span style={{ fontWeight: 400 }}>{Math.round(sortedRows.length * 0.15).toLocaleString()}</span>
          </button>

          {/* First-time chip */}
          <button
            className="inline-flex items-center transition-colors hover:bg-gray-100"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--border-default)',
              borderRadius: '50px',
              paddingLeft: '12px',
              paddingRight: '12px',
              paddingTop: '6px',
              paddingBottom: '6px',
              height: '30px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              gap: '6px',
            }}
          >
            <span>First-time</span>
            <span style={{ fontWeight: 400 }}>{Math.round(sortedRows.length * 0.10).toLocaleString()}</span>
          </button>

          {/* Top markets chip */}
          <button
            className="inline-flex items-center transition-colors hover:bg-gray-100"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--border-default)',
              borderRadius: '50px',
              paddingLeft: '12px',
              paddingRight: '12px',
              paddingTop: '6px',
              paddingBottom: '6px',
              height: '30px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              gap: '6px',
            }}
          >
            <span>Top markets</span>
            <span style={{ fontWeight: 400 }}>{Math.round(sortedRows.length * 0.05).toLocaleString()}</span>
          </button>

          {/* Selected bucket chip - appears when a bucket is clicked */}
          {state.selectedBucket && (
            <div
              className="inline-flex items-center"
              style={{
                backgroundColor: 'transparent',
                border: '2px solid var(--border-focus)',
                borderRadius: '50px',
                paddingLeft: '12px',
                paddingRight: '12px',
                paddingTop: '6px',
                paddingBottom: '6px',
                height: '30px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-link)',
                gap: '6px',
              }}
            >
              <span>{formatBucketLabel(state.selectedBucket)}</span>
              <span style={{ fontWeight: 400, color: 'var(--text-link)' }}>{dateFilteredRows.length.toLocaleString()}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch(actions.clearSelectedBucket());
                }}
                className="cursor-pointer hover:opacity-70 transition-opacity"
                style={{ marginLeft: '2px' }}
                aria-label="Clear period filter"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}

          {/* Plus button */}
          <button
            className="inline-flex items-center justify-center transition-colors hover:bg-gray-100"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--border-default)',
              borderRadius: '50px',
              width: '32px',
              height: '32px',
              color: '#6b7280',
            }}
            aria-label="Add filter"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Search Input */}
        <div className="flex items-center" style={{ marginBottom: '12px', gap: '12px' }}>
          <div className="flex items-center justify-center flex-shrink-0" style={{ width: '32px', height: '32px', backgroundColor: 'var(--bg-surface)', borderRadius: '50%' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="3" width="14" height="1.5" rx="0.75" fill="#474E5A"/>
              <rect x="3" y="7" width="10" height="1.5" rx="0.75" fill="#474E5A"/>
              <rect x="5" y="11" width="6" height="1.5" rx="0.75" fill="#474E5A"/>
            </svg>
          </div>
          <input
            type="text"
            placeholder="Filter table using natural language"
            className="flex-1 text-sm focus:outline-none"
            style={{ 
              fontSize: '14px', 
              borderRadius: '50px',
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingTop: '4px',
              paddingBottom: '4px',
              height: '40px',
              border: '1px solid var(--border-default)',
              borderColor: '#f5f6f8',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#675DFF';
              e.target.style.outline = '1px solid #675DFF';
              e.target.style.outlineOffset = '-1px';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#f5f6f8';
              e.target.style.outline = 'none';
            }}
          />
        </div>
      </div>

      {/* Table container with horizontal scroll */}
      <div ref={tableContainerRef} className="overflow-x-auto" style={{ marginTop: '12px' }}>
        <table className="w-full border-collapse" style={{ fontSize: '14px' }} role="table" aria-label="Data preview table">
          {/* Sticky header */}
          <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-primary)' }}>
            <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
              <th 
                className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400 w-12 sticky left-0 z-20"
                style={{
                  borderRight: isScrolled ? '1px solid var(--border-default)' : 'none',
                  backgroundColor: 'var(--bg-primary)'
                }}
              >
                {/* Show "x" icon when rows are selected */}
                {state.selectedGrid && state.selectedGrid.rowIds.length > 0 && (
                  <button
                    onClick={handleClearAllSelections}
                    className="flex items-center justify-center transition-opacity hover:opacity-70"
                    style={{ cursor: 'pointer', width: '100%', height: '100%' }}
                    aria-label="Clear all selections"
                    title="Clear all selections"
                  >
                    <svg width="8" height="8" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L11 11M11 1L1 11" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300 select-none whitespace-nowrap relative ${
                    draggedColumn === column.key ? 'opacity-30' : ''
                  } ${dragOverColumn === column.key ? 'border-l-2 border-blue-500' : ''}`}
                  style={{
                    transition: 'opacity 0.2s, border 0.2s'
                  }}
                  onMouseEnter={() => setHoveredColumn(column.key)}
                  onMouseLeave={() => setHoveredColumn(null)}
                  onDragOver={(e) => handleDragOver(e, column.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column.key)}
                >
                  <div className="flex items-start gap-2">
                    {/* Drag icon - only visible on hover */}
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        handleDragStart(e, column.key);
                      }}
                      onDragEnd={handleDragEnd}
                      className="cursor-move transition-opacity"
                      style={{
                        opacity: hoveredColumn === column.key ? 1 : 0,
                        pointerEvents: hoveredColumn === column.key ? 'auto' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        marginTop: '8px'
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label="Drag to reorder column"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 10.125C3 10.7463 3.50368 11.25 4.125 11.25C4.74632 11.25 5.25 10.7463 5.25 10.125C5.25 9.50368 4.74632 9 4.125 9C3.50368 9 3 9.50368 3 10.125Z" fill="var(--text-muted)"/>
                        <path d="M6.75 10.125C6.75 10.7463 7.25368 11.25 7.875 11.25C8.49632 11.25 9 10.7463 9 10.125C9 9.50368 8.49632 9 7.875 9C7.25368 9 6.75 9.50368 6.75 10.125Z" fill="var(--text-muted)"/>
                        <path d="M3 1.875C3 2.49632 3.50368 3 4.125 3C4.74632 3 5.25 2.49632 5.25 1.875C5.25 1.25368 4.74632 0.75 4.125 0.75C3.50368 0.75 3 1.25368 3 1.875Z" fill="var(--text-muted)"/>
                        <path d="M6.75 1.875C6.75 2.49632 7.25368 3 7.875 3C8.49632 3 9 2.49632 9 1.875C9 1.25368 8.49632 0.75 7.875 0.75C7.25368 0.75 6.75 1.25368 6.75 1.875Z" fill="var(--text-muted)"/>
                        <path d="M3 6C3 6.62132 3.50368 7.125 4.125 7.125C4.74632 7.125 5.25 6.62132 5.25 6C5.25 5.37868 4.74632 4.875 4.125 4.875C3.50368 4.875 3 5.37868 3 6Z" fill="var(--text-muted)"/>
                        <path d="M6.75 6C6.75 6.62132 7.25368 7.125 7.875 7.125C8.49632 7.125 9 6.62132 9 6C9 5.37868 8.49632 4.875 7.875 4.875C7.25368 4.875 6.75 5.37868 6.75 6Z" fill="var(--text-muted)"/>
                      </svg>
                    </div>

                    {/* Column name - clickable area for popover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setColumnDropdownOpen(columnDropdownOpen === column.key ? null : column.key);
                        setShowFilterOptions(false);
                      }}
                      className="flex-1 text-left cursor-pointer transition-colors focus:outline-none px-2 py-1 -mx-2"
                      style={{
                        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                        minHeight: '36px',
                        borderRadius: '6px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      aria-label={`Column options for ${column.label}`}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-normal text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                            {getFieldLabel(column.object, column.field)}
                          </span>
                          {/* Group by indicator - show pin icon if this column is used for grouping */}
                          {state.groupBy && 
                           state.groupBy.field.object === column.object && 
                           state.groupBy.field.field === column.field && (
                            <svg 
                              width="12" 
                              height="12" 
                              viewBox="0 0 16 16" 
                              fill="none" 
                              xmlns="http://www.w3.org/2000/svg"
                              className="flex-shrink-0"
                              aria-label="Grouped by this column"
                            >
                              <path d="M8 3C8 2.44772 8.44772 2 9 2H11C11.5523 2 12 2.44772 12 3V6H13C13.5523 6 14 6.44772 14 7C14 7.55228 13.5523 8 13 8H12V11C12 11.5523 11.5523 12 11 12H9C8.44772 12 8 11.5523 8 11V8H7C6.44772 8 6 7.55228 6 7C6 6.44772 6.44772 6 7 6H8V3Z" fill="#6366f1"/>
                              <path d="M7.5 13V14.5" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          )}
                          {/* Down arrow icon - always visible when column is sorted, chevron on hover otherwise */}
                          {sortState.column === column.key ? (
                            <svg 
                              width="12" 
                              height="12" 
                              viewBox="0 0 12 12" 
                              fill="none" 
                              xmlns="http://www.w3.org/2000/svg"
                              className="flex-shrink-0"
                              style={{
                                transform: sortState.direction === 'asc' ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.2s'
                              }}
                            >
                              <path d="M6 3V9M6 9L3.5 6.5M6 9L8.5 6.5" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : (
                            <svg 
                              width="12" 
                              height="12" 
                              viewBox="0 0 12 12" 
                              fill="none" 
                              xmlns="http://www.w3.org/2000/svg"
                              className="flex-shrink-0"
                              style={{
                                opacity: hoveredColumn === column.key ? 1 : 0,
                                transition: 'opacity 0.2s'
                              }}
                            >
                              <path d="M3 4.5L6 7.5L9 4.5" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span className="truncate font-mono" style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 300 }}>
                          {column.key}
                        </span>
                      </div>
                    </button>

                    {/* Filter icon - only show when there's an active filter */}
                    {column.fieldDef && hasActiveFilter(column.object, column.field) && (
                      <div style={{ marginLeft: '12px' }}>
                        <FilterPopover
                          field={column.fieldDef}
                          objectName={column.object}
                          currentFilter={getActiveFilter(column.object, column.field)}
                          onFilterChange={(condition) => handleFilterChange(column.object, column.field, condition)}
                          distinctValues={distinctValuesCache[column.key]}
                          hasActiveFilter={hasActiveFilter(column.object, column.field)}
                          asMenuItem={true}
                          trigger={
                            <div 
                              className="transition-colors"
                              style={{ 
                                backgroundColor: 'var(--bg-surface)', 
                                padding: '6px', 
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '28px',
                                height: '28px',
                                cursor: 'pointer'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="1" y="3" width="14" height="1.5" rx="0.75" fill="#474E5A"/>
                                <rect x="3" y="7" width="10" height="1.5" rx="0.75" fill="#474E5A"/>
                                <rect x="5" y="11" width="6" height="1.5" rx="0.75" fill="#474E5A"/>
                              </svg>
                            </div>
                          }
                        />
                      </div>
                    )}
                  </div>

                    {/* Column dropdown menu */}
                    {columnDropdownOpen === column.key && (
                      <div
                        ref={columnDropdownRef}
                        className="absolute py-1 z-50"
                        style={{
                          top: '56px',
                          left: '12px',
                          marginTop: 0,
                          borderRadius: '16px',
                          minWidth: showFilterOptions ? '280px' : '180px',
                          boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
                          backgroundColor: 'var(--bg-elevated)'
                        }}
                      >
                      {!showFilterOptions ? (
                        <>
                      {/* Sort Descending */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSort(column.key);
                          if (sortState.column === column.key && sortState.direction === 'desc') {
                            setSortState({ column: null, direction: null });
                          } else {
                            setSortState({ column: column.key, direction: 'desc' });
                          }
                          setColumnDropdownOpen(null);
                          setShowFilterOptions(false);
                        }}
                        className="w-full text-left py-2 text-sm transition-colors flex items-center justify-between"
                        style={{
                          paddingLeft: '16px',
                          paddingRight: '16px',
                          color: 'var(--text-primary)',
                          fontWeight: 400,
                          height: '32px',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span>Sort descending</span>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M7 3V11M7 11L4 8M7 11L10 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>

                      {/* Sort Ascending */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSort(column.key);
                          if (sortState.column === column.key && sortState.direction === 'asc') {
                            setSortState({ column: null, direction: null });
                          } else {
                            setSortState({ column: column.key, direction: 'asc' });
                          }
                          setColumnDropdownOpen(null);
                          setShowFilterOptions(false);
                        }}
                        className="w-full text-left py-2 text-sm transition-colors flex items-center justify-between"
                        style={{
                          paddingLeft: '16px',
                          paddingRight: '16px',
                          color: 'var(--text-primary)',
                          fontWeight: 400,
                          height: '32px',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span>Sort ascending</span>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M7 11V3M7 3L4 6M7 3L10 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>

                      {/* Add filter */}
                      {column.fieldDef && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowFilterOptions(true);
                          }}
                          className="w-full text-left py-2 text-sm flex items-center justify-between transition-colors"
                          style={{
                            paddingLeft: '16px',
                            paddingRight: '16px',
                            color: 'var(--text-primary)',
                            fontWeight: 400,
                            height: '32px',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span>Add filter</span>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="1" y="3" width="14" height="1.5" rx="0.75" fill="#474E5A"/>
                            <rect x="3" y="7" width="10" height="1.5" rx="0.75" fill="#474E5A"/>
                            <rect x="5" y="11" width="6" height="1.5" rx="0.75" fill="#474E5A"/>
                          </svg>
                        </button>
                      )}

                      {/* Divider */}
                      <div style={{ height: '1px', backgroundColor: 'var(--bg-surface)', margin: '4px 0' }} />

                      {/* Remove column */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveColumn(column.object, column.field);
                          setColumnDropdownOpen(null);
                          setShowFilterOptions(false);
                        }}
                        className="w-full text-left py-2 text-sm transition-colors"
                        style={{
                          paddingLeft: '16px',
                          paddingRight: '16px',
                          color: '#E61947',
                          fontWeight: 400,
                          height: '32px',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span>Remove column</span>
                      </button>
                      </>
                      ) : (
                        <>
                          {/* Filter Options View */}
                          {column.fieldDef && (
                            <div style={{ padding: '12px' }}>
                              <FieldFilter
                                key={column.key}
                                field={column.fieldDef}
                                objectName={column.object}
                                currentFilter={getActiveFilter(column.object, column.field)}
                                onFilterChange={(condition) => {
                                  handleFilterChange(column.object, column.field, condition);
                                  setShowFilterOptions(false);
                                  setColumnDropdownOpen(null);
                                }}
                                onCancel={() => setShowFilterOptions(false)}
                                distinctValues={distinctValuesCache[column.key]}
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {paginatedRows.map((row, pageRowIndex) => {
              const actualRowIndex = currentPage * rowsPerPage + pageRowIndex;
              return (
                <tr
                  key={getRowKey(row)}
                  className={`transition-colors ${
                    isRowSelected(actualRowIndex) ? '' : ''
                  }`}
                  style={{
                    borderBottom: '1px solid var(--border-default)',
                    height: '44px',
                    backgroundColor: isRowSelected(actualRowIndex) ? 'var(--bg-selected)' : 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (!isRowSelected(actualRowIndex)) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isRowSelected(actualRowIndex)) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <td
                    className={`py-2 px-3 font-mono cursor-pointer sticky left-0 ${
                      isRowSelected(actualRowIndex) ? 'ring-1 ring-blue-500' : ''
                    }`}
                    style={{
                      borderRight: isScrolled ? '1px solid var(--border-default)' : 'none',
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-primary)'
                    }}
                    onMouseDown={(e) => {
                      // If row is selected, handle removal, otherwise select
                      if (isRowSelected(actualRowIndex)) {
                        handleRemoveRowFromSelection(e, actualRowIndex);
                      } else {
                        handleRowMouseDown(e, actualRowIndex);
                      }
                    }}
                    onMouseEnter={() => {
                      // Only trigger multi-row selection if not clicking on an already selected row
                      if (!isRowSelected(actualRowIndex)) {
                        handleRowMouseEnter(actualRowIndex);
                      }
                    }}
                  >
                    {isRowSelected(actualRowIndex) ? (
                      <button
                        className="flex items-center justify-center transition-opacity hover:opacity-70"
                        style={{ cursor: 'pointer', width: '100%', height: '100%' }}
                        aria-label="Remove row from selection"
                        title="Remove from selection"
                      >
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 1L11 11M11 1L1 11" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                    ) : (
                      actualRowIndex + 1
                    )}
                  </td>
                  {columns.map((column) => {
                    const cellValue = row.display[column.key];
                    const isNumeric = isNumericValue(cellValue);
                    const isSorted = sortState.column === column.key;
                    return (
                      <td
                        key={column.key}
                        className={`py-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-xs cursor-cell ${
                          isCellSelected(actualRowIndex, column.key) ? 'ring-1 ring-blue-500' : ''
                        }`}
                        style={{
                          textAlign: isNumeric ? 'right' : 'left',
                          fontVariantNumeric: isNumeric ? 'tabular-nums' : 'normal',
                          fontWeight: isSorted ? 600 : 400,
                          paddingLeft: '32px',
                          paddingRight: '12px',
                          color: 'var(--text-primary)',
                          backgroundColor: isCellSelected(actualRowIndex, column.key) ? 'var(--bg-selected)' : 'transparent'
                        }}
                        onMouseDown={(e) => handleCellMouseDown(e, actualRowIndex, column.key)}
                        onMouseEnter={() => handleCellMouseEnter(actualRowIndex, column.key)}
                      >
                        {formatValue(cellValue, column.key)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center">
          <div className="flex items-center text-sm" style={{ gap: '8px', color: 'var(--text-primary)' }}>
            <span>
              <span style={{ fontWeight: 600 }}>{Math.min((currentPage + 1) * rowsPerPage, sortedRows.length)}</span>
              <span style={{ fontWeight: 400 }}> of {sortedRows.length.toLocaleString()} results</span>
            </span>
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          duration={2000}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
