'use client';
import { useState, useMemo, useRef, useEffect, forwardRef } from 'react';
import { useApp, actions } from '@/state/app';
import schema, { getRelated, getFieldLabel } from '@/data/schema';
import { SchemaObject } from '@/types';
import { FieldFilter } from './FieldFilter';
import { FilterCondition } from '@/types';
import { useWarehouseStore } from '@/lib/useWarehouse';
import { ConnectionLines } from './ConnectionLines';
import { SchemaDefinitionModal } from './SchemaDefinitionModal';

  const ObjectCard = forwardRef<HTMLDivElement, { 
    object: SchemaObject; 
    searchQuery: string;
    expandedTables: Record<string, boolean>;
    onExpandChange: (objectName: string, isExpanded: boolean) => void;
    expandedFields: Record<string, boolean>;
    onFieldExpandChange: (fieldId: string, isExpanded: boolean) => void;
    expandedFilters: Record<string, boolean>;
    onFilterExpandChange: (filterId: string, isExpanded: boolean) => void;
    showAllFieldsMap: Record<string, boolean>;
    onShowAllFieldsChange: (objectName: string, showAll: boolean) => void;
    onOpenDefinition: (tableName: string, fieldName?: string) => void;
  }>(
  ({ object, searchQuery, expandedTables, onExpandChange, expandedFields, onFieldExpandChange, expandedFilters, onFilterExpandChange, showAllFieldsMap, onShowAllFieldsChange, onOpenDefinition }, ref) => {
    const { state, dispatch } = useApp();
    const { store: warehouse, version } = useWarehouseStore();
    
    // Track hover state for info icon
    const [hoveredTableChip, setHoveredTableChip] = useState(false);
    const [hoveredFieldChips, setHoveredFieldChips] = useState<Record<string, boolean>>({});
    
    // Use the parent-managed state instead of local state
    const showAllFields = showAllFieldsMap[object.name] ?? false;

    const isObjectSelected = state.selectedObjects.includes(object.name);
    
    // Count selected fields for this object
    const selectedFieldCount = state.selectedFields.filter(
      (f) => f.object === object.name
    ).length;
    
    // Get expanded state from parent (defaults to true if selected fields exist)
    const isExpanded = expandedTables[object.name] ?? (selectedFieldCount > 0);
    
    // Initialize parent state on mount if not set
    useEffect(() => {
      if (expandedTables[object.name] === undefined && selectedFieldCount > 0) {
        onExpandChange(object.name, true);
      }
    }, []); // Only run on mount
    
    // Filter fields based on search query
    const query = searchQuery.toLowerCase();
    const filteredFields = searchQuery 
      ? object.fields.filter(field => 
          field.name.toLowerCase().includes(query) ||
          field.label.toLowerCase().includes(query)
        )
      : object.fields;
    
    // Sort fields: enabled fields first, then the rest
    const sortedFields = [...filteredFields].sort((a, b) => {
      const aSelected = state.selectedFields.some(
        (f) => f.object === object.name && f.field === a.name
      );
      const bSelected = state.selectedFields.some(
        (f) => f.object === object.name && f.field === b.name
      );
      
      // Selected fields come first
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      
      // Within same selection state, maintain original order
      return 0;
    });
    
    // Split into selected and unselected fields
    const selectedFields = sortedFields.filter(field => 
      state.selectedFields.some(f => f.object === object.name && f.field === field.name)
    );
    const unselectedFields = sortedFields.filter(field => 
      !state.selectedFields.some(f => f.object === object.name && f.field === field.name)
    );
    
    // Determine if we should show "Show X more fields" button
    // Show it when: table is expanded by default (has selected fields), not searching, and haven't clicked "Show all"
    const shouldShowMoreButton = selectedFieldCount > 0 && !searchQuery && !showAllFields && unselectedFields.length > 0;
    
    // Fields to actually render
    const fieldsToRender = shouldShowMoreButton ? selectedFields : sortedFields;
    
    // Auto-expand if there's a search query and matching fields
    const hasMatchingFields = searchQuery && filteredFields.length > 0;
    
    // Override expanded state if search has matching fields
    const shouldBeExpanded = hasMatchingFields || isExpanded;
  
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
        // Only cache if we found values, otherwise FieldFilter will use schema enum
        const distinctValues = Array.from(distinctSet).sort();
        if (distinctValues.length > 0) {
          cache[field.name] = distinctValues;
        }
      }
    });
    
    return cache;
  }, [object.name, object.fields, warehouse, version]);

  return (
    <div 
      ref={ref} 
      className="transition-colors relative" 
      style={{ 
        zIndex: 2, 
        marginBottom: isExpanded ? '16px' : '12px'
      }}
    >
      {/* Object header */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          {/* Title chip */}
          <div 
            onClick={() => onExpandChange(object.name, !isExpanded)}
            onMouseEnter={(e) => {
              setHoveredTableChip(true);
              if (!isObjectSelected) {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
              }
              if (isObjectSelected) {
                e.currentTarget.style.border = '2px solid var(--data-chip-table-hover-stroke)';
              }
            }}
            onMouseLeave={(e) => {
              setHoveredTableChip(false);
              if (!isObjectSelected) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
              if (isObjectSelected) {
                e.currentTarget.style.border = '2px solid transparent';
              }
            }}
            className="cursor-pointer"
            style={{ 
              backgroundColor: isObjectSelected ? 'var(--data-chip-table-bg)' : 'transparent',
              border: '2px solid transparent',
              borderRadius: '50px',
              height: '32px',
              paddingLeft: '6px',
              paddingRight: (isObjectSelected && selectedFieldCount > 0) ? '6px' : '12px',
              paddingTop: '6px',
              paddingBottom: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'padding-right 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              width: 'fit-content'
            }}
            data-connection-id={isObjectSelected ? `table-${object.name}` : undefined}
          >
            {/* Icon inside chip (always visible) */}
            <div 
              style={{
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: isObjectSelected ? 'white' : 'var(--text-icon)'
              }}
              data-connection-id={isObjectSelected ? `chevron-${object.name}` : undefined}
        >
          <svg 
                className={`transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                width="16" 
                height="16" 
                viewBox="0 0 16 16" 
            fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path fillRule="evenodd" clipRule="evenodd" d="M3.71967 6.21967C4.01256 5.92678 4.48744 5.92678 4.78033 6.21967L8 9.43934L11.2197 6.21967C11.5126 5.92678 11.9874 5.92678 12.2803 6.21967C12.5732 6.51256 12.5732 6.98744 12.2803 7.28033L8.53033 11.0303C8.23744 11.3232 7.76256 11.3232 7.46967 11.0303L3.71967 7.28033C3.42678 6.98744 3.42678 6.51256 3.71967 6.21967Z" fill="currentColor"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M8 14.5C11.5903 14.5 14.5 11.5903 14.5 7.99999C14.5 4.40834 11.6 1.5 8 1.5C4.4097 1.5 1.5 4.40969 1.5 7.99999C1.5 11.5903 4.4097 14.5 8 14.5ZM8 16C12.4187 16 16 12.4187 16 7.99999C16 3.58126 12.4297 0 8 0C3.58127 0 0 3.58126 0 7.99999C0 12.4187 3.58127 16 8 16Z" fill="currentColor"/>
          </svg>
            </div>
            
            <span 
              className="truncate flex-1" 
              style={{ 
                color: isObjectSelected ? 'var(--data-chip-table-text)' : 'var(--text-secondary)',
                fontSize: '14px',
                fontWeight: isObjectSelected ? 400 : 300,
                lineHeight: '20px'
              }}
            >
              {object.label}
            </span>
            
            {/* Info icon on hover - always rendered for smooth animation */}
            <svg 
              width="12" 
              height="12" 
              viewBox="0 0 12 12" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDefinition(object.name);
              }}
              style={{
                flexShrink: 0,
                opacity: hoveredTableChip ? 1 : 0,
                width: hoveredTableChip ? '12px' : '0px',
                marginLeft: hoveredTableChip ? '0px' : '-12px',
                transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), width 0.2s cubic-bezier(0.4, 0, 0.2, 1), margin-left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
                cursor: hoveredTableChip ? 'pointer' : 'default'
              }}
            >
              <path fillRule="evenodd" clipRule="evenodd" d="M8.75 1.75H3.25C2.42157 1.75 1.75 2.42157 1.75 3.25V8.75C1.75 9.57843 2.42157 10.25 3.25 10.25H8.75C9.57843 10.25 10.25 9.57843 10.25 8.75V3.25C10.25 2.42157 9.57843 1.75 8.75 1.75ZM3.25 0.25C1.59315 0.25 0.25 1.59315 0.25 3.25V8.75C0.25 10.4069 1.59315 11.75 3.25 11.75H8.75C10.4069 11.75 11.75 10.4069 11.75 8.75V3.25C11.75 1.59315 10.4069 0.25 8.75 0.25H3.25Z" fill={isObjectSelected ? 'white' : 'var(--text-icon)'}/>
              <path fillRule="evenodd" clipRule="evenodd" d="M4.48182 6.49998C4.48182 6.11338 4.79522 5.79998 5.18182 5.79998H6.27273C6.65933 5.79998 6.97273 6.11338 6.97273 6.49998V8.49998C6.97273 8.88658 6.65933 9.19998 6.27273 9.19998C5.88613 9.19998 5.57273 8.88658 5.57273 8.49998V7.19998H5.18182C4.79522 7.19998 4.48182 6.88658 4.48182 6.49998Z" fill={isObjectSelected ? 'white' : 'var(--text-icon)'}/>
              <path d="M4.99994 3.99999C4.99994 3.44858 5.44854 2.99999 5.99994 2.99999C6.55134 2.99999 6.99994 3.44858 6.99994 3.99999C6.99994 4.55139 6.55134 4.99999 5.99994 4.99999C5.44854 4.99999 4.99994 4.55139 4.99994 3.99999Z" fill={isObjectSelected ? 'white' : 'var(--text-icon)'}/>
            </svg>
            
            {/* Counter badge */}
            {isObjectSelected && selectedFieldCount > 0 && (
              <span
                style={{
                  backgroundColor: 'white',
                  color: 'var(--data-chip-table-bg)',
                  fontSize: '12px',
                  fontWeight: 500,
                  height: '16px',
                  minWidth: '16px',
                  borderRadius: '16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px'
                }}
              >
                {selectedFieldCount}
              </span>
            )}
          </div>
        </div>
      </div>

          {/* Expandable field list */}
          {shouldBeExpanded && (
            <div style={{ marginLeft: '36px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }} role="group" aria-label={`${object.label} fields`}>
              {fieldsToRender.map((field) => {
                const isFieldSelected = state.selectedFields.some(
                  (f) => f.object === object.name && f.field === field.name
                );
                const qualifiedName = `${object.name}.${field.name}`;
                const fieldId = `${object.name}.${field.name}`;
                const filterId = `${object.name}.${field.name}`;
                
                // Get all filters for this field (support multiple filters per field)
                const fieldFilters = state.filters.conditions.filter(
                  c => c.field.object === object.name && c.field.field === field.name
                );
                
                // For backward compatibility, use first filter as "active" filter
                const activeFilter = fieldFilters[0] || null;
                
                const isFieldExpanded = expandedFields[fieldId] ?? (fieldFilters.length > 0); // Default to true if any filters exist
                const isFilterExpanded = expandedFilters[filterId] || false;
                
                const handleFilterChange = (condition: FilterCondition | null) => {
                  if (condition) {
                    // Check if filter already exists for this field
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

                const handleChipClick = () => {
                  if (isFieldSelected) {
                    // Toggle field expansion (show/hide filter section like table expand/collapse)
                    onFieldExpandChange(fieldId, !isFieldExpanded);
                  } else {
                    // If not selected, clicking selects the field
                    handleFieldToggle();
                  }
                };
                
                // Generate filter description for collapsed state
                const getFilterDescription = () => {
                  if (!activeFilter) return 'Filter';
                  
                  const { operator, value } = activeFilter;
                  
                  // Check for blank/empty values
                  if (value === '' || value === null || value === undefined || 
                      (Array.isArray(value) && value.length === 0)) {
                    return 'Filter for blank';
                  }
                  
                  // Boolean filters
                  if (field.type === 'boolean') {
                    return value === true ? 'Filter for true' : 'Filter for false';
                  }
                  
                  // Date filters
                  if (field.type === 'date') {
                    if (operator === 'between' && Array.isArray(value)) {
                      return `Filter between dates`;
                    }
                    if (operator === 'less_than') return `Filter before ${value}`;
                    if (operator === 'greater_than') return `Filter after ${value}`;
                    return `Filter for ${value}`;
                  }
                  
                  // Number filters
                  if (field.type === 'number') {
                    if (operator === 'between' && Array.isArray(value)) {
                      return `Filter between ${value[0]} and ${value[1]}`;
                    }
                    if (operator === 'greater_than') return `Filter > ${value}`;
                    if (operator === 'less_than') return `Filter < ${value}`;
                    if (operator === 'not_equals') return `Filter ≠ ${value}`;
                    return `Filter for ${value}`;
                  }
                  
                  // String/ID/Enum filters
                  if (Array.isArray(value)) {
                    // Multiple values selected
                    if (value.length === 1) {
                      return `Filter for ${value[0]}`;
                    }
                    return `Filter for ${value.length} values`;
                  }
                  
                  // Single value
                  if (typeof value === 'string') {
                    // Truncate long strings
                    const displayValue = value.length > 20 ? `${value.substring(0, 20)}...` : value;
                    return `Filter for ${displayValue}`;
                  }
                  
                  return 'Filter';
                };
                
                return (
                  <div key={field.name}>
                    <div 
                      className="flex items-center gap-2 text-xs group transition-colors relative"
                      data-connection-id={isFieldSelected ? `field-${object.name}.${field.name}` : undefined}
                    >
                      {/* Field chip - now includes icon for unselected fields */}
                      <div 
                        onClick={handleChipClick}
                        onMouseEnter={(e) => {
                          setHoveredFieldChips(prev => ({ ...prev, [fieldId]: true }));
                          if (!isFieldSelected) {
                            e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                          }
                          if (isFieldSelected) {
                            e.currentTarget.style.border = '2px solid var(--data-chip-field-hover-stroke)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          setHoveredFieldChips(prev => ({ ...prev, [fieldId]: false }));
                          if (!isFieldSelected) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                          if (isFieldSelected) {
                            e.currentTarget.style.border = '2px solid transparent';
                          }
                        }}
                        className="cursor-pointer"
                        style={{
                          backgroundColor: isFieldSelected ? 'var(--data-chip-field-bg)' : 'transparent',
                          border: '2px solid transparent',
                          borderRadius: '50px',
                          height: '32px',
                          paddingLeft: '6px',
                          paddingRight: (isFieldSelected && fieldFilters.length > 0) ? '6px' : '12px',
                          paddingTop: '6px',
                          paddingBottom: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'padding-right 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          width: 'fit-content'
                        }}
                      >
                        {/* Icon inside chip - plus for unselected, chevron for selected */}
                        <div 
                          style={{
                            width: '16px',
                            height: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            color: isFieldSelected ? 'white' : 'var(--text-icon)'
                          }}
                        >
                          {isFieldSelected ? (
                            <svg
                              className={`transition-transform ${isFieldExpanded ? '' : '-rotate-90'}`}
                              width="16" 
                              height="16" 
                              viewBox="0 0 16 16" 
                              fill="none" 
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path fillRule="evenodd" clipRule="evenodd" d="M3.71967 6.21967C4.01256 5.92678 4.48744 5.92678 4.78033 6.21967L8 9.43934L11.2197 6.21967C11.5126 5.92678 11.9874 5.92678 12.2803 6.21967C12.5732 6.51256 12.5732 6.98744 12.2803 7.28033L8.53033 11.0303C8.23744 11.3232 7.76256 11.3232 7.46967 11.0303L3.71967 7.28033C3.42678 6.98744 3.42678 6.51256 3.71967 6.21967Z" fill="currentColor"/>
                              <path fillRule="evenodd" clipRule="evenodd" d="M8 14.5C11.5903 14.5 14.5 11.5903 14.5 7.99999C14.5 4.40834 11.6 1.5 8 1.5C4.4097 1.5 1.5 4.40969 1.5 7.99999C1.5 11.5903 4.4097 14.5 8 14.5ZM8 16C12.4187 16 16 12.4187 16 7.99999C16 3.58126 12.4297 0 8 0C3.58127 0 0 3.58126 0 7.99999C0 12.4187 3.58127 16 8 16Z" fill="currentColor"/>
                            </svg>
                          ) : (
                            <svg
                              width="16" 
                              height="16" 
                              viewBox="0 0 16 16" 
                              fill="none" 
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <circle cx="8" cy="8" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
                              <path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          )}
                        </div>
                        
                        <div className="truncate transition-colors flex-1" style={{
                          color: isFieldSelected ? 'var(--data-chip-field-text)' : 'var(--text-secondary)',
                          fontWeight: isFieldSelected ? 400 : 300,
                          fontSize: '14px',
                          lineHeight: '20px'
                        }}>
                          {/* Show only label for both selected and unselected */}
                          {getFieldLabel(object.name, field.name)}
                        </div>
                        
                        {/* Info icon on hover - always rendered for smooth animation */}
                        <svg 
                          width="12" 
                          height="12" 
                          viewBox="0 0 12 12" 
                          fill="none" 
                          xmlns="http://www.w3.org/2000/svg"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDefinition(object.name, field.name);
                          }}
                          style={{
                            flexShrink: 0,
                            opacity: hoveredFieldChips[fieldId] ? 1 : 0,
                            width: hoveredFieldChips[fieldId] ? '12px' : '0px',
                            marginLeft: hoveredFieldChips[fieldId] ? '0px' : '-12px',
                            transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), width 0.2s cubic-bezier(0.4, 0, 0.2, 1), margin-left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            overflow: 'hidden',
                            cursor: hoveredFieldChips[fieldId] ? 'pointer' : 'default'
                          }}
                        >
                          <path fillRule="evenodd" clipRule="evenodd" d="M8.75 1.75H3.25C2.42157 1.75 1.75 2.42157 1.75 3.25V8.75C1.75 9.57843 2.42157 10.25 3.25 10.25H8.75C9.57843 10.25 10.25 9.57843 10.25 8.75V3.25C10.25 2.42157 9.57843 1.75 8.75 1.75ZM3.25 0.25C1.59315 0.25 0.25 1.59315 0.25 3.25V8.75C0.25 10.4069 1.59315 11.75 3.25 11.75H8.75C10.4069 11.75 11.75 10.4069 11.75 8.75V3.25C11.75 1.59315 10.4069 0.25 8.75 0.25H3.25Z" fill={isFieldSelected ? 'white' : 'var(--text-icon)'}/>
                          <path fillRule="evenodd" clipRule="evenodd" d="M4.48182 6.49998C4.48182 6.11338 4.79522 5.79998 5.18182 5.79998H6.27273C6.65933 5.79998 6.97273 6.11338 6.97273 6.49998V8.49998C6.97273 8.88658 6.65933 9.19998 6.27273 9.19998C5.88613 9.19998 5.57273 8.88658 5.57273 8.49998V7.19998H5.18182C4.79522 7.19998 4.48182 6.88658 4.48182 6.49998Z" fill={isFieldSelected ? 'white' : 'var(--text-icon)'}/>
                          <path d="M4.99994 3.99999C4.99994 3.44858 5.44854 2.99999 5.99994 2.99999C6.55134 2.99999 6.99994 3.44858 6.99994 3.99999C6.99994 4.55139 6.55134 4.99999 5.99994 4.99999C5.44854 4.99999 4.99994 4.55139 4.99994 3.99999Z" fill={isFieldSelected ? 'white' : 'var(--text-icon)'}/>
                        </svg>
                        
                        {/* Counter badge */}
                        {isFieldSelected && fieldFilters.length > 0 && (
                          <span
                            style={{
                              backgroundColor: 'white',
                              color: 'var(--data-chip-field-bg)',
                              fontSize: '12px',
                              fontWeight: 500,
                              height: '16px',
                              minWidth: '16px',
                              borderRadius: '16px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0 4px'
                            }}
                          >
                            {fieldFilters.length}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Filter chip when field is expanded but filter block is not expanded */}
                    {isFieldExpanded && !isFilterExpanded && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onFilterExpandChange(filterId, true);
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.border = '2px solid var(--data-chip-filter-border)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.border = '2px solid transparent';
                        }}
                        className="cursor-pointer"
                        style={{
                          backgroundColor: 'var(--data-chip-filter-bg)',
                          border: '2px solid transparent',
                          borderRadius: '50px',
                          height: '32px',
                          paddingLeft: '6px',
                          paddingRight: '12px',
                          paddingTop: '6px',
                          paddingBottom: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '12px',
                          marginLeft: '36px',
                          width: 'fit-content',
                          transition: 'border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        data-connection-id={isFieldExpanded ? `filter-${object.name}.${field.name}` : undefined}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <rect x="1" y="3" width="14" height="1.5" rx="0.75" fill="var(--data-chip-filter-icon)"/>
                          <rect x="3" y="7" width="10" height="1.5" rx="0.75" fill="var(--data-chip-filter-icon)"/>
                          <rect x="5" y="11" width="6" height="1.5" rx="0.75" fill="var(--data-chip-filter-icon)"/>
                        </svg>
                        <span style={{
                          color: 'var(--data-chip-filter-text)',
                          fontSize: '14px',
                          fontWeight: 400,
                          lineHeight: '20px'
                        }}>
                          {activeFilter ? getFilterDescription() : 'Add a filter'}
                        </span>
                      </div>
                    )}
                    
                    {/* Filter controls when expanded */}
                    {isFieldExpanded && isFilterExpanded && (
                      <div 
                        onMouseEnter={(e) => {
                          e.currentTarget.style.border = '2px solid var(--data-chip-filter-border)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.border = '2px solid transparent';
                        }}
                        style={{
                          backgroundColor: 'var(--data-chip-filter-bg)',
                          border: '2px solid transparent',
                          borderRadius: '16px',
                          marginTop: '12px',
                          marginLeft: '36px',
                          transition: 'border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        data-connection-id={isFieldExpanded ? `filter-${object.name}.${field.name}` : undefined}
                      >
                        {/* Filter header (like collapsed state) */}
                        <div
                          onClick={() => onFilterExpandChange(filterId, false)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px',
                            cursor: 'pointer'
                          }}
                            >
                              <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                                fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <rect x="1" y="3" width="14" height="1.5" rx="0.75" fill="var(--data-chip-filter-icon)"/>
                            <rect x="3" y="7" width="10" height="1.5" rx="0.75" fill="var(--data-chip-filter-icon)"/>
                            <rect x="5" y="11" width="6" height="1.5" rx="0.75" fill="var(--data-chip-filter-icon)"/>
                              </svg>
                          <span style={{
                            color: 'var(--data-chip-filter-text)',
                            fontSize: '14px',
                            fontWeight: 400,
                            lineHeight: '20px',
                            flex: 1
                          }}>
                            {activeFilter ? getFilterDescription() : 'Add a filter'}
                          </span>
                    </div>
                    
                        {/* Filter controls */}
                        <div style={{ padding: '0 12px 12px 12px' }}>
                      <FieldFilter
                        field={field}
                        objectName={object.name}
                            currentFilter={activeFilter || undefined}
                        onFilterChange={handleFilterChange}
                            onCancel={() => onFilterExpandChange(filterId, false)}
                        distinctValues={distinctValuesCache[field.name]}
                      />
                        </div>
                      </div>
                    )}
                    
                  </div>
                );
              })}
              
              {/* "Show X more fields" chip */}
              {shouldShowMoreButton && (
                <div
                  onClick={() => onShowAllFieldsChange(object.name, true)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  style={{
                    backgroundColor: 'transparent',
                    borderRadius: '50px',
                    height: '32px',
                    paddingLeft: '8px',
                    paddingRight: '12px',
                    paddingTop: '6px',
                    paddingBottom: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    width: 'fit-content',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  {/* Plus icon */}
                  <div 
                    style={{
                      width: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: 'var(--text-icon)'
                    }}
                  >
                    <svg
                      width="16" 
                      height="16" 
                      viewBox="0 0 16 16" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle cx="8" cy="8" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  
                  {/* Text */}
                  <span style={{
                    color: 'var(--text-secondary)',
                    fontSize: '14px',
                    fontWeight: 300,
                    lineHeight: '20px'
                  }}>
                    Show {unselectedFields.length} more field{unselectedFields.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          )}
    </div>
  );
});

ObjectCard.displayName = 'ObjectCard';

export function DataTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const { state, dispatch } = useApp();
  const [cardPositions, setCardPositions] = useState<Record<string, DOMRect>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  // Track which tables are expanded for connection line updates
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  
  // Track which fields have their filter section visible
  const [expandedFields, setExpandedFields] = useState<Record<string, boolean>>({});
  
  // Track which filters are expanded for connection line updates
  const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({});
  
  // Track which tables have shown all fields (for connection line updates)
  const [showAllFieldsMap, setShowAllFieldsMap] = useState<Record<string, boolean>>({});
  
  // Track whether to show tables with no enabled fields
  const [showTablesWithNoFields, setShowTablesWithNoFields] = useState(false);
  
  // Modal state for schema definitions
  const [isDefinitionModalOpen, setIsDefinitionModalOpen] = useState(false);
  const [selectedDefinition, setSelectedDefinition] = useState<{
    type: 'table' | 'field';
    tableName: string;
    fieldName?: string;
  } | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // When creating a new metric (blank preset or no selected fields), show all tables by default
  useEffect(() => {
    if (state.report === 'blank' || state.selectedFields.length === 0) {
      setShowTablesWithNoFields(true);
    }
  }, [state.report, state.selectedFields.length]);

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

  // Split objects into those with and without enabled fields
  const objectsWithEnabledFields = sortedObjects.filter(obj => {
    return state.selectedFields.some(field => field.object === obj.name);
  });
  
  const objectsWithoutEnabledFields = sortedObjects.filter(obj => {
    return !state.selectedFields.some(field => field.object === obj.name);
  });

  // Determine which objects to display based on showTablesWithNoFields flag
  const displayedObjects = showTablesWithNoFields || searchQuery 
    ? sortedObjects 
    : objectsWithEnabledFields;

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


      {/* Results count */}
      {searchQuery && (
        <div id="search-results-count" className="text-xs text-gray-500 dark:text-gray-400 mb-2 ml-3 pr-[11px]" role="status" aria-live="polite">
          {filteredObjects.length} results
        </div>
      )}

      {/* Object list with connection lines overlay */}
      <div ref={containerRef} className="flex-1 overflow-y-auto relative custom-scrollbar" role="list" aria-label="Data objects">
        {/* Connection lines overlay */}
        <ConnectionLines containerRef={containerRef} expandedTables={expandedTables} expandedFields={expandedFields} expandedFilters={expandedFilters} showAllFieldsMap={showAllFieldsMap} searchQuery={searchQuery} />
        
        {sortedObjects.length > 0 ? (
          <>
            {displayedObjects.map((obj) => (
            <ObjectCard 
              key={obj.name} 
              object={obj}
              searchQuery={searchQuery}
                expandedTables={expandedTables}
                onExpandChange={(objName, isExpanded) => {
                  setExpandedTables(prev => ({ ...prev, [objName]: isExpanded }));
                }}
                expandedFields={expandedFields}
                onFieldExpandChange={(fieldId, isExpanded) => {
                  setExpandedFields(prev => ({ ...prev, [fieldId]: isExpanded }));
                }}
                expandedFilters={expandedFilters}
                onFilterExpandChange={(filterId, isExpanded) => {
                  setExpandedFilters(prev => ({ ...prev, [filterId]: isExpanded }));
                }}
                showAllFieldsMap={showAllFieldsMap}
                onShowAllFieldsChange={(objName, showAll) => {
                  setShowAllFieldsMap(prev => ({ ...prev, [objName]: showAll }));
                }}
                onOpenDefinition={(tableName, fieldName) => {
                  setSelectedDefinition({
                    type: fieldName ? 'field' : 'table',
                    tableName,
                    fieldName
                  });
                  setIsDefinitionModalOpen(true);
                }}
              ref={(el) => { cardRefs.current[obj.name] = el; }}
            />
            ))}
            
            {/* "Explore more fields" chip - shown when there are tables without enabled fields and they're hidden */}
            {!showTablesWithNoFields && !searchQuery && objectsWithoutEnabledFields.length > 0 && (
              <div
                onClick={() => setShowTablesWithNoFields(true)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                className="cursor-pointer"
                style={{
                  backgroundColor: 'transparent',
                  borderRadius: '50px',
                  height: '32px',
                  paddingLeft: '8px',
                  paddingRight: '12px',
                  paddingTop: '6px',
                  paddingBottom: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.15s ease'
                }}
              >
                {/* Icon */}
                <div 
                  style={{
                    width: '16px',
                    height: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: 'var(--text-icon)'
                  }}
                >
                  <svg
                    className="transition-transform -rotate-90"
                    width="16" 
                    height="16" 
                    viewBox="0 0 16 16" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path fillRule="evenodd" clipRule="evenodd" d="M3.71967 6.21967C4.01256 5.92678 4.48744 5.92678 4.78033 6.21967L8 9.43934L11.2197 6.21967C11.5126 5.92678 11.9874 5.92678 12.2803 6.21967C12.5732 6.51256 12.5732 6.98744 12.2803 7.28033L8.53033 11.0303C8.23744 11.3232 7.76256 11.3232 7.46967 11.0303L3.71967 7.28033C3.42678 6.98744 3.42678 6.51256 3.71967 6.21967Z" fill="currentColor"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M8 14.5C11.5903 14.5 14.5 11.5903 14.5 7.99999C14.5 4.40834 11.6 1.5 8 1.5C4.4097 1.5 1.5 4.40969 1.5 7.99999C1.5 11.5903 4.4097 14.5 8 14.5ZM8 16C12.4187 16 16 12.4187 16 7.99999C16 3.58126 12.4297 0 8 0C3.58127 0 0 3.58126 0 7.99999C0 12.4187 3.58127 16 8 16Z" fill="currentColor"/>
                  </svg>
                </div>
                
                {/* Text */}
                <span 
                  style={{ 
                    color: 'var(--text-secondary)',
                    fontSize: '14px',
                    fontWeight: 300,
                    lineHeight: '20px'
                  }}
                >
                  Explore more fields
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-8" role="status">
            No objects found matching "{searchQuery}"
          </div>
        )}
      </div>
      
      {/* Schema Definition Modal */}
      <SchemaDefinitionModal
        isOpen={isDefinitionModalOpen}
        onClose={() => {
          setIsDefinitionModalOpen(false);
          setSelectedDefinition(null);
        }}
        selectedTable={selectedDefinition?.tableName}
        selectedField={selectedDefinition?.fieldName}
      />
    </div>
  );
}
