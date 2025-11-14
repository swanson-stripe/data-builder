'use client';

import { useState, useMemo } from 'react';

export type GroupBySelectorProps = {
  availableValues: string[];
  selectedValues: string[];
  onApply: (selectedValues: string[]) => void;
  onRemove: () => void;
  onCancel: () => void;
  maxSelections?: number;
  chipLabel?: string; // The label from the chip to display at top
};

/**
 * Multi-select component for choosing group values
 * Matches Stripe's design pattern with search and max selection limit
 */
export default function GroupBySelector({
  availableValues,
  selectedValues: initialSelected,
  onApply,
  onRemove,
  onCancel,
  maxSelections = 10,
  chipLabel = 'Group by',
}: GroupBySelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [searchQuery, setSearchQuery] = useState('');
  
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

  const filteredValues = useMemo(() => {
    if (!searchQuery) return availableValues;
    const query = searchQuery.toLowerCase();
    return availableValues.filter(v => v.toLowerCase().includes(query));
  }, [availableValues, searchQuery]);

  const handleToggle = (value: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(value)) {
      newSelected.delete(value);
    } else {
      if (newSelected.size >= maxSelections) {
        return; // Don't allow selection beyond limit
      }
      newSelected.add(value);
    }
    setSelected(newSelected);
  };

  const handleSelectAll = () => {
    if (selected.size === filteredValues.length) {
      // Deselect all filtered
      const newSelected = new Set(selected);
      filteredValues.forEach(v => newSelected.delete(v));
      setSelected(newSelected);
    } else {
      // Select all filtered (up to max)
      const newSelected = new Set(selected);
      for (const value of filteredValues) {
        if (newSelected.size >= maxSelections) break;
        newSelected.add(value);
      }
      setSelected(newSelected);
    }
  };

  const handleApply = () => {
    onApply(Array.from(selected));
  };

  const isAllSelected = filteredValues.length > 0 && filteredValues.every(v => selected.has(v));
  const atMaxLimit = selected.size >= maxSelections;

  return (
    <div className="group-by-selector">
      {/* Chip label header */}
      <div className="chip-label-header">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1.3125 3.1875C1.82812 3.1875 2.25 2.76562 2.25 2.25C2.25 1.73438 1.82812 1.3125 1.3125 1.3125C0.796875 1.3125 0.375 1.73438 0.375 2.25C0.375 2.775 0.796875 3.1875 1.3125 3.1875Z" fill="currentColor"/>
          <path d="M1.3125 6.9375C1.82812 6.9375 2.25 6.51562 2.25 6C2.25 5.48438 1.82812 5.0625 1.3125 5.0625C0.796875 5.0625 0.375 5.48438 0.375 6C0.375 6.525 0.796875 6.9375 1.3125 6.9375Z" fill="currentColor"/>
          <path d="M1.3125 10.6875C1.82812 10.6875 2.25 10.2656 2.25 9.75C2.25 9.23438 1.82812 8.8125 1.3125 8.8125C0.796875 8.8125 0.375 9.23438 0.375 9.75C0.375 10.275 0.796875 10.6875 1.3125 10.6875Z" fill="currentColor"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M3 2.15625C3 1.79381 3.29381 1.5 3.65625 1.5H10.9688C11.3312 1.5 11.625 1.79381 11.625 2.15625C11.625 2.51869 11.3312 2.8125 10.9688 2.8125H3.65625C3.29381 2.8125 3 2.51869 3 2.15625Z" fill="currentColor"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M3 6.00073C3 5.6383 3.29381 5.34448 3.65625 5.34448H10.9688C11.3312 5.34448 11.625 5.6383 11.625 6.00073C11.625 6.36317 11.3312 6.65698 10.9688 6.65698H3.65625C3.29381 6.65698 3 6.36317 3 6.00073Z" fill="currentColor"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M3 9.84375C3 9.48131 3.29381 9.1875 3.65625 9.1875H10.9688C11.3312 9.1875 11.625 9.48131 11.625 9.84375C11.625 10.2062 11.3312 10.5 10.9688 10.5H3.65625C3.29381 10.5 3 10.2062 3 9.84375Z" fill="currentColor"/>
        </svg>
        <span className="chip-label-text">{chipLabel}</span>
      </div>
      
      {/* Filter/Group toggle (non-functional for now) */}
      <div className="toggle-container">
        <button className="toggle-button">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4.5H14M4.5 8H11.5M6.5 11.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>Filter</span>
        </button>
        <button className="toggle-button active">
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
      
      {/* Search input */}
      <div className="search-container">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="search-icon"
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
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Value list with selection header inside */}
      <div className="value-list">
        {/* Selection header */}
        <div className="selection-header">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleSelectAll}
              className="checkbox"
            />
            <span className="selection-count">
              {selected.size} selected {atMaxLimit && `(max ${maxSelections})`}
            </span>
          </label>
        </div>
        {filteredValues.length === 0 ? (
          <div className="empty-state">No matching values</div>
        ) : (
          filteredValues.map((value) => (
            <label key={value} className="value-item">
              <input
                type="checkbox"
                checked={selected.has(value)}
                onChange={() => handleToggle(value)}
                disabled={!selected.has(value) && atMaxLimit}
                className="checkbox"
              />
              <span className="value-label">{formatValueLabel(value)}</span>
            </label>
          ))
        )}
        </div>

      {/* Action buttons */}
      <div className="actions">
        <button onClick={onRemove} className="btn-remove">
          Remove
        </button>
        <button onClick={handleApply} className="btn-apply">
          Apply
        </button>
      </div>

      <style jsx>{`
        .group-by-selector {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        
        .chip-label-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 16px;
        }
        
        .chip-label-header svg {
          color: var(--text-primary);
          flex-shrink: 0;
        }
        
        .chip-label-text {
          font-size: 14px;
          font-weight: 400;
          color: var(--text-primary);
        }
        
        .toggle-container {
          display: flex;
          gap: 8px;
          padding: 4px 16px;
        }
        
        .toggle-button {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          border: none;
          background: var(--bg-surface);
          color: var(--text-muted);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }
        
        .toggle-button svg {
          width: 12px;
          height: 12px;
        }
        
        .toggle-button:hover {
          background: var(--bg-active);
        }
        
        .toggle-button.active {
          background: var(--bg-elevated);
          color: var(--text-primary);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .search-container {
          position: relative;
          padding: 0 16px;
          border-bottom: 1px solid var(--border-default);
        }

        .search-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          padding: 12px 12px 12px 40px;
          border: none;
          background: transparent;
          color: var(--text-primary);
          font-size: 14px;
          outline: none;
        }

        .search-input::placeholder {
          color: var(--text-muted);
        }

        .selection-header {
          padding: 8px 16px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          user-select: none;
        }

        .checkbox {
          width: 16px;
          height: 16px;
          cursor: pointer;
          accent-color: #6366f1;
        }

        .checkbox:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .selection-count {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
        }

        .value-list {
          flex: 1;
          overflow-y: auto;
          padding: 0;
        }

        .value-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          cursor: pointer;
          user-select: none;
          transition: background 0.15s;
        }

        .value-item:hover {
          background: var(--bg-surface);
        }

        .value-label {
          font-size: 14px;
          color: var(--text-primary);
        }

        .empty-state {
          padding: 24px;
          text-align: center;
          font-size: 14px;
          color: var(--text-muted);
        }

        .actions {
          display: flex;
          gap: 8px;
          padding: 4px 16px 8px 16px;
          background: var(--bg-elevated);
          position: sticky;
          bottom: 0;
        }

        .btn-remove,
        .btn-apply {
          flex: 1;
          height: 28px;
          padding: 0 16px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn-remove {
          background: var(--bg-surface);
          color: var(--text-primary);
        }

        .btn-remove:hover {
          background: var(--bg-active);
        }

        .btn-apply {
          background: #635BFF;
          color: #ffffff;
        }

        .btn-apply:hover {
          background: #5851E6;
        }

        .btn-apply:active {
          background: #4E47CC;
        }
      `}</style>
    </div>
  );
}

