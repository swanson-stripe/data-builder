'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useApp, AppProvider, actions } from '@/state/app';
import { ThemeProvider } from '@/state/theme';
import { WarehouseProvider, useWarehouseStore } from '@/lib/useWarehouse';
import { applyPreset, PresetKey } from '@/lib/presets';
import { SidebarTabs } from '@/components/SidebarTabs';
import { DataTab } from '@/components/DataTab';
import { ChartTab } from '@/components/ChartTab';
import { MetricTab } from '@/components/MetricTab';
import { SQLTab } from '@/components/SQLTab';
import { ReportViewer } from '@/components/ReportViewer';
import { DevToolsMenu } from '@/components/DevToolsMenu';
import { SavePopover } from '@/components/SavePopover';
import { Toast } from '@/components/Toast';
import TemplateSelector from '@/components/TemplateSelector';
import TemplateReopenButton from '@/components/TemplateReopenButton';
import { useReportHeuristics } from '@/hooks/useReportHeuristics';
// getGroupValues import removed - users now manually select group values
import { getSlugForKey, toSlug } from '@/lib/slugs';
import { TEMPLATE_TAXONOMY } from '@/data/templateTaxonomy';

/**
 * New report page - blank editor with template selector.
 * URL: /new
 */
function NewPageContent() {
  const { state, dispatch } = useApp();
  const { store: warehouse } = useWarehouseStore();
  const router = useRouter();
  
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const [isResizing, setIsResizing] = useState(false);
  const [isHoveringHandle, setIsHoveringHandle] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showSavePopover, setShowSavePopover] = useState(false);
  const [showToast, setShowToast] = useState(false);
  
  const sidebarRef = useRef<HTMLElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);

  // Enable automatic report switching based on object selection
  useReportHeuristics();

  // Show template selector on mount
  useEffect(() => {
    dispatch({ type: 'SHOW_TEMPLATE_SELECTOR' });
  }, [dispatch]);

  // Animate loading progress
  const isLoading = state.loadingComponents.size > 0;
  
  useEffect(() => {
    if (isLoading) {
      setLoadingProgress(1);
      const interval = setInterval(() => {
        setLoadingProgress((prev) => prev >= 90 ? 90 : prev + Math.random() * 15);
      }, 200);
      return () => clearInterval(interval);
    }
  }, [isLoading]);
  
  useEffect(() => {
    if (!isLoading && loadingProgress > 0) {
      setLoadingProgress(100);
      const timeout = setTimeout(() => setLoadingProgress(0), 500);
      return () => clearTimeout(timeout);
    }
  }, [isLoading, loadingProgress]);

  // Note: We no longer auto-populate groupBy values - users should manually select which values to include

  // Handle resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(500, e.clientX - 40));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleSave = () => {
    setShowToast(true);
  };

  const handleCloseClick = () => {
    // If a report is loaded, go to its detail page; otherwise go to MRR
    if (state.report && state.report !== 'blank') {
      const slug = getSlugForKey(state.report);
      if (slug) {
        router.push(`/${slug}`);
        return;
      }
    }
    router.push('/mrr');
  };

  // Handle preset selection from DevTools - navigate to detail page
  const handlePresetSelect = (presetKey: string) => {
    if (presetKey === 'blank') {
      dispatch(actions.resetAll());
      dispatch({ type: 'SHOW_TEMPLATE_SELECTOR' });
    } else {
      const slug = getSlugForKey(presetKey);
      if (slug) {
        router.push(`/${slug}`);
      }
    }
  };

  // Determine if current metric is a preset (not 'blank')
  const isPreset = state.report !== 'blank';
  const buttonText = isPreset ? 'Duplicate' : 'Save';

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Template Selector Overlay */}
      {state.showTemplateSelector && (
        <TemplateSelector 
          onSelectTemplate={(reportKey) => {
            // Try to get slug from preset key first
            let slug = getSlugForKey(reportKey);
            
            // If not found, it might be a template report ID - find its label and convert to slug
            if (!slug) {
              for (const category of TEMPLATE_TAXONOMY) {
                for (const topic of category.topics) {
                  const report = topic.reports.find(r => r.id === reportKey);
                  if (report) {
                    slug = toSlug(report.label);
                    break;
                  }
                }
                if (slug) break;
              }
            }
            
            if (slug) {
              router.push(`/${slug}`);
            }
          }}
        />
      )}

      {/* Header */}
      <header 
        className="flex items-center justify-between relative" 
        style={{ 
          height: '56px', 
          backgroundColor: 'var(--bg-primary)', 
          borderBottom: '1px solid var(--border-subtle)', 
          paddingLeft: '20px', 
          paddingRight: '20px' 
        }} 
        role="banner"
      >
        {/* Close button */}
        <button 
          onClick={handleCloseClick}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center" 
          style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '6px', width: '30px', height: '30px' }} 
          aria-label="Close editor"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Save/Duplicate button - only show when not in template selector */}
        {!state.showTemplateSelector && (
          <div className="relative">
            <button
              ref={saveButtonRef}
              onClick={() => setShowSavePopover(!showSavePopover)}
              className="flex items-center gap-2 text-sm font-semibold px-2 py-1 border transition-colors"
              style={{ 
                backgroundColor: 'var(--button-primary-bg)', 
                borderColor: 'var(--button-primary-border)', 
                color: 'var(--button-primary-text)', 
                borderRadius: '6px', 
                cursor: 'pointer' 
              }}
              aria-label={`${buttonText} report`}
            >
              {buttonText}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3 h-3">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <SavePopover
              isOpen={showSavePopover}
              onClose={() => setShowSavePopover(false)}
              buttonRef={saveButtonRef}
              onSave={handleSave}
            />
          </div>
        )}
      </header>
      
      {showToast && (
        <Toast
          message="Metric saved successfully"
          onClose={() => setShowToast(false)}
        />
      )}

      {/* Hide main content when template selector is showing */}
      {!state.showTemplateSelector && (
        <main className="flex flex-1 overflow-hidden gap-10" role="main">
          <aside 
            ref={sidebarRef}
            className="flex flex-col relative"
            style={{ width: `${sidebarWidth}px`, flexShrink: 0, borderRight: '1px solid var(--border-subtle)' }}
            role="complementary" 
            aria-label="Configuration sidebar"
          >
            <SidebarTabs />

            <div className="flex-1 overflow-auto custom-scrollbar relative" style={{ padding: state.activeTab === 'sql' ? '0' : '0 20px 0 20px' }}>
              {state.activeTab === 'data' && <DataTab />}
              {state.activeTab === 'chart' && <ChartTab />}
              {state.activeTab === 'metric' && <MetricTab />}
              {state.activeTab === 'sql' && <SQLTab />}
            </div>

            {/* Template Reopen Button */}
            <TemplateReopenButton />

            {/* Resize Handle */}
            <div
              className={`absolute top-0 right-0 bottom-0 w-1 cursor-col-resize transition-colors ${
                isHoveringHandle || isResizing 
                  ? 'bg-blue-500 dark:bg-blue-400' 
                  : 'bg-transparent hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
              onMouseDown={() => setIsResizing(true)}
              onMouseEnter={() => setIsHoveringHandle(true)}
              onMouseLeave={() => setIsHoveringHandle(false)}
              style={{ cursor: 'col-resize' }}
            />
          </aside>

          <ReportViewer showDataList={true} padding="32px" />
        </main>
      )}

      {/* Floating Dev Tools */}
      <DevToolsMenu 
        loadingProgress={loadingProgress} 
        showNewButton={false}
        onPresetSelect={handlePresetSelect}
      />
    </div>
  );
}

function NewPageWrapper() {
  return (
    <WarehouseProvider presetKey="blank">
      <NewPageContent />
    </WarehouseProvider>
  );
}

export default function NewPage() {
  return (
    <ThemeProvider>
      <AppProvider>
        <NewPageWrapper />
      </AppProvider>
    </ThemeProvider>
  );
}

