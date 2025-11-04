'use client';
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useApp, actions } from '@/state/app';
import { useWarehouseStore } from '@/lib/useWarehouse';
import { getObject } from '@/data/schema';
import { buildDataListView, filterRowsByDate, getRowKey, sortRowsByField, type RowView } from '@/lib/views';
import { applyFilters } from '@/lib/filters';
import { FilterPopover } from './FilterPopover';
import { FieldFilter } from './FieldFilter';
import { FilterCondition } from '@/types';

type SortDirection = 'asc' | 'desc' | null;

type SortState = {
  column: string | null;
  direction: SortDirection;
};

type SelectionMode = 'cell' | 'row' | 'column' | 'multi-cell';

export function DataList() {
  const { state, dispatch } = useApp();
  const { store: warehouse, version, loadEntity, has } = useWarehouseStore();
  const [sortState, setSortState] = useState<SortState>({
    column: null,
    direction: null,
  });
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

    return buildDataListView({
      store: warehouse,
      selectedObjects: state.selectedObjects,
      selectedFields: state.selectedFields,
    });
  }, [state.selectedObjects, state.selectedFields, version]);

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
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 2.5H9.5M4 2.5V9.5M8 2.5V9.5M3 9.5H9" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'number':
      case 'integer':
      case 'float':
      case 'decimal':
        return (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3.5L5.5 8.5M6.5 3.5L9 8.5M3.5 6H8.5" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'date':
      case 'datetime':
      case 'timestamp':
        return (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2.5" width="8" height="7.5" rx="1" stroke="#6b7280" strokeWidth="1.2"/>
            <path d="M2 4.5H10M4 1.5V3.5M8 1.5V3.5" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        );
      case 'boolean':
      case 'bool':
        return (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="4" width="8" height="4" rx="2" stroke="#6b7280" strokeWidth="1.2"/>
            <circle cx="8" cy="6" r="1.5" fill="#6b7280"/>
          </svg>
        );
      case 'varchar':
        return (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3L4.5 8.5M7.5 3L9 8.5M4.5 6H7.5" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      default:
        return (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 2.5H9.5M4 2.5V9.5M8 2.5V9.5M3 9.5H9" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
    }
  };

  // Close column dropdown when clicking outside
  useEffect(() => {
    if (!columnDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(event.target as Node)) {
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

  // Paginated rows
  const paginatedRows = useMemo(() => {
    const startIndex = currentPage * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return sortedRows.slice(startIndex, endIndex);
  }, [sortedRows, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);

  // Reset to first page when sorting or filtering changes
  useEffect(() => {
    setCurrentPage(0);
  }, [sortState.column, sortState.direction, state.filters, state.selectedBucket]);

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
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px', color: '#000000' }}>
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
            <span style={{ fontWeight: 400, color: state.selectedBucket ? '#374151' : '#533AFD' }}>{rawRows.length.toLocaleString()}</span>
          </button>

          {/* Top spend chip */}
          <button
            className="inline-flex items-center transition-colors hover:bg-gray-100"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #f5f6f8',
              borderRadius: '50px',
              paddingLeft: '12px',
              paddingRight: '12px',
              paddingTop: '6px',
              paddingBottom: '6px',
              height: '30px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              gap: '6px',
            }}
          >
            <span>Top spend</span>
            <span style={{ fontWeight: 400 }}>4,382</span>
          </button>

          {/* First-time chip */}
          <button
            className="inline-flex items-center transition-colors hover:bg-gray-100"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #f5f6f8',
              borderRadius: '50px',
              paddingLeft: '12px',
              paddingRight: '12px',
              paddingTop: '6px',
              paddingBottom: '6px',
              height: '30px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              gap: '6px',
            }}
          >
            <span>First-time</span>
            <span style={{ fontWeight: 400 }}>3,182</span>
          </button>

          {/* Recent chip */}
          <button
            className="inline-flex items-center transition-colors hover:bg-gray-100"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #f5f6f8',
              borderRadius: '50px',
              paddingLeft: '12px',
              paddingRight: '12px',
              paddingTop: '6px',
              paddingBottom: '6px',
              height: '30px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              gap: '6px',
            }}
          >
            <span>Recent</span>
            <span style={{ fontWeight: 400 }}>873</span>
          </button>

          {/* Selected bucket chip - appears when a bucket is clicked */}
          {state.selectedBucket && (
            <div
              className="inline-flex items-center"
              style={{
                backgroundColor: 'transparent',
                border: '2px solid #675DFF',
                borderRadius: '50px',
                paddingLeft: '12px',
                paddingRight: '12px',
                paddingTop: '6px',
                paddingBottom: '6px',
                height: '30px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#533AFD',
                gap: '6px',
              }}
            >
              <span>{formatBucketLabel(state.selectedBucket)}</span>
              <span style={{ fontWeight: 400, color: '#533AFD' }}>{dateFilteredRows.length.toLocaleString()}</span>
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
              border: '1px solid #f5f6f8',
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
        <div className="relative" style={{ marginBottom: '12px' }}>
          <div className="absolute left-1 top-1 flex items-center justify-center" style={{ width: '32px', height: '32px', backgroundColor: '#f5f6f8', borderRadius: '50%' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="10" height="1.5" rx="0.75" fill="#6b7280"/>
              <rect x="3.5" y="5.5" width="7" height="1.5" rx="0.75" fill="#6b7280"/>
              <rect x="5" y="9" width="4" height="1.5" rx="0.75" fill="#6b7280"/>
            </svg>
          </div>
          <input
            type="text"
            placeholder="Filter table using natural language"
            className="w-full text-sm focus:outline-none"
            style={{ 
              fontSize: '14px', 
              borderRadius: '50px',
              paddingLeft: '44px',
              paddingRight: '16px',
              paddingTop: '4px',
              paddingBottom: '4px',
              height: '40px',
              border: '1px solid #f5f6f8',
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
          <thead className="sticky top-0 z-10 bg-white dark:bg-gray-900">
            <tr style={{ borderBottom: '1px solid #f5f6f8' }}>
              <th 
                className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400 w-12 sticky left-0 bg-white dark:bg-gray-900 z-20"
                style={{
                  borderRight: isScrolled ? '1px solid #f5f6f8' : 'none'
                }}
              >
                
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300 select-none whitespace-nowrap relative ${
                    draggedColumn === column.key ? 'opacity-30' : ''
                  } ${dragOverColumn === column.key ? 'border-l-2 border-blue-500' : ''} ${isColumnSelected(column.key) ? 'ring-1 ring-blue-500 bg-blue-50 dark:bg-blue-900/30' : ''}`}
                  style={{
                    transition: 'opacity 0.2s, border 0.2s'
                  }}
                  onMouseEnter={() => setHoveredColumn(column.key)}
                  onMouseLeave={() => setHoveredColumn(null)}
                  onDragOver={(e) => handleDragOver(e, column.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column.key)}
                >
                  <div className="flex items-center gap-2">
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
                        alignItems: 'center'
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label="Drag to reorder column"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 10.125C3 10.7463 3.50368 11.25 4.125 11.25C4.74632 11.25 5.25 10.7463 5.25 10.125C5.25 9.50368 4.74632 9 4.125 9C3.50368 9 3 9.50368 3 10.125Z" fill="#99A5B8"/>
                        <path d="M6.75 10.125C6.75 10.7463 7.25368 11.25 7.875 11.25C8.49632 11.25 9 10.7463 9 10.125C9 9.50368 8.49632 9 7.875 9C7.25368 9 6.75 9.50368 6.75 10.125Z" fill="#99A5B8"/>
                        <path d="M3 1.875C3 2.49632 3.50368 3 4.125 3C4.74632 3 5.25 2.49632 5.25 1.875C5.25 1.25368 4.74632 0.75 4.125 0.75C3.50368 0.75 3 1.25368 3 1.875Z" fill="#99A5B8"/>
                        <path d="M6.75 1.875C6.75 2.49632 7.25368 3 7.875 3C8.49632 3 9 2.49632 9 1.875C9 1.25368 8.49632 0.75 7.875 0.75C7.25368 0.75 6.75 1.25368 6.75 1.875Z" fill="#99A5B8"/>
                        <path d="M3 6C3 6.62132 3.50368 7.125 4.125 7.125C4.74632 7.125 5.25 6.62132 5.25 6C5.25 5.37868 4.74632 4.875 4.125 4.875C3.50368 4.875 3 5.37868 3 6Z" fill="#99A5B8"/>
                        <path d="M6.75 6C6.75 6.62132 7.25368 7.125 7.875 7.125C8.49632 7.125 9 6.62132 9 6C9 5.37868 8.49632 4.875 7.875 4.875C7.25368 4.875 6.75 5.37868 6.75 6Z" fill="#99A5B8"/>
                      </svg>
                    </div>

                    {/* Column name and type icon */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setColumnDropdownOpen(columnDropdownOpen === column.key ? null : column.key);
                        setShowFilterOptions(false);
                      }}
                      className="flex-1 text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1 flex items-center gap-1.5"
                      style={{
                        fontSize: '14px',
                        color: '#596171',
                        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                        height: '28px'
                      }}
                      aria-label={`Column options for ${column.label}`}
                    >
                      <span>{column.label}</span>
                      {getTypeIcon(column.type)}
                      {/* Chevron icon - visible on hover */}
                      <svg 
                        width="12" 
                        height="12" 
                        viewBox="0 0 12 12" 
                        fill="none" 
                        xmlns="http://www.w3.org/2000/svg"
                        style={{
                          opacity: hoveredColumn === column.key ? 1 : 0,
                          transition: 'opacity 0.2s'
                        }}
                      >
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="#596171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    {/* Filter icon - only show when there's an active filter */}
                    {column.fieldDef && hasActiveFilter(column.object, column.field) && (
                      <FilterPopover
                        field={column.fieldDef}
                        objectName={column.object}
                        currentFilter={getActiveFilter(column.object, column.field)}
                        onFilterChange={(condition) => handleFilterChange(column.object, column.field, condition)}
                        distinctValues={distinctValuesCache[column.key]}
                        hasActiveFilter={hasActiveFilter(column.object, column.field)}
                        trigger={
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                          </svg>
                        }
                      />
                    )}
                  </div>

                  {/* Column dropdown menu */}
                  {columnDropdownOpen === column.key && (
                    <div
                      ref={columnDropdownRef}
                      className="absolute bg-white py-1 z-50"
                      style={{
                        top: '40px',
                        left: '12px',
                        marginTop: 0,
                        borderRadius: '16px',
                        minWidth: showFilterOptions ? '280px' : '180px',
                        boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)'
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
                          color: '#374151',
                          fontWeight: 400,
                          height: '32px',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f6f8'}
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
                          color: '#374151',
                          fontWeight: 400,
                          height: '32px',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f6f8'}
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
                            color: '#374151',
                            fontWeight: 400,
                            height: '32px',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f6f8'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span>Add filter</span>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="2" y="2" width="10" height="1.5" rx="0.75" fill="#6b7280"/>
                            <rect x="3.5" y="5.5" width="7" height="1.5" rx="0.75" fill="#6b7280"/>
                            <rect x="5" y="9" width="4" height="1.5" rx="0.75" fill="#6b7280"/>
                          </svg>
                        </button>
                      )}

                      {/* Divider */}
                      <div style={{ height: '1px', backgroundColor: '#f5f6f8', margin: '4px 0' }} />

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
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f6f8'}
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
                    isRowSelected(actualRowIndex) ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                  }`}
                  style={{
                    borderBottom: '1px solid #f5f6f8',
                    height: '44px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isRowSelected(actualRowIndex)) {
                      e.currentTarget.style.backgroundColor = '#f5f6f8';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isRowSelected(actualRowIndex)) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <td
                    className={`py-2 px-3 text-gray-400 dark:text-gray-500 font-mono cursor-pointer sticky left-0 bg-white dark:bg-gray-900 ${
                      isRowSelected(actualRowIndex) ? 'ring-1 ring-blue-500' : ''
                    }`}
                    style={{
                      borderRight: isScrolled ? '1px solid #f5f6f8' : 'none'
                    }}
                    onClick={(e) => handleRowClick(e, actualRowIndex)}
                  >
                    {actualRowIndex + 1}
                  </td>
                  {columns.map((column) => {
                    const cellValue = row.display[column.key];
                    const isNumeric = isNumericValue(cellValue);
                    const isSorted = sortState.column === column.key;
                    return (
                      <td
                        key={column.key}
                        className={`py-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-xs cursor-cell text-gray-900 dark:text-gray-200 ${
                          isCellSelected(actualRowIndex, column.key) ? 'ring-1 ring-blue-500 bg-blue-100 dark:bg-blue-900/50' : ''
                        }`}
                        style={{
                          textAlign: isNumeric ? 'right' : 'left',
                          fontVariantNumeric: isNumeric ? 'tabular-nums' : 'normal',
                          fontWeight: isSorted ? 600 : 400,
                          paddingLeft: '32px',
                          paddingRight: '12px'
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
          <div className="flex items-center text-sm text-gray-900" style={{ gap: '8px' }}>
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
    </div>
  );
}
