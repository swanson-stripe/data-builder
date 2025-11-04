'use client';
import { useState, useMemo, useRef, useEffect, forwardRef } from 'react';
import { useApp, actions } from '@/state/app';
import schema, { getRelated } from '@/data/schema';
import { SchemaObject } from '@/types';
import { FieldFilter } from './FieldFilter';
import { FilterLogicToggle } from './FilterLogicToggle';
import { FilterCondition } from '@/types';
import { useWarehouseStore } from '@/lib/useWarehouse';

const ObjectCard = forwardRef<HTMLDivElement, { object: SchemaObject; searchQuery: string }>(
  ({ object, searchQuery }, ref) => {
    const { state, dispatch } = useApp();
    const { store: warehouse, version } = useWarehouseStore();
    const [expanded, setExpanded] = useState(false);
    const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({});

    const isObjectSelected = state.selectedObjects.includes(object.name);
    const relationships = getRelated(object.name);
    
    // Filter fields based on search query
    const query = searchQuery.toLowerCase();
    const filteredFields = searchQuery 
      ? object.fields.filter(field => 
          field.name.toLowerCase().includes(query) ||
          field.label.toLowerCase().includes(query)
        )
      : object.fields;
    
    // Auto-expand if there's a search query and matching fields
    const hasMatchingFields = searchQuery && filteredFields.length > 0;
    const shouldBeExpanded = hasMatchingFields || expanded;
  
  // Compute distinct values for enum fields from actual warehouse data
  const distinctValuesCache = useMemo(() => {
    const cache: Record<string, string[]> = {};
    
    // Get the data array for this object
    const dataArray = warehouse[object.name as keyof typeof warehouse];
    if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0) {
      return cache;
    }
    
    // For each field with an enum, compute distinct values
    object.fields.forEach(field => {
      if (field.enum && field.type === 'string') {
        const distinctSet = new Set<string>();
        dataArray.forEach((item: any) => {
          const value = item[field.name];
          if (value && typeof value === 'string') {
            distinctSet.add(value);
          }
        });
        // Sort alphabetically for consistent display
        cache[field.name] = Array.from(distinctSet).sort();
      }
    });
    
    return cache;
  }, [object.name, object.fields, warehouse, version]);

  // Count selected fields for this object
  const selectedFieldCount = state.selectedFields.filter(
    (f) => f.object === object.name
  ).length;

  // Filter relationships to only show connections to OTHER selected objects
  const selectedRelationships = relationships.filter(rel => {
    const otherObject = rel.from === object.name ? rel.to : rel.from;
    return state.selectedObjects.includes(otherObject);
  });

  // Show all selected relationships (not just 3)
  const relationshipSummary = selectedRelationships.length > 0 ? (
    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1">
      {selectedRelationships.map((rel, idx) => {
        const isFrom = rel.from === object.name;
        const otherObject = isFrom ? rel.to : rel.from;
        const direction = isFrom ? '→' : '←';
        return (
          <div key={idx} className="flex items-center gap-1">
            <span className="text-gray-400 dark:text-gray-500">{direction}</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{otherObject}</span>
            <span className="text-gray-400 dark:text-gray-500 text-[10px]">
              ({rel.type})
            </span>
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <div ref={ref} className={`p-3 bg-white dark:bg-gray-700 hover:bg-[#f5f6f8] dark:hover:bg-gray-600 transition-colors relative ${isObjectSelected ? 'mb-4' : 'mb-2'}`} style={{ zIndex: 2, borderRadius: '8px' }}>
      {/* Object header */}
      <div className="flex items-start gap-1">
        <button
          onClick={() => setExpanded(!expanded)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setExpanded(!expanded);
            }
          }}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-[#D8DEE4] p-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded flex-shrink-0 cursor-pointer transition-colors"
          style={{ marginTop: '1px' }}
          aria-label={`${shouldBeExpanded ? 'Collapse' : 'Expand'} ${object.label} fields`}
          aria-expanded={shouldBeExpanded}
        >
          <svg 
            className={`w-4 h-4 transition-transform ${shouldBeExpanded ? 'rotate-90' : ''}`}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0 flex flex-col">
              {/* Title row */}
              <span className="font-medium text-sm text-gray-800 dark:text-gray-100 truncate">
                {object.label}
              </span>
              
            </div>
            <div 
              className="flex items-center justify-center text-xs px-2.5 py-1 flex-shrink-0" 
              style={{ 
                backgroundColor: selectedFieldCount > 0 ? '#675DFF' : '#f5f6f8',
                color: selectedFieldCount > 0 ? '#ffffff' : '#6b7280',
                borderRadius: '12px', 
                minWidth: '32px' 
              }}
            >
              {selectedFieldCount > 0 ? `${selectedFieldCount} of ${object.fields.length}` : object.fields.length}
            </div>
          </div>

          {/* Relationship hints */}
          {relationshipSummary}

          {/* Expandable field list */}
          {shouldBeExpanded && (
            <div className="mt-3 space-y-0" role="group" aria-label={`${object.label} fields`}>
              {filteredFields.map((field) => {
                const isFieldSelected = state.selectedFields.some(
                  (f) => f.object === object.name && f.field === field.name
                );
                const qualifiedName = `${object.name}.${field.name}`;
                const isFilterExpanded = expandedFilters[field.name] || false;
                
                // Check if this field has an active filter
                const activeFilter = state.filters.conditions.find(
                  c => c.field.object === object.name && c.field.field === field.name
                );
                
                const handleFilterChange = (condition: FilterCondition | null) => {
                  if (condition) {
                    // Check if filter already exists
                    const existingIndex = state.filters.conditions.findIndex(
                      c => c.field.object === object.name && c.field.field === field.name
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
                      c => c.field.object === object.name && c.field.field === field.name
                    );
                    if (existingIndex >= 0) {
                      dispatch(actions.removeFilter(existingIndex));
                    }
                  }
                };
                
                const handleFieldToggle = () => {
                  // If object is not selected, select it first
                  if (!isObjectSelected) {
                    dispatch(actions.toggleObject(object.name));
                  }
                  // Then toggle the field
                  dispatch(actions.toggleField(object.name, field.name));
                };
                
                return (
                  <div key={field.name}>
                    <div className="flex items-start justify-between py-2 text-xs group cursor-pointer transition-colors relative">
                      {/* Expand/collapse chevron */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedFilters(prev => ({
                            ...prev,
                            [field.name]: !prev[field.name],
                          }));
                        }}
                        className="p-0.5 hover:bg-[#D8DEE4] rounded transition-colors mr-1 flex-shrink-0"
                        aria-label={`${isFilterExpanded ? 'Collapse' : 'Expand'} filter for ${qualifiedName}`}
                      >
                        <svg
                          className={`w-3 h-3 text-gray-400 dark:text-gray-500 transition-transform ${isFilterExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      
                      {/* Field info - clickable area */}
                      <div 
                        onClick={handleFieldToggle}
                        className="flex-1 min-w-0 pr-2 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`font-mono text-[13px] truncate transition-colors ${
                            isFieldSelected 
                              ? 'text-[#533AFD] font-semibold' 
                              : 'text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-gray-100'
                          }`}>
                            {qualifiedName}
                          </div>
                          
                          {/* Selected checkmark */}
                          {isFieldSelected && (
                            <div className="relative w-4 h-4 flex-shrink-0">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                                stroke="#675DFF"
                              >
                                <circle cx="12" cy="12" r="10" />
                                <path d="M9 12l2 2 4-4" />
                              </svg>
                            </div>
                          )}
                          
                          {/* Filter indicator */}
                          {activeFilter && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedFilters(prev => ({
                                  ...prev,
                                  [field.name]: !prev[field.name],
                                }));
                              }}
                              className="hover:opacity-80 transition-opacity flex-shrink-0"
                              aria-label={`${isFilterExpanded ? 'Collapse' : 'Expand'} filter for ${qualifiedName}`}
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                                stroke="#675DFF"
                              >
                                <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className={`text-[12px] mt-0.5 transition-colors ${
                          isFieldSelected
                            ? 'text-[#533AFD]'
                            : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400'
                        }`}>
                          {field.type}
                        </div>
                      </div>
                    </div>
                    
                    {/* Filter controls when expanded */}
                    {isFilterExpanded && (
                      <FieldFilter
                        field={field}
                        objectName={object.name}
                        currentFilter={activeFilter}
                        onFilterChange={handleFilterChange}
                        distinctValues={distinctValuesCache[field.name]}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ObjectCard.displayName = 'ObjectCard';

export function DataTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const { state, dispatch } = useApp();
  const [cardPositions, setCardPositions] = useState<Record<string, DOMRect>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter objects based on search
  const filteredObjects = schema.objects.filter((obj) => {
    const query = searchQuery.toLowerCase();
    return (
      obj.name.toLowerCase().includes(query) ||
      obj.label.toLowerCase().includes(query) ||
      obj.fields.some(
        (field) =>
          field.name.toLowerCase().includes(query) ||
          field.label.toLowerCase().includes(query)
      )
    );
  });

  // Helper to count connections for a given object among selected objects
  const getConnectionCount = (objectName: string, selectedObjs: string[]) => {
    const relationships = getRelated(objectName);
    return relationships.filter(rel => {
      const otherObject = rel.from === objectName ? rel.to : rel.from;
      return selectedObjs.includes(otherObject);
    }).length;
  };

  // Sort selected objects by connection count (most connected first)
  const sortedObjects = [...filteredObjects].sort((a, b) => {
    const aSelected = state.selectedObjects.includes(a.name);
    const bSelected = state.selectedObjects.includes(b.name);

    // Selected objects come first
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;

    if (aSelected && bSelected) {
      // Both selected: sort by connection count (descending)
      const aCount = getConnectionCount(a.name, state.selectedObjects);
      const bCount = getConnectionCount(b.name, state.selectedObjects);
      if (aCount !== bCount) return bCount - aCount;
    }

    // Within same selection state, sort alphabetically
    return a.label.localeCompare(b.label);
  });

  // Update card positions when objects or selection changes
  useEffect(() => {
    const updatePositions = () => {
      if (!containerRef.current) return;
      
      const container = containerRef.current;
      const scrollTop = container.scrollTop;
      const scrollLeft = container.scrollLeft;
      const positions: Record<string, DOMRect> = {};
      
      Object.entries(cardRefs.current).forEach(([name, ref]) => {
        if (ref) {
          const rect = ref.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          // Calculate positions relative to container including scroll offset
          positions[name] = {
            width: rect.width,
            height: rect.height,
            top: rect.top - containerRect.top + scrollTop,
            bottom: rect.bottom - containerRect.top + scrollTop,
            left: rect.left - containerRect.left + scrollLeft,
            right: rect.right - containerRect.left + scrollLeft,
            x: rect.left - containerRect.left + scrollLeft,
            y: rect.top - containerRect.top + scrollTop,
            toJSON: () => ({}),
          } as DOMRect;
        }
      });
      
      setCardPositions(positions);
    };

    // Update positions after render
    requestAnimationFrame(updatePositions);
    
    const container = containerRef.current;
    
    // Update on scroll
    if (container) {
      container.addEventListener('scroll', updatePositions);
    }
    
    // Update on window resize
    window.addEventListener('resize', updatePositions);
    
    return () => {
      if (container) {
        container.removeEventListener('scroll', updatePositions);
      }
      window.removeEventListener('resize', updatePositions);
    };
  }, [sortedObjects, state.selectedObjects]);

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="mb-3 relative pr-[11px]">
        <label htmlFor="object-search" className="sr-only">
          Search objects and fields
        </label>
        <input
          id="object-search"
          type="text"
          placeholder="Search objects and fields..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#675DFF]"
          style={{ borderRadius: '8px' }}
          aria-describedby="search-results-count"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Clear search"
            aria-label="Clear search"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filter logic toggle */}
      {state.filters.conditions.length > 1 && (
        <FilterLogicToggle
          logic={state.filters.logic}
          onToggle={() =>
            dispatch(actions.setFilterLogic(state.filters.logic === 'AND' ? 'OR' : 'AND'))
          }
        />
      )}

      {/* Results count */}
      {searchQuery && (
        <div id="search-results-count" className="text-xs text-gray-500 dark:text-gray-400 mb-2 ml-3 pr-[11px]" role="status" aria-live="polite">
          {filteredObjects.length} results
        </div>
      )}

      {/* Object list with SVG overlay for connections */}
      <div ref={containerRef} className="flex-1 overflow-y-auto relative custom-scrollbar" role="list" aria-label="Data objects">
        {/* SVG connections overlay */}
        {state.selectedObjects.length > 1 && Object.keys(cardPositions).length > 0 && (
          <svg 
            className="absolute top-0 left-0 pointer-events-none" 
            style={{ 
              width: '100%', 
              height: '100%',
              minHeight: '100%',
              zIndex: 1
            }}
          >
            <defs>
              <marker 
                id="arrowhead" 
                markerWidth="8" 
                markerHeight="8" 
                refX="7" 
                refY="2.5" 
                orient="auto"
              >
                <polygon points="0 0, 8 2.5, 0 5" fill="#3b82f6" />
              </marker>
            </defs>
            {sortedObjects
              .filter(obj => state.selectedObjects.includes(obj.name))
              .flatMap(obj => {
                const relationships = getRelated(obj.name).filter(rel => {
                  const otherObject = rel.from === obj.name ? rel.to : rel.from;
                  return state.selectedObjects.includes(otherObject);
                });
                
                return relationships
                  .filter(rel => rel.from === obj.name) // Only draw from 'from' to avoid duplicates
                  .map((rel, relIdx) => {
                    const fromPos = cardPositions[rel.from];
                    const toPos = cardPositions[rel.to];
                    
                    if (!fromPos || !toPos) return null;
                    
                    // Calculate center points for bottom-to-top connection
                    const x1 = fromPos.left + (fromPos.width / 2);
                    const y1 = fromPos.bottom;
                    const x2 = toPos.left + (toPos.width / 2);
                    const y2 = toPos.top;
                    
                    return (
                      <line
                        key={`${rel.from}-${rel.to}-${relIdx}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#3b82f6"
                        strokeWidth="2.5"
                        markerEnd="url(#arrowhead)"
                        opacity="0.8"
                      />
                    );
                  });
              })}
          </svg>
        )}
        
        {sortedObjects.length > 0 ? (
          sortedObjects.map((obj) => (
            <ObjectCard 
              key={obj.name} 
              object={obj}
              searchQuery={searchQuery}
              ref={(el) => { cardRefs.current[obj.name] = el; }}
            />
          ))
        ) : (
          <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-8" role="status">
            No objects found matching "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}
