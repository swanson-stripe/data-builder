'use client';

import { useState, useEffect, useMemo } from 'react';
import schema from '@/data/schema';
import { SchemaObject, SchemaField } from '@/types';

type SchemaDefinitionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedTable?: string;
  selectedField?: string;
};

type GroupedSchema = {
  [groupName: string]: SchemaObject[];
};

export function SchemaDefinitionModal({
  isOpen,
  onClose,
  selectedTable,
  selectedField,
}: SchemaDefinitionModalProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const [activeTable, setActiveTable] = useState<string | undefined>(selectedTable);
  const [activeField, setActiveField] = useState<string | undefined>(selectedField);

  // Group tables by their group property
  const groupedSchema: GroupedSchema = useMemo(() => {
    const groups: GroupedSchema = {};
    schema.objects.forEach((obj) => {
      const group = obj.group || 'Other';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(obj);
    });
    return groups;
  }, []);

  // Initialize expanded state based on selected table
  useEffect(() => {
    if (selectedTable) {
      setActiveTable(selectedTable);
      setActiveField(selectedField);

      // Find the group containing the selected table
      const tableObj = schema.objects.find((obj) => obj.name === selectedTable);
      if (tableObj) {
        const group = tableObj.group || 'Other';
        setExpandedGroups((prev) => ({ ...prev, [group]: true }));
        setExpandedTables((prev) => ({ ...prev, [selectedTable]: true }));
      }
    }
  }, [selectedTable, selectedField]);

  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const toggleTable = (tableName: string) => {
    setExpandedTables((prev) => ({ ...prev, [tableName]: !prev[tableName] }));
  };

  const handleTableClick = (tableName: string) => {
    setActiveTable(tableName);
    setActiveField(undefined);
  };

  const handleFieldClick = (tableName: string, fieldName: string) => {
    setActiveTable(tableName);
    setActiveField(fieldName);
  };

  const getFieldType = (type: string): string => {
    const typeMap: Record<string, string> = {
      id: 'VARCHAR',
      string: 'VARCHAR',
      number: 'NUMERIC',
      boolean: 'BOOLEAN',
      date: 'TIMESTAMP',
    };
    return typeMap[type] || 'VARCHAR';
  };

  const activeTableObj = schema.objects.find((obj) => obj.name === activeTable);
  const activeFieldObj = activeTableObj?.fields.find((field) => field.name === activeField);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '900px',
          maxHeight: '60vh',
          backgroundColor: 'var(--bg-elevated)',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Navigation Panel */}
        <div
          style={{
            width: '300px',
            borderRight: '1px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '20px',
              borderBottom: '1px solid var(--border-default)',
            }}
          >
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Schema Reference
            </h2>
          </div>

          {/* Navigation Tree */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
            }}
            className="custom-scrollbar"
          >
            {Object.entries(groupedSchema).map(([groupName, tables]) => (
              <div key={groupName} style={{ marginBottom: '8px' }}>
                {/* Group Header */}
                <div
                  onClick={() => toggleGroup(groupName)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = 'transparent')
                  }
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    style={{
                      transform: expandedGroups[groupName]
                        ? 'rotate(90deg)'
                        : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <path
                      d="M4.5 3L7.5 6L4.5 9"
                      stroke="var(--text-muted)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {groupName}
                  </span>
                </div>

                {/* Tables in Group */}
                {expandedGroups[groupName] &&
                  tables.map((table) => (
                    <div key={table.name} style={{ marginLeft: '12px' }}>
                      {/* Table Header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 8px',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          backgroundColor:
                            activeTable === table.name && !activeField
                              ? 'var(--bg-selected)'
                              : 'transparent',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (activeTable !== table.name || activeField) {
                            e.currentTarget.style.backgroundColor =
                              'var(--bg-surface)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (activeTable !== table.name || activeField) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                        onClick={() => {
                          toggleTable(table.name);
                          handleTableClick(table.name);
                        }}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          style={{
                            transform: expandedTables[table.name]
                              ? 'rotate(90deg)'
                              : 'rotate(0deg)',
                            transition: 'transform 0.2s',
                          }}
                        >
                          <path
                            d="M4.5 3L7.5 6L4.5 9"
                            stroke="var(--text-muted)"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                          />
                        </svg>
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: 500,
                            color:
                              activeTable === table.name && !activeField
                                ? '#675DFF'
                                : 'var(--text-primary)',
                          }}
                        >
                          {table.label}
                        </span>
                      </div>

                      {/* Fields in Table */}
                      {expandedTables[table.name] &&
                        table.fields.map((field) => (
                          <div
                            key={field.name}
                            onClick={() => handleFieldClick(table.name, field.name)}
                            style={{
                              marginLeft: '24px',
                              padding: '6px 8px',
                              cursor: 'pointer',
                              borderRadius: '6px',
                              backgroundColor:
                                activeTable === table.name &&
                                activeField === field.name
                                  ? 'var(--bg-selected)'
                                  : 'transparent',
                              transition: 'background-color 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              if (
                                activeTable !== table.name ||
                                activeField !== field.name
                              ) {
                                e.currentTarget.style.backgroundColor =
                                  'var(--bg-surface)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (
                                activeTable !== table.name ||
                                activeField !== field.name
                              ) {
                                e.currentTarget.style.backgroundColor =
                                  'transparent';
                              }
                            }}
                          >
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: 400,
                                color:
                                  activeTable === table.name &&
                                  activeField === field.name
                                    ? '#675DFF'
                                    : 'var(--text-secondary)',
                              }}
                            >
                              {field.label}
                            </span>
                          </div>
                        ))}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>

        {/* Right Content Panel */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '20px',
              borderBottom: '1px solid var(--border-default)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0,
                  marginBottom: '4px',
                }}
              >
                {activeField
                  ? activeFieldObj?.label || activeField
                  : activeTableObj?.label || activeTable}
              </h3>
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                }}
              >
                {activeField && activeFieldObj && (
                  <>
                    <span
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-muted)',
                        fontWeight: 500,
                      }}
                    >
                      {getFieldType(activeFieldObj.type)}
                    </span>
                    <span
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      •
                    </span>
                    <span
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {activeTableObj?.label}
                    </span>
                  </>
                )}
                {!activeField && activeTableObj && (
                  <>
                    <span
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {activeTableObj.group || 'Other'}
                    </span>
                    <span
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      •
                    </span>
                    <span
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {activeTableObj.fields.length} fields
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = 'transparent')
              }
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 4L4 12M4 4L12 12"
                  stroke="var(--text-muted)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
            }}
            className="custom-scrollbar"
          >
            {activeField && activeFieldObj ? (
              <div>
                <h4
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    margin: 0,
                    marginBottom: '12px',
                  }}
                >
                  Description
                </h4>
                <p
                  style={{
                    fontSize: '15px',
                    lineHeight: '1.6',
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}
                >
                  {activeFieldObj.definition ||
                    'No description available for this field.'}
                </p>
              </div>
            ) : activeTableObj ? (
              <div>
                <h4
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    margin: 0,
                    marginBottom: '12px',
                  }}
                >
                  Description
                </h4>
                <p
                  style={{
                    fontSize: '15px',
                    lineHeight: '1.6',
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}
                >
                  {activeTableObj.definition ||
                    'No description available for this table.'}
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--text-muted)',
                  fontSize: '14px',
                }}
              >
                Select a table or field to view its definition
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

