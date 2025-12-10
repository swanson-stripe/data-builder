'use client';

import { useState, useMemo, useEffect } from 'react';
import { formatDisplayValue } from '@/lib/formatters';

export type GroupBySelectorProps = {
  availableValues: string[];
  selectedValues: string[];
  onApply: (selectedValues: string[]) => void;
  onRemove: () => void;
  onCancel: () => void;
  maxSelections?: number;
  fieldName?: string; // The field name for context-aware formatting (e.g., "country")
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
  fieldName,
}: GroupBySelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sync internal state when initialSelected changes (e.g., when field changes)
  // Use JSON.stringify to properly detect array content changes
  useEffect(() => {
    setSelected(new Set(initialSelected));
  }, [JSON.stringify(initialSelected)]);
  
  // Helper to format value using context-aware formatting
  const formatValueLabel = (value: string) => {
    return formatDisplayValue(value, fieldName);
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
      {/* Search input */}
      <div className="search-container">
        <div className="search-field">
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
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
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

        .search-container {
          padding: 0 16px;
          border-bottom: 1px solid var(--border-default);
        }

        .search-field {
          display: flex;
          align-items: center;
          gap: 8px;
          border: none;
          border-radius: 10px;
          padding: 10px 0;
          background-color: transparent;
        }

        .search-icon {
          color: var(--text-muted);
          flex-shrink: 0;
          width: 16px;
          height: 16px;
        }

        .search-input {
          flex: 1;
          border: none;
          background: transparent;
          color: var(--text-primary);
          font-size: 14px;
          outline: none;
          padding: 0;
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
          border-radius: 6px;
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

