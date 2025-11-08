'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '@/state/app';
import { useTheme } from '@/state/theme';
import { generateSQL } from '@/lib/generateSQL';
import { highlightSQL } from '@/lib/sqlHighlight';
import schema from '@/data/schema';

export function SQLTab() {
  const { state } = useApp();
  const { theme } = useTheme();
  const [editableSQL, setEditableSQL] = useState('');
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Generate SQL from app state
  const generatedSQL = useMemo(() => {
    return generateSQL(state, schema);
  }, [
    state.selectedObjects,
    state.selectedFields,
    state.filters,
    state.metric,
    state.start,
    state.end,
    state.granularity,
  ]);

  // Sync generated SQL to editable state whenever it changes
  useEffect(() => {
    setEditableSQL(generatedSQL);
  }, [generatedSQL]);

  // Highlight SQL for display
  const highlightedHTML = useMemo(() => {
    return highlightSQL(editableSQL, theme);
  }, [editableSQL, theme]);

  // Calculate line numbers
  const lineCount = useMemo(() => {
    return editableSQL.split('\n').length;
  }, [editableSQL]);

  const lineNumbers = useMemo(() => {
    return Array.from({ length: lineCount }, (_, i) => i + 1);
  }, [lineCount]);

  // Sync scroll position between textarea and line numbers
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        SQL representation of your current query
      </div>

      {/* SQL Editor with line numbers and syntax highlighting */}
      <div className="relative rounded flex" style={{ minHeight: '400px', maxHeight: '80vh', border: '1px solid var(--border-default)' }}>
        {/* Line numbers */}
        <div 
          ref={lineNumbersRef}
          className="flex-shrink-0 w-12 overflow-y-scroll" 
          style={{ 
            backgroundColor: 'var(--bg-surface)', 
            borderRight: '1px solid var(--border-default)',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="p-4 pr-2 font-mono text-sm text-right select-none whitespace-pre-wrap" style={{ color: 'var(--text-muted)' }}>
            {lineNumbers.map((num) => (
              <div key={num}>{num}</div>
            ))}
          </div>
        </div>

        {/* SQL content area */}
        <div className="relative flex-1">
          {/* Editable textarea (invisible but captures input) */}
          <textarea
            ref={textareaRef}
            value={editableSQL}
            onChange={(e) => setEditableSQL(e.target.value)}
            onScroll={handleScroll}
            className="absolute inset-0 w-full h-full p-4 pl-3 font-mono text-sm
                       bg-transparent text-transparent caret-gray-900 dark:caret-white
                       resize-none overflow-auto z-10 outline-none whitespace-pre-wrap break-words custom-scrollbar"
            spellCheck={false}
            aria-label="Editable SQL query"
            wrap="soft"
          />
          
          {/* Syntax-highlighted display (visible, non-interactive) */}
          <pre
            className="absolute inset-0 w-full h-full p-4 pl-3 font-mono text-sm overflow-auto
                       pointer-events-none whitespace-pre-wrap break-words custom-scrollbar"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
            dangerouslySetInnerHTML={{ __html: highlightedHTML }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Footer note */}
      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 italic">
        Note: This SQL is for reference only. Edits do not affect the Data tab.
      </div>
    </div>
  );
}

