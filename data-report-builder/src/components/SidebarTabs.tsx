'use client';
import { useApp, actions } from '@/state/app';

export function SidebarTabs() {
  const { state, dispatch } = useApp();

  const tabs = [
    { id: 'data' as const, label: 'Data' },
    { id: 'chart' as const, label: 'Chart' },
    { id: 'metric' as const, label: 'Metric' },
    { id: 'sql' as const, label: 'SQL' },
  ];

  return (
    <div className="p-1 mr-[11px]" style={{ backgroundColor: '#F5F6F8', borderRadius: '8px' }} role="tablist" aria-label="Configuration tabs">
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => dispatch(actions.setTab(tab.id))}
            role="tab"
            aria-selected={state.activeTab === tab.id}
            aria-controls={`${tab.id}-panel`}
            className={`flex-1 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
              state.activeTab === tab.id
                ? 'text-gray-800 dark:text-gray-200'
                : 'text-gray-600 dark:text-gray-400'
            }`}
            style={{ 
              backgroundColor: state.activeTab === tab.id ? '#D8DEE4' : 'transparent',
              borderRadius: '4px'
            }}
            onMouseEnter={(e) => {
              if (state.activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = '#D8DEE4';
              }
            }}
            onMouseLeave={(e) => {
              if (state.activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
