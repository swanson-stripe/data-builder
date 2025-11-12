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
  asMenuItem?: boolean;
};

export function FilterPopover({
  field,
  objectName,
  currentFilter,
  onFilterChange,
  distinctValues,
  trigger,
  hasActiveFilter,
  asMenuItem = false,
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
    <div className="relative inline-block" style={asMenuItem ? { width: '100%' } : undefined}>
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
        className={asMenuItem 
          ? 'w-full focus:outline-none' 
          : `p-1 rounded transition-colors focus:outline-none ${
              hasActiveFilter
                ? 'hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`
        }
        style={asMenuItem ? { 
          cursor: 'pointer',
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          textAlign: 'left'
        } : hasActiveFilter ? {
          color: '#675DFF',
          outline: isOpen ? '2px solid #675DFF' : 'none',
          outlineOffset: '2px'
        } : undefined}
        aria-label={`Filter ${field.label}`}
        aria-expanded={isOpen}
        title={hasActiveFilter ? 'Filter active' : 'Add filter'}
      >
        {trigger}
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute top-full z-50 py-1"
          style={{
            marginTop: '2px',
            borderRadius: '16px',
            boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
            minWidth: '240px',
            maxWidth: '320px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--bg-elevated)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '8px', paddingBottom: '12px' }}>
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

