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
                transition: 'background-color 100ms ease, border-color 100ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#857AFE';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              {/* Visual editor icon */}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M0 2C0 0.89543 0.895431 0 2 0H5C6.10457 0 7 0.895431 7 2V5C7 6.10457 6.10457 7 5 7H2C0.89543 7 0 6.10457 0 5V2ZM2 1.5H5C5.27614 1.5 5.5 1.72386 5.5 2V5C5.5 5.27614 5.27614 5.5 5 5.5H2C1.72386 5.5 1.5 5.27614 1.5 5V2C1.5 1.72386 1.72386 1.5 2 1.5Z" fill="#857AFE"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M0 11C0 9.89543 0.895431 9 2 9H5C6.10457 9 7 9.89543 7 11V14C7 15.1046 6.10457 16 5 16H2C0.89543 16 0 15.1046 0 14V11ZM2 10.5H5C5.27614 10.5 5.5 10.7239 5.5 11V14C5.5 14.2761 5.27614 14.5 5 14.5H2C1.72386 14.5 1.5 14.2761 1.5 14V11C1.5 10.7239 1.72386 10.5 2 10.5Z" fill="#857AFE"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M11 0C9.89543 0 9 0.89543 9 2V5C9 6.10457 9.89543 7 11 7H14C15.1046 7 16 6.10457 16 5V2C16 0.895431 15.1046 0 14 0H11ZM14 1.5H11C10.7239 1.5 10.5 1.72386 10.5 2V5C10.5 5.27614 10.7239 5.5 11 5.5H14C14.2761 5.5 14.5 5.27614 14.5 5V2C14.5 1.72386 14.2761 1.5 14 1.5Z" fill="#857AFE"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M9 11C9 9.89543 9.89543 9 11 9H14C15.1046 9 16 9.89543 16 11V14C16 15.1046 15.1046 16 14 16H11C9.89543 16 9 15.1046 9 14V11ZM11 10.5H14C14.2761 10.5 14.5 10.7239 14.5 11V14C14.5 14.2761 14.2761 14.5 14 14.5H11C10.7239 14.5 10.5 14.2761 10.5 14V11C10.5 10.7239 10.7239 10.5 11 10.5Z" fill="#857AFE"/>
              </svg>
              Open visual editor
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
                transition: 'background-color 100ms ease, border-color 100ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3DA00B';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              {/* SQL editor icon */}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M13 2.5H3C2.17157 2.5 1.5 3.17157 1.5 4V12C1.5 12.8284 2.17157 13.5 3 13.5H13C13.8284 13.5 14.5 12.8284 14.5 12V4C14.5 3.17157 13.8284 2.5 13 2.5ZM3 1C1.34315 1 0 2.34315 0 4V12C0 13.6569 1.34315 15 3 15H13C14.6569 15 16 13.6569 16 12V4C16 2.34315 14.6569 1 13 1H3Z" fill="#3DA00B"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M3.43056 4.51191C3.70012 4.19741 4.1736 4.16099 4.48809 4.43056L7.98809 7.43056C8.15433 7.57304 8.25 7.78106 8.25 8C8.25 8.21894 8.15433 8.42696 7.98809 8.56944L4.48809 11.5694C4.1736 11.839 3.70012 11.8026 3.43056 11.4881C3.16099 11.1736 3.19741 10.7001 3.51191 10.4306L6.34756 8L3.51191 5.56944C3.19741 5.29988 3.16099 4.8264 3.43056 4.51191Z" fill="#3DA00B"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M8 10.75C8 10.3358 8.33579 10 8.75 10H12.25C12.6642 10 13 10.3358 13 10.75C13 11.1642 12.6642 11.5 12.25 11.5H8.75C8.33579 11.5 8 11.1642 8 10.75Z" fill="#3DA00B"/>
              </svg>
              Open SQL editor
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

        <ReportViewer showDataList={true} padding="32px" paddingLeft="20px" isEditor={true} />
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

