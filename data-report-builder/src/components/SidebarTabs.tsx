'use client';
import { useApp, actions } from '@/state/app';

export function SidebarTabs() {
  const { state, dispatch } = useApp();

  const tabs = [
    { id: 'data' as const, label: 'Data' },
    { id: 'chart' as const, label: 'Chart' },
    { id: 'metric' as const, label: 'Metric' },
  ];

  return (
    <div className="flex gap-1 mb-3" role="tablist" aria-label="Configuration tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => dispatch(actions.setTab(tab.id))}
          role="tab"
          aria-selected={state.activeTab === tab.id}
          aria-controls={`${tab.id}-panel`}
          className={`px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            state.activeTab === tab.id
              ? 'bg-gray-900 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
