'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '@/state/app';
import { useTheme } from '@/state/theme';
import { generateSQL } from '@/lib/generateSQL';
import { highlightSQL } from '@/lib/sqlHighlight';
import schema from '@/data/schema';

export function SQLTab() {
  console.log('[SQLTab] Component rendering');
  const { state } = useApp();
  const { theme } = useTheme();
  console.log('[SQLTab] Theme:', theme);
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
    const result = highlightSQL(editableSQL, theme);
    console.log('[SQLTab] Highlighted HTML length:', result.length);
    console.log('[SQLTab] First 200 chars:', result.substring(0, 200));
    return result;
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
    <div className="relative flex" style={{ height: '100%' }}>
      {/* Line numbers */}
      <div 
        ref={lineNumbersRef}
        className="flex-shrink-0 w-12 overflow-y-scroll" 
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div className="pt-4 pb-4 pr-2 font-mono text-sm text-right select-none whitespace-pre-wrap" style={{ color: 'var(--text-muted)' }}>
          {lineNumbers.map((num) => (
            <div key={num} style={{ lineHeight: '1.5' }}>{num}</div>
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
          className="absolute inset-0 w-full h-full pt-4 pb-4 pl-3 font-mono text-sm
                     bg-transparent text-transparent caret-gray-900 dark:caret-white
                     resize-none overflow-auto z-10 outline-none whitespace-pre-wrap break-words custom-scrollbar"
          spellCheck={false}
          aria-label="Editable SQL query"
          wrap="soft"
        />
        
        {/* Syntax-highlighted display (visible, non-interactive) */}
        <pre
          className="absolute inset-0 w-full h-full pt-4 pb-4 pl-3 font-mono text-sm overflow-auto
                     pointer-events-none whitespace-pre-wrap break-words custom-scrollbar [&_span]:![color:inherit]"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
          dangerouslySetInnerHTML={{ __html: highlightedHTML }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

