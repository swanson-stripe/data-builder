'use client';
import { useEffect, useState, useCallback, useMemo, RefObject } from 'react';
import { useApp } from '@/state/app';

interface ConnectionLinesProps {
  containerRef: RefObject<HTMLDivElement | null>;
  expandedTables: Record<string, boolean>; // Track which tables are expanded
  expandedFields: Record<string, boolean>; // Track which fields are expanded
  expandedFilters: Record<string, boolean>; // Track which filters are expanded
  showAllFieldsMap?: Record<string, boolean>; // Track which tables show all fields
  searchQuery?: string; // Track search query to trigger recalculation
}

interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Connection {
  id: string;
  from: ElementPosition;
  to: ElementPosition;
  type: 'table-table' | 'table-fields' | 'field-filter';
  fieldPositions?: Array<{ field: string; pos: ElementPosition }>; // For table-fields type
}

export function ConnectionLines({ containerRef, expandedTables, expandedFields, expandedFilters, showAllFieldsMap = {}, searchQuery = '' }: ConnectionLinesProps) {
  const { state } = useApp();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });

  // Memoize selector strings to reduce repeated string concatenation
  const selectors = useMemo(() => {
    const tableSelectors = new Map<string, string>();
    const fieldSelectors = new Map<string, string>();
    const filterSelectors = new Map<string, string>();
    
    state.selectedObjects.forEach(objectName => {
      tableSelectors.set(objectName, `[data-connection-id="table-${objectName}"]`);
    });
    
    state.selectedFields.forEach(field => {
      const fieldId = `${field.object}.${field.field}`;
      fieldSelectors.set(fieldId, `[data-connection-id="field-${fieldId}"]`);
      filterSelectors.set(fieldId, `[data-connection-id="filter-${fieldId}"]`);
    });
    
    return { tableSelectors, fieldSelectors, filterSelectors };
  }, [state.selectedObjects, state.selectedFields]);

  const calculateConnections = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;

    const newConnections: Connection[] = [];

    // Helper to get element position relative to container
    const getElementPosition = (element: Element): ElementPosition | null => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left - containerRect.left + scrollLeft,
        y: rect.top - containerRect.top + scrollTop,
        width: rect.width,
        height: rect.height,
      };
    };

    // Table-to-fields connections (vertical line with horizontal branches)
    state.selectedObjects.forEach((objectName) => {
      const selectedFieldsForObject = state.selectedFields.filter(
        (f) => f.object === objectName
      );
      
      if (selectedFieldsForObject.length === 0) return;
      
      // Get table chip position using memoized selector
      const tableSelector = selectors.tableSelectors.get(objectName);
      if (!tableSelector) return;
      const tableChipEl = container.querySelector(tableSelector);
      if (!tableChipEl) return;
      
      const tableChipPos = getElementPosition(tableChipEl);
      if (!tableChipPos) return;
      
      // Get all field element positions using memoized selectors
      const fieldPositions: Array<{ field: string; pos: ElementPosition }> = [];
      selectedFieldsForObject.forEach((field) => {
        const fieldId = `${objectName}.${field.field}`;
        const fieldSelector = selectors.fieldSelectors.get(fieldId);
        if (!fieldSelector) return;
        const fieldEl = container.querySelector(fieldSelector);
        if (fieldEl) {
          const pos = getElementPosition(fieldEl);
          if (pos) {
            fieldPositions.push({ field: field.field, pos });
          }
        }
      });
      
      if (fieldPositions.length === 0) return;
      
      // Sort by vertical position
      fieldPositions.sort((a, b) => a.pos.y - b.pos.y);
      
      // Create connections for this table's fields
      newConnections.push({
        id: `table-fields-${objectName}`,
        from: tableChipPos, // Store table chip position
        to: { x: 0, y: 0, width: 0, height: 0 }, // Not used for this type
        type: 'table-fields',
        fieldPositions, // Store positions for rendering
      });
    });

    // Find all field-to-filter connections (including expanded fields with no filter yet)
    // First, add connections for fields with actual filters
    state.filters.conditions.forEach((condition) => {
      const fieldId = `${condition.field.object}.${condition.field.field}`;
      const fieldSelector = selectors.fieldSelectors.get(fieldId);
      const filterSelector = selectors.filterSelectors.get(fieldId);
      
      if (!fieldSelector || !filterSelector) return;
      const fieldEl = container.querySelector(fieldSelector);
      const filterEl = container.querySelector(filterSelector);

      if (!fieldEl || !filterEl) return;

      const fieldPos = getElementPosition(fieldEl);
      const filterPos = getElementPosition(filterEl);

      if (!fieldPos || !filterPos) return;

      newConnections.push({
        id: `field-${condition.field.object}.${condition.field.field}-filter`,
        from: fieldPos,
        to: filterPos,
        type: 'field-filter',
      });
    });
    
    // Also add connections for expanded fields that don't have filters yet
    state.selectedFields.forEach((field) => {
      const fieldId = `${field.object}.${field.field}`;
      const isFieldExpanded = expandedFields[fieldId];
      
      // Only proceed if field is expanded
      if (!isFieldExpanded) return;
      
      // Check if this field already has a filter connection
      const hasFilter = state.filters.conditions.some(
        (c) => c.field.object === field.object && c.field.field === field.field
      );
      
      // If it has a filter, we already drew the connection above
      if (hasFilter) return;
      
      // Find the field and filter elements using memoized selectors
      const fieldSelector = selectors.fieldSelectors.get(fieldId);
      const filterSelector = selectors.filterSelectors.get(fieldId);
      
      if (!fieldSelector || !filterSelector) return;
      const fieldEl = container.querySelector(fieldSelector);
      const filterEl = container.querySelector(filterSelector);
      
      if (!fieldEl || !filterEl) return;
      
      const fieldPos = getElementPosition(fieldEl);
      const filterPos = getElementPosition(filterEl);
      
      if (!fieldPos || !filterPos) return;
      
      newConnections.push({
        id: `field-${fieldId}-filter-empty`,
        from: fieldPos,
        to: filterPos,
        type: 'field-filter',
      });
    });

    setConnections(newConnections);

    // Update SVG dimensions to match container scroll area
    setSvgDimensions({
      width: container.scrollWidth,
      height: container.scrollHeight,
    });
  }, [containerRef, state.selectedObjects, state.selectedFields, state.filters.conditions, expandedTables, expandedFields, expandedFilters, showAllFieldsMap, searchQuery, selectors]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial calculation with a slight delay to ensure DOM is ready
    const initialDelay = setTimeout(() => {
      requestAnimationFrame(() => {
        calculateConnections();
      });
    }, 100);

    // Debounce resize calculations
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        requestAnimationFrame(calculateConnections);
      }, 250); // Increased from 100ms for better performance
    };

    // Handle scroll with requestAnimationFrame for performance
    let scrollRafId: number | null = null;
    const handleScroll = () => {
      if (scrollRafId !== null) return;
      scrollRafId = requestAnimationFrame(() => {
        calculateConnections();
        scrollRafId = null;
      });
    };

    // Add event listeners
    container.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      clearTimeout(initialDelay);
      if (scrollRafId !== null) cancelAnimationFrame(scrollRafId);
      clearTimeout(resizeTimeout);
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [containerRef, calculateConnections]);

  // Re-calculate when selections or filters change - with delay to let DOM update
  useEffect(() => {
    const timeout = setTimeout(() => {
      requestAnimationFrame(calculateConnections);
    }, 150); // Increased from 50ms for better performance
    return () => clearTimeout(timeout);
  }, [calculateConnections]);

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      style={{
        width: svgDimensions.width || '100%',
        height: svgDimensions.height || '100%',
        zIndex: 1,
      }}
    >
      {connections.map((connection) => {
        if (connection.type === 'table-fields') {
          // Table-to-fields: vertical line from table chip with horizontal branches
          if (!connection.fieldPositions || connection.fieldPositions.length === 0) return null;
          
          const fieldPos = connection.fieldPositions;
          const tableChip = connection.from;
          
          // Calculate vertical line position (fixed 16px from left edge of chip)
          const verticalX = tableChip.x + 16;
          
          // Vertical line starts 4px below the bottom edge of table chip
          const verticalStartY = tableChip.y + tableChip.height + 4;
          
          // Vertical line ends at the last field's center
          const verticalEndY = fieldPos[fieldPos.length - 1].pos.y + fieldPos[fieldPos.length - 1].pos.height / 2;
          
          const radius = 8; // 8px corner radius
          
          return (
            <g key={connection.id}>
              {/* Continuous vertical line from table chip, stopping before last field's curve */}
              <line
                x1={verticalX}
                y1={verticalStartY}
                x2={verticalX}
                y2={verticalEndY - radius}
                stroke="var(--connection-line)"
                strokeWidth="2"
                opacity="1"
              />
              
              {/* Curved branches to each field with arrows */}
              {fieldPos.map((field, idx) => {
                const fieldCenterY = field.pos.y + field.pos.height / 2;
                const fieldLeftX = field.pos.x;
                
                // Create curved branch path - stop 4px before chip edge
                const branchPath = `
                  M ${verticalX} ${fieldCenterY - radius}
                  Q ${verticalX} ${fieldCenterY} ${verticalX + radius} ${fieldCenterY}
                  L ${fieldLeftX - 4} ${fieldCenterY}
                `;
                
                return (
                  <g key={`${connection.id}-${field.field}-${idx}`}>
                    <path
                      d={branchPath}
                      stroke="var(--connection-line)"
                      strokeWidth="2"
                      fill="none"
                      opacity="1"
                    />
                    {/* Arrow at the end of horizontal line */}
                    <svg
                      x={fieldLeftX - 12}
                      y={fieldCenterY - 6}
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M3.38128 0.381282C3.72299 0.0395728 4.27701 0.0395728 4.61872 0.381282L9.61872 5.38128C9.96043 5.72299 9.96043 6.27701 9.61872 6.61872L4.61872 11.6187C4.27701 11.9604 3.72299 11.9604 3.38128 11.6187C3.03957 11.277 3.03957 10.723 3.38128 10.3813L7.76256 6L3.38128 1.61872C3.03957 1.27701 3.03957 0.72299 3.38128 0.381282Z"
                        fill="var(--connection-arrow)"
                      />
                    </svg>
                  </g>
                );
              })}
            </g>
          );
        } else {
          // Field-to-filter: vertical line from field chip with horizontal branch to filter
          const fieldChip = connection.from;
          const filterChip = connection.to;
          
          // Calculate vertical line position (fixed 16px from left edge of chip)
          const verticalX = fieldChip.x + 16;
          
          // Vertical line starts 4px below the bottom edge of field chip
          const verticalStartY = fieldChip.y + fieldChip.height + 4;
          
          // Vertical line ends at filter's vertical center
          const verticalEndY = filterChip.y + filterChip.height / 2;
          
          // Horizontal line extends from vertical line, stopping 4px before filter edge
          const filterLeftX = filterChip.x;
          
          const radius = 8; // 8px corner radius
          
          // Create path with curved corner - stop 4px before chip edge
          const pathData = `
            M ${verticalX} ${verticalStartY}
            L ${verticalX} ${verticalEndY - radius}
            Q ${verticalX} ${verticalEndY} ${verticalX + radius} ${verticalEndY}
            L ${filterLeftX - 4} ${verticalEndY}
          `;
          
          return (
            <g key={connection.id}>
              <path
                d={pathData}
                stroke="var(--connection-line)"
                strokeWidth="2"
                fill="none"
                opacity="1"
              />
              {/* Arrow at the end of horizontal line */}
              <svg
                x={filterLeftX - 12}
                y={verticalEndY - 6}
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M3.38128 0.381282C3.72299 0.0395728 4.27701 0.0395728 4.61872 0.381282L9.61872 5.38128C9.96043 5.72299 9.96043 6.27701 9.61872 6.61872L4.61872 11.6187C4.27701 11.9604 3.72299 11.9604 3.38128 11.6187C3.03957 11.277 3.03957 10.723 3.38128 10.3813L7.76256 6L3.38128 1.61872C3.03957 1.27701 3.03957 0.72299 3.38128 0.381282Z"
                  fill="var(--connection-arrow)"
                />
              </svg>
            </g>
          );
        }
      })}
    </svg>
  );
}

