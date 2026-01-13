'use client';
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { useWarehouseStore } from '@/lib/useWarehouse';
import { buildDataListView, sortRowsByField, type RowView } from '@/lib/views';
import { getObject } from '@/data/schema';
import type { DataListElementData } from '@/types/mapElements';
import { useApp } from '@/state/app';

type SortDirection = 'asc' | 'desc' | null;
type SortState = { column: string | null; direction: SortDirection };

interface DataListNodeProps {
  data: DataListElementData & { isSelected?: boolean };
  id: string;
}

export const DataListNode = React.memo(({ data, id }: DataListNodeProps) => {
  const { state } = useApp();
  const { store: warehouse, version, loadEntity, has } = useWarehouseStore();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const rowsPerPage = 20;
  
  // Sort state
  const [sortState, setSortState] = useState<SortState>({
    column: null,
    direction: null,
  });
  
  // Dragging state
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Auto-load missing warehouse entities
  useEffect(() => {
    if (!data.selectedObjects) return;
    
    data.selectedObjects.forEach((objectName) => {
      if (!has(objectName as any)) {
        loadEntity(objectName as any).catch((err) => {
          console.error(`[DataListNode] Failed to load ${objectName}:`, err);
        });
      }
    });
  }, [data.selectedObjects, has, loadEntity]);

  // Build columns from selectedFields
  const columns = useMemo(() => {
    if (!data.selectedFields || data.selectedFields.length === 0) return [];

    return data.selectedFields.map((field) => {
      const obj = getObject(field.object);
      const fieldDef = obj?.fields.find((f) => f.name === field.field);
      const qualifiedName = `${field.object}.${field.field}`;

      return {
        key: qualifiedName,
        label: qualifiedName,
        type: fieldDef?.type || 'string',
        object: field.object,
        field: field.field,
      };
    });
  }, [data.selectedFields]);

  // Check if warehouse has all required data
  const warehouseKeys = useMemo(
    () => (data.selectedObjects || []).filter((obj) => has(obj as any)),
    [data.selectedObjects, has, version]
  );
  const hasWarehouseData = data.selectedObjects && warehouseKeys.length === data.selectedObjects.length;

  // Build rows
  const rows: RowView[] = useMemo(() => {
    if (!hasWarehouseData || !data.selectedFields || data.selectedFields.length === 0 || !data.selectedObjects) return [];

    try {
      const result = buildDataListView({
        store: warehouse,
        selectedObjects: data.selectedObjects,
        selectedFields: data.selectedFields,
      });
      return result;
    } catch (err) {
      console.error('[DataListNode] Error building view:', err);
      return [];
    }
  }, [
    hasWarehouseData,
    data.selectedFields,
    data.selectedObjects,
    warehouse.version,
  ]);

  // Apply sorting
  const sortedRows = useMemo(() => {
    if (!sortState.column || !sortState.direction) return rows;
    return sortRowsByField(rows, sortState.column, sortState.direction);
  }, [rows, sortState]);

  // Paginate rows
  const paginatedRows = useMemo(() => {
    const startIndex = currentPage * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return sortedRows.slice(startIndex, endIndex);
  }, [sortedRows, currentPage]);

  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);

  // Reset to page 0 when data changes
  useEffect(() => {
    setCurrentPage(0);
  }, [rows.length]);

  // Set default sort when columns change
  useEffect(() => {
    if (columns.length > 0 && sortState.column === null) {
      const firstColumn = columns[0];
      let defaultDirection: 'asc' | 'desc' = 'asc';
      
      if (firstColumn.type === 'number') {
        defaultDirection = 'desc';
      } else if (firstColumn.type === 'date') {
        defaultDirection = 'desc';
      }
      
      setSortState({
        column: firstColumn.key,
        direction: defaultDirection,
      });
    }
  }, [columns, sortState.column]);

  // Column drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, columnKey: string) => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    if (draggedColumn && draggedColumn !== columnKey) {
      setDragOverColumn(columnKey);
    }
  }, [draggedColumn]);

  const handleDrop = useCallback((e: React.DragEvent, targetColumnKey: string) => {
    e.preventDefault();
    // Note: Column reordering would update appState, which we're not doing in Map View yet
    setDraggedColumn(null);
    setDragOverColumn(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  }, []);

  // Sort handler
  const handleSort = useCallback((columnKey: string) => {
    setSortState((prev) => {
      if (prev.column === columnKey) {
        // Toggle: asc -> desc -> null
        if (prev.direction === 'asc') return { column: columnKey, direction: 'desc' };
        if (prev.direction === 'desc') return { column: null, direction: null };
      }
      return { column: columnKey, direction: 'asc' };
    });
  }, []);

  // Format cell value
  const formatValue = useCallback((value: any, columnKey: string): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }, []);

  if (!hasWarehouseData) {
    return (
      <div
        style={{
          minWidth: '600px',
          minHeight: '400px',
          backgroundColor: 'var(--bg-primary)',
          border: data.isSelected ? '2px solid #675DFF' : '1px solid var(--border-default)',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
        Loading data...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        style={{
          minWidth: '600px',
          minHeight: '400px',
          backgroundColor: 'var(--bg-primary)',
          border: data.isSelected ? '2px solid #675DFF' : '1px solid var(--border-default)',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
        No data to display
      </div>
    );
  }

  return (
    <div
      style={{
        minWidth: '800px',
        backgroundColor: 'var(--bg-primary)',
        border: data.isSelected ? '2px solid #675DFF' : '1px solid var(--border-default)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="3" width="14" height="3" rx="1" fill="var(--text-secondary)" />
            <rect x="3" y="8" width="14" height="2" rx="1" fill="var(--text-secondary)" opacity="0.5" />
            <rect x="3" y="12" width="14" height="2" rx="1" fill="var(--text-secondary)" opacity="0.5" />
            <rect x="3" y="16" width="14" height="2" rx="1" fill="var(--text-secondary)" opacity="0.5" />
          </svg>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {data.label}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {(data.selectedFields || []).length} fields • {(data.selectedObjects || []).length} objects
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-primary)' }}>
            <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
              {/* Row number column */}
              <th
                style={{
                  width: '48px',
                  textAlign: 'left',
                  padding: '12px',
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                }}
              >
                #
              </th>
              
              {/* Data columns */}
              {columns.map((column) => {
                const isSorted = sortState.column === column.key;
                const isNumeric = column.type === 'number';

                return (
                  <th
                    key={column.key}
                    draggable
                    onDragStart={(e) => handleDragStart(e, column.key)}
                    onDragOver={(e) => handleDragOver(e, column.key)}
                    onDrop={(e) => handleDrop(e, column.key)}
                    onDragEnd={handleDragEnd}
                    style={{
                      textAlign: isNumeric ? 'right' : 'left',
                      padding: '12px 16px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                      position: 'relative',
                      opacity: draggedColumn === column.key ? 0.3 : 1,
                      borderLeft: dragOverColumn === column.key ? '2px solid #675DFF' : 'none',
                      background: isSorted
                        ? 'linear-gradient(180deg, rgba(103, 93, 255, 0.08) 0%, rgba(103, 93, 255, 0.02) 100%)'
                        : 'transparent',
                    }}
                    onClick={() => handleSort(column.key)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{column.field}</span>
                        {isSorted && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            {sortState.direction === 'asc' ? (
                              <path d="M6 9V3M6 3L3 6M6 3L9 6" stroke="var(--text-primary)" strokeWidth="1.5" strokeLinecap="round" />
                            ) : (
                              <path d="M6 3V9M6 9L3 6M6 9L9 6" stroke="var(--text-primary)" strokeWidth="1.5" strokeLinecap="round" />
                            )}
                          </svg>
                        )}
                      </div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 300, fontFamily: 'monospace' }}>
                        {column.key}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, pageRowIndex) => {
              const actualRowIndex = currentPage * rowsPerPage + pageRowIndex;
              return (
                <tr
                  key={actualRowIndex}
                  style={{
                    borderBottom: '1px solid var(--border-default)',
                  }}
                >
                  {/* Row number */}
                  <td
                    style={{
                      padding: '12px',
                      color: 'var(--text-muted)',
                      fontSize: '12px',
                      fontWeight: 400,
                    }}
                  >
                    {actualRowIndex + 1}
                  </td>

                  {/* Data cells */}
                  {columns.map((column) => {
                    const cellValue = row.display[column.key];
                    const isNumeric = column.type === 'number';
                    const isSorted = sortState.column === column.key;

                    return (
                      <td
                        key={column.key}
                        style={{
                          padding: '12px 16px',
                          textAlign: isNumeric ? 'right' : 'left',
                          fontVariantNumeric: isNumeric ? 'tabular-nums' : 'normal',
                          fontWeight: isSorted ? 600 : 400,
                          color: 'var(--text-primary)',
                        }}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
            <span style={{ fontWeight: 600 }}>
              {Math.min((currentPage + 1) * rowsPerPage, sortedRows.length)}
            </span>
            <span style={{ fontWeight: 400 }}> of {sortedRows.length.toLocaleString()} results</span>
          </span>
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            style={{
              padding: '8px',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
              opacity: currentPage === 0 ? 0.3 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Previous page"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage >= totalPages - 1}
            style={{
              padding: '8px',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage >= totalPages - 1 ? 0.3 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Next page"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
});

DataListNode.displayName = 'DataListNode';
