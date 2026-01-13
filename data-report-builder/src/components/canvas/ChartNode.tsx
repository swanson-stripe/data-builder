'use client';

import { Handle, Position } from 'reactflow';
import { useMemo } from 'react';
import { useWarehouseStore } from '@/lib/useWarehouse';
import { useApp } from '@/state/app';

/**
 * ChartNode - Shows chart preview or placeholder
 */
export function ChartNode({ data, selected }: { data: any & { isSelected?: boolean }; selected?: boolean }) {
  const { state: appState } = useApp();
  
  const chartType = data.chartType || appState.chartType || 'line';
  const hasParent = !!data.parentDataListId;

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-elevated)',
        border: data.isSelected ? '2px solid #675DFF' : '1px solid var(--border-default)',
        boxShadow: data.isSelected ? '0 4px 12px rgba(0, 0, 0, 0.15)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
        minWidth: '300px',
        maxWidth: '400px',
        transition: 'all 0.15s ease-in-out',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: 'var(--chart-line-primary)',
          width: '8px',
          height: '8px',
          border: '2px solid var(--bg-elevated)',
        }}
      />

      {/* Header */}
      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '18px' }}>📈</span>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
            Chart
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {chartType} chart {hasParent ? '(connected)' : '(no data)'}
          </div>
        </div>
      </div>

      {/* Chart placeholder */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '6px',
          padding: '24px',
          border: '1px solid var(--border-subtle)',
          textAlign: 'center',
        }}
      >
        {hasParent ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            <div style={{ marginBottom: '8px', fontSize: '32px', opacity: 0.3 }}>📊</div>
            <div>Chart visualization</div>
            <div style={{ fontSize: '11px', marginTop: '4px' }}>
              Type: {chartType}
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Connect to a data source
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: 'var(--chart-line-primary)',
          width: '8px',
          height: '8px',
          border: '2px solid var(--bg-elevated)',
        }}
      />
    </div>
  );
}

