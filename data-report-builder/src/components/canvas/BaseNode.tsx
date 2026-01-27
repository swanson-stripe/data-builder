'use client';

import { Handle, Position } from 'reactflow';

/**
 * Base node component for all canvas elements
 * Renders a card with connection handles
 */
export function BaseNode({ data, selected }: { data: any; selected?: boolean }) {
  // Generate summary text based on element type
  const getSummary = () => {
    if (data.type === 'dataList') {
      const fieldCount = data.selectedFields?.length || 0;
      const objectCount = data.selectedObjects?.length || 0;
      return `${fieldCount} fields • ${objectCount} objects`;
    }
    if (data.type === 'chart') {
      return data.chartType ? `${data.chartType} chart` : 'No chart type';
    }
    if (data.type === 'filter') {
      const conditionCount = data.conditions?.length || 0;
      return `${conditionCount} condition${conditionCount !== 1 ? 's' : ''}`;
    }
    if (data.type === 'grouping') {
      const valueCount = data.selectedValues?.length || 0;
      return `${valueCount} group${valueCount !== 1 ? 's' : ''}`;
    }
    if (data.type === 'metric') {
      const metricCount = data.metricBlocks?.length || 0;
      return `${metricCount} metric${metricCount !== 1 ? 's' : ''}`;
    }
    if (data.type === 'sqlQuery') {
      return data.query ? 'Query configured' : 'No query';
    }
    return '';
  };

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-elevated)',
        border: selected ? '1px solid var(--button-primary-bg)' : '1px solid var(--border-default)',
        boxShadow: selected ? '0 4px 12px rgba(0, 0, 0, 0.15)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
        minWidth: '200px',
        maxWidth: '400px',
        transition: 'all 0.15s ease-in-out',
      }}
    >
      {/* Connection handles */}
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

      {/* Content */}
      <div style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
        <div style={{ fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>
            {data.type === 'dataList' && '📊'}
            {data.type === 'chart' && '📈'}
            {data.type === 'filter' && '🔍'}
            {data.type === 'grouping' && '📁'}
            {data.type === 'metric' && '🔢'}
            {data.type === 'sqlQuery' && '💾'}
          </span>
          <span>
            {data.type === 'dataList' && 'Data List'}
            {data.type === 'chart' && 'Chart'}
            {data.type === 'filter' && 'Filter'}
            {data.type === 'grouping' && 'Grouping'}
            {data.type === 'metric' && 'Metric'}
            {data.type === 'sqlQuery' && 'SQL Query'}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {getSummary()}
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


