'use client';
import { useEffect, useRef } from 'react';
import { useApp, AppProvider } from '@/state/app';
import { useTheme, ThemeProvider } from '@/state/theme';
import { SidebarTabs } from '@/components/SidebarTabs';
import { DataTab } from '@/components/DataTab';
import { ChartTab } from '@/components/ChartTab';
import { ChartPanel } from '@/components/ChartPanel';
import { ValueTable } from '@/components/ValueTable';
import { DataList } from '@/components/DataList';
import { useReportHeuristics } from '@/hooks/useReportHeuristics';
import { PRESET_OPTIONS, applyPreset } from '@/lib/presets';
import { ReportKey } from '@/types';

function PageContent() {
  const { state, dispatch } = useApp();
  const { theme, setTheme } = useTheme();
  const initializedRef = useRef(false);

  // Apply initial preset on mount
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      applyPreset(state.report, dispatch);
    }
  }, [state.report, dispatch]);

  // Enable automatic report switching based on object selection
  useReportHeuristics();

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      <header className="flex items-center justify-between px-4 h-12 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" role="banner">
        <button className="text-sm text-gray-800 dark:text-gray-200 hover:text-gray-600 dark:hover:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1" aria-label="Close report builder">
          Close
        </button>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="report-preset-select" className="text-sm text-gray-800 dark:text-gray-200">
              Report Preset
            </label>
            <select
              id="report-preset-select"
              className="border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={state.report}
              onChange={(e) => applyPreset(e.target.value as ReportKey, dispatch)}
              aria-label="Select report preset"
            >
              {PRESET_OPTIONS.map((preset) => (
                <option key={preset.key} value={preset.key}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded overflow-hidden">
            <button
              onClick={() => setTheme('light')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                theme === 'light'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              aria-label="Switch to light mode"
              aria-pressed={theme === 'light'}
            >
              Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              aria-label="Switch to dark mode"
              aria-pressed={theme === 'dark'}
            >
              Dark
            </button>
          </div>
        </div>
        <button className="text-sm text-gray-800 dark:text-gray-200 hover:text-gray-600 dark:hover:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1" aria-label="Save report">
          Save
        </button>
      </header>

      <main className="flex flex-1 overflow-hidden" role="main">
        <aside className="w-80 border-r border-gray-200 dark:border-gray-700 p-3 flex flex-col bg-gray-50 dark:bg-gray-800" role="complementary" aria-label="Configuration sidebar">
          <SidebarTabs />

          <div className="flex-1 overflow-hidden">
            {state.activeTab === 'data' && <DataTab />}
            {state.activeTab === 'chart' && <ChartTab />}
            {state.activeTab === 'metric' && (
              <div className="text-sm text-gray-500 dark:text-gray-400 p-4" role="status">
                Metric configuration coming soon...
              </div>
            )}
          </div>
        </aside>

        <section className="flex-1 p-3 space-y-3 flex flex-col bg-white dark:bg-gray-900 overflow-hidden" role="region" aria-label="Report visualizations">
          {/* Chart Panel */}
          <div className="h-80 border border-gray-200 dark:border-gray-700 rounded p-3 flex flex-col bg-white dark:bg-gray-800" role="region" aria-label="Time series chart">
            <ChartPanel />
          </div>

          {/* Value Table */}
          <div className="h-48 border border-gray-200 dark:border-gray-700 rounded p-3 flex flex-col bg-white dark:bg-gray-800" role="region" aria-label="Value comparison">
            <ValueTable />
          </div>

          {/* Data List */}
          <div className="flex-1 border border-gray-200 dark:border-gray-700 rounded p-3 flex flex-col min-h-0 bg-white dark:bg-gray-800" role="region" aria-label="Data preview">
            <DataList />
          </div>
        </section>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <ThemeProvider>
      <AppProvider>
        <PageContent />
      </AppProvider>
    </ThemeProvider>
  );
}
