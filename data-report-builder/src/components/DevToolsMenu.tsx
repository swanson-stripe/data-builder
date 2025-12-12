'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/state/theme';

type Props = {
  /** Progress value 0-100, or 0 when idle */
  loadingProgress: number;
  /** Whether to show the "New" button that navigates to /new */
  showNewButton?: boolean;
  /** Callback when preset is selected (optional, for custom handling) */
  onPresetSelect?: (presetKey: string) => void;
};

/**
 * Floating helper menu (editor-only).
 */
export function DevToolsMenu({ loadingProgress }: Props) {
  const { theme, mode, cycleMode } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPopoverMounted, setIsPopoverMounted] = useState(false);
  const [isPopoverAnimatingOut, setIsPopoverAnimatingOut] = useState(false);
  const [hoveredMiscKey, setHoveredMiscKey] = useState<string | null>(null);
  const [updatesDismissed, setUpdatesDismissed] = useState(false);
  const [isDismissingUpdates, setIsDismissingUpdates] = useState(false);
  const [shouldAnimateMovedImprovement, setShouldAnimateMovedImprovement] = useState(false);
  const [hoveredImprovementTitle, setHoveredImprovementTitle] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click when expanded
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!isExpanded) return;
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        requestClosePopover();
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [isExpanded]);

  const modeLabel = mode === 'adaptive' ? 'Adaptive' : mode === 'light' ? 'Light' : 'Dark';
  const themeRowLabel = mode === 'adaptive' ? 'Adaptive theme' : mode === 'light' ? 'Light theme' : 'Dark theme';

  const POPOVER_ANIM_MS = 600;

  const requestOpenPopover = () => {
    if (isExpanded || isPopoverMounted) return;
    setIsPopoverMounted(true);
    // Next tick so the element mounts at its "from" transform before animating in
    requestAnimationFrame(() => {
      setIsExpanded(true);
    });
  };

  const requestClosePopover = () => {
    if (!isExpanded) return;
    setIsPopoverAnimatingOut(true);
    setIsExpanded(false);
    window.setTimeout(() => {
      setIsPopoverMounted(false);
      setIsPopoverAnimatingOut(false);
    }, POPOVER_ANIM_MS);
  };

  const requestDismissUpdates = () => {
    if (updatesDismissed || isDismissingUpdates) return;
    setIsDismissingUpdates(true);
    window.setTimeout(() => {
      setUpdatesDismissed(true);
      setIsDismissingUpdates(false);
      setShouldAnimateMovedImprovement(true);
      window.setTimeout(() => setShouldAnimateMovedImprovement(false), POPOVER_ANIM_MS);
    }, POPOVER_ANIM_MS);
  };

  const PaneIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0 4.5C0 2.84315 1.34315 1.5 3 1.5H13C14.6569 1.5 16 2.84315 16 4.5V11.5C16 13.1569 14.6569 14.5 13 14.5H3C1.34315 14.5 0 13.1569 0 11.5V4.5ZM10.5 3H13C13.8284 3 14.5 3.67157 14.5 4.5V11.5C14.5 12.3284 13.8284 13 13 13H10.5V3ZM9 3H3C2.17157 3 1.5 3.67157 1.5 4.5V11.5C1.5 12.3284 2.17157 13 3 13H9V3Z"
        fill="currentColor"
      />
    </svg>
  );

  const NegativeIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1 8C1 7.51675 1.39175 7.125 1.875 7.125H14.125C14.6082 7.125 15 7.51675 15 8C15 8.48325 14.6082 8.875 14.125 8.875H1.875C1.39175 8.875 1 8.48325 1 8Z"
        fill="currentColor"
      />
    </svg>
  );

  const ArrowsLoopIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9.71397 6.69302C9.4341 6.99838 9.45477 7.4728 9.76013 7.75267C10.0655 8.03254 10.5399 8.01187 10.8198 7.7065L13.7521 4.50699C14.0149 4.22029 14.0149 3.7803 13.7522 3.49356L10.8198 0.293368C10.54 -0.0120257 10.0656 -0.0327462 9.76019 0.247088C9.4548 0.526922 9.43408 1.00134 9.71391 1.30674L11.4948 3.25028L4.5998 3.24993C2.52866 3.24983 0.849609 4.92879 0.849609 6.99993V7.06671C0.849609 7.48092 1.1854 7.81671 1.59961 7.81671C2.01382 7.81671 2.34961 7.48092 2.34961 7.06671V6.99993C2.34961 5.75725 3.35704 4.74987 4.59972 4.74993L11.4945 4.75028L9.71397 6.69302Z"
        fill="currentColor"
      />
      <path
        d="M6.28539 9.3068C6.56522 9.0014 6.5445 8.52698 6.23911 8.24715C5.93371 7.96731 5.45929 7.98803 5.17946 8.29343L2.2471 11.4936C1.98437 11.7803 1.98439 12.2203 2.24713 12.507L5.17949 15.7068C5.45934 16.0122 5.93376 16.0329 6.23914 15.753C6.54452 15.4732 6.56521 14.9988 6.28536 14.6934L4.50493 12.7506H11.3995C13.4706 12.7506 15.1495 11.0716 15.1495 9.00058V8.93365C15.1495 8.51944 14.8137 8.18365 14.3995 8.18365C13.9853 8.18365 13.6495 8.51944 13.6495 8.93365V9.00058C13.6495 10.2432 12.6422 11.2506 11.3995 11.2506H4.50429L6.28539 9.3068Z"
        fill="currentColor"
      />
    </svg>
  );

  return (
    <div
      ref={containerRef}
      className="fixed z-50"
      style={{ bottom: '20px', right: '20px' }}
    >
      {/* Collapsed trigger */}
      {!isExpanded && !isPopoverMounted && (
        <button
          onClick={requestOpenPopover}
          className="cursor-pointer"
          style={{ border: 'none', background: 'transparent', padding: 0 }}
          aria-label="Open helper"
        >
          <div
            style={{
              borderRadius: '10px',
              paddingLeft: '12px',
              paddingRight: '12px',
              paddingTop: '12px',
              paddingBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-elevated)',
              boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
              gap: '8px',
            }}
          >
            <div
              style={{
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                flexShrink: 0,
              }}
            >
              {/* help icon */}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M6.8864 4.92282C6.65368 5.17294 6.5 5.55331 6.5 6.04545C6.5 6.45967 6.16421 6.79545 5.75 6.79545C5.33579 6.79545 5 6.45967 5 6.04545C5 5.24215 5.2544 4.47479 5.78823 3.90105C6.32915 3.31968 7.09913 3 8 3C8.90087 3 9.67085 3.31968 10.2118 3.90105C10.7456 4.47479 11 5.24215 11 6.04545C11 7.27924 10.1311 7.96688 9.56438 8.37658C9.47014 8.4447 9.38575 8.5042 9.30937 8.55805C9.11953 8.69189 8.97916 8.79085 8.85995 8.90077C8.79024 8.96503 8.76105 9.00433 8.75 9.02233V9.5C8.75 9.91421 8.41421 10.25 8 10.25C7.58579 10.25 7.25 9.91421 7.25 9.5V9C7.25 8.43699 7.57587 8.04442 7.84318 7.79796C8.04139 7.61521 8.29958 7.43355 8.51465 7.28224C8.57594 7.23911 8.63372 7.19846 8.68562 7.16094C9.24387 6.75739 9.5 6.46776 9.5 6.04545C9.5 5.55331 9.34631 5.17294 9.1136 4.92282C8.88797 4.68032 8.53295 4.5 8 4.5C7.46705 4.5 7.11203 4.68032 6.8864 4.92282Z" fill="currentColor"/>
                <path d="M9 12C9 12.5514 8.5514 13 8 13C7.4486 13 7 12.5514 7 12C7 11.4486 7.4486 11 8 11C8.5514 11 9 11.4486 9 12Z" fill="currentColor"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M8 14.5C11.5899 14.5 14.5 11.5899 14.5 8C14.5 4.41015 11.5899 1.5 8 1.5C4.41015 1.5 1.5 4.41015 1.5 8C1.5 9.02218 1.67899 9.60751 2.10262 10.3985C2.4189 10.989 2.51047 11.712 2.28063 12.4015L1.62171 14.3783L3.59848 13.7194C4.28801 13.4895 5.01103 13.5811 5.60154 13.8974C6.39249 14.321 6.97782 14.5 8 14.5ZM8 16C12.4183 16 16 12.4183 16 8C16 3.58172 12.4183 0 8 0C3.58172 0 0 3.58172 0 8C0 9.29031 0.250384 10.1172 0.780342 11.1067C0.915539 11.3591 0.948157 11.6555 0.857606 11.9272L0.0513167 14.3461C0.0173279 14.448 0 14.5548 0 14.6623V15C0 15.5523 0.447715 16 1 16H1.33772C1.4452 16 1.55198 15.9827 1.65395 15.9487L4.07282 15.1424C4.34447 15.0518 4.6409 15.0845 4.89332 15.2197C5.88278 15.7496 6.70969 16 8 16Z" fill="currentColor"/>
              </svg>
            </div>

            <div
              style={{
                height: '24px',
                borderRadius: '6px',
                paddingLeft: '4px',
                paddingRight: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: 'rgba(103, 93, 255, 0.12)',
                color: theme === 'dark' ? 'var(--text-link)' : '#44139F',
                fontSize: '14px',
                fontWeight: 400,
                lineHeight: '16px',
              }}
            >
              Updates
            </div>
          </div>
        </button>
      )}

      {/* Expanded panel */}
      {isPopoverMounted && (
        <div
          style={{
            width: '320px',
            backgroundColor: 'var(--bg-elevated)',
            borderRadius: '16px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.18)',
            overflow: 'hidden',
            transformOrigin: 'bottom right',
            // Enter/exit animation
            animation: isExpanded && !isPopoverAnimatingOut ? `helperPopoverIn ${POPOVER_ANIM_MS}ms cubic-bezier(0.16, 1, 0.3, 1)` : undefined,
            opacity: isExpanded ? 1 : 0,
            transform: isExpanded ? 'translateY(0px) scale(1)' : 'translateY(10px) scale(0.92)',
            transition: `opacity ${POPOVER_ANIM_MS}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${POPOVER_ANIM_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
          }}
          role="dialog"
          aria-label="Helper"
        >
          {/* Header */}
          <div
            style={{
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Helper</div>
            <div className="flex items-center gap-2">
              {/* Pane icon */}
              <button
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
                aria-label="Secondary action"
              >
                <PaneIcon />
              </button>
              {/* Collapse */}
              <button
                onClick={requestClosePopover}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
                aria-label="Close helper"
              >
                <NegativeIcon />
              </button>
            </div>
          </div>

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Updates pill row */}
            {!updatesDismissed && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div
                  style={{
                    height: '28px',
                    borderRadius: '6px',
                    paddingLeft: '12px',
                    paddingRight: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    backgroundColor: 'rgba(103, 93, 255, 0.12)',
                    color: theme === 'dark' ? 'var(--text-link)' : '#44139F',
                    fontSize: '14px',
                    fontWeight: 400,
                  }}
                >
                  Updates
                </div>
                <button
                  onClick={requestDismissUpdates}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                  aria-label="Dismiss updates"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}

            {/* Hero content (no container) */}
            {!updatesDismissed && (
              <>
                <div
                  style={{
                    animation: isDismissingUpdates ? `helperSlideOut ${POPOVER_ANIM_MS}ms cubic-bezier(0.16, 1, 0.3, 1)` : undefined,
                  }}
                >
                  <img
                    src="/no%20code.png"
                    width={288}
                    height={160}
                    alt=""
                    style={{
                      width: '288px',
                      height: '160px',
                      display: 'block',
                      borderRadius: '12px',
                    }}
                  />
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Build reports without code
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: '12px' }}>
                      Using the new visual editor, you can build data reports and metrics easily and without SQL. This is available to all dashboard users.
                    </div>
                    <button
                      style={{
                        width: '100%',
                        height: '36px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background-color 100ms ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      Give me a tour
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Separator */}
            {!updatesDismissed && (
              <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', marginLeft: '-16px', marginRight: '-16px' }} />
            )}

            {/* Recent improvements */}
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px' }}>
                Recent improvements
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  ...(updatesDismissed
                    ? [{ title: 'Build reports without code', date: 'Dec 15', thumb: '/no%20code%20sm.png' as const }]
                    : []),
                  { title: 'Expanded visibility and sharing controls', date: 'Nov 14', thumb: '/vis.png' as const },
                  { title: 'Faster Assistant responses', date: 'Oct 28', thumb: '/assist.png' as const },
                ].map((item) => (
                  <button
                    key={item.title}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      width: '100%',
                      border: 'none',
                      backgroundColor: 'transparent',
                      paddingLeft: 0,
                      paddingRight: 0,
                      paddingTop: 0,
                      paddingBottom: 0,
                      borderRadius: '0px',
                      cursor: 'pointer',
                      transition: 'color 100ms ease',
                    }}
                    onMouseEnter={() => setHoveredImprovementTitle(item.title)}
                    onMouseLeave={() => setHoveredImprovementTitle(null)}
                  >
                    <img
                      src={item.thumb}
                      width={56}
                      height={56}
                      alt=""
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '12px',
                        flexShrink: 0,
                        display: 'block',
                      }}
                    />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-primary)' }}>{item.title}</div>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 400,
                          color: hoveredImprovementTitle === item.title ? 'var(--text-primary)' : 'var(--text-muted)',
                          transition: 'color 100ms ease',
                        }}
                      >
                        {item.date}
                      </div>
                    </div>
                    {/* animate the moved item in */}
                    {updatesDismissed && shouldAnimateMovedImprovement && item.title === 'Build reports without code' && (
                      <span
                        style={{
                          position: 'absolute',
                          inset: 0,
                          pointerEvents: 'none',
                          animation: `helperSlideIn ${POPOVER_ANIM_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Separator */}
            <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', marginLeft: '-16px', marginRight: '-16px' }} />

            {/* Misc section */}
            <div>
              {[
                { key: 'guided_tour', label: 'Guided tour', right: '' },
                { key: 'adaptive', label: themeRowLabel, right: '' },
                { key: 'shortcuts', label: 'Keyboard shortcuts', right: '' },
                { key: 'guides', label: 'Guides', right: '' },
                { key: 'feedback', label: 'Share feedback', right: '' },
              ].map((row) => {
                const isThemeRow = row.key === 'adaptive';
                return (
                  <button
                    key={row.key}
                    onClick={() => {
                      if (isThemeRow) cycleMode();
                    }}
                    style={{
                      width: '100%',
                      border: 'none',
                      backgroundColor: 'transparent',
                      paddingTop: '6px',
                      paddingBottom: '6px',
                      paddingLeft: 0,
                      paddingRight: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'opacity 100ms ease',
                    }}
                    onMouseEnter={() => setHoveredMiscKey(row.key)}
                    onMouseLeave={() => setHoveredMiscKey(null)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-surface)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-muted)',
                          flexShrink: 0,
                        }}
                      >
                        {row.key === 'guided_tour' ? (
                          <img src="/pointer.svg" width={16} height={16} alt="" style={{ display: 'block' }} />
                        ) : row.key === 'shortcuts' ? (
                          <img src="/%EF%A3%BF.svg" alt="" style={{ display: 'block' }} />
                        ) : row.key === 'guides' ? (
                          <img src="/document.svg" width={16} height={16} alt="" style={{ display: 'block' }} />
                        ) : row.key === 'feedback' ? (
                          <img src="/chat.svg" width={16} height={16} alt="" style={{ display: 'block' }} />
                        ) : row.key === 'adaptive' ? (
                          theme === 'light' ? (
                            // sun icon (light UI)
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
                              <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1.1 1.1M11.9 11.9L13 13M3 13l1.1-1.1M11.9 4.1L13 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          ) : (
                            // moon icon (dark UI)
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M13.5 9.05A6 6 0 1 1 6.95 2.5 4.7 4.7 0 0 0 13.5 9.05z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )
                        ) : null}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {row.label}
                      </div>
                    </div>
                    <div style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: hoveredMiscKey === row.key ? 1 : 0, transition: 'opacity 100ms ease', color: 'var(--text-muted)' }}>
                      {row.key === 'adaptive' ? (
                        <ArrowsLoopIcon />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hidden dev-only bits (kept for later) */}
          {false && (
            <div style={{ padding: 12 }}>
              loadingProgress: {loadingProgress}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes helperPopoverIn {
          0% {
            transform: translateY(10px) scale(0.92);
            opacity: 0;
          }
          60% {
            transform: translateY(0px) scale(1.02);
            opacity: 1;
          }
          100% {
            transform: translateY(0px) scale(1);
            opacity: 1;
          }
        }

        @keyframes helperSlideOut {
          0% {
            opacity: 1;
            transform: translateY(0px);
          }
          100% {
            opacity: 0;
            transform: translateY(-12px);
          }
        }

        @keyframes helperSlideIn {
          0% {
            opacity: 0;
            transform: translateY(12px);
          }
          100% {
            opacity: 1;
            transform: translateY(0px);
          }
        }
      `}</style>
    </div>
  );
}

