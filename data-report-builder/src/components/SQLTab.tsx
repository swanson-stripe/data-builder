'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/state/app';
import { useTheme } from '@/state/theme';
import { generateSQL } from '@/lib/generateSQL';
import { highlightSQL } from '@/lib/sqlHighlight';
import schema from '@/data/schema';
import type { AIParseResult, AIReportConfig } from '@/types/ai';

export function SQLTab() {
  const { state } = useApp();
  const { theme } = useTheme();
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const wrapMeasureRef = useRef<HTMLDivElement>(null);
  const boltButtonRef = useRef<HTMLButtonElement>(null);
  const boltPopoverRef = useRef<HTMLDivElement>(null);

  const [sqlText, setSqlText] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Assistant simulation
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantFocused, setAssistantFocused] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<Array<{ id: string; role: 'user' | 'system'; text: string; isStreaming?: boolean }>>([]);
  const assistantTimersRef = useRef<{ phase2?: number; phase3?: number; spinner?: number }>({});
  const [assistantSpinnerIdx, setAssistantSpinnerIdx] = useState(0);
  const ASSISTANT_SPINNER_FRAMES = useMemo(() => ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'], []);
  const [isBoltPopoverOpen, setIsBoltPopoverOpen] = useState(false);
  const [boltPopoverPosition, setBoltPopoverPosition] = useState({ top: 0, left: 0 });

  // Run button simulation
  const [runState, setRunState] = useState<'idle' | 'running' | 'done'>('idle');

  // Current line highlight (visual row; supports wrapping)
  const [scrollTop, setScrollTop] = useState(0);
  const [caretRowTop, setCaretRowTop] = useState(0);
  const [lineHeightPx, setLineHeightPx] = useState(0);
  const [caretIndex, setCaretIndex] = useState(0);
  const [wrappedRowsByLine, setWrappedRowsByLine] = useState<number[]>([]);

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

  // Keep highlight aligned while typing (mirror measurement depends on layout)
  useEffect(() => {
    const id = window.requestAnimationFrame(() => updateCaretRow());
    return () => window.cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sqlText]);

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

  const highlightedLines = useMemo(() => {
    return (highlightedHTML || '').split('\n');
  }, [highlightedHTML]);

  // Calculate line numbers
  const lineCount = useMemo(() => {
    return (sqlText || '').split('\n').length;
  }, [sqlText]);

  const lineNumberItems = useMemo(() => {
    return Array.from({ length: lineCount }, (_, i) => i + 1);
  }, [lineCount]);

  const logicalLines = useMemo(() => {
    return (sqlText || '').split('\n');
  }, [sqlText]);

  const activeLineNumber = useMemo(() => {
    const idx = Math.max(0, Math.min(caretIndex, (sqlText || '').length));
    let n = 1;
    for (let i = 0; i < idx; i += 1) {
      if (sqlText.charCodeAt(i) === 10) n += 1; // '\n'
    }
    return n;
  }, [caretIndex, sqlText]);

  // Sync scroll between content and line numbers
  const handleScroll = () => {
    if (contentRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = contentRef.current.scrollTop;
      setScrollTop(contentRef.current.scrollTop);
    }
  };

  const EDITOR_PADDING_TOP = 16;
  const EDITOR_PADDING_X = 12;

  // Measure line-height from textarea so highlight height matches precisely
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cs = window.getComputedStyle(ta);
    const lh = parseFloat(cs.lineHeight || '0');
    if (Number.isFinite(lh) && lh > 0) setLineHeightPx(lh);
  }, []);

  const updateCaretRow = () => {
    const ta = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!ta || !mirror) return;

    const caret = typeof ta.selectionStart === 'number' ? ta.selectionStart : 0;
    setCaretIndex(caret);
    const before = ta.value.slice(0, caret);
    const after = ta.value.slice(caret);

    mirror.textContent = '';
    mirror.appendChild(document.createTextNode(before));
    const marker = document.createElement('span');
    marker.className = 'sql-caret-marker';
    marker.textContent = '\u200b';
    mirror.appendChild(marker);
    mirror.appendChild(document.createTextNode(after));

    setCaretRowTop(marker.offsetTop);
  };

  // Position + dismissal for bolt popover
  useEffect(() => {
    if (!isBoltPopoverOpen || !boltButtonRef.current) return;
    const rect = boltButtonRef.current.getBoundingClientRect();
    const popoverWidth = 320;
    const padding = 12;
    const left = Math.min(Math.max(padding, rect.left - 4), window.innerWidth - popoverWidth - padding);
    setBoltPopoverPosition({
      top: rect.bottom + 6,
      left,
    });
  }, [isBoltPopoverOpen]);

  useEffect(() => {
    if (!isBoltPopoverOpen) return;

    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        boltPopoverRef.current &&
        !boltPopoverRef.current.contains(t) &&
        boltButtonRef.current &&
        !boltButtonRef.current.contains(t)
      ) {
        setIsBoltPopoverOpen(false);
      }
    };

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsBoltPopoverOpen(false);
    };

    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [isBoltPopoverOpen]);

  const recomputeWrappedRows = () => {
    const measurer = wrapMeasureRef.current;
    if (!measurer) return;
    const lh = lineHeightPx || 0;
    if (!lh) return;

    // Render the *same* highlighted HTML (incl. field pills) so wrap math matches what users see.
    // We measure the vertical offset of each line start marker; the delta between markers tells us
    // how many visual rows that logical line occupies when wrapping.
    const html = logicalLines
      .map((_, i) => {
        const lineHtml = highlightedLines[i] ?? '';
        const safeLineHtml = lineHtml.length ? lineHtml : '&#8203;';
        return `<div class="sql-wrap-line"><span class="sql-wrap-marker" data-i="${i}">&#8203;</span>${safeLineHtml}</div>`;
      })
      .join('');

    measurer.innerHTML = html;

    const markers = Array.from(measurer.querySelectorAll<HTMLElement>('.sql-wrap-marker'));
    if (markers.length === 0) return;

    const tops = markers.map((m) => m.offsetTop);
    const total = measurer.scrollHeight;

    const next: number[] = [];
    for (let i = 0; i < tops.length; i += 1) {
      const start = tops[i] ?? 0;
      const end = i < tops.length - 1 ? (tops[i + 1] ?? total) : total;
      const rows = Math.max(1, Math.round((end - start + 0.01) / lh));
      next.push(rows);
    }

    setWrappedRowsByLine(next);
  };

  // Recompute wrapped rows when text or layout changes
  useEffect(() => {
    const id = window.requestAnimationFrame(() => recomputeWrappedRows());
    return () => window.cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logicalLines, lineHeightPx]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      recomputeWrappedRows();
      updateCaretRow();
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineHeightPx, logicalLines]);

  const lineGutterRows = useMemo(() => {
    const rows: Array<{ key: string; label: string; isActive: boolean; isSpacer: boolean }> = [];
    for (let i = 0; i < lineNumberItems.length; i += 1) {
      const n = lineNumberItems[i];
      const wrapRows = wrappedRowsByLine[i] || 1;
      rows.push({ key: `n_${n}`, label: String(n), isActive: n === activeLineNumber, isSpacer: false });
      for (let j = 1; j < wrapRows; j += 1) {
        rows.push({ key: `s_${n}_${j}`, label: '\u00a0', isActive: false, isSpacer: true });
      }
    }
    return rows;
  }, [activeLineNumber, lineNumberItems, wrappedRowsByLine]);

  const pluralize = (s: string) => {
    if (!s) return s;
    if (s.endsWith('s')) return s;
    return `${s}s`;
  };

  const extractByPhrase = (prompt: string) => {
    const m = prompt.match(/\bby\s+([^.,;]+)$/i);
    if (!m) return null;
    const phrase = m[1].trim();
    return phrase ? phrase : null;
  };

  const summarizeConfig = (prompt: string, config: AIReportConfig) => {
    const byPhrase = extractByPhrase(prompt);
    const primaryObject = config.objects?.[0] || 'data';

    const prettyField = (f: string) => String(f || '').replace(/_/g, ' ');

    const filters = (config.filters || []).filter((c: any) => c && c.field && c.operator && 'value' in c);
    const filterPhrase = (() => {
      const first = filters[0] as any;
      if (!first) return '';
      const obj = first.field?.object;
      const field = first.field?.field;
      const op = first.operator;
      const val = first.value;
      if (obj && field && op === 'equals') return ` filtered to ${obj}.${field} = ${JSON.stringify(val)}`;
      return '';
    })();

    const timePhrase = config.range?.granularity ? ` over time (${config.range.granularity})` : '';

    if (config.multiBlock?.blocks?.length) {
      const a = config.multiBlock.blocks[0];
      const b = config.multiBlock.blocks[1];
      const op = config.multiBlock.calculation?.operator;
      const opPhrase =
        op === 'divide' ? 'as a rate' :
        op === 'multiply' ? 'as a multiplied metric' :
        op === 'add' ? 'as a combined metric' :
        op === 'subtract' ? 'as a net metric' :
        'as a derived metric';
      const base = `compute ${a.name.toLowerCase()} ${op === 'divide' ? 'divided by' : op || 'with'} ${b?.name?.toLowerCase() || 'a comparison'} ${opPhrase}`;
      return `${base}${timePhrase}.`;
    }

    if (config.metric) {
      const { op, source } = config.metric;
      const metricTarget =
        source?.object && source?.field
          ? `${source.object}.${source.field}`
          : primaryObject;

      const metricPhrase =
        op === 'count'
          ? `count ${source?.field === 'id' ? pluralize(primaryObject) : metricTarget}`
          : `${op} ${metricTarget}`;

      const groupPhrase = byPhrase ? ` grouped by ${byPhrase}` : '';
      return `${metricPhrase}${groupPhrase}${filterPhrase}${timePhrase}.`;
    }

    // Fallback: still return something plausible
    return `update the query for ${prettyField(primaryObject)}${byPhrase ? ` grouped by ${byPhrase}` : ''}${timePhrase}.`;
  };

  const submitAssistant = async (rawPrompt?: string) => {
    const prompt = (rawPrompt ?? assistantInput).trim();
    if (!prompt) return;

    // Cancel any prior timers so sequences don't overlap
    if (assistantTimersRef.current.phase2) window.clearTimeout(assistantTimersRef.current.phase2);
    if (assistantTimersRef.current.phase3) window.clearTimeout(assistantTimersRef.current.phase3);
    if (assistantTimersRef.current.spinner) window.clearInterval(assistantTimersRef.current.spinner);
    assistantTimersRef.current = {};
    setAssistantSpinnerIdx(0);

    const now = Date.now();
    const sysId = `s_${now}`;
    setAssistantMessages((prev) => [
      ...prev,
      { id: sysId, role: 'system', text: 'Updating the query…' },
    ]);
    setAssistantInput('');

    const controller = new AbortController();

    try {
      const resp = await fetch('/api/parse-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });

      const result = (await resp.json()) as AIParseResult;
      if (!result || typeof result !== 'object') throw new Error('Invalid response');

      if ('success' in result && result.success) {
        const summary = summarizeConfig(prompt, result.config);
        // Phase 1 (immediate): show detailed updating message
        const updatingText = `Updating the query to ${summary}`;
        setAssistantMessages((prev) => prev.map((m) => (m.id === sysId ? { ...m, text: updatingText } : m)));

        // Start spinner while in "Updating..." phase
        assistantTimersRef.current.spinner = window.setInterval(() => {
          setAssistantSpinnerIdx((i) => (i + 1) % 10);
        }, 140);

        // Phase 2 (+3s): show updated confirmation
        assistantTimersRef.current.phase2 = window.setTimeout(() => {
          if (assistantTimersRef.current.spinner) window.clearInterval(assistantTimersRef.current.spinner);
          assistantTimersRef.current.spinner = undefined;
          const updatedText = `Updated the query to ${summary}`;
          setAssistantMessages((prev) => prev.map((m) => (m.id === sysId ? { ...m, text: updatedText } : m)));
        }, 3000);

        // Phase 3 (+6s): clear message
        assistantTimersRef.current.phase3 = window.setTimeout(() => {
          setAssistantMessages((prev) => prev.filter((m) => m.id !== sysId));
        }, 6000);
      } else {
        const err = (result as any).error || 'Failed to process your request.';
        // Keep the initial "Updating..." text, then show an error and clear it.
        assistantTimersRef.current.spinner = window.setInterval(() => {
          setAssistantSpinnerIdx((i) => (i + 1) % 10);
        }, 140);
        assistantTimersRef.current.phase2 = window.setTimeout(() => {
          if (assistantTimersRef.current.spinner) window.clearInterval(assistantTimersRef.current.spinner);
          assistantTimersRef.current.spinner = undefined;
          const updatedText = `Couldn’t update the query: ${err}`;
          setAssistantMessages((prev) => prev.map((m) => (m.id === sysId ? { ...m, text: updatedText } : m)));
        }, 3000);
        assistantTimersRef.current.phase3 = window.setTimeout(() => {
          setAssistantMessages((prev) => prev.filter((m) => m.id !== sysId));
        }, 6000);
      }
    } catch (e: any) {
      const errText =
        e?.name === 'AbortError' ? 'Couldn’t update the query.' : 'Couldn’t update the query: network error.';
      assistantTimersRef.current.spinner = window.setInterval(() => {
        setAssistantSpinnerIdx((i) => (i + 1) % 10);
      }, 140);
      assistantTimersRef.current.phase2 = window.setTimeout(() => {
        if (assistantTimersRef.current.spinner) window.clearInterval(assistantTimersRef.current.spinner);
        assistantTimersRef.current.spinner = undefined;
        setAssistantMessages((prev) => prev.map((m) => (m.id === sysId ? { ...m, text: errText } : m)));
      }, 3000);
      assistantTimersRef.current.phase3 = window.setTimeout(() => {
        setAssistantMessages((prev) => prev.filter((m) => m.id !== sysId));
      }, 6000);
    }
  };

  // Cleanup timers/interval on unmount
  useEffect(() => {
    return () => {
      if (assistantTimersRef.current.phase2) window.clearTimeout(assistantTimersRef.current.phase2);
      if (assistantTimersRef.current.phase3) window.clearTimeout(assistantTimersRef.current.phase3);
      if (assistantTimersRef.current.spinner) window.clearInterval(assistantTimersRef.current.spinner);
    };
  }, []);

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
        <div className="flex items-center" style={{ gap: '12px' }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 0,
              height: '28px',
              borderRadius: '6px',
              border: '1px solid var(--border-default)',
              borderColor: assistantFocused ? 'var(--button-primary-bg)' : 'var(--border-default)',
              outline: assistantFocused ? '1px solid var(--button-primary-bg)' : 'none',
              outlineOffset: assistantFocused ? '-1px' : '0px',
              backgroundColor: 'var(--bg-surface)',
              paddingLeft: '4px',
              paddingRight: '4px',
            }}
          >
            {/* Bolt button (clickable in a future step) */}
            <button
              type="button"
              aria-label="Assistant options"
              ref={boltButtonRef}
              onClick={() => setIsBoltPopoverOpen((v) => !v)}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                border: '1px solid var(--border-medium)',
                backgroundColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                flexShrink: 0,
                marginRight: '8px',
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: 'currentColor',
                  WebkitMaskImage: "url('/bolt.svg')",
                  WebkitMaskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  WebkitMaskSize: 'contain',
                  maskImage: "url('/bolt.svg')",
                  maskRepeat: 'no-repeat',
                  maskPosition: 'center',
                  maskSize: 'contain',
                }}
              />
            </button>

            <input
              className="sql-assistant-input"
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
                fontSize: '14px',
                fontWeight: 400,
              }}
            />

            {/* Submit button (Enter) */}
            <button
              onClick={() => submitAssistant()}
              disabled={!assistantInput.trim()}
              aria-label="Submit assistant prompt"
              style={{
                height: '20px',
                width: '44px',
                borderRadius: '4px',
                border: assistantInput.trim() ? '1px solid var(--button-primary-border)' : '1px solid var(--border-medium)',
                backgroundColor: assistantInput.trim() ? 'var(--button-primary-bg)' : 'transparent',
                color: assistantInput.trim() ? 'var(--button-primary-text)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: assistantInput.trim() ? 'pointer' : 'default',
                flexShrink: 0,
                marginLeft: '4px',
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: 'currentColor',
                  WebkitMaskImage: "url('/enter.svg')",
                  WebkitMaskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  WebkitMaskSize: 'contain',
                  maskImage: "url('/enter.svg')",
                  maskRepeat: 'no-repeat',
                  maskPosition: 'center',
                  maskSize: 'contain',
                }}
              />
            </button>
          </div>

          {/* Run button */}
          <button
            onClick={onRun}
            disabled={runState !== 'idle'}
            style={{
              height: '28px',
              borderRadius: '6px',
              border: '1px solid var(--border-medium)',
              backgroundColor: 'var(--bg-surface)',
              paddingLeft: '8px',
              paddingRight: '8px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: runState === 'idle' ? 'pointer' : 'default',
              opacity: runState === 'idle' ? 1 : 0.9,
            }}
          >
            {runState === 'idle' && (
              <>
                <div
                  aria-hidden="true"
                  style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: 'var(--text-primary)',
                    WebkitMaskImage: "url('/Start%20icon.svg')",
                    WebkitMaskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    WebkitMaskSize: 'contain',
                    maskImage: "url('/Start%20icon.svg')",
                    maskRepeat: 'no-repeat',
                    maskPosition: 'center',
                    maskSize: 'contain',
                    flexShrink: 0,
                  }}
                />
                Run
              </>
            )}
            {runState === 'running' && (
              <>
                <svg width="12" height="12" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 2.5A6.5 6.5 0 1 0 15.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Running
              </>
            )}
            {runState === 'done' && (
              <>
                <svg width="12" height="12" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14.5 5.5L7.5 12.5L4 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Done
              </>
            )}
          </button>
        </div>

        {/* System response area */}
        <div
          aria-live="polite"
          style={{
            marginTop: assistantMessages.length > 0 ? '12px' : '0px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            overflow: 'hidden',
            maxHeight: assistantMessages.length > 0 ? '48px' : '0px',
            opacity: assistantMessages.length > 0 ? 1 : 0,
            transform: assistantMessages.length > 0 ? 'translateY(0px)' : 'translateY(-4px)',
            transition: 'max-height 220ms ease, opacity 220ms ease, transform 220ms ease, margin-top 220ms ease',
          }}
        >
          {assistantMessages.slice(-1).map((m) => {
            const isUpdating = m.text.startsWith('Updating');
            const isUpdated = m.text.startsWith('Updated');
            const prefix = isUpdating
              ? `${ASSISTANT_SPINNER_FRAMES[assistantSpinnerIdx]} `
              : isUpdated
                ? `✓ `
                : '';
            const color = isUpdated ? 'var(--text-primary)' : 'var(--text-muted)';
            return (
              <div
                key={`${m.id}:${m.text}`}
                className="assistant-msg-anim"
                style={{
                  fontSize: '12px',
                  color,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.4,
                }}
              >
                {prefix}
                {m.text}
              </div>
            );
          })}
        </div>
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
          <div
            className="font-mono text-sm text-right select-none"
            style={{
              margin: 0,
              paddingTop: '16px',
              paddingBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
            }}
          >
            {lineGutterRows.map((row) => (
              <div
                key={row.key}
                style={{
                  height: `${lineHeightPx || 24}px`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-end',
                  color: row.isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  opacity: row.isSpacer ? 0 : 1,
                }}
              >
                {row.label}
              </div>
            ))}
          </div>
        </div>

        {/* SQL content with syntax highlighting + editable overlay */}
        <div
          ref={contentRef}
          className="flex-1 overflow-auto custom-scrollbar"
          onScroll={handleScroll}
          style={{ position: 'relative' }}
        >
          {/* Current visual line highlight (behind code, follows wrapping) */}
          <div
            className="sql-current-line"
            style={{
              top: `${EDITOR_PADDING_TOP + caretRowTop - scrollTop - 4}px`,
              height: `${lineHeightPx || 24}px`,
            }}
          />

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
              position: 'relative',
              zIndex: 1,
            }}
            dangerouslySetInnerHTML={{ __html: highlightedHTML + '\n' }}
          />

          {/* Hidden mirror used to measure caret's wrapped visual row */}
          <div ref={mirrorRef} className="sql-caret-mirror" aria-hidden="true" />
          {/* Hidden measurer used to compute wraps per logical line (for gutter spacing) */}
          <div ref={wrapMeasureRef} className="sql-wrap-measure" aria-hidden="true" />

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
              zIndex: 2,
            }}
            onScroll={() => {
              // Ensure scroll stays on the container, not textarea
              if (textareaRef.current && contentRef.current) {
                textareaRef.current.scrollTop = contentRef.current.scrollTop;
                textareaRef.current.scrollLeft = contentRef.current.scrollLeft;
              }
            }}
            onKeyUp={updateCaretRow}
            onClick={updateCaretRow}
            onSelect={updateCaretRow}
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

        .sql-current-line {
          position: absolute;
          left: max(0px, calc(${EDITOR_PADDING_X}px - 8px));
          right: ${EDITOR_PADDING_X}px;
          pointer-events: none;
          background: color-mix(in srgb, var(--text-muted) 18%, transparent);
          border-radius: 6px;
          z-index: 0;
        }

        .sql-caret-mirror {
          position: absolute;
          left: ${EDITOR_PADDING_X}px;
          right: ${EDITOR_PADDING_X}px;
          top: ${EDITOR_PADDING_TOP}px;
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-wrap: anywhere;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 14px;
          line-height: 1.65;
          visibility: hidden;
          pointer-events: none;
          z-index: -1;
        }

        .sql-wrap-measure {
          position: absolute;
          left: ${EDITOR_PADDING_X}px;
          right: ${EDITOR_PADDING_X}px;
          top: 0px;
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-wrap: anywhere;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 14px;
          line-height: 1.65;
          visibility: hidden;
          pointer-events: none;
          padding: 0;
          margin: 0;
          z-index: -1;
        }

        .sql-wrap-line {
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-wrap: anywhere;
        }

        .sql-wrap-marker {
          display: inline-block;
          width: 0px;
          height: 0px;
          overflow: hidden;
        }

        .sql-assistant-input::placeholder {
          color: var(--text-muted);
        }

        .assistant-msg-anim {
          animation: assistantMsgIn 220ms ease both;
        }

        @keyframes assistantMsgIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0px);
          }
        }
      `}</style>

      {isBoltPopoverOpen && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={boltPopoverRef}
            style={{
              position: 'fixed',
              top: boltPopoverPosition.top,
              left: boltPopoverPosition.left,
              width: '320px',
              maxWidth: 'calc(100vw - 24px)',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-popover)',
              zIndex: 9999,
              overflow: 'hidden',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                Suggested prompts
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  'Payment success rate',
                  'Monthly recurring revenue from active subscriptions',
                  'Refund count',
                ].map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="hover-fast"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      fontSize: '14px',
                      lineHeight: 1.35,
                      fontWeight: 400,
                      color: 'var(--text-primary)',
                      padding: '2px 0',
                      borderRadius: '12px',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onClick={() => {
                      setIsBoltPopoverOpen(false);
                      submitAssistant(label);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="hover-fast"
                style={{
                  marginTop: '14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: 'var(--text-muted)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Show more
                <div
                  aria-hidden="true"
                  style={{
                    width: '18px',
                    height: '18px',
                    backgroundColor: 'currentColor',
                    WebkitMaskImage: "url('/arrowsLoop.svg')",
                    WebkitMaskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    WebkitMaskSize: 'contain',
                    maskImage: "url('/arrowsLoop.svg')",
                    maskRepeat: 'no-repeat',
                    maskPosition: 'center',
                    maskSize: 'contain',
                  }}
                />
              </button>
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />

            <a
              href="https://docs.stripe.com/assistant"
              target="_blank"
              rel="noreferrer"
              className="hover-fast"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                textDecoration: 'none',
                color: 'inherit',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-primary)' }}>
                  A guide to using Stripe Assistant
                </div>
                <div style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>
                  docs.stripe.com/assistant
                </div>
              </div>

              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--text-muted)' }} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M14 3H21V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 14V21H3V3H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>,
          document.body
        )}
    </div>
  );
}

