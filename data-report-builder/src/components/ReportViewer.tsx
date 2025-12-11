'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useApp } from '@/state/app';
import { ChartPanel } from '@/components/ChartPanel';
import { DataList } from '@/components/DataList';

export type Breadcrumb = {
  label: string;
  href: string;
};

type Props = {
  /** Whether to show the data list below the chart */
  showDataList?: boolean;
  /** Custom padding for the container (right side) */
  padding?: string;
  /** Custom left padding for the container */
  paddingLeft?: string;
  /** Optional action buttons to display inline with the metric header */
  actionButtons?: ReactNode;
  /** Optional breadcrumbs to display above the metric */
  breadcrumbs?: Breadcrumb[];
  /** Whether this is shown in the editor (hides version history) */
  isEditor?: boolean;
};

/**
 * Read-only report viewer component.
 * Renders the chart panel and optionally the data list.
 * Used by both detail pages and the editor.
 */
export function ReportViewer({ showDataList = true, padding = '32px', paddingLeft = '0px', actionButtons, breadcrumbs, isEditor = false }: Props) {
  const { state } = useApp();

  return (
    <section 
      className="flex-1 py-6 overflow-y-auto custom-scrollbar h-full" 
      style={{ paddingRight: padding, paddingLeft }} 
      role="region" 
      aria-label="Report visualizations"
    >
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav 
          className="flex items-center gap-2" 
          aria-label="Breadcrumb"
          style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}
        >
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.href} className="flex items-center gap-2">
              <Link
                href={crumb.href}
                style={{
                  color: '#635BFF',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                {crumb.label}
              </Link>
              {index < breadcrumbs.length - 1 && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--text-muted)' }}>
                  <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Only show chart and metric sections when fields are selected */}
      {state.selectedFields.length > 0 && (
        <>
          {/* Chart Panel - includes integrated summary table when comparison is enabled */}
          <div 
            className="flex flex-col" 
            role="region" 
            aria-label="Time series chart"
          >
            <ChartPanel actionButtons={actionButtons} isEditor={isEditor} />
          </div>
        </>
      )}

      {/* Data List */}
      {showDataList && (
        <div 
          style={{ 
            marginTop: state.selectedFields.length > 0 ? '40px' : '0',
            borderRadius: '12px',
            padding: '8px',
            backgroundColor: 'var(--bg-surface)'
          }} 
          role="region" 
          aria-label="Data preview"
        >
          <div style={{ borderRadius: '8px', backgroundColor: 'var(--bg-primary)', padding: '16px' }}>
            <DataList />
          </div>
        </div>
      )}
    </section>
  );
}

