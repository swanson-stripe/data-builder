// src/components/TemplateReopenButton.tsx
'use client';
import { useApp } from '@/state/app';

export default function TemplateReopenButton() {
  const { state, dispatch } = useApp();

  // Only show when report is blank and user hasn't made changes
  if (state.report !== 'blank' || state.hasUserMadeChanges) {
    return null;
  }

  const handleClick = () => {
    dispatch({ type: 'SHOW_TEMPLATE_SELECTOR' });
  };

  return (
    <div className="flex items-center justify-center py-4 border-t border-border-default">
      <button
        onClick={handleClick}
        className="flex items-center space-x-2 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-tertiary rounded-lg transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="2" width="12" height="12" rx="2" />
          <path d="M8 6v4M6 8h4" />
        </svg>
        <span>Start with a template</span>
      </button>
    </div>
  );
}

