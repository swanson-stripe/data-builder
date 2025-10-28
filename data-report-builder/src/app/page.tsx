'use client';
import { AppProvider, useApp } from '@/state/app';
import { SidebarTabs } from '@/components/SidebarTabs';
import { DataTab } from '@/components/DataTab';
import { ChartPanel } from '@/components/ChartPanel';
import { ValueTable } from '@/components/ValueTable';
import { DataList } from '@/components/DataList';
import { useReportHeuristics } from '@/hooks/useReportHeuristics';
import { PRESET_OPTIONS, applyPreset } from '@/lib/presets';
import { ReportKey } from '@/types';

function PageContent() {
  const { state, dispatch } = useApp();

  // Enable automatic report switching based on object selection
  useReportHeuristics();

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 h-12 border-b bg-white" role="banner">
        <button className="text-sm hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1" aria-label="Close report builder">
          Close
        </button>
        <div className="flex items-center gap-2">
          <label htmlFor="report-preset-select" className="text-sm">
            Report Preset
          </label>
          <select
            id="report-preset-select"
            className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <button className="text-sm hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1" aria-label="Save report">
          Save
        </button>
      </header>

      <main className="flex flex-1 overflow-hidden" role="main">
        <aside className="w-80 border-r p-3 flex flex-col bg-gray-50" role="complementary" aria-label="Configuration sidebar">
          <SidebarTabs />

          <div className="flex-1 overflow-hidden">
            {state.activeTab === 'data' && <DataTab />}
            {state.activeTab === 'chart' && (
              <div className="text-sm text-gray-500 p-4" role="status">
                Chart configuration coming soon...
              </div>
            )}
            {state.activeTab === 'metric' && (
              <div className="text-sm text-gray-500 p-4" role="status">
                Metric configuration coming soon...
              </div>
            )}
          </div>
        </aside>

        <section className="flex-1 p-3 space-y-3 flex flex-col bg-white overflow-hidden" role="region" aria-label="Report visualizations">
          {/* Chart Panel */}
          <div className="h-80 border rounded p-3 flex flex-col" role="region" aria-label="Time series chart">
            <ChartPanel />
          </div>

          {/* Value Table */}
          <div className="h-48 border rounded p-3 flex flex-col" role="region" aria-label="Value comparison">
            <ValueTable />
          </div>

          {/* Data List */}
          <div className="flex-1 border rounded p-3 flex flex-col min-h-0" role="region" aria-label="Data preview">
            <DataList />
          </div>
        </section>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <AppProvider>
      <PageContent />
    </AppProvider>
  );
}
