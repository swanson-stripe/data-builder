'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/state/app';
import { useTheme } from '@/state/theme';
import { useWarehouseStore } from '@/lib/useWarehouse';
import { PRESET_OPTIONS, applyPreset } from '@/lib/presets';
import { getSlugForKey } from '@/lib/slugs';

type Props = {
  /** Progress value 0-100, or 0 when idle */
  loadingProgress: number;
  /** Whether to show the "New" button that navigates to /new */
  showNewButton?: boolean;
  /** Callback when preset is selected (optional, for custom handling) */
  onPresetSelect?: (presetKey: string) => void;
};

/**
 * Floating dev tools menu with preset switcher, new button, and theme toggle.
 * Used on both detail pages and editor pages.
 */
export function DevToolsMenu({ loadingProgress, showNewButton = true, onPresetSelect }: Props) {
  const { state, dispatch } = useApp();
  const { theme, setTheme } = useTheme();
  const { store: warehouse } = useWarehouseStore();
  const router = useRouter();
  
  const [devToolsExpanded, setDevToolsExpanded] = useState(true);
  const [showPresetOptions, setShowPresetOptions] = useState(false);

  const handlePresetSelect = (presetKey: string) => {
    if (onPresetSelect) {
      onPresetSelect(presetKey);
    } else {
      // Default behavior: navigate to the preset's edit page
      const slug = getSlugForKey(presetKey);
      if (slug) {
        router.push(`/${slug}/edit`);
      }
    }
    setShowPresetOptions(false);
  };

  const handleNewClick = () => {
    router.push('/new');
  };

  return (
    <div 
      className="fixed z-50" 
      style={{ 
        bottom: '20px', 
        right: '40px', 
        borderRadius: '16px', 
        padding: '8px', 
        width: 'fit-content',
        cursor: devToolsExpanded ? 'default' : 'pointer',
        boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
        backgroundColor: 'var(--bg-elevated)'
      }}
      onClick={() => !devToolsExpanded && setDevToolsExpanded(true)}
    >
      <div className="flex items-center gap-3" style={{ justifyContent: 'space-between', width: '100%', paddingLeft: '8px', paddingRight: '10px' }}>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Dev tools</span>
        {loadingProgress > 0 ? (
          // Progress bar when loading - expands from circle
          <div
            style={{
              height: '8px',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '4px',
              overflow: 'hidden',
              marginLeft: 'auto',
              flexBasis: '0%',
              flexGrow: 1,
              maxWidth: '100%',
              transition: 'flex-grow 0.4s ease-out, flex-basis 0.4s ease-out',
            }}
          >
            <div
              style={{
                width: `${loadingProgress}%`,
                height: '100%',
                backgroundColor: '#10b981',
                borderRadius: '4px',
                transition: 'width 0.3s ease-out',
              }}
            />
          </div>
        ) : (
          // Green circle when idle
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              marginLeft: 'auto',
              flexShrink: 0,
            }}
          />
        )}
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
              {showNewButton && (
                <button
                  onClick={handleNewClick}
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
              )}
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
                  onClick={() => handlePresetSelect(preset.key)}
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
  );
}

