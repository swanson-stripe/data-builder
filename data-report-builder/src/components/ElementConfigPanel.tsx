'use client';

import { useMapView, mapActions } from '@/state/mapView';
import type { DataListElementData } from '@/types/mapElements';
import { useEffect, useRef } from 'react';

/**
 * ElementConfigPanel - Floating panel for configuring selected elements
 * Appears above selected element
 */
export function ElementConfigPanel() {
  const { state, dispatch } = useMapView();
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedElement = state.elements.find(el => el.id === state.selectedElementId);

  useEffect(() => {
    // Close panel on Escape
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && state.selectedElementId) {
        dispatch(mapActions.deselectElement());
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedElementId, dispatch]);

  if (!selectedElement) return null;

  const renderConfig = () => {
    switch (selectedElement.type) {
      case 'dataList': {
        const data = selectedElement.data as DataListElementData;
        return (
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
              Data List Configuration
            </h4>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>{data.selectedFields?.length || 0}</strong> fields selected
              </div>
              <div>
                <strong>{data.selectedObjects?.length || 0}</strong> objects selected
              </div>
            </div>
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Edit fields & objects
              </button>
            </div>
          </div>
        );
      }

      case 'chart':
        return (
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
              Chart Configuration
            </h4>
            <div style={{ fontSize: '13px', marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Chart Type
              </label>
              <select
                value={selectedElement.data.chartType || 'line'}
                onChange={(e) => {
                  dispatch(mapActions.updateElement(selectedElement.id, {
                    data: { ...selectedElement.data, chartType: e.target.value },
                  }));
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
              >
                <option value="line">Line</option>
                <option value="area">Area</option>
                <option value="bar">Bar</option>
                <option value="table">Table</option>
              </select>
            </div>
          </div>
        );

      case 'filter':
        return (
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
              Filter Configuration
            </h4>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              {selectedElement.data.conditions?.length || 0} conditions
            </div>
            <button
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Add filter condition
            </button>
          </div>
        );

      case 'metric':
        return (
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
              Metric Configuration
            </h4>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              {selectedElement.data.metricBlocks?.length || 0} metrics
            </div>
            <button
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Add metric
            </button>
          </div>
        );

      case 'sqlQuery':
        return (
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
              SQL Query Configuration
            </h4>
            <div style={{ fontSize: '13px', marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Mode
              </label>
              <select
                value={selectedElement.data.mode || 'create'}
                onChange={(e) => {
                  dispatch(mapActions.updateElement(selectedElement.id, {
                    data: { ...selectedElement.data, mode: e.target.value },
                  }));
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
              >
                <option value="create">Create new data list</option>
                <option value="update">Update existing</option>
              </select>
            </div>
            <button
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Edit query
            </button>
          </div>
        );

      default:
        return (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            No configuration available
          </div>
        );
    }
  };

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: '80px',
        right: '20px',
        width: '280px',
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        padding: '16px',
        zIndex: 1000,
      }}
    >
      {/* Close button */}
      <button
        onClick={() => dispatch(mapActions.deselectElement())}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          width: '24px',
          height: '24px',
          padding: 0,
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M12 4L4 12M4 4L12 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {renderConfig()}

      {/* Delete Button */}
      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => {
            dispatch(mapActions.deleteElement(selectedElement.id));
          }}
          style={{
            width: '100%',
            padding: '8px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#ef4444',
            backgroundColor: 'transparent',
            border: '1px solid #ef4444',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          Delete element
        </button>
      </div>
    </div>
  );
}

