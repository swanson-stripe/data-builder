'use client';

import { useState } from 'react';
import { useMapView, mapActions } from '@/state/mapView';
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

/**
 * MapConfigPanel - Left-side configuration panel with icon menu
 */
export function MapConfigPanel() {
  const { state, dispatch } = useMapView();
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const { processCommand, isLoading } = useMapAI();

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
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    marginBottom: '12px',
                    color: 'var(--text-primary)',
                  }}
                >
                  Keyboard Shortcuts
                </h3>
                <div className="flex flex-col gap-2" style={{ fontSize: '13px' }}>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Delete element</span>
                    <code
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      Backspace
                    </code>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Deselect</span>
                    <code
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      Esc
                    </code>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Zoom in</span>
                    <code
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      Cmd/Ctrl +
                    </code>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Zoom out</span>
                    <code
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      Cmd/Ctrl -
                    </code>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

