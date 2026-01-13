'use client';

import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { setActiveView } from '@/lib/mapSession';

type ViewMode = 'table' | 'map';

export function ViewSwitcher() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const reportSlug = params.report as string;
  
  // Get current view from URL or default to table
  const currentView: ViewMode = (searchParams.get('view') as ViewMode) || 'table';

  // Save view preference to session when it changes
  useEffect(() => {
    if (reportSlug && currentView) {
      setActiveView(reportSlug, currentView);
    }
  }, [reportSlug, currentView]);

  const handleViewChange = (view: ViewMode) => {
    if (view === currentView) return;
    
    // Update URL with view query param
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    router.push(url.pathname + url.search);
  };

  return (
    <div 
      className="flex items-center gap-1"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderRadius: '6px',
        padding: '2px',
      }}
    >
      {/* Table View Button */}
      <button
        onClick={() => handleViewChange('table')}
        className="flex items-center gap-2 px-3 py-1 text-sm font-medium transition-colors"
        style={{
          backgroundColor: currentView === 'table' ? 'var(--bg-primary)' : 'transparent',
          color: currentView === 'table' ? 'var(--text-primary)' : 'var(--text-secondary)',
          borderRadius: '4px',
          border: 'none',
          cursor: 'pointer',
          fontWeight: currentView === 'table' ? 600 : 400,
        }}
        aria-pressed={currentView === 'table'}
        aria-label="Switch to table view"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M2 6H14M5 6V13M11 6V13" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        Table
      </button>

      {/* Map View Button */}
      <button
        onClick={() => handleViewChange('map')}
        className="flex items-center gap-2 px-3 py-1 text-sm font-medium transition-colors"
        style={{
          backgroundColor: currentView === 'map' ? 'var(--bg-primary)' : 'transparent',
          color: currentView === 'map' ? 'var(--text-primary)' : 'var(--text-secondary)',
          borderRadius: '4px',
          border: 'none',
          cursor: 'pointer',
          fontWeight: currentView === 'map' ? 600 : 400,
        }}
        aria-pressed={currentView === 'map'}
        aria-label="Switch to map view"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 4L6 2L10 4L14 2V12L10 14L6 12L2 14V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M6 2V12M10 4V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Map
      </button>
    </div>
  );
}

