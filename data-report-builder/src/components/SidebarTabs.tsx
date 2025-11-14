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
    <div role="tablist" aria-label="Configuration tabs" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="flex gap-2 items-center">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => dispatch(actions.setTab(tab.id))}
            role="tab"
            aria-selected={state.activeTab === tab.id}
            aria-controls={`${tab.id}-panel`}
            className="px-2 py-1.5 text-sm text-center focus:outline-none transition-colors cursor-pointer"
            style={{ 
              backgroundColor: state.activeTab === tab.id ? 'var(--border-subtle)' : 'transparent',
              borderRadius: '4px',
              color: state.activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)'
            }}
            onMouseEnter={(e) => {
              if (state.activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = 'var(--border-subtle)';
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
        
        {/* Search icon - only show on Data tab */}
        {state.activeTab === 'data' && (
          <button
            onClick={() => dispatch(actions.toggleSearch())}
            className="p-1.5 transition-colors cursor-pointer ml-auto"
            style={{
              color: state.showSearch ? 'var(--text-primary)' : 'var(--text-muted)',
              backgroundColor: state.showSearch ? 'var(--border-subtle)' : 'transparent',
              borderRadius: '4px'
            }}
            onMouseEnter={(e) => {
              if (!state.showSearch) {
                e.currentTarget.style.backgroundColor = 'var(--border-subtle)';
              }
            }}
            onMouseLeave={(e) => {
              if (!state.showSearch) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            aria-label="Toggle search"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10.5 10.5L14 14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        
        {/* Schema icon - only show on SQL tab */}
        {state.activeTab === 'sql' && (
          <a
            href="https://docs.stripe.com/stripe-data/schema"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 transition-colors cursor-pointer ml-auto"
            style={{
              color: 'var(--text-muted)',
              backgroundColor: 'transparent',
              borderRadius: '4px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--border-subtle)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="View Stripe Data schema documentation"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="1" y="6" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="9" y="10" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="11" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M5 8C8 8 8 4 11 4" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M5 8C8 8 6 12 9 12" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

export { SidebarTabs as default };
