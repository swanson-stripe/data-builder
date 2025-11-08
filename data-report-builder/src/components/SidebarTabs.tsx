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
    <div className="p-1 mr-[11px]" style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }} role="tablist" aria-label="Configuration tabs">
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => dispatch(actions.setTab(tab.id))}
            role="tab"
            aria-selected={state.activeTab === tab.id}
            aria-controls={`${tab.id}-panel`}
            className="flex-1 px-2 py-1.5 text-sm text-center focus:outline-none transition-colors"
            style={{ 
              backgroundColor: state.activeTab === tab.id ? 'var(--bg-hover)' : 'transparent',
              borderRadius: '4px',
              color: state.activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)'
            }}
            onMouseEnter={(e) => {
              if (state.activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
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
