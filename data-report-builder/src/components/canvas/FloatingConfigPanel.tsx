'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMapView, mapActions } from '@/state/mapView';
import { useReactFlow } from 'reactflow';
import type { MapElement, MapElementType } from '@/types/mapElements';

interface FloatingConfigPanelProps {
  selectedElement: MapElement;
  nodePosition: { x: number; y: number };
}

export function FloatingConfigPanel({ selectedElement, nodePosition }: FloatingConfigPanelProps) {
  const { dispatch } = useMapView();
  const reactFlowInstance = useReactFlow();
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Calculate position above the selected node
  useEffect(() => {
    if (!panelRef.current) return;

    const panelHeight = panelRef.current.offsetHeight;
    const panelWidth = panelRef.current.offsetWidth;
    
    // Get the viewport transform
    const viewport = reactFlowInstance.getViewport();
    const zoom = viewport.zoom;
    
    // Transform node position to screen position
    const screenX = nodePosition.x * zoom + viewport.x;
    const screenY = nodePosition.y * zoom + viewport.y;
    
    // Position panel above the node, centered
    const top = screenY - panelHeight - 20; // 20px gap above node
    const left = screenX + 200 - (panelWidth / 2); // Assuming ~400px node width, center the panel

    setPosition({ top, left });
  }, [nodePosition, reactFlowInstance]);

  const handleDelete = useCallback(() => {
    if (confirm(`Delete ${selectedElement.data.label}?`)) {
      dispatch(mapActions.deleteElement(selectedElement.id));
    }
  }, [selectedElement, dispatch]);

  const handleUpdateData = useCallback((updates: Partial<MapElement['data']>) => {
    dispatch(mapActions.updateElement({
      id: selectedElement.id,
      data: {
        ...selectedElement.data,
        ...updates,
      },
    }));
  }, [selectedElement, dispatch]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dispatch(mapActions.deselectElement());
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [dispatch]);

  const renderConfigOptions = () => {
    switch (selectedElement.type) {
      case 'filter':
      case 'metric':
      case 'grouping':
        // These have inline config, only show delete button
        return null;

      case 'dataList':
        return (
          <>
            <ConfigButton
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              }
              label="Add field"
              onClick={() => {
                // TODO: Open field selector
                alert('Add field functionality coming soon');
              }}
            />
            <ConfigButton
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 6L14 10L10 14M6 14L2 10L6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              label="Export"
              onClick={() => {
                alert('Export functionality coming soon');
              }}
            />
          </>
        );

      case 'chart':
        return (
          <>
            <ConfigSelect
              label="Chart type"
              value={(selectedElement.data as any).chartType || 'line'}
              options={[
                { value: 'line', label: 'Line' },
                { value: 'bar', label: 'Bar' },
                { value: 'area', label: 'Area' },
                { value: 'pie', label: 'Pie' },
              ]}
              onChange={(value) => handleUpdateData({ chartType: value })}
            />
          </>
        );

      case 'sqlQuery':
        return (
          <>
            <ConfigSelect
              label="Query mode"
              value={(selectedElement.data as any).mode || 'update'}
              options={[
                { value: 'update', label: 'Update table' },
                { value: 'create', label: 'Create new table' },
              ]}
              onChange={(value) => handleUpdateData({ mode: value })}
            />
          </>
        );

      default:
        return null;
    }
  };

  // Don't render panel for elements with inline config (but they still show delete button)
  const configOptions = renderConfigOptions();
  const hasConfigOptions = configOptions !== null;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 1000,
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
        padding: '8px',
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
        animation: 'fadeInUp 0.2s ease-out',
      }}
    >
      {/* Config options */}
      {hasConfigOptions && configOptions}

      {/* Divider (only if there are config options) */}
      {hasConfigOptions && (
        <div
          style={{
            width: '1px',
            height: '24px',
            backgroundColor: 'var(--border-default)',
            margin: '0 4px',
          }}
        />
      )}

      {/* Delete button */}
      <ConfigButton
        icon={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 4H13M5 4V3C5 2.44772 5.44772 2 6 2H10C10.5523 2 11 2.44772 11 3V4M6 7V11M10 7V11M4 4L5 13C5 13.5523 5.44772 14 6 14H10C10.5523 14 11 13.5523 11 13L12 4"
              stroke="#EF4444"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
        label="Delete"
        onClick={handleDelete}
        danger
      />

      {/* Arrow pointing down to element */}
      <div
        style={{
          position: 'absolute',
          bottom: '-8px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '8px solid var(--bg-elevated)',
        }}
      />

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

interface ConfigButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function ConfigButton({ icon, label, onClick, danger }: ConfigButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        fontSize: '13px',
        fontWeight: 500,
        color: danger ? '#EF4444' : 'var(--text-primary)',
        backgroundColor: isHovered ? (danger ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-surface)') : 'transparent',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

interface ConfigSelectProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

function ConfigSelect({ label, value, options, onChange }: ConfigSelectProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '6px 8px',
          fontSize: '13px',
          color: 'var(--text-primary)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '6px',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

