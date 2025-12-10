'use client';
import { useState, useMemo, useRef, useEffect, forwardRef } from 'react';
import { useApp, actions, ChartType, XSourceMode, YSourceMode, Comparison } from '@/state/app';
import schema, { getRelated, getFieldLabel } from '@/data/schema';
import { SchemaObject, MetricBlock, MetricFormula } from '@/types';
import { FieldFilter } from './FieldFilter';
import { FilterCondition } from '@/types';
import { useWarehouseStore } from '@/lib/useWarehouse';
import { ConnectionLines } from './ConnectionLines';
import { SchemaDefinitionModal } from './SchemaDefinitionModal';
import { CustomSelect } from './CustomSelect';
import { MetricBlockCard } from './MetricBlockCard';
import { FormulaBuilder } from './FormulaBuilder';
import { computeFormula } from '@/lib/formulaMetrics';
import { getAvailableGroupFields, getGroupValues } from '@/lib/grouping';
import GroupBySelector from './GroupBySelector';

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
    
    // Track hover state for info icon and trash icon
    const [hoveredTableChip, setHoveredTableChip] = useState(false);
    const [hoveredFieldChips, setHoveredFieldChips] = useState<Record<string, boolean>>({});
    const [hoveredFieldRows, setHoveredFieldRows] = useState<Record<string, boolean>>({});
    
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
              borderRadius: '10px',
              height: '32px',
              paddingLeft: '6px',
              paddingRight: (isObjectSelected && selectedFieldCount > 0) ? '6px' : '12px',
              paddingTop: '6px',
              paddingBottom: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
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
                color: isObjectSelected ? 'var(--data-chip-table-icon)' : 'var(--text-icon)'
              }}
              data-connection-id={isObjectSelected ? `chevron-${object.name}` : undefined}
        >
          <svg 
                width="12" 
                height="12" 
                viewBox="0 0 12 12" 
                fill="none"
                style={{
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease',
                }}
              >
                <path
                  d="M4.5 2.5L8 6L4.5 9.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
          </svg>
            </div>
            
            <span 
              className="truncate" 
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
                marginLeft: hoveredTableChip ? '4px' : '0px',
                transition: 'opacity 0.2s ease, width 0.2s ease, margin-left 0.2s ease',
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
                  padding: '0 4px',
                  marginLeft: '8px'
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
                      onMouseEnter={() => setHoveredFieldRows(prev => ({ ...prev, [fieldId]: true }))}
                      onMouseLeave={() => setHoveredFieldRows(prev => ({ ...prev, [fieldId]: false }))}
                      style={{ position: 'relative' }}
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
                          borderRadius: '10px',
                          height: '32px',
                          paddingLeft: '6px',
                          paddingRight: (isFieldSelected && fieldFilters.length > 0) ? '6px' : '12px',
                          paddingTop: '6px',
                          paddingBottom: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
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
                            color: isFieldSelected ? 'var(--data-chip-field-icon)' : 'var(--text-icon)'
                          }}
                        >
                          {isFieldSelected ? (
                            <svg
                              width="12" 
                              height="12" 
                              viewBox="0 0 12 12" 
                              fill="none"
                              style={{
                                transform: isFieldExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: 'transform 0.15s ease',
                              }}
                            >
                              <path
                                d="M4.5 2.5L8 6L4.5 9.5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : (
                            <svg
                              width="12" 
                              height="12" 
                              viewBox="0 0 12 12" 
                              fill="none"
                            >
                              <path
                                d="M4.5 2.5L8 6L4.5 9.5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                        
                        <div className="truncate transition-colors" style={{
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
                            marginLeft: hoveredFieldChips[fieldId] ? '4px' : '0px',
                            transition: 'opacity 0.2s ease, width 0.2s ease, margin-left 0.2s ease',
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
                              padding: '0 4px',
                              marginLeft: '8px'
                            }}
                          >
                            {fieldFilters.length}
                          </span>
                        )}
                      </div>
                      
                      {/* Trash icon - only show for selected fields on row hover */}
                      {isFieldSelected && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          onClick={(e) => {
                            e.stopPropagation();
                            dispatch(actions.toggleField(object.name, field.name));
                          }}
                          style={{
                            position: 'absolute',
                            right: 0,
                            opacity: hoveredFieldRows[fieldId] ? 1 : 0,
                            transition: 'opacity 100ms ease-in-out',
                            cursor: hoveredFieldRows[fieldId] ? 'pointer' : 'default',
                            pointerEvents: hoveredFieldRows[fieldId] ? 'auto' : 'none',
                            fill: 'var(--text-icon)'
                          }}
                        >
                          <path fillRule="evenodd" clipRule="evenodd" d="M8.99998 3V1.5C8.99998 0.671573 8.3284 0 7.49998 0H4.49998C3.67155 0 2.99998 0.671573 2.99998 1.5V3H0.75C0.335786 3 0 3.33579 0 3.75C0 4.16421 0.335786 4.5 0.75 4.5H1.49998V10C1.49998 11.1046 2.39541 12 3.49998 12H8.49998C9.60454 12 10.5 11.1046 10.5 10V4.5H11.25C11.6642 4.5 12 4.16421 12 3.75C12 3.33579 11.6642 3 11.25 3H8.99998ZM7.49998 1.4H4.49998C4.44475 1.4 4.39998 1.44477 4.39998 1.5V3H7.59998V1.5C7.59998 1.44477 7.5552 1.4 7.49998 1.4ZM9.09998 4.5V10C9.09998 10.3314 8.83135 10.6 8.49998 10.6H3.49998C3.1686 10.6 2.89998 10.3314 2.89998 10V4.5H9.09998Z" fill="#474E5A"/>
                          <path fillRule="evenodd" clipRule="evenodd" d="M4.62498 5.5C4.97015 5.5 5.24998 5.77982 5.24998 6.125V8.875C5.24998 9.22018 4.97015 9.5 4.62498 9.5C4.2798 9.5 3.99998 9.22018 3.99998 8.875V6.125C3.99998 5.77982 4.2798 5.5 4.62498 5.5Z" fill="#474E5A"/>
                          <path fillRule="evenodd" clipRule="evenodd" d="M7.37498 5.5C7.72015 5.5 7.99998 5.77982 7.99998 6.125V8.875C7.99998 9.22018 7.72015 9.5 7.37498 9.5C7.0298 9.5 6.74998 9.22018 6.74998 8.875V6.125C6.74998 5.77982 7.0298 5.5 7.37498 5.5Z" fill="#474E5A"/>
                        </svg>
                      )}
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
                          borderRadius: '10px',
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
                    borderRadius: '10px',
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

  // Section expansion state (all expanded by default)
  const [isDisplayExpanded, setIsDisplayExpanded] = useState(true);
  const [isDataExpanded, setIsDataExpanded] = useState(true);
  const [isMetricExpanded, setIsMetricExpanded] = useState(true);

  // ===== Metric Tab State =====
  const { store: warehouse, version } = useWarehouseStore();
  
  // Track draft formula for multi-block calculations (to prevent broken states)
  const [draftFormula, setDraftFormula] = useState<MetricFormula | null>(null);
  const [hasUnappliedChanges, setHasUnappliedChanges] = useState(false);

  // Group By state
  const [isGroupByFieldSelectorOpen, setIsGroupByFieldSelectorOpen] = useState(false);
  const [isGroupByValueSelectorOpen, setIsGroupByValueSelectorOpen] = useState(false);
  const [groupBySearchQuery, setGroupBySearchQuery] = useState('');
  const groupByButtonRef = useRef<HTMLButtonElement>(null);
  const groupByPopoverRef = useRef<HTMLDivElement>(null);

  // Build list of qualified field names from selected fields
  const fieldOptions = state.selectedFields.map((field) => ({
    value: `${field.object}.${field.field}`,
    label: `${field.object}.${field.field}`,
    plainName: getFieldLabel(field.object, field.field),
    object: field.object,
    field: field.field,
  }));

  // Determine if we're in multi-block mode (based on state OR draft)
  const isMultiBlock = state.metricFormula.blocks.length >= 2 || (draftFormula && draftFormula.blocks.length >= 2);

  // Use draft formula for display if it exists, otherwise use state
  const activeFormula = draftFormula || state.metricFormula;

  // Available fields for grouping with categorization
  const availableGroupFields = useMemo(() => {
    const allFields = getAvailableGroupFields(state.selectedObjects, schema);
    
    // Common field names to prioritize (status, currency, type, etc.)
    const commonFieldNames = ['status', 'currency', 'type', 'country', 'brand', 'category', 'method', 'tier'];
    
    // Categorize into common and other
    const common: typeof allFields = [];
    const other: typeof allFields = [];
    
    allFields.forEach(field => {
      const fieldName = field.field.toLowerCase();
      if (commonFieldNames.some(commonName => fieldName.includes(commonName))) {
        common.push(field);
      } else {
        other.push(field);
      }
    });
    
    return { common, other, all: allFields };
  }, [state.selectedObjects]);
  
  // Filtered group by fields based on search
  const filteredGroupFields = useMemo(() => {
    if (!groupBySearchQuery) {
      return availableGroupFields;
    }
    
    const query = groupBySearchQuery.toLowerCase();
    const filterFields = (fields: typeof availableGroupFields.all) => 
      fields.filter(f => 
        f.label.toLowerCase().includes(query) ||
        f.object.toLowerCase().includes(query) ||
        f.field.toLowerCase().includes(query)
      );
    
    return {
      common: filterFields(availableGroupFields.common),
      other: filterFields(availableGroupFields.other),
      all: filterFields(availableGroupFields.all),
    };
  }, [availableGroupFields, groupBySearchQuery]);

  // Available values for the selected group field
  const availableGroupValues = useMemo(() => {
    if (!state.groupBy || !warehouse) return [];
    // Get the primary object for cross-object grouping
    const primaryObject = state.selectedObjects[0] || state.metricFormula.blocks[0]?.source?.object;
    return getGroupValues(warehouse, state.groupBy.field, 50, primaryObject); // Get top 50, user can select max 10
  }, [state.groupBy?.field, state.selectedObjects, state.metricFormula.blocks, version, warehouse]);
  
  // Helper to format value to sentence case
  const formatValueLabel = (value: string) => {
    return value
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getFieldDisplayLabel = (label: string) => {
    if (!label) return '';
    const parts = label.split('.');
    return parts[parts.length - 1];
  };
  
  // Format group by label showing actual values
  const groupByLabel = useMemo(() => {
    if (!state.groupBy) return 'Add grouping';
    
    const values = state.groupBy.selectedValues.map(formatValueLabel);
    if (values.length === 0) return 'Add grouping';
    
    if (values.length === 1) {
      return values[0];
    } else if (values.length === 2) {
      return `${values[0]} and ${values[1]}`;
    } else if (values.length === 3) {
      return `${values[0]}, ${values[1]}, and ${values[2]}`;
    } else {
      // Show first 3 and count remaining
      const remaining = values.length - 3;
      return `${values[0]}, ${values[1]}, ${values[2]}, and ${remaining} more`;
    }
  }, [state.groupBy?.selectedValues]);

  // Close Group By popovers when clicking outside
  useEffect(() => {
    if (!isGroupByFieldSelectorOpen && !isGroupByValueSelectorOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't close if clicking the button
      if (groupByButtonRef.current?.contains(target)) {
        return;
      }

      // Close if clicking outside the popover
      if (groupByPopoverRef.current && !groupByPopoverRef.current.contains(target)) {
        setIsGroupByFieldSelectorOpen(false);
        setIsGroupByValueSelectorOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isGroupByFieldSelectorOpen, isGroupByValueSelectorOpen]);

  // Compute block results for live preview
  const { result, blockResults } = useMemo(() => {
    if (state.metricFormula.blocks.length === 0) {
      return { result: { value: null, series: null }, blockResults: [] };
    }
    
    return computeFormula({
      formula: state.metricFormula,
      start: state.start,
      end: state.end,
      granularity: state.granularity,
      store: warehouse,
      schema,
      selectedObjects: state.selectedObjects,
      selectedFields: state.selectedFields,
    });
  }, [
    state.metricFormula,
    state.start,
    state.end,
    state.granularity,
    state.selectedObjects,
    state.selectedFields,
    warehouse,
    version,
  ]);

  const handleAddBlock = () => {
    const blockId = `block_${Date.now()}`;
    
    // Always work with the current state formula (not draft)
    const currentBlocks = state.metricFormula.blocks;
    const newBlock: MetricBlock = {
      id: blockId,
      name: `Block ${currentBlocks.length + 1}`,
      source: undefined,
      op: 'sum',
      type: 'sum_over_period',
      filters: [],
    };
    
    // Check if this will create a multi-block situation
    const willBeMultiBlock = currentBlocks.length + 1 >= 2;
    
    if (willBeMultiBlock) {
      // Create draft formula with the new block
      const updatedDraft = {
        ...state.metricFormula,
        blocks: [...currentBlocks, newBlock],
      };
      setDraftFormula(updatedDraft);
      setHasUnappliedChanges(true);
    } else {
      // Single block - update directly (shouldn't happen since we start with 1 block)
      dispatch(actions.addMetricBlock(newBlock));
    }
  };

  const handleUpdateBlock = (blockId: string, updates: Partial<MetricBlock>) => {
    if (isMultiBlock && draftFormula) {
      // Update draft formula
      const updatedBlocks = draftFormula.blocks.map(block =>
        block.id === blockId ? { ...block, ...updates } : block
      );
      setDraftFormula({ ...draftFormula, blocks: updatedBlocks });
      setHasUnappliedChanges(true);
    } else {
      // Single block - update directly
      dispatch(actions.updateMetricBlock(blockId, updates));
    }
  };

  const handleRemoveBlock = (blockId: string) => {
    if (isMultiBlock && draftFormula) {
      // Remove from draft formula
      const updatedBlocks = draftFormula.blocks.filter(block => block.id !== blockId);
      const updatedDraft = { ...draftFormula, blocks: updatedBlocks };
      
      // If this brings us back to single block, apply immediately
      if (updatedBlocks.length === 1) {
        // Apply the removal directly
        dispatch(actions.removeMetricBlock(blockId));
        setDraftFormula(null);
        setHasUnappliedChanges(false);
      } else {
        setDraftFormula(updatedDraft);
        setHasUnappliedChanges(true);
      }
    } else {
      // Single block - remove directly
      dispatch(actions.removeMetricBlock(blockId));
    }
  };

  const handleCalculationChange = (calculation: MetricFormula['calculation']) => {
    if (isMultiBlock && draftFormula) {
      // Update draft formula
      setDraftFormula({ ...draftFormula, calculation });
      setHasUnappliedChanges(true);
    } else {
      dispatch(actions.setCalculation(calculation));
    }
  };

  const handleToggleExposeBlock = (blockId: string) => {
    // Always apply expose block changes immediately (not part of draft)
    // This allows users to see exposed values in the main content area right away
    dispatch(actions.toggleExposeBlock(blockId));
    
    // Also update draft formula if it exists to keep it in sync
    if (draftFormula) {
      const currentExposeBlocks = draftFormula.exposeBlocks || [];
      const updatedExposeBlocks = currentExposeBlocks.includes(blockId)
        ? currentExposeBlocks.filter(id => id !== blockId)
        : [...currentExposeBlocks, blockId];
      setDraftFormula({ ...draftFormula, exposeBlocks: updatedExposeBlocks });
    }
  };

  const handleApplyChanges = () => {
    if (draftFormula) {
      // Apply all changes from draft to state
      draftFormula.blocks.forEach((block, index) => {
        if (index < state.metricFormula.blocks.length) {
          // Update existing block
          dispatch(actions.updateMetricBlock(block.id, block));
        } else {
          // Add new block
          dispatch(actions.addMetricBlock(block));
        }
      });
      
      // Remove blocks that were deleted
      state.metricFormula.blocks.forEach(block => {
        if (!draftFormula.blocks.find(b => b.id === block.id)) {
          dispatch(actions.removeMetricBlock(block.id));
        }
      });
      
      // Update calculation
      if (draftFormula.calculation) {
        dispatch(actions.setCalculation(draftFormula.calculation));
      }
      
      // Note: expose blocks are managed separately and apply immediately
      // so we don't need to sync them here
      
      setHasUnappliedChanges(false);
    }
  };

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

  // Chart configuration options
  const chartTypes: { value: ChartType; label: string }[] = [
    { value: 'table', label: 'Table' },
    { value: 'line', label: 'Line' },
    { value: 'area', label: 'Area' },
    { value: 'bar', label: 'Bar' },
  ];

  const comparisonOptions: { value: Comparison; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'period_start', label: 'Period Start Baseline' },
    { value: 'previous_period', label: 'Previous Period' },
    { value: 'previous_year', label: 'Previous Year' },
  ];

  // Filter timestamp-like fields for X axis
  const xAxisFields = useMemo(() => {
    const allFields = [...state.selectedFields];
    state.metricFormula.blocks.forEach(block => {
      if (block.source) {
        const exists = allFields.some(f => 
          f.object === block.source!.object && f.field === block.source!.field
        );
        if (!exists) {
          allFields.push({ object: block.source.object, field: block.source.field });
        }
      }
    });
    
    return allFields.filter(({ object, field }) => {
      const schemaObj = schema.objects.find(o => o.name === object);
      if (!schemaObj) return false;
      const schemaField = schemaObj.fields.find(f => f.name === field);
      if (!schemaField) return false;
      return schemaField.type === 'date' ||
             field.toLowerCase().includes('created') ||
             field.toLowerCase().includes('date');
    });
  }, [state.selectedFields, state.metricFormula.blocks]);

  // Filter numeric fields for Y axis
  const yAxisFields = useMemo(() => {
    const allFields = [...state.selectedFields];
    state.metricFormula.blocks.forEach(block => {
      if (block.source) {
        const exists = allFields.some(f => 
          f.object === block.source!.object && f.field === block.source!.field
        );
        if (!exists) {
          allFields.push({ object: block.source.object, field: block.source.field });
        }
      }
    });
    
    return allFields.filter(({ object, field }) => {
      const schemaObj = schema.objects.find(o => o.name === object);
      if (!schemaObj) return false;
      const schemaField = schemaObj.fields.find(f => f.name === field);
      if (!schemaField) return false;
      return schemaField.type === 'number';
    });
  }, [state.selectedFields, state.metricFormula.blocks]);

  const currentXSourceValue = state.chart.xSource
    ? `${state.chart.xSource.object}.${state.chart.xSource.field}`
    : '';

  const currentYFieldValue = state.chart.yField
    ? `${state.chart.yField.object}.${state.chart.yField.field}`
    : '';

  const handleXSourceChange = (value: string) => {
    if (!value) {
      dispatch(actions.setXSource(undefined));
      return;
    }
    const [object, field] = value.split('.');
    dispatch(actions.setXSource({ object, field }));
  };

  const handleYFieldChange = (value: string) => {
    if (!value) {
      dispatch(actions.setYField(undefined));
      return;
    }
    const [object, field] = value.split('.');
    dispatch(actions.setYField({ object, field }));
  };

  return (
    <div className="flex flex-col" style={{ padding: '16px' }}>
      {/* Chart Configuration Section */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', marginLeft: '-16px', marginRight: '-16px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: '16px' }}>
        {/* Display Section Header */}
        <button
          onClick={() => setIsDisplayExpanded(!isDisplayExpanded)}
          className="flex items-center w-full text-left cursor-pointer"
          style={{ background: 'none', border: 'none', padding: 0, gap: '4px', marginBottom: isDisplayExpanded ? '12px' : '0px' }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            style={{
              transform: isDisplayExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
              color: 'var(--text-muted)',
            }}
          >
            <path
              d="M4.5 2.5L8 6L4.5 9.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>
            Display
          </span>
        </button>

        <div 
          className="space-y-4"
          style={{
            overflow: 'hidden',
            maxHeight: isDisplayExpanded ? '1000px' : '0',
            opacity: isDisplayExpanded ? 1 : 0,
            transition: 'max-height 400ms ease-in-out, opacity 400ms ease-in-out',
          }}
        >
            {/* Display Type Toggle Buttons */}
            <div className="flex gap-2">
            {chartTypes.map((chartType) => {
              const isSelected = state.chart.type === chartType.value;
              return (
                <button
                  key={chartType.value}
                  onClick={() => dispatch(actions.setChartType(chartType.value))}
                  className="px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
                  style={{
                    backgroundColor: isSelected ? '#635BFF' : 'transparent',
                    color: isSelected ? 'white' : 'var(--text-primary)',
                    border: isSelected ? '2px solid #635BFF' : '2px solid var(--border-subtle)',
                    borderRadius: '8px',
                    minWidth: '64px',
                  }}
                >
                  {chartType.label}
                </button>
              );
            })}
            </div>

            {/* X Axis - inline with select */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                X axis
              </label>
              <CustomSelect
                value={state.chart.xSourceMode === 'time' ? 'time' : currentXSourceValue || 'time'}
                onChange={(value) => {
                  if (value === 'time') {
                    dispatch(actions.setXSourceMode('time'));
                  } else {
                    dispatch(actions.setXSourceMode('field'));
                    handleXSourceChange(value);
                  }
                }}
                options={[
                  { value: 'time', label: 'Time' },
                  ...xAxisFields.map((field) => ({
                    value: `${field.object}.${field.field}`,
                    label: getFieldLabel(field.object, field.field),
                  })),
                ]}
              />
            </div>

            {/* Y Axis - inline with select */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Y axis
              </label>
              <CustomSelect
                value={state.chart.ySourceMode === 'metric' ? 'metric' : currentYFieldValue || 'metric'}
                onChange={(value) => {
                  if (value === 'metric') {
                    dispatch(actions.setYSourceMode('metric'));
                  } else {
                    dispatch(actions.setYSourceMode('field'));
                    handleYFieldChange(value);
                  }
                }}
                options={[
                  { value: 'metric', label: 'Metric' },
                  ...yAxisFields.map((field) => ({
                    value: `${field.object}.${field.field}`,
                    label: getFieldLabel(field.object, field.field),
                  })),
                ]}
              />
            </div>

            {/* Compare - inline with select */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Compare
              </label>
              <CustomSelect
                value={state.chart.comparison}
                onChange={(value) => dispatch(actions.setComparison(value as Comparison))}
                options={comparisonOptions}
              />
            </div>
          </div>
      </div>

      {/* Data Section */}
      <div className="flex flex-col pt-4">
        {/* Data Header with Search Icon */}
        <div className="flex items-center justify-between" style={{ marginBottom: isDataExpanded ? '12px' : '0px' }}>
          <button
            onClick={() => setIsDataExpanded(!isDataExpanded)}
            className="flex items-center text-left cursor-pointer"
            style={{ background: 'none', border: 'none', padding: 0, gap: '4px' }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{
                transform: isDataExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
                color: 'var(--text-muted)',
              }}
            >
              <path
                d="M4.5 2.5L8 6L4.5 9.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>
              Data
            </span>
          </button>
          {isDataExpanded && (
            <button
              onClick={() => dispatch(actions.toggleSearch())}
              className="p-1.5 transition-colors cursor-pointer"
              style={{
                color: state.showSearch ? 'var(--text-primary)' : 'var(--text-muted)',
                backgroundColor: state.showSearch ? 'var(--bg-surface)' : 'transparent',
                borderRadius: '4px'
              }}
              onMouseEnter={(e) => {
                if (!state.showSearch) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                }
              }}
              onMouseLeave={(e) => {
                if (!state.showSearch) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
              aria-label="Toggle search"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10.5 10.5L14 14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>

        <div
          style={{
            overflow: 'hidden',
            maxHeight: isDataExpanded ? '5000px' : '0',
            opacity: isDataExpanded ? 1 : 0,
            transition: 'max-height 400ms ease-in-out, opacity 400ms ease-in-out',
          }}
        >

      {/* Search input - only show when state.showSearch is true */}
      {state.showSearch && (
        <div className="mb-3 relative">
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
            autoFocus
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
      )}


      {/* Results count */}
      {searchQuery && (
        <div id="search-results-count" className="text-xs text-gray-500 dark:text-gray-400 mb-2 ml-3 pr-[11px]" role="status" aria-live="polite">
          {filteredObjects.length} results
        </div>
      )}

      {/* Object list with connection lines overlay */}
      <div ref={containerRef} className="relative" role="list" aria-label="Data objects">
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
                  borderRadius: '10px',
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
      </div>

      {/* Horizontal Rule */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '16px', marginLeft: '-16px', marginRight: '-16px' }} />

      {/* Metric Section */}
      <div className="pt-4">
        {/* Metric Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: isMetricExpanded ? '12px' : '0px' }}>
          <button
            onClick={() => setIsMetricExpanded(!isMetricExpanded)}
            className="flex items-center text-left cursor-pointer"
            style={{ background: 'none', border: 'none', padding: 0, gap: '4px' }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{
                transform: isMetricExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
                color: 'var(--text-muted)',
              }}
            >
              <path
                d="M4.5 2.5L8 6L4.5 9.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>
              Metric
            </span>
          </button>
          {isMetricExpanded && isMultiBlock && hasUnappliedChanges && (
            <button
              onClick={handleApplyChanges}
              className="transition-colors"
              style={{
                backgroundColor: '#675DFF',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 16px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#5548E0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#675DFF';
              }}
            >
              Apply
            </button>
          )}
        </div>

        <div
          style={{
            overflow: 'hidden',
            maxHeight: isMetricExpanded ? '5000px' : '0',
            opacity: isMetricExpanded ? 1 : 0,
            transition: 'max-height 400ms ease-in-out, opacity 400ms ease-in-out',
          }}
        >
          {activeFormula.blocks.map((block) => {
            const blockResult = blockResults.find((r) => r.blockId === block.id);
            return (
              <MetricBlockCard
                key={block.id}
                block={block}
                fieldOptions={fieldOptions}
                onUpdate={handleUpdateBlock}
                onRemove={handleRemoveBlock}
                result={blockResult}
                isExposed={activeFormula.exposeBlocks?.includes(block.id)}
                onToggleExpose={handleToggleExposeBlock}
              />
            );
          })}
          
          {/* Add Block Button */}
          <button
            onClick={handleAddBlock}
            className="w-auto transition-colors"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-muted)',
              border: 'none',
              borderRadius: '10px',
              padding: '6px 12px',
              fontSize: '14px',
              fontWeight: 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '20px',
              height: '32px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-active)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6.5625 3.1875C6.5625 2.87684 6.31066 2.625 6 2.625C5.68934 2.625 5.4375 2.87684 5.4375 3.1875V5.4375H3.1875C2.87684 5.4375 2.625 5.68934 2.625 6C2.625 6.31066 2.87684 6.5625 3.1875 6.5625H5.4375V8.8125C5.4375 9.12316 5.68934 9.375 6 9.375C6.31066 9.375 6.5625 9.12316 6.5625 8.8125V6.5625H8.8125C9.12316 6.5625 9.375 6.31066 9.375 6C9.375 5.68934 9.12316 5.4375 8.8125 5.4375H6.5625V3.1875Z" fill="currentColor"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M12 5.99999C12 9.31404 9.31405 12 6 12C2.68595 12 0 9.31404 0 5.99999C0 2.68595 2.68595 0 6 0C9.32231 0 12 2.68595 12 5.99999ZM10.875 5.99999C10.875 8.69272 8.69272 10.875 6 10.875C3.30728 10.875 1.125 8.69272 1.125 5.99999C1.125 3.30727 3.30727 1.125 6 1.125C8.69998 1.125 10.875 3.30626 10.875 5.99999Z" fill="currentColor"/>
            </svg>
            Add block
          </button>
          
          {/* Group By Button */}
          <div className="relative inline-flex items-center" style={{ marginTop: '8px' }}>
            <button
              ref={groupByButtonRef}
              onClick={() => {
                if (!state.groupBy) {
                  // Open field selector
                  setIsGroupByFieldSelectorOpen(true);
                } else {
                  // Open value selector
                  setIsGroupByValueSelectorOpen(true);
                }
              }}
              className="text-sm border-none focus:outline-none cursor-pointer flex items-center transition-colors gap-2"
              style={{
                backgroundColor: 'var(--bg-surface)',
                color: state.groupBy ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: 400,
                borderRadius: '10px',
                padding: '6px 12px',
                height: '32px',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-active)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
              }}
            >
              {state.groupBy ? (
                // Icon when grouping is applied
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1.3125 3.1875C1.82812 3.1875 2.25 2.76562 2.25 2.25C2.25 1.73438 1.82812 1.3125 1.3125 1.3125C0.796875 1.3125 0.375 1.73438 0.375 2.25C0.375 2.775 0.796875 3.1875 1.3125 3.1875Z" fill="currentColor"/>
                  <path d="M1.3125 6.9375C1.82812 6.9375 2.25 6.51562 2.25 6C2.25 5.48438 1.82812 5.0625 1.3125 5.0625C0.796875 5.0625 0.375 5.48438 0.375 6C0.375 6.525 0.796875 6.9375 1.3125 6.9375Z" fill="currentColor"/>
                  <path d="M1.3125 10.6875C1.82812 10.6875 2.25 10.2656 2.25 9.75C2.25 9.23438 1.82812 8.8125 1.3125 8.8125C0.796875 8.8125 0.375 9.23438 0.375 9.75C0.375 10.275 0.796875 10.6875 1.3125 10.6875Z" fill="currentColor"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M3 2.15625C3 1.79381 3.29381 1.5 3.65625 1.5H10.9688C11.3312 1.5 11.625 1.79381 11.625 2.15625C11.625 2.51869 11.3312 2.8125 10.9688 2.8125H3.65625C3.29381 2.8125 3 2.51869 3 2.15625Z" fill="currentColor"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M3 6.00073C3 5.6383 3.29381 5.34448 3.65625 5.34448H10.9688C11.3312 5.34448 11.625 5.6383 11.625 6.00073C11.625 6.36317 11.3312 6.65698 10.9688 6.65698H3.65625C3.29381 6.65698 3 6.36317 3 6.00073Z" fill="currentColor"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M3 9.84375C3 9.48131 3.29381 9.1875 3.65625 9.1875H10.9688C11.3312 9.1875 11.625 9.48131 11.625 9.84375C11.625 10.2062 11.3312 10.5 10.9688 10.5H3.65625C3.29381 10.5 3 10.2062 3 9.84375Z" fill="currentColor"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6.5625 3.1875C6.5625 2.87684 6.31066 2.625 6 2.625C5.68934 2.625 5.4375 2.87684 5.4375 3.1875V5.4375H3.1875C2.87684 5.4375 2.625 5.68934 2.625 6C2.625 6.31066 2.87684 6.5625 3.1875 6.5625H5.4375V8.8125C5.4375 9.12316 5.68934 9.375 6 9.375C6.31066 9.375 6.5625 9.12316 6.5625 8.8125V6.5625H8.8125C9.12316 6.5625 9.375 6.31066 9.375 6C9.375 5.68934 9.12316 5.4375 8.8125 5.4375H6.5625V3.1875Z" fill="currentColor"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 5.99999C12 9.31404 9.31405 12 6 12C2.68595 12 0 9.31404 0 5.99999C0 2.68595 2.68595 0 6 0C9.32231 0 12 2.68595 12 5.99999ZM10.875 5.99999C10.875 8.69272 8.69272 10.875 6 10.875C3.30728 10.875 1.125 8.69272 1.125 5.99999C1.125 3.30727 3.30727 1.125 6 1.125C8.69998 1.125 10.875 3.30626 10.875 5.99999Z" fill="currentColor"/>
                </svg>
              )}
              <span>
                {state.groupBy ? groupByLabel : 'Group by'}
              </span>
              {state.groupBy && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>

            {/* Field Selector Popover */}
            {isGroupByFieldSelectorOpen && (
              <div
                ref={groupByPopoverRef}
                className="absolute py-1 z-50"
                style={{
                  top: 0,
                  left: 0,
                  minWidth: '240px',
                  maxHeight: '360px',
                  backgroundColor: 'var(--bg-elevated)',
                  borderRadius: '16px',
                  boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Toggle */}
                <div style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                  <button
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-surface)',
                      cursor: 'pointer',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 4.5H14M4.5 8H11.5M6.5 11.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <span>Filter</span>
                  </button>
                  <button
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--bg-elevated)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      cursor: 'pointer',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M1.3125 3.1875C1.82812 3.1875 2.25 2.76562 2.25 2.25C2.25 1.73438 1.82812 1.3125 1.3125 1.3125C0.796875 1.3125 0.375 1.73438 0.375 2.25C0.375 2.775 0.796875 3.1875 1.3125 3.1875Z" fill="currentColor"/>
                      <path d="M1.3125 6.9375C1.82812 6.9375 2.25 6.51562 2.25 6C2.25 5.48438 1.82812 5.0625 1.3125 5.0625C0.796875 5.0625 0.375 5.48438 0.375 6C0.375 6.525 0.796875 6.9375 1.3125 6.9375Z" fill="currentColor"/>
                      <path d="M1.3125 10.6875C1.82812 10.6875 2.25 10.2656 2.25 9.75C2.25 9.23438 1.82812 8.8125 1.3125 8.8125C0.796875 8.8125 0.375 9.23438 0.375 9.75C0.375 10.275 0.796875 10.6875 1.3125 10.6875Z" fill="currentColor"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M3 2.15625C3 1.79381 3.29381 1.5 3.65625 1.5H10.9688C11.3312 1.5 11.625 1.79381 11.625 2.15625C11.625 2.51869 11.3312 2.8125 10.9688 2.8125H3.65625C3.29381 2.8125 3 2.51869 3 2.15625Z" fill="currentColor"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M3 6.00073C3 5.6383 3.29381 5.34448 3.65625 5.34448H10.9688C11.3312 5.34448 11.625 5.6383 11.625 6.00073C11.625 6.36317 11.3312 6.65698 10.9688 6.65698H3.65625C3.29381 6.65698 3 6.36317 3 6.00073Z" fill="currentColor"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M3 9.84375C3 9.48131 3.29381 9.1875 3.65625 9.1875H10.9688C11.3312 9.1875 11.625 9.48131 11.625 9.84375C11.625 10.2062 11.3312 10.5 10.9688 10.5H3.65625C3.29381 10.5 3 10.2062 3 9.84375Z" fill="currentColor"/>
                    </svg>
                    <span>Group</span>
                  </button>
                </div>

                {/* Search bar */}
                <div style={{ padding: '0 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 0',
                      backgroundColor: 'transparent',
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <path
                        d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10.5 10.5L14 14"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search"
                      value={groupBySearchQuery}
                      onChange={(e) => setGroupBySearchQuery(e.target.value)}
                      style={{
                        flex: 1,
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        outline: 'none',
                        padding: 0,
                      }}
                    />
                  </div>
                </div>
                
                {/* Scrollable field list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                  {filteredGroupFields.all.length === 0 ? (
                    <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                      No matching fields
                    </div>
                  ) : (
                    <>
                      {/* Common section */}
                      {filteredGroupFields.common.length > 0 && (
                        <>
                          <div className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Common
                          </div>
                          {filteredGroupFields.common.map((field) => {
                            const plainLabel = getFieldDisplayLabel(field.label);
                            return (
                              <button
                                key={`${field.object}.${field.field}`}
                                onClick={() => {
                                  dispatch(actions.setGroupBy({
                                    field: { object: field.object, field: field.field },
                                    selectedValues: [],
                                    autoAddedField: false,
                                  }));
                                  
                                  // Transition to value selector
                                  setIsGroupByFieldSelectorOpen(false);
                                  setGroupBySearchQuery(''); // Clear search
                                  setTimeout(() => setIsGroupByValueSelectorOpen(true), 100);
                                }}
                                className="w-full text-left transition-colors flex flex-col gap-1"
                                style={{
                                  paddingLeft: '16px',
                                  paddingRight: '16px',
                                  paddingTop: '8px',
                                  paddingBottom: '8px',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <span className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 400 }}>
                                  {plainLabel}
                                </span>
                                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>
                                  {field.object}.{field.field}
                                </span>
                              </button>
                            );
                          })}
                        </>
                      )}
                      
                      {/* Other section */}
                      {filteredGroupFields.other.length > 0 && (
                        <>
                          <div className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {filteredGroupFields.common.length > 0 ? 'Other' : 'All Fields'}
                          </div>
                          {filteredGroupFields.other.map((field) => {
                            const plainLabel = getFieldDisplayLabel(field.label);
                            return (
                              <button
                                key={`${field.object}.${field.field}`}
                                onClick={() => {
                                  dispatch(actions.setGroupBy({
                                    field: { object: field.object, field: field.field },
                                    selectedValues: [],
                                    autoAddedField: false,
                                  }));
                                  
                                  // Transition to value selector
                                  setIsGroupByFieldSelectorOpen(false);
                                  setGroupBySearchQuery(''); // Clear search
                                  setTimeout(() => setIsGroupByValueSelectorOpen(true), 100);
                                }}
                                className="w-full text-left transition-colors flex flex-col gap-1"
                                style={{
                                  paddingLeft: '16px',
                                  paddingRight: '16px',
                                  paddingTop: '8px',
                                  paddingBottom: '8px',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <span className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 400 }}>
                                  {plainLabel}
                                </span>
                                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>
                                  {field.object}.{field.field}
                                </span>
                              </button>
                            );
                          })}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Value Selector Popover */}
            {isGroupByValueSelectorOpen && state.groupBy && (
              <div
                ref={groupByPopoverRef}
                className="absolute py-1 z-50"
                style={{
                  top: 0,
                  left: 0,
                  minWidth: '240px',
                  maxHeight: '360px',
                  backgroundColor: 'var(--bg-elevated)',
                  borderRadius: '16px',
                  boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <GroupBySelector
                  availableValues={availableGroupValues}
                  selectedValues={state.groupBy.selectedValues}
                  onApply={(selectedValues) => {
                    dispatch(actions.updateGroupValues(selectedValues));
                    setIsGroupByValueSelectorOpen(false);
                  }}
                  onRemove={() => {
                    dispatch(actions.clearGroupBy());
                    setIsGroupByValueSelectorOpen(false);
                  }}
                  onCancel={() => {
                    setIsGroupByValueSelectorOpen(false);
                  }}
                  maxSelections={10}
                  fieldName={state.groupBy.field.field}
                />
              </div>
            )}
          </div>

          {/* Formula Builder - only shown when 2+ blocks */}
          {activeFormula.blocks.length >= 2 && (
            <FormulaBuilder
              blocks={activeFormula.blocks}
              calculation={activeFormula.calculation}
              onCalculationChange={handleCalculationChange}
              finalValue={result.value}
              blockResults={blockResults}
              resultUnitType={result.unitType}
            />
          )}
        </div>
      </div>
    </div>
  );
}
