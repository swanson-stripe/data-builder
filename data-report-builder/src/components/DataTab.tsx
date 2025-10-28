'use client';
import { useState } from 'react';
import { useApp, actions } from '@/state/app';
import schema, { getRelated } from '@/data/schema';
import { SchemaObject } from '@/types';

function ObjectCard({ object }: { object: SchemaObject }) {
  const { state, dispatch } = useApp();
  const [expanded, setExpanded] = useState(false);

  const isObjectSelected = state.selectedObjects.includes(object.name);
  const relationships = getRelated(object.name);

  // Count selected fields for this object
  const selectedFieldCount = state.selectedFields.filter(
    (f) => f.object === object.name
  ).length;

  // Generate relationship summary
  const relationshipSummary = relationships.length > 0 ? (
    <div className="text-xs text-gray-500 mt-2 space-y-1">
      {relationships.slice(0, 3).map((rel, idx) => {
        const isFrom = rel.from === object.name;
        const otherObject = isFrom ? rel.to : rel.from;
        const direction = isFrom ? '→' : '←';
        return (
          <div key={idx} className="flex items-center gap-1">
            <span className="text-gray-400">{direction}</span>
            <span className="font-medium">{otherObject}</span>
            <span className="text-gray-400 text-[10px]">
              ({rel.type})
            </span>
          </div>
        );
      })}
      {relationships.length > 3 && (
        <div className="text-gray-400">+{relationships.length - 3} more</div>
      )}
    </div>
  ) : (
    <div className="text-xs text-gray-400 mt-2 italic">No relationships</div>
  );

  return (
    <div className="border rounded p-3 mb-2 bg-white hover:border-gray-400 transition-colors">
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
            <div className="flex-1 min-w-0">
              <label htmlFor={`object-${object.name}`} className="font-medium text-sm truncate cursor-pointer">
                {object.label}
              </label>
              <div className="text-xs text-gray-500">
                {object.fields.length} fields
                {selectedFieldCount > 0 && (
                  <span className="ml-1 text-blue-600">
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
              className="text-gray-400 hover:text-gray-600 px-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
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
            <div className="mt-3 pt-3 border-t space-y-2" role="group" aria-label={`${object.label} fields`}>
              {object.fields.map((field) => {
                const isFieldSelected = state.selectedFields.some(
                  (f) => f.object === object.name && f.field === field.name
                );
                const fieldId = `field-${object.name}-${field.name}`;
                return (
                  <label
                    key={field.name}
                    htmlFor={fieldId}
                    className="flex items-center gap-2 text-xs hover:bg-gray-50 p-1 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      id={fieldId}
                      checked={isFieldSelected}
                      onChange={() =>
                        dispatch(actions.toggleField(object.name, field.name))
                      }
                      className="text-xs"
                      aria-label={`${field.label} (${field.type})`}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{field.label}</span>
                      <span className="text-gray-400 ml-2">
                        ({field.type})
                      </span>
                    </div>
                  </label>
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

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="mb-3">
        <label htmlFor="object-search" className="sr-only">
          Search objects and fields
        </label>
        <input
          id="object-search"
          type="text"
          placeholder="Search objects and fields..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-describedby="search-results-count"
        />
      </div>

      {/* Results count */}
      {searchQuery && (
        <div id="search-results-count" className="text-xs text-gray-500 mb-2" role="status" aria-live="polite">
          {filteredObjects.length} object(s) found
        </div>
      )}

      {/* Object list */}
      <div className="flex-1 overflow-y-auto space-y-0" role="list" aria-label="Data objects">
        {filteredObjects.length > 0 ? (
          filteredObjects.map((obj) => <ObjectCard key={obj.name} object={obj} />)
        ) : (
          <div className="text-sm text-gray-400 text-center py-8" role="status">
            No objects found matching "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}
