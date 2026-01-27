'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMapView, mapActions } from '@/state/mapView';
import { useReactFlow } from 'reactflow';
import type { ChartElementData, MapElement, MapElementType, SQLQueryElementData } from '@/types/mapElements';

interface FloatingConfigPanelProps {
  selectedElement: MapElement;
  nodePosition: { x: number; y: number };
  onHoverChange?: (isHovered: boolean) => void;
}

export function FloatingConfigPanel({ selectedElement, nodePosition, onHoverChange }: FloatingConfigPanelProps) {
  const { dispatch } = useMapView();
  const reactFlowInstance = useReactFlow();
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  // Calculate position above the selected node
  useEffect(() => {
    if (!panelRef.current) return;

    const panelHeight = panelRef.current.offsetHeight;
    const nodeElement = document.querySelector(`[data-id="${selectedElement.id}"]`) as HTMLElement | null;
    const nodeRect = nodeElement?.getBoundingClientRect();
    
    // Get the viewport transform
    const viewport = reactFlowInstance.getViewport();
    const zoom = viewport.zoom;
    
    // Transform node position to screen position
    const screenX = nodePosition.x * zoom + viewport.x;
    const screenY = nodePosition.y * zoom + viewport.y;

    const nodeWidth = nodeRect?.width ?? panelRef.current.offsetWidth;
    const nodeLeft = nodeRect?.left ?? screenX;
    const top = (nodeRect?.top ?? screenY) - panelHeight - 12; // 12px gap above node
    const left = nodeLeft; // Align with left edge of element

    setPosition({ top, left, width: nodeWidth });
  }, [nodePosition, reactFlowInstance, selectedElement.id]);

  const handleDelete = useCallback(() => {
    dispatch(mapActions.deleteElement(selectedElement.id));
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
          </>
        );

      case 'chart':
        const chartData = selectedElement.data as ChartElementData;
        return (
          <>
            <ConfigSelect
              label="Chart type"
              value={chartData.chartType || 'line'}
              options={[
                { value: 'line', label: 'Line' },
                { value: 'bar', label: 'Bar' },
                { value: 'area', label: 'Area' },
                { value: 'pie', label: 'Pie' },
              ]}
              onChange={(value) =>
                dispatch(mapActions.updateElement(selectedElement.id, {
                  data: { ...chartData, chartType: value as ChartElementData['chartType'] },
                }))
              }
            />
          </>
        );

      case 'sqlQuery':
        const sqlData = selectedElement.data as SQLQueryElementData;
        return (
          <>
            <ConfigSelect
              label="Query mode"
              value={sqlData.mode || 'update'}
              options={[
                { value: 'update', label: 'Update table' },
                { value: 'create', label: 'Create new table' },
              ]}
              onChange={(value) =>
                dispatch(mapActions.updateElement(selectedElement.id, {
                  data: { ...sqlData, mode: value as SQLQueryElementData['mode'] },
                }))
              }
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
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: position.width ? `${position.width}px` : 'auto',
        zIndex: 1000,
        backgroundColor: 'transparent',
        border: 'none',
        boxShadow: 'none',
        padding: 0,
        display: 'flex',
        justifyContent: 'space-between',
        gap: '8px',
        alignItems: 'center',
        animation: 'fadeInUp 0.2s ease-out',
      }}
    >
      {/* Left side: Config options */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {hasConfigOptions && configOptions}
      </div>

      {/* Right side: Delete and Export buttons */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {/* Export button (only for dataList) */}
        {selectedElement.type === 'dataList' && (
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
      </div>

      {/* Expand hover hit area below the row so it stays reachable */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: '100%',
          width: '100%',
          height: '16px',
          pointerEvents: 'auto',
          backgroundColor: 'transparent',
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

