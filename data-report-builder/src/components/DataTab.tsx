'use client';
import { useState, useMemo } from 'react';
import { useApp, actions } from '@/state/app';
import schema, { getRelated } from '@/data/schema';
import { SchemaObject } from '@/types';
import { FieldFilter } from './FieldFilter';
import { FilterLogicToggle } from './FilterLogicToggle';
import { FilterCondition } from '@/types';
import { useWarehouseStore } from '@/lib/useWarehouse';

function ObjectCard({ object }: { object: SchemaObject }) {
  const { state, dispatch } = useApp();
  const { store: warehouse, version } = useWarehouseStore();
  const [expanded, setExpanded] = useState(false);
  const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({});

  const isObjectSelected = state.selectedObjects.includes(object.name);
  const relationships = getRelated(object.name);
  
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

  // Generate relationship summary
  const relationshipSummary = relationships.length > 0 ? (
    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1">
      {relationships.slice(0, 3).map((rel, idx) => {
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
      {relationships.length > 3 && (
        <div className="text-gray-400 dark:text-gray-500">+{relationships.length - 3} more</div>
      )}
    </div>
  ) : (
    <div className="text-xs text-gray-400 dark:text-gray-500 mt-2 italic">No relationships</div>
  );

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded p-3 mb-2 bg-white dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
      {/* Object header */}
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id={`object-${object.name}`}
          checked={isObjectSelected}
          onChange={() => dispatch(actions.toggleObject(object.name))}
          className="mt-1"
          aria-label={`Select ${object.label} object`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <label htmlFor={`object-${object.name}`} className="font-medium text-sm text-gray-800 dark:text-gray-100 truncate cursor-pointer">
                {object.label}
              </label>
              {isObjectSelected && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                  Selected
                </span>
              )}
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {object.fields.length} fields
                {selectedFieldCount > 0 && (
                  <span className="ml-1 text-blue-600 dark:text-blue-400">
                    ({selectedFieldCount} selected)
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setExpanded(!expanded);
                }
              }}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 px-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              disabled={!isObjectSelected}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${object.label} fields`}
              aria-expanded={expanded}
            >
              {expanded ? '▼' : '▶'}
            </button>
          </div>

          {/* Relationship hints */}
          {relationshipSummary}

          {/* Expandable field list */}
          {expanded && isObjectSelected && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-2" role="group" aria-label={`${object.label} fields`}>
              {object.fields.map((field) => {
                const isFieldSelected = state.selectedFields.some(
                  (f) => f.object === object.name && f.field === field.name
                );
                const fieldId = `field-${object.name}-${field.name}`;
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
                
                return (
                  <div key={field.name}>
                    <div className="flex items-center gap-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-600 p-1 rounded">
                      {/* Expand/collapse filter button */}
                      <button
                        onClick={() => setExpandedFilters(prev => ({
                          ...prev,
                          [field.name]: !prev[field.name],
                        }))}
                        className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-500 rounded transition-colors"
                        aria-label={`${isFilterExpanded ? 'Collapse' : 'Expand'} filter for ${qualifiedName}`}
                      >
                        <svg
                          className={`w-3 h-3 text-gray-500 dark:text-gray-400 transition-transform ${isFilterExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M9 5l7 7-7 7"></path>
                        </svg>
                      </button>
                      
                      {/* Field checkbox */}
                      <label
                        htmlFor={fieldId}
                        className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          id={fieldId}
                          checked={isFieldSelected}
                          onChange={() =>
                            dispatch(actions.toggleField(object.name, field.name))
                          }
                          className="text-xs"
                          aria-label={`${qualifiedName} (${field.type})`}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-[11px] text-gray-600 dark:text-gray-300">{qualifiedName}</span>
                          <span className="text-gray-400 dark:text-gray-500 ml-2">
                            · {field.type}
                          </span>
                        </div>
                      </label>
                      
                      {/* Filter indicator badge */}
                      {activeFilter && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded font-medium">
                          ⚡
                        </span>
                      )}
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
}

export function DataTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const { state, dispatch } = useApp();

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

  // Sort objects: selected first, then alphabetically by label
  const sortedObjects = [...filteredObjects].sort((a, b) => {
    const aSelected = state.selectedObjects.includes(a.name);
    const bSelected = state.selectedObjects.includes(b.name);

    // Selected objects come first
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;

    // Within same selection state, sort alphabetically
    return a.label.localeCompare(b.label);
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="mb-3 flex gap-2">
        <label htmlFor="object-search" className="sr-only">
          Search objects and fields
        </label>
        <input
          id="object-search"
          type="text"
          placeholder="Search objects and fields..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-describedby="search-results-count"
        />
        {state.filters.conditions.length > 0 && (
          <button
            onClick={() => dispatch(actions.clearFilters())}
            className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
            title="Clear all filters"
          >
            Clear Filters
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
        <div id="search-results-count" className="text-xs text-gray-500 dark:text-gray-400 mb-2" role="status" aria-live="polite">
          {filteredObjects.length} object(s) found
        </div>
      )}

      {/* Object list */}
      <div className="flex-1 overflow-y-auto space-y-0" role="list" aria-label="Data objects">
        {sortedObjects.length > 0 ? (
          sortedObjects.map((obj) => <ObjectCard key={obj.name} object={obj} />)
        ) : (
          <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-8" role="status">
            No objects found matching "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}
