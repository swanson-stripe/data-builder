'use client';
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { useApp } from '@/state/app';
import { useTheme } from '@/state/theme';
import { generateSQL } from '@/lib/generateSQL';
import { highlightSQL } from '@/lib/sqlHighlight';
import schema from '@/data/schema';
import type { SQLQueryElementData } from '@/types/mapElements';

interface SQLQueryNodeProps {
  data: SQLQueryElementData & { isSelected?: boolean };
  id: string;
}

export const SQLQueryNode = React.memo(({ data, id }: SQLQueryNodeProps) => {
  const { state } = useApp();
  const { theme } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [sqlText, setSqlText] = useState(data.query || '');
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantFocused, setAssistantFocused] = useState(false);
  const [runState, setRunState] = useState<'idle' | 'running' | 'done'>('idle');
  const [scrollTop, setScrollTop] = useState(0);

  // Generate SQL from app state if no custom query
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

  const displaySQL = sqlText || generatedSQL;

  // Highlight SQL for display
  const highlightedHTML = useMemo(() => {
    return highlightSQL(displaySQL, theme);
  }, [displaySQL, theme]);

  // Calculate line numbers
  const lineCount = useMemo(() => {
    return (displaySQL || '').split('\n').length;
  }, [displaySQL]);

  const lineNumberItems = useMemo(() => {
    return Array.from({ length: lineCount }, (_, i) => i + 1);
  }, [lineCount]);

  // Sync scroll between content and line numbers
  const handleScroll = useCallback(() => {
    if (contentRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = contentRef.current.scrollTop;
      setScrollTop(contentRef.current.scrollTop);
    }
  }, []);

  const handleRun = useCallback(() => {
    setRunState('running');
    setTimeout(() => {
      setRunState('done');
      setTimeout(() => setRunState('idle'), 2000);
    }, 1500);
  }, []);

  const handleAssistantSubmit = useCallback(() => {
    if (!assistantInput.trim()) return;
    // In a real implementation, this would call the AI API
    setAssistantInput('');
  }, [assistantInput]);

  return (
    <div
      style={{
        minWidth: '800px',
        width: '800px',
        backgroundColor: 'var(--bg-primary)',
        border: data.isSelected ? '2px solid #675DFF' : '1px solid var(--border-default)',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M8 5L5 8L8 11M12 15L15 12L12 9"
              stroke="var(--text-secondary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {data.label}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              padding: '4px 8px',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '6px',
            }}
          >
            {data.mode === 'create' ? 'Create new table' : 'Update existing'}
          </span>
        </div>
      </div>

      {/* AI Assistant Input */}
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '8px',
            border: assistantFocused ? '1px solid #675DFF' : '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-primary)',
            transition: 'border-color 0.15s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 2L9.5 6.5L14 8L9.5 9.5L8 14L6.5 9.5L2 8L6.5 6.5L8 2Z"
              fill="#675DFF"
            />
          </svg>
          <input
            type="text"
            placeholder="Ask Assistant to edit the query"
            value={assistantInput}
            onChange={(e) => setAssistantInput(e.target.value)}
            onFocus={() => setAssistantFocused(true)}
            onBlur={() => setAssistantFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAssistantSubmit();
            }}
            style={{
              flex: 1,
              fontSize: '14px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          <button
            onClick={handleRun}
            disabled={runState === 'running'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#FFFFFF',
              backgroundColor: runState === 'done' ? '#10B981' : '#675DFF',
              border: 'none',
              borderRadius: '6px',
              cursor: runState === 'running' ? 'not-allowed' : 'pointer',
              opacity: runState === 'running' ? 0.6 : 1,
              transition: 'all 0.15s',
              height: '32px',
            }}
          >
            {runState === 'running' && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 18 18"
                fill="none"
                style={{
                  animation: 'spin 1s linear infinite',
                }}
              >
                <path
                  d="M9 2.5A6.5 6.5 0 1 0 15.5 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
            {runState === 'done' && (
              <svg width="12" height="12" viewBox="0 0 18 18" fill="none">
                <path
                  d="M14.5 5.5L7.5 12.5L4 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            <span>{runState === 'running' ? 'Running' : runState === 'done' ? 'Done' : 'Run'}</span>
          </button>
        </div>
      </div>

      {/* SQL Editor */}
      <div
        style={{
          display: 'flex',
          height: '400px',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        {/* Line numbers */}
        <div
          ref={lineNumbersRef}
          style={{
            width: '48px',
            paddingRight: '8px',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-surface)',
            borderRight: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              fontFamily: 'Monaco, "Courier New", monospace',
              fontSize: '13px',
              margin: 0,
              paddingTop: '16px',
              paddingBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              color: 'var(--text-muted)',
            }}
          >
            {lineNumberItems.map((num) => (
              <div
                key={num}
                style={{
                  height: '24px',
                  lineHeight: '24px',
                  paddingRight: '8px',
                }}
              >
                {num}
              </div>
            ))}
          </div>
        </div>

        {/* SQL content with syntax highlighting + editable overlay */}
        <div
          ref={contentRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'auto',
          }}
        >
          {/* Highlighted SQL (background layer) */}
          <pre
            style={{
              margin: 0,
              padding: '16px 12px',
              fontFamily: 'Monaco, "Courier New", monospace',
              fontSize: '13px',
              lineHeight: '24px',
              color: 'transparent',
              caretColor: 'var(--text-primary)',
              whiteSpace: 'pre',
              overflowWrap: 'normal',
              pointerEvents: 'none',
            }}
            dangerouslySetInnerHTML={{ __html: highlightedHTML }}
          />

          {/* Editable textarea (overlay) */}
          <textarea
            ref={textareaRef}
            value={displaySQL}
            onChange={(e) => setSqlText(e.target.value)}
            spellCheck={false}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              margin: 0,
              padding: '16px 12px',
              fontFamily: 'Monaco, "Courier New", monospace',
              fontSize: '13px',
              lineHeight: '24px',
              color: 'var(--text-primary)',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              whiteSpace: 'pre',
              overflowWrap: 'normal',
              overflow: 'hidden',
              caretColor: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
});

SQLQueryNode.displayName = 'SQLQueryNode';
