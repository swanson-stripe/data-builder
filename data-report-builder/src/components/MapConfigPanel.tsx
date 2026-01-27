'use client';

import { useState } from 'react';
import { useMapView, mapActions } from '@/state/mapView';
import { useTheme } from '@/state/theme';
import {
  createDataListElement,
  createChartElement,
  createFilterElement,
  createGroupingElement,
  createMetricElement,
  createSQLQueryElement,
  generateConnectionId,
} from '@/lib/mapElementCreation';
import { useMapAI } from '@/lib/useMapAI';

type PanelSection = 'new' | 'chat' | 'templates' | 'helper' | null;
type HelperView = 'default' | 'feedback' | 'shortcuts' | 'guides' | 'improvement';

/**
 * MapConfigPanel - Left-side configuration panel with icon menu
 */
export function MapConfigPanel() {
  const { state, dispatch } = useMapView();
  const { theme, mode, cycleMode } = useTheme();
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const { processCommand, isLoading } = useMapAI();
  const [hoveredMiscKey, setHoveredMiscKey] = useState<string | null>(null);
  const [hoveredImprovementTitle, setHoveredImprovementTitle] = useState<string | null>(null);
  const [helperView, setHelperView] = useState<HelperView>('default');
  const [feedbackText, setFeedbackText] = useState('');

  const modeLabel = mode === 'adaptive' ? 'adaptive' : mode === 'light' ? 'light' : 'dark';
  const themeRowLabel = `Using ${modeLabel} theme`;

  const requestSwitchHelperView = (next: HelperView) => {
    setHelperView(next);
  };

  const handleIconClick = (section: PanelSection) => {
    if (state.activePanelSection === section) {
      // Close if already open
      dispatch(mapActions.setActivePanelSection(null));
    } else {
      dispatch(mapActions.setActivePanelSection(section));
    }
  };

  const handleAddElement = (elementType: string) => {
    let newElement;
    
    switch (elementType) {
      case 'field':
        newElement = createDataListElement(state.elements);
        break;
      case 'chart':
        newElement = createChartElement(state.elements);
        break;
      case 'filter':
        // Filter requires a parent - use first DataList if exists
        const firstDataList = state.elements.find(el => el.type === 'dataList');
        if (firstDataList) {
          newElement = createFilterElement(state.elements, firstDataList.id);
          // Also create connection
          const connection = {
            id: generateConnectionId(firstDataList.id, newElement.id),
            source: firstDataList.id,
            target: newElement.id,
          };
          dispatch(mapActions.addConnection(connection));
        } else {
          // Create a DataList first if none exists
          const dataList = createDataListElement(state.elements);
          dispatch(mapActions.addElement(dataList));
          newElement = createFilterElement([...state.elements, dataList], dataList.id);
          const connection = {
            id: generateConnectionId(dataList.id, newElement.id),
            source: dataList.id,
            target: newElement.id,
          };
          dispatch(mapActions.addConnection(connection));
        }
        break;
      case 'grouping':
        const dataListForGroup = state.elements.find(el => el.type === 'dataList');
        if (dataListForGroup) {
          newElement = createGroupingElement(state.elements, dataListForGroup.id);
        } else {
          const dataList = createDataListElement(state.elements);
          dispatch(mapActions.addElement(dataList));
          newElement = createGroupingElement([...state.elements, dataList], dataList.id);
        }
        break;
      case 'metric':
        newElement = createMetricElement(state.elements);
        break;
      case 'sql':
        newElement = createSQLQueryElement(state.elements);
        break;
      default:
        return;
    }
    
    if (newElement) {
      dispatch(mapActions.addElement(newElement));
      dispatch(mapActions.selectElement(newElement.id));
    }
  };

  const handleAIChatSubmit = async () => {
    if (!chatInput.trim() || isLoading) return;

    const result = await processCommand(chatInput, state.elements);
    
    // Add new elements and connections
    if (result.newElements) {
      result.newElements.forEach((element) => {
        dispatch(mapActions.addElement(element));
      });
    }
    if (result.newConnections) {
      result.newConnections.forEach((connection) => {
        dispatch(mapActions.addConnection(connection));
      });
    }

    // Show response
    setChatResponse(result.message);
    setChatInput('');
  };

  const menuItems = [
    {
      id: 'new',
      label: 'New',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 4V16M4 10H16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      id: 'chat',
      label: 'Chat with AI',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M17 9C17 13.4183 13.4183 17 9 17C7.72842 17 6.53028 16.6906 5.47672 16.1412L3 17L3.85882 14.5233C3.30941 13.4697 3 12.2716 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      id: 'templates',
      label: 'Templates',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect
            x="3"
            y="3"
            width="6"
            height="6"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="11"
            y="3"
            width="6"
            height="6"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="3"
            y="11"
            width="6"
            height="6"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="11"
            y="11"
            width="6"
            height="6"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      ),
    },
    {
      id: 'helper',
      label: 'Helper',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M10 14V14.01M10 11C10 9.89543 10.8954 9 12 9C13.1046 9 14 9.89543 14 11C14 11.7403 13.5978 12.3866 13 12.7324C12.4022 13.0781 12 13.5344 12 14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="flex flex-shrink-0 transition-all"
      style={{
        width: state.isPanelExpanded ? '320px' : '64px',
        borderRight: '1px solid var(--border-default)',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* Icon Menu */}
      <div
        className="flex flex-col gap-2 p-3"
        style={{
          width: '64px',
          flexShrink: 0,
          borderRight: state.isPanelExpanded ? '1px solid var(--border-subtle)' : 'none',
        }}
      >
        {menuItems.map((item) => {
          const isActive = state.activePanelSection === item.id;
          const isHovered = hoveredIcon === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleIconClick(item.id as PanelSection)}
              onMouseEnter={() => setHoveredIcon(item.id)}
              onMouseLeave={() => setHoveredIcon(null)}
              className="relative flex items-center justify-center transition-all"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: isActive
                  ? 'var(--bg-surface)'
                  : isHovered
                  ? 'var(--bg-surface)'
                  : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: isActive ? '1px solid var(--border-default)' : '1px solid transparent',
                cursor: 'pointer',
              }}
              aria-label={item.label}
              aria-pressed={isActive}
            >
              {item.icon}

              {/* Tooltip on hover */}
              {isHovered && !state.isPanelExpanded && (
                <div
                  className="absolute left-full ml-2 px-2 py-1 whitespace-nowrap pointer-events-none z-50"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Expanded Panel Content */}
      {state.isPanelExpanded && (
        <div className="flex-1 p-4 overflow-y-auto">
          {/* Close button */}
          <button
            onClick={() => dispatch(mapActions.setActivePanelSection(null))}
            className="absolute top-3 right-3 flex items-center justify-center transition-colors"
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Close panel"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>

          {/* Panel Content Based on Active Section */}
          <div style={{ marginTop: '32px' }}>
            {state.activePanelSection === 'new' && (
              <div>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    marginBottom: '12px',
                    color: 'var(--text-primary)',
                  }}
                >
                  Add to Canvas
                </h3>
                <div className="flex flex-col gap-2">
                  {[
                    { id: 'field', label: 'Field', icon: '📊' },
                    { id: 'chart', label: 'Chart', icon: '📈' },
                    { id: 'filter', label: 'Filter', icon: '🔍' },
                    { id: 'grouping', label: 'Grouping', icon: '📁' },
                    { id: 'metric', label: 'Metric', icon: '🔢' },
                    { id: 'sql', label: 'SQL Query', icon: '💾' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleAddElement(option.id)}
                      className="flex items-center gap-3 p-3 transition-colors text-left"
                      style={{
                        borderRadius: '8px',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                        e.currentTarget.style.borderColor = 'var(--border-default)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>{option.icon}</span>
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {state.activePanelSection === 'chat' && (
              <div>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    marginBottom: '12px',
                    color: 'var(--text-primary)',
                  }}
                >
                  AI Assistant
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Ask me to add elements or modify your workflow.
                </p>

                {/* Response display */}
                {chatResponse && (
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-surface)',
                      marginBottom: '16px',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {chatResponse}
                  </div>
                )}

                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleAIChatSubmit();
                    }
                  }}
                  placeholder="E.g., 'Add a chart showing revenue over time'"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
                <button
                  onClick={handleAIChatSubmit}
                  disabled={isLoading || !chatInput.trim()}
                  style={{
                    marginTop: '12px',
                    width: '100%',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: isLoading || !chatInput.trim() ? 'var(--bg-surface)' : 'var(--button-primary-bg)',
                    color: isLoading || !chatInput.trim() ? 'var(--text-muted)' : 'var(--button-primary-text)',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: isLoading || !chatInput.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isLoading ? 'Processing...' : 'Send'}
                </button>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Tip: Press Cmd/Ctrl + Enter to send
                </p>
              </div>
            )}

            {state.activePanelSection === 'templates' && (
              <div>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    marginBottom: '12px',
                    color: 'var(--text-primary)',
                  }}
                >
                  Workflow Templates
                </h3>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    marginBottom: '16px',
                  }}
                >
                  Coming soon: Pre-built workflow patterns
                </p>
              </div>
            )}

            {state.activePanelSection === 'helper' && (
              <div>
                {helperView === 'feedback' ? (
                  <div>
                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <button
                        type="button"
                        onClick={() => requestSwitchHelperView('default')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          padding: 0,
                          cursor: 'pointer',
                          color: 'var(--text-primary)',
                        }}
                        aria-label="Back"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Share feedback
                        </div>
                      </button>
                      <div style={{ width: '1px', height: '1px' }} />
                    </div>

                    <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', marginLeft: '-16px', marginRight: '-16px' }} />

                    <textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Share what's working, what's missing, or what feels off…"
                      style={{
                        width: '100%',
                        marginTop: '12px',
                        height: '96px',
                        resize: 'none',
                        borderRadius: '10px',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-surface)',
                        padding: '10px 12px',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        lineHeight: 1.4,
                        outline: 'none',
                        transition: 'border-color 100ms ease, box-shadow 100ms ease',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--button-primary-bg)';
                        e.currentTarget.style.boxShadow = '0 0 0 1px var(--button-primary-bg)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />

                    <div style={{ height: '12px' }} />

                    <button
                      disabled={!feedbackText.trim()}
                      onClick={() => {
                        setFeedbackText('');
                        requestSwitchHelperView('default');
                      }}
                      style={{
                        width: '100%',
                        height: '36px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: feedbackText.trim() ? 'pointer' : 'not-allowed',
                        opacity: feedbackText.trim() ? 1 : 0.5,
                        transition: 'background-color 100ms ease, opacity 100ms ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!feedbackText.trim()) return;
                        e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                      }}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      Send to team
                    </button>
                  </div>
                ) : helperView === 'shortcuts' ? (
                  <div>
                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <button
                        type="button"
                        onClick={() => requestSwitchHelperView('default')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          padding: 0,
                          cursor: 'pointer',
                          color: 'var(--text-primary)',
                        }}
                        aria-label="Back"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Keyboard shortcuts
                        </div>
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>
                        <img src="/%EF%A3%BF.svg" alt="" style={{ display: 'block' }} />
                        Mac
                      </div>
                    </div>

                    <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', marginLeft: '-16px', marginRight: '-16px' }} />

                    <div style={{ paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[
                        { label: 'Delete element', keys: ['backspace'] },
                        { label: 'Deselect', keys: ['esc'] },
                      ].map((row) => (
                        <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                          <div style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-primary)' }}>
                            {row.label}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {row.keys.map((k, i) => {
                              const isSingleChar = String(k).length === 1;
                              return (
                                <div
                                  key={`${row.label}-${k}-${i}`}
                                  style={{
                                    height: '20px',
                                    width: isSingleChar ? '20px' : 'auto',
                                    minWidth: isSingleChar ? '20px' : '60px',
                                    paddingLeft: isSingleChar ? '0px' : '6px',
                                    paddingRight: isSingleChar ? '0px' : '6px',
                                    borderRadius: '8px',
                                    backgroundColor: 'color-mix(in srgb, var(--bg-surface) 70%, transparent)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-secondary)',
                                    fontSize: '12px',
                                    fontWeight: 400,
                                    lineHeight: '12px',
                                  }}
                                >
                                  {k}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : helperView === 'guides' ? (
                  <div>
                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <button
                        type="button"
                        onClick={() => requestSwitchHelperView('default')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          padding: 0,
                          cursor: 'pointer',
                          color: 'var(--text-primary)',
                        }}
                        aria-label="Back"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Quickstart guides
                        </div>
                      </button>
                      <div style={{ width: '1px', height: '1px' }} />
                    </div>

                    <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', marginLeft: '-16px', marginRight: '-16px' }} />

                    <div style={{ paddingTop: '12px', paddingBottom: '12px', fontSize: '14px', color: 'var(--text-muted)' }}>
                      Coming soon: Step-by-step guides for building reports
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Default helper view - Updates section */}
                    {/* Updates pill row */}
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
                    </div>

                    {/* Hero content (no container) */}
                    <>
                      <div
                        role="button"
                        tabIndex={0}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          padding: 0,
                          textAlign: 'left',
                          cursor: 'pointer',
                          outline: 'none',
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
                            type="button"
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

                    {/* Separator */}
                    <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', marginLeft: '-16px', marginRight: '-16px' }} />

                    {/* Recent improvements */}
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px' }}>
                        Recent improvements
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[
                          { title: 'Expanded visibility and sharing controls', date: 'Nov 14', thumb: '/vis.png' },
                          { title: 'Faster Assistant responses', date: 'Oct 28', thumb: '/assist.png' },
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
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Separator */}
                    <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', marginLeft: '-16px', marginRight: '-16px' }} />

                    {/* Misc section */}
                    <div>
                      {[
                        { key: 'adaptive', label: themeRowLabel, right: '' },
                        { key: 'guided_tour', label: 'Show guided tour', right: '' },
                        { key: 'shortcuts', label: 'View keyboard shortcuts', right: '' },
                        { key: 'guides', label: 'See quickstart guides', right: '' },
                        { key: 'feedback', label: 'Share feedback', right: '' },
                      ].map((row) => {
                        const isThemeRow = row.key === 'adaptive';
                        return (
                          <button
                            key={row.key}
                            onClick={() => {
                              if (isThemeRow) cycleMode();
                              if (row.key === 'feedback') requestSwitchHelperView('feedback');
                              if (row.key === 'shortcuts') requestSwitchHelperView('shortcuts');
                              if (row.key === 'guides') requestSwitchHelperView('guides');
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
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
                                      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1.1 1.1M11.9 11.9L13 13M3 13l1.1-1.1M11.9 4.1L13 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                    </svg>
                                  ) : (
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
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M12.8 8C12.8 8.21217 12.8841 8.41566 13.0343 8.56569C13.1843 8.71571 13.3878 8.8 13.6 8.8C13.8122 8.8 14.0157 8.71571 14.1657 8.56569C14.3159 8.41566 14.4 8.21217 14.4 8C14.4 4.4653 11.5347 1.6 8 1.6C4.46529 1.6 1.6 4.4653 1.6 8C1.6 11.5347 4.46529 14.4 8 14.4C8.21217 14.4 8.41566 14.3159 8.56569 14.1657C8.71571 14.0157 8.8 13.8122 8.8 13.6C8.8 13.3878 8.71571 13.1843 8.56569 13.0343C8.41566 12.8841 8.21217 12.8 8 12.8C5.34902 12.8 3.2 10.651 3.2 8C3.2 5.34903 5.34902 3.2 8 3.2C10.651 3.2 12.8 5.34903 12.8 8Z" fill="currentColor"/>
                                  <path d="M14.1657 11.4343C14.0157 11.2843 13.8122 11.2 13.6 11.2C13.3878 11.2 13.1843 11.2843 13.0343 11.4343C12.8841 11.5843 12.8 11.7878 12.8 12C12.8 12.2122 12.8841 12.4157 13.0343 12.5657C13.1843 12.7159 13.3878 12.8 13.6 12.8C13.8122 12.8 14.0157 12.7159 14.1657 12.5657C14.3159 12.4157 14.4 12.2122 14.4 12C14.4 11.7878 14.3159 11.5843 14.1657 11.4343Z" fill="currentColor"/>
                                </svg>
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
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

