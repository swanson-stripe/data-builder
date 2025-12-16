'use client';
import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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
  /** When true, the trigger wrapper button is unstyled (no padding/background), letting the trigger node control visuals */
  unstyled?: boolean;
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
  unstyled = false,
}: FilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Function to calculate popover position
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return null;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const popoverWidth = 240;
    const estHeight = 440;

    // Try to center under the trigger
    const desiredLeft = triggerRect.left + (triggerRect.width / 2) - (popoverWidth / 2);
    
    // Clamp horizontally
    const left = Math.max(12, Math.min(desiredLeft, viewportWidth - popoverWidth - 12));

    // Prefer opening downward
    const downTop = triggerRect.bottom + 6;
    const upTop = triggerRect.top - estHeight - 6;
    const top = downTop + estHeight > viewportHeight - 12 ? Math.max(12, upTop) : downTop;

    return { top, left, width: popoverWidth };
  }, []);

  // Calculate position when opening (use layoutEffect for synchronous calculation)
  useLayoutEffect(() => {
    if (isOpen) {
      const position = calculatePosition();
      if (position) {
        setPopoverPosition(position);
      }
    } else {
      setPopoverPosition(null);
    }
  }, [isOpen, calculatePosition]);

  // Recalculate position on scroll or resize
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      const position = calculatePosition();
      if (position) {
        setPopoverPosition(position);
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, calculatePosition]);

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
    <div
      className="relative inline-block"
    >
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          if (!isOpen) {
            // Calculate position immediately before opening
            const position = calculatePosition();
            if (position) {
              setPopoverPosition(position);
            }
            setIsOpen(true);
          } else {
            setIsOpen(false);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            if (!isOpen) {
              // Calculate position immediately before opening
              const position = calculatePosition();
              if (position) {
                setPopoverPosition(position);
              }
              setIsOpen(true);
            } else {
              setIsOpen(false);
            }
          }
        }}
        className={
          asMenuItem
            ? 'focus:outline-none'
            : unstyled
              ? 'focus:outline-none'
              : `p-1 rounded transition-colors focus:outline-none ${
                  hasActiveFilter
                    ? 'hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`
        }
        style={
          asMenuItem
            ? {
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                padding: 0,
                margin: 0,
                textAlign: 'left',
                display: 'inline-flex',
              }
            : unstyled
              ? {
                  cursor: 'pointer',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'inline-flex',
                }
              : hasActiveFilter
                ? {
                    color: '#675DFF',
                    outline: isOpen ? '2px solid #675DFF' : 'none',
                    outlineOffset: '2px',
                  }
                : undefined
        }
        aria-label={`Filter ${field.label}`}
        aria-expanded={isOpen}
        title={hasActiveFilter ? 'Filter active' : 'Add filter'}
      >
        {trigger}
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          className="py-1"
          style={{
            position: 'fixed',
            top: popoverPosition?.top ?? 0,
            left: popoverPosition?.left ?? 0,
            width: popoverPosition?.width ?? 240,
            maxHeight: '440px',
            overflowY: 'auto',
            borderRadius: '16px',
            boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
            backgroundColor: 'var(--bg-elevated)',
            zIndex: 10000,
            opacity: popoverPosition ? 1 : 0,
            transition: 'opacity 0.1s',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
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
        </div>,
        document.body
      )}
    </div>
  );
}

