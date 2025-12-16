'use client';
import { useState, useMemo, useRef, useEffect, forwardRef, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import { useApp, actions, ChartType, XSourceMode, YSourceMode, Comparison } from '@/state/app';
import schema, { getRelated, getFieldLabel } from '@/data/schema';
import { SchemaObject, MetricBlock, MetricFormula } from '@/types';
import { FieldFilter } from './FieldFilter';
import { FilterPopover } from './FilterPopover';
import { FilterCondition } from '@/types';
import { useWarehouseStore } from '@/lib/useWarehouse';
import { SchemaDefinitionModal } from './SchemaDefinitionModal';
import { CustomSelect } from './CustomSelect';
import { MetricBlockCard } from './MetricBlockCard';
import { FormulaBuilder } from './FormulaBuilder';
import { computeFormula } from '@/lib/formulaMetrics';
import { getAvailableGroupFields, getGroupValues } from '@/lib/grouping';
import GroupBySelector from './GroupBySelector';
import { getPackage, getAllPackages, isCuratedField, isTableInPackage } from '@/lib/dataPackages';

  const ObjectCard = forwardRef<HTMLDivElement, { 
    object: SchemaObject; 
    searchQuery: string;
    activePackage: string | null;
    expandedTables: Record<string, boolean>;
    onExpandChange: (objectName: string, isExpanded: boolean) => void;
    showAllFieldsMap: Record<string, boolean>;
    onShowAllFieldsChange: (objectName: string, showAll: boolean) => void;
    onOpenDefinition: (tableName: string, fieldName?: string) => void;
  }>(
  ({ object, searchQuery, activePackage, expandedTables, onExpandChange, showAllFieldsMap, onShowAllFieldsChange, onOpenDefinition }, ref) => {
    const { state, dispatch } = useApp();
    const { store: warehouse, version } = useWarehouseStore();
    
    // Track hover state for info icon and trash icon
    const [hoveredTableChip, setHoveredTableChip] = useState(false);
    const [hoveredFieldChips, setHoveredFieldChips] = useState<Record<string, boolean>>({});
    const [hoveredFieldRows, setHoveredFieldRows] = useState<Record<string, boolean>>({});
    const [hoveredInfoIcons, setHoveredInfoIcons] = useState<Record<string, boolean>>({});

    // Drag-and-drop reorder for selected fields (vertical list)
    const [draggedField, setDraggedField] = useState<string | null>(null);
    const [dragOverField, setDragOverField] = useState<string | null>(null);

    // Field options popover (DataList-style menu)
    const [openFieldMenuId, setOpenFieldMenuId] = useState<string | null>(null);
    const [showFilterOptions, setShowFilterOptions] = useState(false);
    const fieldMenuRef = useRef<HTMLDivElement>(null);

    const selectedQualifiedFields = useMemo(() => {
      return state.selectedFields.map((f) => `${f.object}.${f.field}`);
    }, [state.selectedFields]);

    const getCurrentFieldOrder = useMemo(() => {
      // Keep only selected fields in order, then append any selected fields missing from fieldOrder
      const ordered = (state.fieldOrder.length > 0 ? state.fieldOrder : selectedQualifiedFields).filter((k) =>
        selectedQualifiedFields.includes(k)
      );
      const missing = selectedQualifiedFields.filter((k) => !ordered.includes(k));
      return [...ordered, ...missing];
    }, [state.fieldOrder, selectedQualifiedFields]);

    const fieldOrderIndex = useMemo(() => {
      const map = new Map<string, number>();
      getCurrentFieldOrder.forEach((k, idx) => map.set(k, idx));
      return map;
    }, [getCurrentFieldOrder]);

    const handleFieldDragStart = (e: DragEvent, qualifiedName: string) => {
      setDraggedField(qualifiedName);
      e.dataTransfer.effectAllowed = 'move';
      if (e.currentTarget instanceof HTMLElement) {
        e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
      }
    };

    const handleFieldDragOver = (e: DragEvent, targetQualifiedName: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (draggedField && draggedField !== targetQualifiedName) {
        setDragOverField(targetQualifiedName);
      }
    };

    const handleFieldDragLeave = () => {
      setDragOverField(null);
    };

    const handleFieldDrop = (e: DragEvent, targetQualifiedName: string) => {
      e.preventDefault();
      setDragOverField(null);

      if (!draggedField || draggedField === targetQualifiedName) {
        setDraggedField(null);
        return;
      }

      const currentOrder = [...getCurrentFieldOrder];
      const draggedIndex = currentOrder.indexOf(draggedField);
      const targetIndex = currentOrder.indexOf(targetQualifiedName);
      if (draggedIndex === -1 || targetIndex === -1) {
        setDraggedField(null);
        return;
      }

      const newOrder = [...currentOrder];
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedField);
      dispatch(actions.reorderFields(newOrder));
      setDraggedField(null);
    };

    const handleFieldDragEnd = () => {
      setDraggedField(null);
      setDragOverField(null);
    };

  // Close dropdown when clicking outside
    useEffect(() => {
      if (!openFieldMenuId) return;

      const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't close if clicking on a field button
      if (target.closest('button[data-field-menu]')) {
        return;
      }
      
      if (fieldMenuRef.current && !fieldMenuRef.current.contains(target)) {
        setOpenFieldMenuId(null);
        setShowFilterOptions(false);
      }
      };

      document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openFieldMenuId]);
    
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
    
    // Sort fields: selected fields first, then curated fields (if package), then the rest
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
      
      // If there's an active package, curated fields come next
      if (activePackage) {
        const aCurated = isCuratedField(activePackage, object.name, a.name);
        const bCurated = isCuratedField(activePackage, object.name, b.name);
        if (aCurated && !bCurated) return -1;
        if (!aCurated && bCurated) return 1;
      }
      
      // Within same selection state, maintain original order
      return 0;
    });
    
    // Split into selected and unselected fields
    const selectedFields = sortedFields.filter(field => 
      state.selectedFields.some(f => f.object === object.name && f.field === field.name)
    );
    // Order selected fields by global fieldOrder (so drag reorder is reflected here)
    const orderedSelectedFields = [...selectedFields].sort((a, b) => {
      const aKey = `${object.name}.${a.name}`;
      const bKey = `${object.name}.${b.name}`;
      const aIdx = fieldOrderIndex.get(aKey) ?? Number.MAX_SAFE_INTEGER;
      const bIdx = fieldOrderIndex.get(bKey) ?? Number.MAX_SAFE_INTEGER;
      return aIdx - bIdx;
    });
    const unselectedFields = sortedFields.filter(field => 
      !state.selectedFields.some(f => f.object === object.name && f.field === field.name)
    );
    
    // When there's an active package, also split curated vs non-curated among unselected
    const curatedUnselectedFields = activePackage 
      ? unselectedFields.filter(f => isCuratedField(activePackage, object.name, f.name))
      : unselectedFields;
    const nonCuratedFields = activePackage
      ? unselectedFields.filter(f => !isCuratedField(activePackage, object.name, f.name))
      : [];
    
    // Determine if we should show "Show X more fields" button
    // When package is active: show button if there are non-curated fields hidden
    // Otherwise: show button when table has selected fields and there are unselected fields
    const hasHiddenFields = activePackage 
      ? (nonCuratedFields.length > 0 && !showAllFields)
      : (selectedFieldCount > 0 && !searchQuery && !showAllFields && unselectedFields.length > 0);
    const shouldShowMoreButton = hasHiddenFields;
    
    // Fields to actually render
    // When package: show selected + curated unselected, optionally + non-curated if showAll
    // Otherwise: show selected only if shouldShowMoreButton, else all
    const fieldsToRender = activePackage
      ? [...orderedSelectedFields, ...curatedUnselectedFields, ...(showAllFields ? nonCuratedFields : [])]
      : (shouldShowMoreButton ? orderedSelectedFields : sortedFields);
    
    // Count of hidden fields for the "show more" button
    const hiddenFieldCount = activePackage ? nonCuratedFields.length : unselectedFields.length;
    
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
            
            {/* Counter badge - hidden for now, may bring back later */}
            {false && isObjectSelected && selectedFieldCount > 0 && (
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
                const fieldId = `${object.name}.${field.name}`;
                const qualifiedName = fieldId;
                
                // Get all filters for this field (support multiple filters per field)
                const fieldFilters = state.filters.conditions.filter(
                  c => c.field.object === object.name && c.field.field === field.name
                );
                
                // For backward compatibility, use first filter as "active" filter
                const activeFilter = fieldFilters[0] || null;
                
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
                
                return (
                  <div key={field.name}>
                    <div 
                      className="flex items-center gap-2 text-xs group transition-colors relative"
                      onMouseEnter={() => setHoveredFieldRows(prev => ({ ...prev, [fieldId]: true }))}
                      onMouseLeave={() => setHoveredFieldRows(prev => ({ ...prev, [fieldId]: false }))}
                      onDragOver={isFieldSelected ? (e) => handleFieldDragOver(e, qualifiedName) : undefined}
                      onDragLeave={isFieldSelected ? handleFieldDragLeave : undefined}
                      onDrop={isFieldSelected ? (e) => handleFieldDrop(e, qualifiedName) : undefined}
                      style={{ 
                        position: 'relative',
                        paddingTop: dragOverField === qualifiedName ? '6px' : undefined,
                        borderTop: dragOverField === qualifiedName ? '2px solid #675DFF' : undefined
                      }}
                    >
                      {/* Field chip - now full width with drag handle inside */}
                      {isFieldSelected ? (
                        <div style={{ position: 'relative', display: 'flex', flex: 1, alignItems: 'center', gap: '8px' }}>
                          <button
                            data-field-menu
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenFieldMenuId(openFieldMenuId === fieldId ? null : fieldId);
                              setShowFilterOptions(false);
                            }}
                            onDragOver={(e) => handleFieldDragOver(e, qualifiedName)}
                            onDragLeave={handleFieldDragLeave}
                            onDrop={(e) => handleFieldDrop(e, qualifiedName)}
                            onMouseEnter={() => setHoveredFieldChips(prev => ({ ...prev, [fieldId]: true }))}
                            onMouseLeave={() => setHoveredFieldChips(prev => ({ ...prev, [fieldId]: false }))}
                            className="cursor-pointer hover-fast"
                            style={{
                              backgroundColor: 'transparent',
                              borderWidth: '1px',
                              borderStyle: 'solid',
                              borderColor: hoveredFieldChips[fieldId] ? 'var(--border-subtle)' : 'var(--border-default)',
                              borderRadius: '8px',
                              minHeight: '44px',
                              paddingLeft: '8px',
                              paddingRight: '8px',
                              paddingTop: '6px',
                              paddingBottom: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'border-color 100ms ease, background-color 100ms ease',
                              flex: 1,
                            }}
                          >
                            {/* Drag handle - now inside and always visible */}
                        <div
                          draggable={true}
                          onDragStart={(e) => {
                            e.stopPropagation();
                            handleFieldDragStart(e, qualifiedName);
                          }}
                          onDragEnd={handleFieldDragEnd}
                              className="cursor-move"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                                width: '16px',
                                height: '16px',
                            flexShrink: 0,
                                color: hoveredFieldChips[fieldId] ? 'var(--text-primary)' : 'var(--text-muted)',
                                transition: 'color 100ms ease',
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label="Drag to reorder field"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 10.125C3 10.7463 3.50368 11.25 4.125 11.25C4.74632 11.25 5.25 10.7463 5.25 10.125C5.25 9.50368 4.74632 9 4.125 9C3.50368 9 3 9.50368 3 10.125Z" fill="currentColor"/>
                                <path d="M6.75 10.125C6.75 10.7463 7.25368 11.25 7.875 11.25C8.49632 11.25 9 10.7463 9 10.125C9 9.50368 8.49632 9 7.875 9C7.25368 9 6.75 9.50368 6.75 10.125Z" fill="currentColor"/>
                                <path d="M3 1.875C3 2.49632 3.50368 3 4.125 3C4.74632 3 5.25 2.49632 5.25 1.875C5.25 1.25368 4.74632 0.75 4.125 0.75C3.50368 0.75 3 1.25368 3 1.875Z" fill="currentColor"/>
                                <path d="M6.75 1.875C6.75 2.49632 7.25368 3 7.875 3C8.49632 3 9 2.49632 9 1.875C9 1.25368 8.49632 0.75 7.875 0.75C7.25368 0.75 6.75 1.25368 6.75 1.875Z" fill="currentColor"/>
                                <path d="M3 6C3 6.62132 3.50368 7.125 4.125 7.125C4.74632 7.125 5.25 6.62132 5.25 6C5.25 5.37868 4.74632 4.875 4.125 4.875C3.50368 4.875 3 5.37868 3 6Z" fill="currentColor"/>
                                <path d="M6.75 6C6.75 6.62132 7.25368 7.125 7.875 7.125C8.49632 7.125 9 6.62132 9 6C9 5.37868 8.49632 4.875 7.875 4.875C7.25368 4.875 6.75 5.37868 6.75 6Z" fill="currentColor"/>
                          </svg>
                        </div>

                            {/* Field label - data list style with name and path */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                              <div className="truncate" style={{
                                color: 'var(--text-primary)',
                                fontWeight: 400,
                                fontSize: '14px',
                                lineHeight: '20px',
                                textAlign: 'left',
                              }}>
                                {getFieldLabel(object.name, field.name)}
                              </div>
                              <div className="truncate" style={{
                                color: 'var(--text-muted)',
                                fontWeight: 400,
                                fontSize: '11px',
                                lineHeight: '16px',
                                textAlign: 'left',
                                fontFamily: 'monospace',
                              }}>
                                {object.name}.{field.name}
                              </div>
                            </div>

                            {/* Info icon on hover */}
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
                              onMouseEnter={() => setHoveredInfoIcons(prev => ({ ...prev, [fieldId]: true }))}
                              onMouseLeave={() => setHoveredInfoIcons(prev => ({ ...prev, [fieldId]: false }))}
                              style={{
                                flexShrink: 0,
                                opacity: hoveredFieldRows[fieldId] ? 1 : 0,
                                transition: 'opacity 100ms ease, color 100ms ease',
                                cursor: 'pointer',
                                color: hoveredInfoIcons[fieldId] ? 'var(--text-primary)' : 'var(--text-muted)',
                              }}
                            >
                              <path fillRule="evenodd" clipRule="evenodd" d="M8.75 1.75H3.25C2.42157 1.75 1.75 2.42157 1.75 3.25V8.75C1.75 9.57843 2.42157 10.25 3.25 10.25H8.75C9.57843 10.25 10.25 9.57843 10.25 8.75V3.25C10.25 2.42157 9.57843 1.75 8.75 1.75ZM3.25 0.25C1.59315 0.25 0.25 1.59315 0.25 3.25V8.75C0.25 10.4069 1.59315 11.75 3.25 11.75H8.75C10.4069 11.75 11.75 10.4069 11.75 8.75V3.25C11.75 1.59315 10.4069 0.25 8.75 0.25H3.25Z" fill="currentColor"/>
                              <path fillRule="evenodd" clipRule="evenodd" d="M4.48182 6.49998C4.48182 6.11338 4.79522 5.79998 5.18182 5.79998H6.27273C6.65933 5.79998 6.97273 6.11338 6.97273 6.49998V8.49998C6.97273 8.88658 6.65933 9.19998 6.27273 9.19998C5.88613 9.19998 5.57273 8.88658 5.57273 8.49998V7.19998H5.18182C4.79522 7.19998 4.48182 6.88658 4.48182 6.49998Z" fill="currentColor"/>
                              <path d="M4.99994 3.99999C4.99994 3.44858 5.44854 2.99999 5.99994 2.99999C6.55134 2.99999 6.99994 3.44858 6.99994 3.99999C6.99994 4.55139 6.55134 4.99999 5.99994 4.99999C5.44854 4.99994 4.99994 4.55139 4.99994 3.99999Z" fill="currentColor"/>
                            </svg>
                          </button>

                          {/* Filter button - outside the chip, show on hover or when active */}
                          <FilterPopover
                            field={field}
                            objectName={object.name}
                            currentFilter={activeFilter || undefined}
                            onFilterChange={handleFilterChange}
                            distinctValues={distinctValuesCache[field.name]}
                            hasActiveFilter={fieldFilters.length > 0}
                            unstyled={true}
                          trigger={
                            <div
                                className="hover-fast"
                                style={{ 
                                  backgroundColor: fieldFilters.length > 0 ? '#3F4652' : 'transparent',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '28px',
                                  height: '28px',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                  opacity: fieldFilters.length > 0 || hoveredFieldRows[fieldId] ? 1 : 0,
                                  transition: 'opacity 100ms ease, background-color 100ms ease',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = fieldFilters.length > 0 ? '#3F4652' : 'var(--bg-surface)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = fieldFilters.length > 0 ? '#3F4652' : 'transparent'}
                              >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="1" y="3" width="14" height="1.5" rx="0.75" fill={fieldFilters.length > 0 ? '#FFFFFF' : '#474E5A'}/>
                                  <rect x="3" y="7" width="10" height="1.5" rx="0.75" fill={fieldFilters.length > 0 ? '#FFFFFF' : '#474E5A'}/>
                                  <rect x="5" y="11" width="6" height="1.5" rx="0.75" fill={fieldFilters.length > 0 ? '#FFFFFF' : '#474E5A'}/>
                                </svg>
                              </div>
                            }
                          />

                          {/* Column dropdown menu - matching DataList style */}
                          {openFieldMenuId === fieldId && (
                            <div
                              ref={fieldMenuRef}
                              className="absolute py-1 z-50"
                              style={{
                                top: '36px',
                                left: '0px',
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
                                      dispatch(actions.setDataListSort(fieldId, 'desc'));
                                      setOpenFieldMenuId(null);
                                    }}
                                    className="w-full text-left py-2 text-sm hover-fast flex items-center justify-between"
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
                                      dispatch(actions.setDataListSort(fieldId, 'asc'));
                                      setOpenFieldMenuId(null);
                                    }}
                                    className="w-full text-left py-2 text-sm hover-fast flex items-center justify-between"
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
                                  <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                      setShowFilterOptions(true);
                                }}
                                    className="w-full text-left py-2 text-sm flex items-center justify-between hover-fast"
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

                                  {/* Divider */}
                                  <div style={{ height: '1px', backgroundColor: 'var(--bg-surface)', margin: '4px 0' }} />

                                  {/* Remove column */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      dispatch(actions.toggleField(object.name, field.name));
                                      setOpenFieldMenuId(null);
                                    }}
                                    className="w-full text-left py-2 text-sm hover-fast"
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
                                  <div style={{ padding: '12px' }}>
                                    <FieldFilter
                                      field={field}
                                      objectName={object.name}
                                      currentFilter={activeFilter || undefined}
                                      onFilterChange={(condition) => {
                                        handleFilterChange(condition);
                                        setShowFilterOptions(false);
                                        setOpenFieldMenuId(null);
                                      }}
                                      onCancel={() => setShowFilterOptions(false)}
                                      distinctValues={distinctValuesCache[field.name]}
                                    />
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          onClick={handleFieldToggle}
                          className="cursor-pointer"
                          style={{
                            backgroundColor: 'transparent',
                            border: '1px solid var(--border-default)',
                            borderRadius: '8px',
                            height: '36px',
                            paddingLeft: '8px',
                            paddingRight: '8px',
                            paddingTop: '6px',
                            paddingBottom: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flex: 1,
                            transition: 'background-color 100ms ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          {/* Plus icon (unselected) */}
                          <div style={{
                            width: '16px',
                            height: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            color: 'var(--text-muted)',
                          }}>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <circle cx="6" cy="6" r="5.25" stroke="currentColor" strokeWidth="1.5"/>
                              <path d="M6 3.5V8.5M3.5 6H8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </div>
                          <div className="truncate transition-colors" style={{
                            color: 'var(--text-secondary)',
                            fontWeight: 400,
                            fontSize: '14px',
                            lineHeight: '20px',
                            flex: 1,
                            textAlign: 'left',
                          }}>
                            {getFieldLabel(object.name, field.name)}
                          </div>

                          {/* Info icon on hover */}
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
                              opacity: hoveredFieldRows[fieldId] ? 1 : 0,
                              transition: 'opacity 100ms ease',
                              cursor: 'pointer',
                              color: 'var(--text-muted)',
                            }}
                          >
                            <path fillRule="evenodd" clipRule="evenodd" d="M8.75 1.75H3.25C2.42157 1.75 1.75 2.42157 1.75 3.25V8.75C1.75 9.57843 2.42157 10.25 3.25 10.25H8.75C9.57843 10.25 10.25 9.57843 10.25 8.75V3.25C10.25 2.42157 9.57843 1.75 8.75 1.75ZM3.25 0.25C1.59315 0.25 0.25 1.59315 0.25 3.25V8.75C0.25 10.4069 1.59315 11.75 3.25 11.75H8.75C10.4069 11.75 11.75 10.4069 11.75 8.75V3.25C11.75 1.59315 10.4069 0.25 8.75 0.25H3.25Z" fill="currentColor"/>
                            <path fillRule="evenodd" clipRule="evenodd" d="M4.48182 6.49998C4.48182 6.11338 4.79522 5.79998 5.18182 5.79998H6.27273C6.65933 5.79998 6.97273 6.11338 6.97273 6.49998V8.49998C6.97273 8.88658 6.65933 9.19998 6.27273 9.19998C5.88613 9.19998 5.57273 8.88658 5.57273 8.49998V7.19998H5.18182C4.79522 7.19998 4.48182 6.88658 4.48182 6.49998Z" fill="currentColor"/>
                            <path d="M4.99994 3.99999C4.99994 3.44858 5.44854 2.99999 5.99994 2.99999C6.55134 2.99999 6.99994 3.44858 6.99994 3.99999C6.99994 4.55139 6.55134 4.99999 5.99994 4.99999C5.44854 4.99994 4.99994 4.55139 4.99994 3.99999Z" fill="currentColor"/>
                          </svg>
                        </div>
                      )}
                    </div>
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
                    Show {hiddenFieldCount} more field{hiddenFieldCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          )}
    </div>
  );
});

