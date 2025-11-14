'use client';

import { useState, useMemo } from 'react';

export type GroupBySelectorProps = {
  availableValues: string[];
  selectedValues: string[];
  onApply: (selectedValues: string[]) => void;
  onRemove: () => void;
  onCancel: () => void;
  maxSelections?: number;
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
}: GroupBySelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [searchQuery, setSearchQuery] = useState('');

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

      {/* Value list */}
      <div className="value-list">
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
              <span className="value-label">{value}</span>
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
          position: relative;
          padding: 12px;
          border-bottom: 1px solid var(--border-medium);
        }

        .search-icon {
          position: absolute;
          left: 24px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          padding: 8px 12px 8px 36px;
          border: 1px solid var(--border-medium);
          border-radius: 6px;
          background: var(--bg-surface);
          color: var(--text-primary);
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
        }

        .search-input:focus {
          border-color: #6366f1;
        }

        .search-input::placeholder {
          color: var(--text-muted);
        }

        .selection-header {
          padding: 12px;
          border-bottom: 1px solid var(--border-medium);
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
          padding: 8px 0;
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
          padding: 16px;
          background: var(--bg-elevated);
          position: sticky;
          bottom: 0;
        }

        .btn-remove,
        .btn-apply {
          flex: 1;
          padding: 10px 16px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
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

