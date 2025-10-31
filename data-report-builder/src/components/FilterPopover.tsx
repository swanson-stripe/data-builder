'use client';
import { useState, useRef, useEffect } from 'react';
import { FieldFilter } from './FieldFilter';
import { SchemaField, FilterCondition } from '@/types';

type FilterPopoverProps = {
  field: SchemaField;
  objectName: string;
  currentFilter?: FilterCondition;
  onFilterChange: (condition: FilterCondition | null) => void;
  distinctValues?: string[];
  trigger: React.ReactNode;
  hasActiveFilter?: boolean;
};

export function FilterPopover({
  field,
  objectName,
  currentFilter,
  onFilterChange,
  distinctValues,
  trigger,
  hasActiveFilter,
}: FilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [alignment, setAlignment] = useState<'left' | 'right'>('left');
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Determine optimal alignment based on viewport position
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const popoverWidth = 320; // max-w-[320px]

    // If there's not enough space on the right, align to the right
    if (triggerRect.left + popoverWidth > viewportWidth - 20) {
      setAlignment('right');
    } else {
      setAlignment('left');
    }
  }, [isOpen]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close popover on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleFilterChange = (condition: FilterCondition | null) => {
    onFilterChange(condition);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(!isOpen);
          }
        }}
        className={`p-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          hasActiveFilter
            ? 'text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
        }`}
        aria-label={`Filter ${field.label}`}
        aria-expanded={isOpen}
        title={hasActiveFilter ? 'Filter active' : 'Add filter'}
      >
        {trigger}
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className={`absolute top-full mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[240px] max-w-[320px] ${
            alignment === 'right' ? 'right-0' : 'left-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {objectName}.{field.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {field.type}
            </div>
          </div>
          <div className="p-2">
            <FieldFilter
              field={field}
              objectName={objectName}
              currentFilter={currentFilter}
              onFilterChange={handleFilterChange}
              distinctValues={distinctValues}
            />
          </div>
        </div>
      )}
    </div>
  );
}

