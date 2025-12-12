'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [sqlText, setSqlText] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Assistant simulation
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantFocused, setAssistantFocused] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<Array<{ id: string; role: 'user' | 'system'; text: string; isStreaming?: boolean }>>([]);

  // Run button simulation
  const [runState, setRunState] = useState<'idle' | 'running' | 'done'>('idle');

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

  // Build schema field-name set (used to add a subtle border around fields)
  const schemaFieldSet = useMemo(() => {
    const s = new Set<string>();
    schema.objects.forEach((obj) => {
      obj.fields.forEach((f) => {
        s.add(f.name.toLowerCase());
      });
    });
    return s;
  }, []);

  // Initialize editor text from generated SQL, and keep in sync until user edits
  useEffect(() => {
    if (!isDirty) {
      setSqlText(generatedSQL);
    }
  }, [generatedSQL, isDirty]);

  const wrapSchemaFields = (html: string) => {
    if (!html) return html;
    // Process only text segments between tags, wrap identifiers matching schema field names.
    // Prefer wrapping table.field as a unit when the field matches.
    const parts = html.split(/(<[^>]+>)/g);
    return parts
      .map((part, idx) => {
        // If it's a tag, keep as-is
        if (idx % 2 === 1) return part;
        // Otherwise, it's text content (already escaped)
        return part.replace(
          /\b([A-Za-z_][A-Za-z0-9_]*\.)?([A-Za-z_][A-Za-z0-9_]*)\b/g,
          (m, _prefix: string | undefined, field: string) => {
            if (schemaFieldSet.has(String(field).toLowerCase())) {
              return `<span class="sql-field-pill">${m}</span>`;
            }
            return m;
          }
        );
      })
      .join('');
  };

  // Highlight SQL for display
  const highlightedHTML = useMemo(() => {
    const base = highlightSQL(sqlText, theme);
    return wrapSchemaFields(base);
  }, [sqlText, theme, schemaFieldSet]);

  // Calculate line numbers
  const lineCount = useMemo(() => {
    return (sqlText || '').split('\n').length;
  }, [sqlText]);

  const lineNumbers = useMemo(() => {
    return Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');
  }, [lineCount]);

  // Sync scroll between content and line numbers
  const handleScroll = () => {
    if (contentRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = contentRef.current.scrollTop;
    }
  };

  const submitAssistant = () => {
    const prompt = assistantInput.trim();
    if (!prompt) return;
    const now = Date.now();
    const userId = `u_${now}`;
    const sysId = `s_${now}`;
    setAssistantMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', text: prompt },
      { id: sysId, role: 'system', text: '', isStreaming: true },
    ]);
    setAssistantInput('');

    const response = `Sure — I can help with that.\n\nI’ll draft a query that groups subscriptions by country and returns the counts, with a clear sort order.`;
    let i = 0;
    const interval = window.setInterval(() => {
      i += Math.max(1, Math.round(response.length / 30));
      setAssistantMessages((prev) =>
        prev.map((m) =>
          m.id === sysId
            ? { ...m, text: response.slice(0, Math.min(i, response.length)), isStreaming: i < response.length }
            : m
        )
      );
      if (i >= response.length) {
        window.clearInterval(interval);
      }
    }, 50);
  };

  const onRun = () => {
    if (runState !== 'idle') return;
    setRunState('running');
    window.setTimeout(() => {
      setRunState('done');
      window.setTimeout(() => {
        setRunState('idle');
      }, 1000);
    }, 2000);
  };

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Assistant bar */}
      <div
        style={{
          padding: '16px 16px 12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        <div className="flex items-center gap-12">
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              height: '44px',
              borderRadius: '12px',
              border: assistantFocused ? '2px solid #1F6FEB' : '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface)',
              paddingLeft: '12px',
              paddingRight: '12px',
            }}
          >
            {/* Lightning icon */}
            <div style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M9 1L3 9H7L6 15L13 6H9L9 1Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <input
              value={assistantInput}
              onChange={(e) => setAssistantInput(e.target.value)}
              onFocus={() => setAssistantFocused(true)}
              onBlur={() => setAssistantFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitAssistant();
                }
              }}
              placeholder="Ask Assistant to edit the query"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '18px',
                fontWeight: 400,
              }}
            />

            {/* Submit affordance */}
            <button
              onClick={submitAssistant}
              aria-label="Submit assistant prompt"
              style={{
                width: '44px',
                height: '28px',
                borderRadius: '14px',
                border: assistantInput.trim() ? '1px solid var(--border-default)' : '1px solid var(--border-subtle)',
                backgroundColor: assistantInput.trim() ? 'rgba(103, 93, 255, 0.22)' : 'transparent',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: assistantInput.trim() ? 'pointer' : 'default',
              }}
              disabled={!assistantInput.trim()}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 3L11 7L7 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11 7H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Run button */}
          <button
            onClick={onRun}
            disabled={runState !== 'idle'}
            style={{
              height: '44px',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface)',
              paddingLeft: '18px',
              paddingRight: '18px',
              color: 'var(--text-primary)',
              fontSize: '18px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: runState === 'idle' ? 'pointer' : 'default',
              opacity: runState === 'idle' ? 1 : 0.9,
            }}
          >
            {runState === 'idle' && (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 4.5L14 9L6 13.5V4.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
                Run
              </>
            )}
            {runState === 'running' && (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 2.5A6.5 6.5 0 1 0 15.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Running
              </>
            )}
            {runState === 'done' && (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14.5 5.5L7.5 12.5L4 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Done
              </>
            )}
          </button>
        </div>

        {/* System response area */}
        {assistantMessages.length > 0 && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {assistantMessages.slice(-2).map((m) => (
              <div
                key={m.id}
                style={{
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.4,
                }}
              >
                {m.role === 'user' ? `You: ${m.text}` : `Assistant: ${m.text}${m.isStreaming ? '▍' : ''}`}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor area */}
      <div className="flex-1 flex min-h-0">
        {/* Line numbers - scrollable but scrollbar hidden */}
        <div
          ref={lineNumbersRef}
          className="flex-shrink-0 w-12 pr-2 overflow-y-scroll"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <pre
            className="font-mono text-sm text-right select-none"
            style={{
              color: 'var(--text-muted)',
              lineHeight: '1.65',
              margin: 0,
              paddingTop: '16px',
              paddingBottom: '16px',
            }}
          >
            {lineNumbers}
          </pre>
        </div>

        {/* SQL content with syntax highlighting + editable overlay */}
        <div
          ref={contentRef}
          className="flex-1 overflow-auto custom-scrollbar"
          onScroll={handleScroll}
          style={{ position: 'relative' }}
        >
          <pre
            className="font-mono text-sm"
            style={{
              lineHeight: '1.65',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              overflowWrap: 'anywhere',
              color: 'var(--text-primary)',
              pointerEvents: 'none',
              paddingTop: '16px',
              paddingBottom: '16px',
              paddingLeft: '12px',
              paddingRight: '12px',
            }}
            dangerouslySetInnerHTML={{ __html: highlightedHTML + '\n' }}
          />

          <textarea
            ref={textareaRef}
            className="sql-editor-textarea sql-editor-overlay"
            value={sqlText}
            onChange={(e) => {
              setSqlText(e.target.value);
              setIsDirty(true);
            }}
            spellCheck={false}
            wrap="soft"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              paddingTop: '16px',
              paddingBottom: '16px',
              paddingLeft: '12px',
              paddingRight: '12px',
              border: 'none',
              outline: 'none',
              resize: 'none',
              background: 'transparent',
              color: 'transparent',
              WebkitTextFillColor: 'transparent',
              caretColor: 'var(--text-primary)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace',
              fontSize: '14px',
              lineHeight: '1.65',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              overflowWrap: 'anywhere',
              overflow: 'hidden',
            }}
            onScroll={() => {
              // Ensure scroll stays on the container, not textarea
              if (textareaRef.current && contentRef.current) {
                textareaRef.current.scrollTop = contentRef.current.scrollTop;
                textareaRef.current.scrollLeft = contentRef.current.scrollLeft;
              }
            }}
          />
        </div>
      </div>

      <style jsx global>{`
        /* Override global textarea background rules for the SQL editor overlay */
        .sql-editor-textarea {
          background-color: transparent !important;
        }
        /* Keep syntax-highlighted text visible behind selection */
        .sql-editor-overlay::selection {
          background: rgba(103, 93, 255, 0.22);
          color: transparent;
        }
        .sql-editor-overlay::-moz-selection {
          background: rgba(103, 93, 255, 0.22);
          color: transparent;
        }

        .sql-field-pill {
          /* Use box-shadow instead of border so line-height doesn't change */
          box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 22%, transparent);
          border-radius: 6px;
          padding: 0px 4px;
          margin: 0px 1px;
          display: inline;
          line-height: inherit;
          color: var(--color-orange-600);
          box-decoration-break: clone;
        }

        .dark .sql-field-pill {
          color: color-mix(in srgb, var(--color-orange-600) 65%, var(--text-primary));
        }
      `}</style>
    </div>
  );
}

