'use client';
import { useApp, AppProvider, actions } from '@/state/app';
import { useTheme, ThemeProvider } from '@/state/theme';
import { SidebarTabs } from '@/components/SidebarTabs';
import { DataTab } from '@/components/DataTab';
import { ChartTab } from '@/components/ChartTab';
import { MetricTab } from '@/components/MetricTab';
import { SQLTab } from '@/components/SQLTab';
import { ChartPanel } from '@/components/ChartPanel';
import { ValueTable } from '@/components/ValueTable';
import { DataList } from '@/components/DataList';
import { SavePopover } from '@/components/SavePopover';
import { Toast } from '@/components/Toast';
import { ProgressIndicator } from '@/components/ProgressIndicator';
import { useReportHeuristics } from '@/hooks/useReportHeuristics';
import { PRESET_OPTIONS, applyPreset } from '@/lib/presets';
import { ReportKey } from '@/types';
import { WarehouseProvider, useWarehouseStore } from '@/lib/useWarehouse';
import { useState, useRef, useEffect } from 'react';
import TemplateSelector from '@/components/TemplateSelector';
import TemplateReopenButton from '@/components/TemplateReopenButton';

function PageContent() {
  const { state, dispatch } = useApp();
  const { theme, setTheme } = useTheme();
  const { store: warehouse } = useWarehouseStore();
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const [isResizing, setIsResizing] = useState(false);
  const [isHoveringHandle, setIsHoveringHandle] = useState(false);
  const [devToolsExpanded, setDevToolsExpanded] = useState(true);
  const [showPresetOptions, setShowPresetOptions] = useState(false);
  const [showSavePopover, setShowSavePopover] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);

  // Enable automatic report switching based on object selection
  useReportHeuristics();

  // Handle resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(500, e.clientX - 40)); // Account for left margin
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

  // Determine if current metric is a preset (not 'blank')
  const isPreset = state.report !== 'blank';
  const buttonText = isPreset ? 'Duplicate' : 'Save';

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Template Selector Overlay */}
      {state.showTemplateSelector && <TemplateSelector />}

      {/* Header always visible */}
      <header className="flex items-center justify-between px-10 relative" style={{ height: '56px', backgroundColor: 'var(--bg-primary)' }} role="banner">
        <button className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '6px', width: '30px', height: '30px' }} aria-label="Close report builder">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {/* Only show save button when not in template selector */}
        {!state.showTemplateSelector && (
          <div className="relative">
            <button
              ref={saveButtonRef}
              onClick={() => setShowSavePopover(!showSavePopover)}
              className="flex items-center gap-2 text-sm font-semibold px-2 py-1 border transition-colors"
              style={{ backgroundColor: 'var(--button-primary-bg)', borderColor: 'var(--button-primary-border)', color: 'var(--button-primary-text)', borderRadius: '6px' }}
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

      <ProgressIndicator 
        isLoading={state.isCalculating} 
        message="Calculating metrics..."
      />

      {/* Hide main content when template selector is showing */}
      {!state.showTemplateSelector && (
        <>
      <main className="flex flex-1 overflow-hidden pl-10 gap-10" role="main">
        <aside 
          ref={sidebarRef}
          className="flex flex-col relative py-6"
          style={{ width: `${sidebarWidth}px`, flexShrink: 0 }}
          role="complementary" 
          aria-label="Configuration sidebar"
        >
          <SidebarTabs />

          <div className="flex-1 overflow-auto custom-scrollbar mt-3">
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

        <section className="flex-1 py-6 overflow-y-auto custom-scrollbar" style={{ paddingRight: '32px', backgroundColor: 'var(--bg-primary)' }} role="region" aria-label="Report visualizations">
          {/* Chart Panel - now includes integrated summary table when comparison is enabled */}
          <div className="flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }} role="region" aria-label="Time series chart">
            <ChartPanel />
          </div>

          {/* Value Table - now integrated into ChartPanel, kept here for future use if needed */}

          {/* Data List */}
          <div style={{ marginTop: '40px', backgroundColor: 'var(--bg-primary)' }} role="region" aria-label="Data preview">
            <DataList />
          </div>
        </section>
      </main>
        </>
      )}

      {/* Floating Dev Tools - Always visible */}
      <div 
        className="fixed z-50" 
        style={{ 
          bottom: '20px', 
          right: '40px', 
          borderRadius: '16px', 
          padding: '8px 16px', 
          width: 'fit-content',
          cursor: devToolsExpanded ? 'default' : 'pointer',
          boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
          backgroundColor: 'var(--bg-elevated)'
        }}
        onClick={() => !devToolsExpanded && setDevToolsExpanded(true)}
      >
        <div className="flex items-center gap-3" style={{ justifyContent: devToolsExpanded ? 'space-between' : 'flex-start' }}>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Dev tools</span>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setDevToolsExpanded(!devToolsExpanded);
              // Reset to main view when collapsing
              if (devToolsExpanded) {
                setShowPresetOptions(false);
              }
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={devToolsExpanded ? "Collapse dev tools" : "Expand dev tools"}
            style={{ 
              marginLeft: devToolsExpanded ? 'auto' : '0',
              marginTop: devToolsExpanded ? '-4px' : '0',
              marginBottom: devToolsExpanded ? '-4px' : '0',
              cursor: 'pointer',
              background: devToolsExpanded ? 'transparent' : 'var(--bg-elevated)',
              backgroundColor: devToolsExpanded ? 'transparent' : 'var(--bg-elevated)',
              padding: devToolsExpanded ? '4px 8px' : '0',
              border: 'none',
              outline: 'none',
              borderRadius: devToolsExpanded ? '6px' : '0',
              boxShadow: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              appearance: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            } as React.CSSProperties}
            onMouseEnter={(e) => {
              if (devToolsExpanded) {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
              }
            }}
            onMouseLeave={(e) => {
              if (devToolsExpanded) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            {devToolsExpanded ? (
              // Inward arrows (collapse)
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M0.75 7.25C0.75 6.83578 1.08579 6.5 1.5 6.5H4.75C5.16421 6.5 5.5 6.83578 5.5 7.25V10.5C5.5 10.9142 5.16421 11.25 4.75 11.25C4.33579 11.25 4 10.9142 4 10.5V9.06066L1.53033 11.5303C1.23744 11.8232 0.762563 11.8232 0.46967 11.5303C0.176777 11.2374 0.176777 10.7626 0.46967 10.4697L2.93934 8H1.5C1.08579 8 0.75 7.66421 0.75 7.25Z" fill="var(--text-muted)"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M11.5303 0.46967C11.8232 0.762563 11.8232 1.23744 11.5303 1.53033L9.06066 4H10.5C10.9142 4 11.25 4.33579 11.25 4.75C11.25 5.16421 10.9142 5.5 10.5 5.5H7.25C7.05109 5.5 6.86032 5.42098 6.71967 5.28033C6.57902 5.13968 6.5 4.94891 6.5 4.75V1.5C6.5 1.08579 6.83579 0.75 7.25 0.75C7.66421 0.75 8 1.08579 8 1.5V2.93934L10.4697 0.46967C10.7626 0.176777 11.2374 0.176777 11.5303 0.46967Z" fill="var(--text-muted)"/>
              </svg>
            ) : (
              // Outward arrows (expand)
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M6.75 2.5C6.33579 2.5 6 2.16421 6 1.75C6 1.33579 6.33579 1 6.75 1H10.25C10.6642 1 11 1.33579 11 1.75V5.25C11 5.66421 10.6642 6 10.25 6C9.83579 6 9.5 5.66421 9.5 5.25V3.56066L3.56066 9.5H5.25C5.66421 9.5 6 9.83579 6 10.25C6 10.6642 5.66421 11 5.25 11H1.75C1.33579 11 1 10.6642 1 10.25V6.75C1 6.33579 1.33579 6 1.75 6C2.16421 6 2.5 6.33579 2.5 6.75V8.43934L8.43934 2.5H6.75Z" fill="var(--text-muted)"/>
              </svg>
            )}
          </button>
        </div>
        {devToolsExpanded && (
          <div className="mt-2">
            {!showPresetOptions ? (
              // Main view
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPresetOptions(true)}
                  className="flex items-center gap-1 text-sm font-medium transition-colors cursor-pointer rounded px-2 py-1"
                  style={{ whiteSpace: 'nowrap', margin: '-4px 0', color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  {PRESET_OPTIONS.find(p => p.key === state.report)?.label || 'Select preset'}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  onClick={() => dispatch(actions.resetAll())}
                  className="flex items-center gap-1 text-sm font-medium transition-colors cursor-pointer rounded px-2 py-1"
                  aria-label="Start new report"
                  style={{ margin: '-4px 0', color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span>New</span>
                </button>
                <button
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  className="transition-colors cursor-pointer rounded px-2 py-1"
                  aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                  style={{ margin: '-4px 0', color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  {theme === 'light' ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10.5 6.4A4.5 4.5 0 1 1 5.6 1.5 3.5 3.5 0 0 0 10.5 6.4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M6 0.5v1m0 9v1M2.11 2.11l.71.71m6.36 6.36l.71.71M0.5 6h1m9 0h1M2.11 9.89l.71-.71M9.18 2.82l.71-.71" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  )}
                </button>
              </div>
            ) : (
              // Preset options view
              <div>
                {PRESET_OPTIONS.map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => {
                      applyPreset(preset.key, dispatch, state, warehouse);
                      setShowPresetOptions(false);
                      // Hide template selector if it's showing
                      if (state.showTemplateSelector) {
                        dispatch({ type: 'HIDE_TEMPLATE_SELECTOR' });
                      }
                    }}
                    className="w-full text-left px-2 py-2 text-sm rounded transition-colors flex items-center justify-between"
                    style={{ 
                      whiteSpace: 'nowrap',
                      color: preset.key === 'blank' ? 'var(--text-muted)' : 'var(--text-primary)',
                      fontWeight: preset.key === 'blank' ? 400 : 600,
                      gap: '16px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {preset.label}
                    {state.report === preset.key && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="8" cy="8" r="8" fill="var(--text-primary)"/>
                        <path d="M11 5.5L7 10L5 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <ThemeProvider>
      <AppProvider>
        <WarehouseConnector />
      </AppProvider>
    </ThemeProvider>
  );
}

// Connector component to bridge AppProvider and WarehouseProvider
function WarehouseConnector() {
  const { state } = useApp();
  return (
    <WarehouseProvider key={state.report || 'default'} presetKey={state.report}>
      <PageContent />
    </WarehouseProvider>
  );
}
