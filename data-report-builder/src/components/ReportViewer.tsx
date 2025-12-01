'use client';

import { ReactNode } from 'react';
import { useApp } from '@/state/app';
import { ChartPanel } from '@/components/ChartPanel';
import { DataList } from '@/components/DataList';

type Props = {
  /** Whether to show the data list below the chart */
  showDataList?: boolean;
  /** Custom padding for the container */
  padding?: string;
  /** Optional action buttons to display inline with the metric header */
  actionButtons?: ReactNode;
};

/**
 * Read-only report viewer component.
 * Renders the chart panel and optionally the data list.
 * Used by both detail pages and the editor.
 */
export function ReportViewer({ showDataList = true, padding = '32px', actionButtons }: Props) {
  const { state } = useApp();

  return (
    <section 
      className="flex-1 py-6 overflow-y-auto custom-scrollbar h-full" 
      style={{ paddingRight: padding, backgroundColor: 'var(--bg-primary)' }} 
      role="region" 
      aria-label="Report visualizations"
    >
      {/* Only show chart and metric sections when fields are selected */}
      {state.selectedFields.length > 0 && (
        <>
          {/* Chart Panel - includes integrated summary table when comparison is enabled */}
          <div 
            className="flex flex-col" 
            style={{ backgroundColor: 'var(--bg-primary)' }} 
            role="region" 
            aria-label="Time series chart"
          >
            <ChartPanel actionButtons={actionButtons} />
          </div>
        </>
      )}

      {/* Data List */}
      {showDataList && (
        <div 
          style={{ 
            marginTop: state.selectedFields.length > 0 ? '40px' : '0', 
            backgroundColor: 'var(--bg-primary)' 
          }} 
          role="region" 
          aria-label="Data preview"
        >
          <DataList />
        </div>
      )}
    </section>
  );
}

