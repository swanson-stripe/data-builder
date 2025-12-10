'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import { useApp, AppProvider, actions } from '@/state/app';
import { ThemeProvider, useTheme, Theme } from '@/state/theme';
import { WarehouseProvider, useWarehouseStore } from '@/lib/useWarehouse';
import { fromSlug, ReportInfo } from '@/lib/slugs';
import { applyPreset, PRESET_CONFIGS, PresetKey } from '@/lib/presets';
import { convertReportToPreset } from '@/lib/reportToPreset';
import { DataTab } from '@/components/DataTab';
import { SQLTab } from '@/components/SQLTab';
import { ReportViewer } from '@/components/ReportViewer';
import { DevToolsMenu } from '@/components/DevToolsMenu';
import { SavePopover } from '@/components/SavePopover';
import { Toast } from '@/components/Toast';
import TemplateReopenButton from '@/components/TemplateReopenButton';
import { useReportHeuristics } from '@/hooks/useReportHeuristics';
// getGroupValues import removed - users now manually select group values

/**
 * Edit page for modifying a report.
 * URL: /[report]/edit (e.g., /mrr/edit, /active-subscribers/edit)
 */
function EditPageContent({ reportInfo }: { reportInfo: ReportInfo }) {
  const { state, dispatch } = useApp();
  const { store: warehouse } = useWarehouseStore();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const [isResizing, setIsResizing] = useState(false);
  const [isHoveringHandle, setIsHoveringHandle] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showSavePopover, setShowSavePopover] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [hasAppliedPreset, setHasAppliedPreset] = useState(false);
  const [activePanel, setActivePanel] = useState<'config' | 'sql'>('config');
  const [previousTheme, setPreviousTheme] = useState<Theme | null>(null);
  
  const sidebarRef = useRef<HTMLElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);

  // Enable automatic report switching based on object selection
  useReportHeuristics();

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

  // Handle theme and width changes when switching between config and SQL panels
  useEffect(() => {
    if (activePanel === 'sql') {
      // Save current theme and switch to dark
      if (theme !== 'dark') {
        setPreviousTheme(theme);
        setTheme('dark');
      }
      // Widen sidebar to 600px
      setSidebarWidth(600);
    } else {
      // Restore previous theme when switching back to config
      if (previousTheme && previousTheme !== 'dark') {
        setTheme(previousTheme);
        setPreviousTheme(null);
      }
      // Restore default width
      setSidebarWidth(360);
    }
  }, [activePanel]);

  // Apply the preset/template when warehouse data is loaded
  useEffect(() => {
    if (hasAppliedPreset) return;
    
    const hasData = warehouse && (Object.keys(warehouse) as Array<keyof typeof warehouse>).some(k => 
      Array.isArray(warehouse[k]) && warehouse[k]!.length > 0
    );
    
    if (!hasData) return;

    if (reportInfo.type === 'preset') {
      applyPreset(reportInfo.key as PresetKey, dispatch, state, warehouse);
    } else if (reportInfo.report) {
      const presetConfig = convertReportToPreset(reportInfo.report);
      // Cast to any since ConvertedPresetConfig has compatible structure with PresetConfig
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyPreset(presetConfig as any, dispatch, state, warehouse);
    }
    
    setHasAppliedPreset(true);
  }, [reportInfo, warehouse, dispatch, state, hasAppliedPreset]);

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
    router.push(`/${reportInfo.slug}`);
  };

  // Determine if current metric is a preset (not 'blank')
  const isPreset = state.report !== 'blank';
  const buttonText = isPreset ? 'Duplicate' : 'Save';

  return (
    <div className="h-screen flex flex-col dot-grid-bg">
      {/* Header */}
      <header 
        className="flex items-center justify-between relative" 
        style={{ 
          height: '56px',
          minHeight: '56px',
          flexShrink: 0,
          backgroundColor: 'var(--bg-primary)', 
          borderBottom: '1px solid var(--border-subtle)', 
          paddingLeft: '20px', 
          paddingRight: '20px' 
        }} 
        role="banner"
      >
        {/* Close button, divider, and label */}
        <div className="flex items-center">
          <button 
            onClick={handleCloseClick}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center hover-fast cursor-pointer" 
            style={{ backgroundColor: 'transparent', borderRadius: '6px', width: '30px', height: '30px' }} 
            aria-label="Close editor"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
              <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          {/* Vertical divider */}
          <div 
            style={{ 
              width: '1px', 
              height: '12px', 
              backgroundColor: 'var(--border-subtle)', 
              marginLeft: '12px', 
              marginRight: '12px' 
            }} 
          />
          
          {/* Edit report label */}
          <span style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>
            Edit report
          </span>
        </div>

        {/* Save/Duplicate button */}
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
      </header>
      
      {showToast && (
        <Toast
          message="Metric saved successfully"
          onClose={() => setShowToast(false)}
        />
      )}

      {/* Main content with sidebar */}
      <main className="flex flex-1 overflow-hidden" role="main">
        <aside 
          ref={sidebarRef}
          className="flex flex-col relative"
          style={{ 
            width: `${sidebarWidth}px`, 
            flexShrink: 0,
            padding: '20px',
            gap: '20px',
            transition: 'width 400ms ease-in-out',
            maxHeight: '100%',
            overflow: 'visible',
          }}
          role="complementary" 
          aria-label="Configuration sidebar"
        >
          {/* Config Panel Section */}
          {activePanel === 'config' ? (
            /* Expanded config panel */
            <div 
              className="flex flex-col"
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-primary)',
                overflow: 'hidden',
                maxHeight: '100%',
              }}
            >
              <div className="relative overflow-y-auto overflow-x-hidden hide-scrollbar">
                <DataTab />
              </div>

              {/* Template Reopen Button */}
              <TemplateReopenButton />
            </div>
          ) : (
            /* Collapsed config panel - clickable row */
            <button
              onClick={() => setActivePanel('config')}
              className="flex items-center justify-center gap-2 text-sm font-medium transition-colors cursor-pointer"
              style={{
                padding: '16px 20px',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-primary)',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
              }}
            >
              Open config panel
            </button>
          )}

          {/* SQL Panel Section */}
          {activePanel === 'sql' ? (
            /* Expanded SQL panel */
            <div 
              className="flex flex-col flex-1 overflow-hidden relative"
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-primary)',
                minHeight: 0,
              }}
            >
              <SQLTab />
            </div>
          ) : (
            /* Collapsed SQL panel - clickable row */
            <button
              onClick={() => setActivePanel('sql')}
              className="flex items-center justify-center gap-2 text-sm font-medium transition-colors cursor-pointer"
              style={{
                padding: '16px 20px',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-primary)',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
              }}
            >
              Open with SQL editor
            </button>
          )}

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

        <ReportViewer showDataList={true} padding="32px" paddingLeft="20px" />
      </main>

      {/* Floating Dev Tools */}
      <DevToolsMenu loadingProgress={loadingProgress} showNewButton={true} />
    </div>
  );
}

function EditPageWrapper() {
  const params = useParams();
  const slug = params.report as string;
  
  const reportInfo = fromSlug(slug);
  
  if (!reportInfo) {
    notFound();
  }

  const presetKey = reportInfo.type === 'preset' 
    ? reportInfo.key as PresetKey 
    : 'blank';

  return (
    <WarehouseProvider presetKey={presetKey}>
      <EditPageContent reportInfo={reportInfo} />
    </WarehouseProvider>
  );
}

export default function EditPage() {
  return (
    <ThemeProvider>
      <AppProvider>
        <EditPageWrapper />
      </AppProvider>
    </ThemeProvider>
  );
}

