'use client';

import { Handle, Position } from 'reactflow';
import { useState } from 'react';
import { AddElementButton } from './AddElementButton';

interface MetricNodeProps {
  data: any & { isSelected?: boolean; onHoverChange?: (isHovered: boolean, elementId: string) => void };
  id: string;
}

/**
 * MetricNode - Shows metric calculations
 */
export function MetricNode({ data, id }: MetricNodeProps) {
  const metricBlocks = data.metricBlocks || [];
  const [isHovered, setIsHovered] = useState(false);
  const [openMenuCount, setOpenMenuCount] = useState(0);

  return (
    <div
      onMouseEnter={() => {
        setIsHovered(true);
        data.onHoverChange?.(true, id);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        data.onHoverChange?.(false, id);
      }}
      style={{
        position: 'relative',
        padding: '110px',
        margin: '-110px',
      }}
    >
      <div
        style={{
          position: 'relative', // Add relative positioning for button placement
          minWidth: '250px',
          maxWidth: '350px',
          backgroundColor: 'var(--bg-elevated)',
          border: data.isSelected 
            ? '1px solid #675DFF' 
            : isHovered 
            ? '1px solid #b8b3ff' 
            : '1px solid var(--border-default)',
          borderRadius: '12px',
          transition: 'all 0.15s ease-in-out',
          cursor: 'pointer',
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
        
        {/* Add Element Buttons - only show on hover, when selected, or when a menu is open */}
        {(isHovered || data.isSelected || openMenuCount > 0) && (
          <>
            <AddElementButton 
              parentElementId={id} 
              position="left" 
              onHoverChange={data.onHoverChange}
              onMenuStateChange={(isOpen) => setOpenMenuCount(prev => isOpen ? prev + 1 : Math.max(0, prev - 1))}
            />
            <AddElementButton 
              parentElementId={id} 
              position="right" 
              onHoverChange={data.onHoverChange}
              onMenuStateChange={(isOpen) => setOpenMenuCount(prev => isOpen ? prev + 1 : Math.max(0, prev - 1))}
            />
            <AddElementButton 
              parentElementId={id} 
              position="bottom" 
              onHoverChange={data.onHoverChange}
              onMenuStateChange={(isOpen) => setOpenMenuCount(prev => isOpen ? prev + 1 : Math.max(0, prev - 1))}
            />
          </>
        )}
      </div>
    </div>
  );
}
