'use client';
import { useMemo, useRef } from 'react';
import { useApp } from '@/state/app';
import { useTheme } from '@/state/theme';
import { generateSQL } from '@/lib/generateSQL';
import { highlightSQL } from '@/lib/sqlHighlight';
import schema from '@/data/schema';

export function SQLTab() {
  const { state } = useApp();
  const { theme } = useTheme();
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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

  // Highlight SQL for display
  const highlightedHTML = useMemo(() => {
    return highlightSQL(generatedSQL, theme);
  }, [generatedSQL, theme]);

  // Calculate line numbers
  const lineCount = useMemo(() => {
    return generatedSQL.split('\n').length;
  }, [generatedSQL]);

  const lineNumbers = useMemo(() => {
    return Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');
  }, [lineCount]);

  // Sync scroll between content and line numbers
  const handleScroll = () => {
    if (contentRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = contentRef.current.scrollTop;
    }
  };

  return (
    <div className="absolute inset-0 flex" style={{ backgroundColor: 'var(--bg-elevated)' }}>
      {/* Line numbers */}
      <div 
        ref={lineNumbersRef}
        className="flex-shrink-0 w-12 overflow-y-auto pr-2 pt-4 pb-4"
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <pre 
          className="font-mono text-sm text-right select-none" 
          style={{ 
            color: 'var(--text-muted)', 
            lineHeight: '1.5',
            margin: 0,
          }}
        >
          {lineNumbers}
        </pre>
      </div>

      {/* SQL content with syntax highlighting */}
      <div 
        ref={contentRef}
        className="flex-1 overflow-y-auto pt-4 pb-4 pl-3 custom-scrollbar"
        onScroll={handleScroll}
      >
        <pre 
          className="font-mono text-sm"
          style={{ 
            lineHeight: '1.5',
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
          dangerouslySetInnerHTML={{ __html: highlightedHTML }}
        />
      </div>
    </div>
  );
}