ObjectCard.displayName = 'ObjectCard';

// PackageCard - A single card that shows all package fields flattened
const PackageCard = forwardRef<HTMLDivElement, {
  packageId: string;
  searchQuery: string;
  showAllFields: boolean;
  onShowAllFieldsChange: (showAll: boolean) => void;
  onOpenDefinition: (tableName: string, fieldName?: string) => void;
}>(
({ packageId, searchQuery, showAllFields, onShowAllFieldsChange, onOpenDefinition }, ref) => {
  const { state, dispatch } = useApp();
  const { store: warehouse, version } = useWarehouseStore();
  const pkg = getPackage(packageId);
  
  const [hoveredFieldChips, setHoveredFieldChips] = useState<Record<string, boolean>>({});
  const [hoveredFieldRows, setHoveredFieldRows] = useState<Record<string, boolean>>({});
  const [hoveredInfoIcons, setHoveredInfoIcons] = useState<Record<string, boolean>>({});

  // Drag-and-drop reorder for selected fields (vertical list)
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [dragOverField, setDragOverField] = useState<string | null>(null);

  // Field options popover (DataList-style menu)
  const [openFieldMenuId, setOpenFieldMenuId] = useState<string | null>(null);
  const [showFilterOptions, setShowFilterOptions] = useState(false);
  const fieldMenuRef = useRef<HTMLDivElement>(null);

  const selectedQualifiedFields = useMemo(() => {
    return state.selectedFields.map((f) => `${f.object}.${f.field}`);
  }, [state.selectedFields]);

  const getCurrentFieldOrder = useMemo(() => {
    const ordered = (state.fieldOrder.length > 0 ? state.fieldOrder : selectedQualifiedFields).filter((k) =>
      selectedQualifiedFields.includes(k)
    );
    const missing = selectedQualifiedFields.filter((k) => !ordered.includes(k));
    return [...ordered, ...missing];
  }, [state.fieldOrder, selectedQualifiedFields]);

  const fieldOrderIndex = useMemo(() => {
    const map = new Map<string, number>();
    getCurrentFieldOrder.forEach((k, idx) => map.set(k, idx));
    return map;
  }, [getCurrentFieldOrder]);

  const handleFieldDragStart = (e: DragEvent, qualifiedName: string) => {
    setDraggedField(qualifiedName);
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    }
  };

  const handleFieldDragOver = (e: DragEvent, targetQualifiedName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedField && draggedField !== targetQualifiedName) {
      setDragOverField(targetQualifiedName);
    }
  };

  const handleFieldDragLeave = () => {
    setDragOverField(null);
  };

  const handleFieldDrop = (e: DragEvent, targetQualifiedName: string) => {
    e.preventDefault();
    setDragOverField(null);

    if (!draggedField || draggedField === targetQualifiedName) {
      setDraggedField(null);
      return;
    }

    const currentOrder = [...getCurrentFieldOrder];
    const draggedIndex = currentOrder.indexOf(draggedField);
    const targetIndex = currentOrder.indexOf(targetQualifiedName);
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedField(null);
      return;
    }

    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedField);
    dispatch(actions.reorderFields(newOrder));
    setDraggedField(null);
  };

  const handleFieldDragEnd = () => {
    setDraggedField(null);
    setDragOverField(null);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!openFieldMenuId) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't close if clicking on a field button
      if (target.closest('button[data-field-menu]')) {
        return;
      }
      
      if (fieldMenuRef.current && !fieldMenuRef.current.contains(target)) {
        setOpenFieldMenuId(null);
        setShowFilterOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openFieldMenuId]);
  
  if (!pkg) return null;

  // Helper to build field metadata
  const buildFieldMeta = (objectName: string, fieldName: string, isCurated: boolean) => {
    const schemaObj = schema.objects.find(o => o.name === objectName);
    const schemaField = schemaObj?.fields.find(f => f.name === fieldName);
    if (!schemaObj || !schemaField) return null;
    
    // Use just the field label to match DataList headers
    const displayLabel = schemaField.label;
    return {
      object: objectName,
      field: fieldName,
      objectLabel: schemaObj.label,
      fieldLabel: schemaField.label,
      displayLabel,
      fieldType: schemaField.type,
      fieldEnum: schemaField.enum,
      isCurated,
    };
  };

  // Build curated fields list (only these show in the main UI)
  const curatedPackageFields = useMemo(() => {
    return pkg.curatedFields
      .map(cf => buildFieldMeta(cf.object, cf.field, true))
      .filter((f): f is NonNullable<typeof f> => f !== null);
  }, [pkg]);

  // Build all schema fields list (for search)
  const allSchemaFields = useMemo(() => {
    const fields: Array<ReturnType<typeof buildFieldMeta> & {}> = [];
    
    pkg.tables.forEach(tableName => {
      const schemaObj = schema.objects.find(o => o.name === tableName);
      if (schemaObj) {
        schemaObj.fields.forEach(field => {
          const isCurated = pkg.curatedFields.some(
            cf => cf.object === tableName && cf.field === field.name
          );
          const meta = buildFieldMeta(tableName, field.name, isCurated);
          if (meta) fields.push(meta);
        });
      }
    });
    
    return fields;
  }, [pkg]);
  
  // Filter fields based on search query
  // When searching: search all schema fields
  // When not searching: only show curated fields
  const filteredFields = searchQuery
    ? allSchemaFields.filter(f => 
        f.displayLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.fieldLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.objectLabel.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : curatedPackageFields;
  
  // Sort: selected fields first, then curated, then rest
  const sortedFields = [...filteredFields].sort((a, b) => {
    const aSelected = state.selectedFields.some(f => f.object === a.object && f.field === a.field);
    const bSelected = state.selectedFields.some(f => f.object === b.object && f.field === b.field);
    
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    
    if (a.isCurated && !b.isCurated) return -1;
    if (!a.isCurated && b.isCurated) return 1;
    
    return 0;
  });
  
  // Split into selected and unselected
  const selectedFields = sortedFields.filter(f => 
    state.selectedFields.some(sf => sf.object === f.object && sf.field === f.field)
  );
  const orderedSelectedFields = [...selectedFields].sort((a, b) => {
    const aKey = `${a.object}.${a.field}`;
    const bKey = `${b.object}.${b.field}`;
    const aIdx = fieldOrderIndex.get(aKey) ?? Number.MAX_SAFE_INTEGER;
    const bIdx = fieldOrderIndex.get(bKey) ?? Number.MAX_SAFE_INTEGER;
    return aIdx - bIdx;
  });
  const unselectedFields = sortedFields.filter(f => 
    !state.selectedFields.some(sf => sf.object === f.object && sf.field === f.field)
  );
  
  // Count total selected fields
  const selectedFieldCount = selectedFields.length;
  
  // Show first 8 curated fields by default (exposed but not enabled)
  // When showAllFields is true, show all curated fields
  const DEFAULT_EXPOSED_COUNT = 8;
  const exposedUnselectedFields = showAllFields 
    ? unselectedFields 
    : unselectedFields.slice(0, Math.max(0, DEFAULT_EXPOSED_COUNT - selectedFieldCount));
  
  // Fields to render - selected fields + exposed unselected fields
  const fieldsToRender = [...orderedSelectedFields, ...exposedUnselectedFields];
  
  const hiddenFieldCount = unselectedFields.length - exposedUnselectedFields.length;
  const shouldShowMoreButton = !showAllFields && hiddenFieldCount > 0 && !searchQuery;
  
  // Compute distinct values cache for enum fields (use all schema fields for complete coverage)
  const distinctValuesCache = useMemo(() => {
    const cache: Record<string, string[]> = {};
    
    allSchemaFields.forEach(pf => {
      if (pf.fieldEnum && pf.fieldType === 'string') {
        const dataArray = warehouse[pf.object as keyof typeof warehouse];
        if (dataArray && Array.isArray(dataArray) && dataArray.length > 0) {
          const distinctSet = new Set<string>();
          dataArray.forEach((item: any) => {
            const value = item[pf.field];
            if (value && typeof value === 'string') {
              distinctSet.add(value);
            }
          });
          const distinctValues = Array.from(distinctSet).sort();
          if (distinctValues.length > 0) {
            cache[`${pf.object}.${pf.field}`] = distinctValues;
          }
        }
      }
    });
    
    return cache;
  }, [allSchemaFields, warehouse, version]);
  
  return (
    <div 
      ref={ref} 
      className="transition-colors relative" 
      style={{ zIndex: 2, marginBottom: '16px' }}
    >
      {/* Field list - always visible */}
      {true && (
        <div
          style={{ marginLeft: '0px', marginTop: '0px', display: 'flex', flexDirection: 'column', gap: '12px' }}
          role="group"
          aria-label="Package fields"
        >
          {fieldsToRender.map((pf) => {
            const isFieldSelected = state.selectedFields.some(
              (f) => f.object === pf.object && f.field === pf.field
            );
            const fieldId = `${pf.object}.${pf.field}`;
            
            // Get all filters for this field
            const fieldFilters = state.filters.conditions.filter(
              c => c.field.object === pf.object && c.field.field === pf.field
            );
            const activeFilter = fieldFilters[0] || null;
            
            // Get schema field for filter component
            const schemaObj = schema.objects.find(o => o.name === pf.object);
            const schemaField = schemaObj?.fields.find(f => f.name === pf.field);
            
            const handleFilterChange = (condition: FilterCondition | null) => {
              if (condition) {
                const existingIndex = state.filters.conditions.findIndex(
                  c => c.field.object === pf.object && c.field.field === pf.field
                );
                
                if (existingIndex >= 0) {
                  dispatch(actions.updateFilter(existingIndex, condition));
                } else {
                  dispatch(actions.addFilter(condition));
                }
              } else {
                const existingIndex = state.filters.conditions.findIndex(
                  c => c.field.object === pf.object && c.field.field === pf.field
                );
                if (existingIndex >= 0) {
                  dispatch(actions.removeFilter(existingIndex));
                }
              }
            };
            
            const handleFieldToggle = () => {
              // Auto-select the object if not selected
              if (!state.selectedObjects.includes(pf.object)) {
                dispatch(actions.toggleObject(pf.object));
              }
              dispatch(actions.toggleField(pf.object, pf.field));
            };
            
            return (
              <div key={fieldId}>
                <div
                  className="flex items-center gap-2 text-xs group transition-colors relative"
                  onMouseEnter={() => setHoveredFieldRows(prev => ({ ...prev, [fieldId]: true }))}
                  onMouseLeave={() => setHoveredFieldRows(prev => ({ ...prev, [fieldId]: false }))}
                  onDragOver={isFieldSelected ? (e) => handleFieldDragOver(e, fieldId) : undefined}
                  onDragLeave={isFieldSelected ? handleFieldDragLeave : undefined}
                  onDrop={isFieldSelected ? (e) => handleFieldDrop(e, fieldId) : undefined}
                  style={{
                    position: 'relative',
                    paddingTop: dragOverField === fieldId ? '6px' : undefined,
                    borderTop: dragOverField === fieldId ? '2px solid #675DFF' : undefined,
                  }}
                >
                  {/* Field chip - full width with drag handle inside */}
                  {isFieldSelected && schemaField ? (
                    <div style={{ position: 'relative', display: 'flex', flex: 1, alignItems: 'center', gap: '8px' }}>
                      <button
                        data-field-menu
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenFieldMenuId(openFieldMenuId === fieldId ? null : fieldId);
                          setShowFilterOptions(false);
                        }}
                        onDragOver={(e) => handleFieldDragOver(e, fieldId)}
                        onDragLeave={handleFieldDragLeave}
                        onDrop={(e) => handleFieldDrop(e, fieldId)}
                        onMouseEnter={() => setHoveredFieldChips(prev => ({ ...prev, [fieldId]: true }))}
                        onMouseLeave={() => setHoveredFieldChips(prev => ({ ...prev, [fieldId]: false }))}
                        className="cursor-pointer hover-fast"
                        style={{
                          backgroundColor: 'transparent',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: hoveredFieldChips[fieldId] ? 'var(--border-subtle)' : 'var(--border-default)',
                          borderRadius: '8px',
                          minHeight: '44px',
                          paddingLeft: '8px',
                          paddingRight: '8px',
                          paddingTop: '6px',
                          paddingBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'border-color 100ms ease, background-color 100ms ease',
                          flex: 1,
                        }}
                      >
                        {/* Drag handle - now inside and always visible */}
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        handleFieldDragStart(e, fieldId);
                      }}
                      onDragEnd={handleFieldDragEnd}
                          className="cursor-move"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                            width: '16px',
                            height: '16px',
                        flexShrink: 0,
                            color: hoveredFieldChips[fieldId] ? 'var(--text-primary)' : 'var(--text-muted)',
                            transition: 'color 100ms ease',
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label="Drag to reorder field"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 10.125C3 10.7463 3.50368 11.25 4.125 11.25C4.74632 11.25 5.25 10.7463 5.25 10.125C5.25 9.50368 4.74632 9 4.125 9C3.50368 9 3 9.50368 3 10.125Z" fill="currentColor"/>
                            <path d="M6.75 10.125C6.75 10.7463 7.25368 11.25 7.875 11.25C8.49632 11.25 9 10.7463 9 10.125C9 9.50368 8.49632 9 7.875 9C7.25368 9 6.75 9.50368 6.75 10.125Z" fill="currentColor"/>
                            <path d="M3 1.875C3 2.49632 3.50368 3 4.125 3C4.74632 3 5.25 2.49632 5.25 1.875C5.25 1.25368 4.74632 0.75 4.125 0.75C3.50368 0.75 3 1.25368 3 1.875Z" fill="currentColor"/>
                            <path d="M6.75 1.875C6.75 2.49632 7.25368 3 7.875 3C8.49632 3 9 2.49632 9 1.875C9 1.25368 8.49632 0.75 7.875 0.75C7.25368 0.75 6.75 1.25368 6.75 1.875Z" fill="currentColor"/>
                            <path d="M3 6C3 6.62132 3.50368 7.125 4.125 7.125C4.74632 7.125 5.25 6.62132 5.25 6C5.25 5.37868 4.74632 4.875 4.125 4.875C3.50368 4.875 3 5.37868 3 6Z" fill="currentColor"/>
                            <path d="M6.75 6C6.75 6.62132 7.25368 7.125 7.875 7.125C8.49632 7.125 9 6.62132 9 6C9 5.37868 8.49632 4.875 7.875 4.875C7.25368 4.875 6.75 5.37868 6.75 6Z" fill="currentColor"/>
                      </svg>
                    </div>

                        {/* Field label - data list style with name and path */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                          <div className="truncate" style={{
                            color: 'var(--text-primary)',
                            fontWeight: 400,
                            fontSize: '14px',
                            lineHeight: '20px',
                            textAlign: 'left',
                          }}>
                            {pf.displayLabel}
                          </div>
                          <div className="truncate" style={{
                            color: 'var(--text-muted)',
                            fontWeight: 400,
                            fontSize: '11px',
                            lineHeight: '16px',
                            textAlign: 'left',
                            fontFamily: 'monospace',
                          }}>
                            {pf.object}.{pf.field}
                          </div>
                        </div>

                        {/* Info icon on hover */}
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDefinition(pf.object, pf.field);
                          }}
                          onMouseEnter={() => setHoveredInfoIcons(prev => ({ ...prev, [fieldId]: true }))}
                          onMouseLeave={() => setHoveredInfoIcons(prev => ({ ...prev, [fieldId]: false }))}
                          style={{
                            flexShrink: 0,
                            opacity: hoveredFieldRows[fieldId] ? 1 : 0,
                            transition: 'opacity 100ms ease, color 100ms ease',
                            cursor: 'pointer',
                            color: hoveredInfoIcons[fieldId] ? 'var(--text-primary)' : 'var(--text-muted)',
                          }}
                        >
                          <path fillRule="evenodd" clipRule="evenodd" d="M8.75 1.75H3.25C2.42157 1.75 1.75 2.42157 1.75 3.25V8.75C1.75 9.57843 2.42157 10.25 3.25 10.25H8.75C9.57843 10.25 10.25 9.57843 10.25 8.75V3.25C10.25 2.42157 9.57843 1.75 8.75 1.75ZM3.25 0.25C1.59315 0.25 0.25 1.59315 0.25 3.25V8.75C0.25 10.4069 1.59315 11.75 3.25 11.75H8.75C10.4069 11.75 11.75 10.4069 11.75 8.75V3.25C11.75 1.59315 10.4069 0.25 8.75 0.25H3.25Z" fill="currentColor"/>
                          <path fillRule="evenodd" clipRule="evenodd" d="M4.48182 6.49998C4.48182 6.11338 4.79522 5.79998 5.18182 5.79998H6.27273C6.65933 5.79998 6.97273 6.11338 6.97273 6.49998V8.49998C6.97273 8.88658 6.65933 9.19998 6.27273 9.19998C5.88613 9.19998 5.57273 8.88658 5.57273 8.49998V7.19998H5.18182C4.79522 7.19998 4.48182 6.88658 4.48182 6.49998Z" fill="currentColor"/>
                          <path d="M4.99994 3.99999C4.99994 3.44858 5.44854 2.99999 5.99994 2.99999C6.55134 2.99999 6.99994 3.44858 6.99994 3.99999C6.99994 4.55139 6.55134 4.99999 5.99994 4.99999C5.44854 4.99994 4.99994 4.55139 4.99994 3.99999Z" fill="currentColor"/>
                        </svg>
                      </button>

                      {/* Filter button - outside the chip, show on hover or when active */}
                      <FilterPopover
                        field={schemaField}
                        objectName={pf.object}
                        currentFilter={activeFilter || undefined}
                        onFilterChange={handleFilterChange}
                        distinctValues={distinctValuesCache[fieldId]}
                        hasActiveFilter={fieldFilters.length > 0}
                        unstyled={true}
                      trigger={
                        <div
                            className="hover-fast"
                            style={{ 
                              backgroundColor: fieldFilters.length > 0 ? '#3F4652' : 'transparent',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '28px',
                              height: '28px',
                              cursor: 'pointer',
                              flexShrink: 0,
                              opacity: fieldFilters.length > 0 || hoveredFieldRows[fieldId] ? 1 : 0,
                              transition: 'opacity 100ms ease, background-color 100ms ease',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = fieldFilters.length > 0 ? '#3F4652' : 'var(--bg-surface)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = fieldFilters.length > 0 ? '#3F4652' : 'transparent'}
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="1" y="3" width="14" height="1.5" rx="0.75" fill={fieldFilters.length > 0 ? '#FFFFFF' : '#474E5A'}/>
                              <rect x="3" y="7" width="10" height="1.5" rx="0.75" fill={fieldFilters.length > 0 ? '#FFFFFF' : '#474E5A'}/>
                              <rect x="5" y="11" width="6" height="1.5" rx="0.75" fill={fieldFilters.length > 0 ? '#FFFFFF' : '#474E5A'}/>
                            </svg>
                          </div>
                        }
                      />

                      {/* Column dropdown menu - matching DataList style */}
                      {openFieldMenuId === fieldId && (
                        <div
                          ref={fieldMenuRef}
                          className="absolute py-1 z-50"
                          style={{
                            top: '36px',
                            left: '0px',
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
                                  dispatch(actions.setDataListSort(fieldId, 'desc'));
                                  setOpenFieldMenuId(null);
                                }}
                                className="w-full text-left py-2 text-sm hover-fast flex items-center justify-between"
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
                                  dispatch(actions.setDataListSort(fieldId, 'asc'));
                                  setOpenFieldMenuId(null);
                                }}
                                className="w-full text-left py-2 text-sm hover-fast flex items-center justify-between"
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
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowFilterOptions(true);
                                }}
                                className="w-full text-left py-2 text-sm flex items-center justify-between hover-fast"
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

                              {/* Divider */}
                              <div style={{ height: '1px', backgroundColor: 'var(--bg-surface)', margin: '4px 0' }} />

                              {/* Remove column */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  dispatch(actions.toggleField(pf.object, pf.field));
                                  setOpenFieldMenuId(null);
                                }}
                                className="w-full text-left py-2 text-sm hover-fast"
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
                              <div style={{ padding: '12px' }}>
                                <FieldFilter
                                  field={schemaField}
                                  objectName={pf.object}
                                  currentFilter={activeFilter || undefined}
                                  onFilterChange={(condition) => {
                                    handleFilterChange(condition);
                                    setShowFilterOptions(false);
                                    setOpenFieldMenuId(null);
                                  }}
                                  onCancel={() => setShowFilterOptions(false)}
                                  distinctValues={distinctValuesCache[fieldId]}
                                />
                            </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={handleFieldToggle}
                      className="cursor-pointer"
                      style={{
                        backgroundColor: 'transparent',
                        border: '1px solid var(--border-default)',
                        borderRadius: '8px',
                        height: '36px',
                        paddingLeft: '8px',
                        paddingRight: '8px',
                        paddingTop: '6px',
                        paddingBottom: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flex: 1,
                        transition: 'background-color 100ms ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{
                        width: '16px',
                        height: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: 'var(--text-muted)',
                      }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <circle cx="6" cy="6" r="5.25" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M6 3.5V8.5M3.5 6H8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div style={{
                        color: 'var(--text-secondary)',
                        fontWeight: 400,
                        fontSize: '14px',
                        lineHeight: '20px',
                        flex: 1,
                        textAlign: 'left',
                      }}>
                        {pf.displayLabel}
                      </div>

                      {/* Info icon on hover */}
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      onClick={(e) => {
                        e.stopPropagation();
                          onOpenDefinition(pf.object, pf.field);
                      }}
                      style={{
                          flexShrink: 0,
                          opacity: hoveredFieldRows[fieldId] ? 1 : 0,
                          transition: 'opacity 100ms ease',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                      }}
                    >
                        <path fillRule="evenodd" clipRule="evenodd" d="M8.75 1.75H3.25C2.42157 1.75 1.75 2.42157 1.75 3.25V8.75C1.75 9.57843 2.42157 10.25 3.25 10.25H8.75C9.57843 10.25 10.25 9.57843 10.25 8.75V3.25C10.25 2.42157 9.57843 1.75 8.75 1.75ZM3.25 0.25C1.59315 0.25 0.25 1.59315 0.25 3.25V8.75C0.25 10.4069 1.59315 11.75 3.25 11.75H8.75C10.4069 11.75 11.75 10.4069 11.75 8.75V3.25C11.75 1.59315 10.4069 0.25 8.75 0.25H3.25Z" fill="currentColor"/>
                        <path fillRule="evenodd" clipRule="evenodd" d="M4.48182 6.49998C4.48182 6.11338 4.79522 5.79998 5.18182 5.79998H6.27273C6.65933 5.79998 6.97273 6.11338 6.97273 6.49998V8.49998C6.97273 8.88658 6.65933 9.19998 6.27273 9.19998C5.88613 9.19998 5.57273 8.88658 5.57273 8.49998V7.19998H5.18182C4.79522 7.19998 4.48182 6.88658 4.48182 6.49998Z" fill="currentColor"/>
                        <path d="M4.99994 3.99999C4.99994 3.44858 5.44854 2.99999 5.99994 2.99999C6.55134 2.99999 6.99994 3.44858 6.99994 3.99999C6.99994 4.55139 6.55134 4.99999 5.99994 4.99999C5.44854 4.99994 4.99994 4.55139 4.99994 3.99999Z" fill="currentColor"/>
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* "Show X more fields" button */}
          {shouldShowMoreButton && (
            <div
              onClick={() => onShowAllFieldsChange(true)}
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
              <div style={{
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'var(--text-icon)'
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <span style={{
                color: 'var(--text-secondary)',
                fontSize: '14px',
                fontWeight: 300,
                lineHeight: '20px'
              }}>
                Show {hiddenFieldCount} more field{hiddenFieldCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

PackageCard.displayName = 'PackageCard';

export function DataTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const { state, dispatch } = useApp();
  
  // Track which tables are expanded
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  
  // Track which tables have shown all fields
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

  // Section expansion state
  const [isDisplayExpanded, setIsDisplayExpanded] = useState(true);
  const [isDataExpanded, setIsDataExpanded] = useState(true);
  const [isMetricExpanded, setIsMetricExpanded] = useState(false); // Collapsed by default

  // ===== Metric Tab State =====
  const { store: warehouse, version } = useWarehouseStore();
  
  // Track draft formula for multi-block calculations (to prevent broken states)
  const [draftFormula, setDraftFormula] = useState<MetricFormula | null>(null);
  const [hasUnappliedChanges, setHasUnappliedChanges] = useState(false);

  // Group By state
  const [isGroupByFieldSelectorOpen, setIsGroupByFieldSelectorOpen] = useState(false);
  const [isGroupByValueSelectorOpen, setIsGroupByValueSelectorOpen] = useState(false);
  const [groupBySearchQuery, setGroupBySearchQuery] = useState('');
  const [groupByPopoverPosition, setGroupByPopoverPosition] = useState({ top: 0, left: 0 });
  const groupByButtonRef = useRef<HTMLButtonElement>(null);
  const groupByPopoverRef = useRef<HTMLDivElement>(null);

  // Update Group By popover position when opened
  useEffect(() => {
    if ((isGroupByFieldSelectorOpen || isGroupByValueSelectorOpen) && groupByButtonRef.current) {
      const rect = groupByButtonRef.current.getBoundingClientRect();
      // Store the button's right edge so each popover can calculate its own left position
      setGroupByPopoverPosition({
        top: rect.bottom + 4,
        left: rect.right, // Store right edge of button
      });
    }
  }, [isGroupByFieldSelectorOpen, isGroupByValueSelectorOpen]);

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

  // Display section description - describes chart type, data, and options
  const displayDescription = useMemo(() => {
    const chartVerbs: Record<string, string> = { 
      line: 'plotting', 
      area: 'plotting', 
      bar: 'showing', 
      table: 'listing' 
    };
    const verb = chartVerbs[state.chart.type] || 'showing';
    const chartLabel = state.chart.type === 'table' 
      ? 'Table' 
      : `${state.chart.type.charAt(0).toUpperCase() + state.chart.type.slice(1)} chart`;
    
    // Get metric name from first block
    const metricName = state.metricFormula.blocks[0]?.name?.toLowerCase() || 'data';
    
    // X-axis clause
    const xAxis = state.chart.xSourceMode === 'time' 
      ? 'over time' 
      : state.chart.xSource 
        ? `by ${getFieldLabel(state.chart.xSource.object, state.chart.xSource.field)?.toLowerCase() || state.chart.xSource.field}` 
        : 'over time';
    
    // Comparison clause
    const comparisonMap: Record<string, string> = {
      previous_period: ', compared to previous period',
      previous_year: ', compared to previous year',
      period_start: ', compared to start of period',
      benchmarks: ', compared to benchmarks',
    };
    const comparison = comparisonMap[state.chart.comparison] || '';
    
    // Group by clause
    const groupByClause = state.groupBy 
      ? `, grouped by ${getFieldLabel(state.groupBy.field.object, state.groupBy.field.field)?.toLowerCase() || state.groupBy.field.field}` 
      : '';
    
    return `${chartLabel} ${verb} ${metricName} ${xAxis}${comparison}${groupByClause}`;
  }, [state.chart, state.metricFormula.blocks, state.groupBy]);

  // Metric section description - describes the calculation
  const metricDescription = useMemo(() => {
    const block = state.metricFormula.blocks[0];
    if (!block) return '';
    
    const fieldName = block.name?.toLowerCase() || 'data';
    const objectName = block.source?.object?.replace(/_/g, ' ') || 'records';
    
    // Operation phrases
    const opPhrases: Record<string, string> = {
      sum: `The sum of ${fieldName}`,
      avg: `The average of ${fieldName}`,
      count: `The count of ${objectName}`,
      distinct_count: `The distinct count of ${fieldName}`,
      median: `The median of ${fieldName}`,
      mode: `The mode of ${fieldName}`,
    };
    
    // Aggregation type phrases
    const typePhrases: Record<string, string> = {
      sum_over_period: 'totaled over the period',
      average_over_period: 'averaged over time',
      latest: 'at period end',
      first: 'at period start',
    };
    
    const opPhrase = opPhrases[block.op] || `The ${block.op} of ${fieldName}`;
    const typePhrase = typePhrases[block.type] || '';
    
    return `${opPhrase} ${typePhrase}`.trim();
  }, [state.metricFormula.blocks]);

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

  // Get the active package (if any)
  const activePackageConfig = state.activePackage ? getPackage(state.activePackage) : null;

  // Filter objects based on search AND active package
  const filteredObjects = schema.objects.filter((obj) => {
    // If there's an active package, only show objects in that package
    if (activePackageConfig && !activePackageConfig.tables.includes(obj.name)) {
      return false;
    }
    
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

  // Chart configuration options with icons
  const chartTypes: { value: ChartType; label: string; icon: React.ReactNode }[] = [
    { 
      value: 'line', 
      label: 'Line',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 14L7 10L11 13L17 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    { 
      value: 'area', 
      label: 'Area',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 14L7 10L11 13L17 6V16H3V14Z" fill="currentColor" fillOpacity="0.3"/>
          <path d="M3 14L7 10L11 13L17 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    { 
      value: 'bar', 
      label: 'Bar',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="10" width="3" height="7" rx="1" fill="currentColor"/>
          <rect x="8.5" y="6" width="3" height="11" rx="1" fill="currentColor"/>
          <rect x="14" y="3" width="3" height="14" rx="1" fill="currentColor"/>
        </svg>
      )
    },
    { 
      value: 'table', 
      label: 'Table',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <line x1="3" y1="7.5" x2="17" y2="7.5" stroke="currentColor" strokeWidth="1.5"/>
          <line x1="3" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="1.5"/>
          <line x1="8" y1="7.5" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      )
    },
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
      {/* Package Selection - shown when no package is selected */}
      {!state.activePackage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Choose a dataset
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Select a dataset to start exploring your data
            </p>
          </div>
          {getAllPackages().map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => dispatch(actions.setPackage(pkg.id))}
              className="text-left cursor-pointer"
              style={{
                padding: '12px',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-primary)',
                transition: 'border-color 100ms ease, background-color 100ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                {pkg.label}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)', lineHeight: '1.4' }}>
                {pkg.description}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Main config panel content - only shown when a package is selected */}
      {state.activePackage && (
        <>
      {/* Chart Configuration Section */}
      <div
        data-tour="config-display-section"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          marginLeft: '-16px',
          marginRight: '-16px',
          paddingLeft: '16px',
          paddingRight: '16px',
          paddingBottom: '16px',
        }}
      >
        {/* Display Section Header */}
        <div style={{ marginBottom: isDisplayExpanded ? '12px' : '0px' }}>
          <button
            onClick={() => setIsDisplayExpanded(!isDisplayExpanded)}
            className="flex items-center w-full text-left cursor-pointer"
            style={{ background: 'none', border: 'none', padding: 0, gap: '4px' }}
          >
            <span style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>
              Display
            </span>
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
          </button>
          <p style={{ 
            color: 'var(--text-muted)', 
            fontSize: '13px', 
            marginTop: '4px',
            lineHeight: '1.4',
          }}>
            {displayDescription}
          </p>
        </div>

        <div 
          className="space-y-4"
          style={{
            overflow: isDisplayExpanded ? 'visible' : 'hidden',
            maxHeight: isDisplayExpanded ? 'none' : '0',
            opacity: isDisplayExpanded ? 1 : 0,
            transition: 'opacity 400ms ease-in-out',
          }}
        >
            {/* Display Type Toggle Buttons - 2x2 Grid */}
            <div className="grid grid-cols-2 gap-2">
            {chartTypes.map((chartType) => {
              const isSelected = state.chart.type === chartType.value;
              return (
                <button
                  key={chartType.value}
                  onClick={() => dispatch(actions.setChartType(chartType.value))}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 text-xs font-medium cursor-pointer hover-fast"
                  style={{
                    backgroundColor: isSelected ? 'var(--bg-chip-selected)' : 'var(--bg-surface)',
                    color: isSelected ? 'var(--text-inverse)' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '10px',
                    minHeight: '64px',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                    }
                  }}
                >
                  {chartType.icon}
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

            {/* Group By - inline with button (styled like CustomSelect) */}
            <div className="flex items-center justify-between relative">
              <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Group by
              </label>
              <button
                ref={groupByButtonRef}
                onClick={() => {
                  if (!state.groupBy) {
                    setIsGroupByFieldSelectorOpen(true);
                  } else {
                    setIsGroupByValueSelectorOpen(true);
                  }
                }}
                className="text-sm border-none focus:outline-none cursor-pointer flex items-center transition-colors gap-2 hover-fast"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  paddingLeft: '12px',
                  paddingRight: '12px',
                  paddingTop: '8px',
                  paddingBottom: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: 400,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ whiteSpace: 'nowrap' }}>
                  {state.groupBy ? groupByLabel : 'None'}
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{
                    flexShrink: 0,
                    transition: 'transform 0.2s',
                    transform: isGroupByFieldSelectorOpen || isGroupByValueSelectorOpen ? 'rotate(180deg)' : 'none',
                  }}
                >
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Field Selector Popover - rendered via portal */}
              {isGroupByFieldSelectorOpen && typeof document !== 'undefined' && createPortal(
                <div
                  ref={groupByPopoverRef}
                  style={{
                    position: 'fixed',
                    top: groupByPopoverPosition.top,
                    left: groupByPopoverPosition.left - 280, // Right-align: button right edge minus popover width
                    width: '280px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    backgroundColor: 'var(--bg-elevated)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-popover)',
                    zIndex: 9999,
                    paddingTop: '4px',
                    paddingBottom: '4px',
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {/* None option to clear grouping */}
                  <button
                    onClick={() => {
                      dispatch(actions.clearGroupBy());
                      setIsGroupByFieldSelectorOpen(false);
                    }}
                    className="w-full text-left flex items-center justify-between hover-fast"
                    style={{
                      padding: '12px 16px',
                      backgroundColor: !state.groupBy ? 'var(--bg-surface)' : 'transparent',
                      transition: 'background-color 100ms ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = !state.groupBy ? 'var(--bg-surface)' : 'transparent'}
                  >
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '14px' }}>
                      None
                    </span>
                    {!state.groupBy && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                        <path d="M13 4L6 11L3 8" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>

                  {/* Field options - with name and field path */}
                  {[...filteredGroupFields.common, ...filteredGroupFields.other].map((field) => {
                    const plainLabel = getFieldDisplayLabel(field.label);
                    const fieldPath = `${field.object}.${field.field}`;
                    const isSelected = state.groupBy?.field.object === field.object && state.groupBy?.field.field === field.field;
                    return (
                      <button
                        key={fieldPath}
                        onClick={() => {
                          dispatch(actions.setGroupBy({
                            field: { object: field.object, field: field.field },
                            selectedValues: [],
                            autoAddedField: false,
                          }));
                          
                          setIsGroupByFieldSelectorOpen(false);
                          setTimeout(() => setIsGroupByValueSelectorOpen(true), 100);
                        }}
                        className="w-full text-left flex flex-col hover-fast"
                        style={{
                          padding: '12px 16px',
                          backgroundColor: isSelected ? 'var(--bg-surface)' : 'transparent',
                          transition: 'background-color 100ms ease',
                          gap: '2px',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isSelected ? 'var(--bg-surface)' : 'transparent'}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '14px' }}>
                            {plainLabel}
                          </span>
                          {isSelected && (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                              <path d="M13 4L6 11L3 8" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 400 }}>
                          {fieldPath}
                        </span>
                      </button>
                    );
                  })}
                </div>,
                document.body
              )}

              {/* Value Selector Popover - rendered via portal */}
              {isGroupByValueSelectorOpen && state.groupBy && typeof document !== 'undefined' && createPortal(
                <div
                  ref={groupByPopoverRef}
                  className="py-1"
                  style={{
                    position: 'fixed',
                    top: groupByPopoverPosition.top,
                    left: groupByPopoverPosition.left - 280, // Right-align: button right edge minus popover width
                    width: '280px',
                    maxHeight: '360px',
                    backgroundColor: 'var(--bg-elevated)',
                    borderRadius: '16px',
                    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 9999,
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
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
                </div>,
                document.body
              )}
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
      <div data-tour="config-data-section" className="flex flex-col pt-4">
        {/* Data Header with Search Icon */}
        <div style={{ marginBottom: isDataExpanded ? '12px' : '0px' }}>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsDataExpanded(!isDataExpanded)}
              className="flex items-center text-left cursor-pointer"
              style={{ background: 'none', border: 'none', padding: 0, gap: '4px' }}
            >
              <span style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>
                Data
              </span>
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
          <p style={{ 
            color: 'var(--text-muted)', 
            fontSize: '13px', 
            marginTop: '4px',
            lineHeight: '1.4',
          }}>
            Choose the columns you want to include in the data table
          </p>
        </div>

        <div
          style={{
            overflow: isDataExpanded ? 'visible' : 'hidden',
            maxHeight: isDataExpanded ? 'none' : '0',
            opacity: isDataExpanded ? 1 : 0,
            transition: 'opacity 400ms ease-in-out',
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


      {/* Package view - when there's an active package and no search */}
      {state.activePackage && !searchQuery ? (
        <div ref={containerRef} className="relative" role="list" aria-label="Package fields">
          <PackageCard
            packageId={state.activePackage}
            searchQuery={searchQuery}
            showAllFields={showAllFieldsMap['__package__'] ?? false}
            onShowAllFieldsChange={(showAll) => {
              setShowAllFieldsMap(prev => ({ ...prev, '__package__': showAll }));
            }}
            onOpenDefinition={(tableName, fieldName) => {
              setSelectedDefinition({
                type: fieldName ? 'field' : 'table',
                tableName,
                fieldName
              });
              setIsDefinitionModalOpen(true);
            }}
          />
        </div>
      ) : searchQuery ? (
        /* Search view - show package matches + schema matches */
        <div ref={containerRef} className="relative" role="list" aria-label="Search results">
          {/* Package section - if there's an active package */}
          {state.activePackage && (
            <>
              <PackageCard
                packageId={state.activePackage}
                searchQuery={searchQuery}
                showAllFields={true}
                onShowAllFieldsChange={() => {}}
                onOpenDefinition={(tableName, fieldName) => {
                  setSelectedDefinition({
                    type: fieldName ? 'field' : 'table',
                    tableName,
                    fieldName
                  });
                  setIsDefinitionModalOpen(true);
                }}
              />
              
              {/* All schema section header */}
              <div style={{ 
                fontSize: '12px', 
                fontWeight: 500, 
                color: 'var(--text-muted)', 
                marginTop: '24px',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                All Schema
              </div>
            </>
          )}
          
          {/* Schema results */}
          {sortedObjects.length > 0 ? (
            <>
              {displayedObjects.map((obj) => (
                <ObjectCard 
                  key={obj.name} 
                  object={obj}
                  searchQuery={searchQuery}
                  activePackage={null}
                  expandedTables={expandedTables}
                  onExpandChange={(objName, isExpanded) => {
                    setExpandedTables(prev => ({ ...prev, [objName]: isExpanded }));
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
                />
              ))}
            </>
          ) : (
            <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-8" role="status">
              No objects found matching "{searchQuery}"
            </div>
          )}
        </div>
      ) : (
        /* Default view - no package, no search - show all tables */
        <div ref={containerRef} className="relative" role="list" aria-label="Data objects">
          {sortedObjects.length > 0 ? (
            <>
              {displayedObjects.map((obj) => (
                <ObjectCard 
                  key={obj.name} 
                  object={obj}
                  searchQuery={searchQuery}
                  activePackage={null}
                  expandedTables={expandedTables}
                  onExpandChange={(objName, isExpanded) => {
                    setExpandedTables(prev => ({ ...prev, [objName]: isExpanded }));
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
                />
              ))}
            </>
          ) : (
            <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-8" role="status">
              No data objects available
            </div>
          )}
        </div>
      )}
      
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
        <div style={{ marginBottom: isMetricExpanded ? '12px' : '0px' }}>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsMetricExpanded(!isMetricExpanded)}
              className="flex items-center text-left cursor-pointer"
              style={{ background: 'none', border: 'none', padding: 0, gap: '4px' }}
            >
              <span style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>
                Metric
              </span>
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
          <p style={{ 
            color: 'var(--text-muted)', 
            fontSize: '13px', 
            marginTop: '4px',
            lineHeight: '1.4',
          }}>
            {metricDescription}
          </p>
        </div>

        <div
          style={{
            overflow: isMetricExpanded ? 'visible' : 'hidden',
            maxHeight: isMetricExpanded ? 'none' : '0',
            opacity: isMetricExpanded ? 1 : 0,
            transition: 'opacity 400ms ease-in-out',
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
        </>
      )}
    </div>
  );
}
