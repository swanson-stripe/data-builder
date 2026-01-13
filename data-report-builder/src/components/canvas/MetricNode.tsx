'use client';

import { Handle, Position } from 'reactflow';

interface MetricNodeProps {
  data: any & { isSelected?: boolean };
  id: string;
}

/**
 * MetricNode - Shows metric calculations
 */
export function MetricNode({ data, id }: MetricNodeProps) {
  const metricBlocks = data.metricBlocks || [];

  return (
    <div
      style={{
        minWidth: '250px',
        maxWidth: '350px',
        backgroundColor: 'var(--bg-elevated)',
        border: data.isSelected ? '2px solid #675DFF' : '1px solid var(--border-default)',
        borderRadius: '12px',
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

      <div style={{ padding: '16px' }}>
        {/* Header */}
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🔢</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
              Metric
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {metricBlocks.length} metric{metricBlocks.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Metric list */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {metricBlocks.length > 0 ? (
            <div style={{ padding: '12px' }}>
              {metricBlocks.slice(0, 3).map((block: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    fontSize: '12px',
                    padding: '8px 0',
                    borderBottom: idx < Math.min(metricBlocks.length, 3) - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {block.label || 'Metric'}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                    {block.aggregation || 'sum'} • {block.field || 'field'}
                  </div>
                </div>
              ))}
              {metricBlocks.length > 3 && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  +{metricBlocks.length - 3} more
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}
            >
              No metrics configured
            </div>
          )}
        </div>
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
