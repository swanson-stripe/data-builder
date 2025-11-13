'use client';

import { useState, useMemo } from 'react';
import { useTheme } from 'next-themes';

export type GroupBySelectorProps = {
  availableValues: string[];
  selectedValues: string[];
  onApply: (selectedValues: string[]) => void;
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
  onCancel,
  maxSelections = 10,
}: GroupBySelectorProps) {
  const { theme } = useTheme();
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
        <button onClick={onCancel} className="btn-cancel">
          Cancel
        </button>
        <button onClick={handleApply} className="btn-apply">
          Apply
        </button>
      </div>

      <style jsx>{`
        .group-by-selector {
          display: flex;
          flex-direction: column;
          width: 300px;
          background: ${theme === 'dark' ? '#1f2937' : '#ffffff'};
          border: 1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'};
          border-radius: 8px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          overflow: hidden;
        }

        .search-container {
          position: relative;
          padding: 12px;
          border-bottom: 1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'};
        }

        .search-icon {
          position: absolute;
          left: 24px;
          top: 50%;
          transform: translateY(-50%);
          color: ${theme === 'dark' ? '#9ca3af' : '#6b7280'};
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          padding: 8px 12px 8px 36px;
          border: 1px solid ${theme === 'dark' ? '#374151' : '#d1d5db'};
          border-radius: 6px;
          background: ${theme === 'dark' ? '#111827' : '#ffffff'};
          color: ${theme === 'dark' ? '#f9fafb' : '#111827'};
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
        }

        .search-input:focus {
          border-color: #6366f1;
        }

        .search-input::placeholder {
          color: ${theme === 'dark' ? '#6b7280' : '#9ca3af'};
        }

        .selection-header {
          padding: 12px;
          border-bottom: 1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'};
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
          color: ${theme === 'dark' ? '#f9fafb' : '#111827'};
        }

        .value-list {
          max-height: 300px;
          overflow-y: auto;
          padding: 8px 12px;
        }

        .value-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          border-radius: 4px;
          cursor: pointer;
          user-select: none;
          transition: background 0.15s;
        }

        .value-item:hover {
          background: ${theme === 'dark' ? '#374151' : '#f3f4f6'};
        }

        .value-label {
          font-size: 14px;
          color: ${theme === 'dark' ? '#f9fafb' : '#111827'};
        }

        .empty-state {
          padding: 24px;
          text-align: center;
          font-size: 14px;
          color: ${theme === 'dark' ? '#9ca3af' : '#6b7280'};
        }

        .actions {
          display: flex;
          gap: 8px;
          padding: 12px;
          border-top: 1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'};
          justify-content: flex-end;
        }

        .btn-cancel,
        .btn-apply {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
        }

        .btn-cancel {
          background: ${theme === 'dark' ? '#374151' : '#f3f4f6'};
          color: ${theme === 'dark' ? '#f9fafb' : '#111827'};
        }

        .btn-cancel:hover {
          background: ${theme === 'dark' ? '#4b5563' : '#e5e7eb'};
        }

        .btn-apply {
          background: #6366f1;
          color: #ffffff;
        }

        .btn-apply:hover {
          background: #4f46e5;
        }

        .btn-apply:active {
          background: #4338ca;
        }
      `}</style>
    </div>
  );
}

