'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '@/state/app';
import { useWarehouseStore } from '@/lib/useWarehouse';
import { computeMetric } from '@/lib/metrics';
import { computeFormula } from '@/lib/formulaMetrics';
import { buildDataListView } from '@/lib/views';
import { applyFilters } from '@/lib/filters';
import schema from '@/data/schema';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { currency, number as formatNumber } from '@/lib/format';

type View = 'main' | 'ownership' | 'visibility' | 'groups';

type SavePopoverProps = {
  isOpen: boolean;
  onClose: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  onSave: () => void;
};

export function SavePopover({ isOpen, onClose, buttonRef, onSave }: SavePopoverProps) {
  const { state } = useApp();
  const warehouse = useWarehouseStore();
  
  const [view, setView] = useState<View>('main');
  const [metricName, setMetricName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [owners, setOwners] = useState<string[]>([]);
  const [ownerInput, setOwnerInput] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'operations' | 'company'>('private');
  const [selectedGroups, setSelectedGroups] = useState<string[]>(['Drafts']);
  const [cohortEnabled, setCohortEnabled] = useState(false);
  const [cohortType, setCohortType] = useState<'updated' | 'fixed'>('updated');
  const [linkCopied, setLinkCopied] = useState(false);
  
  const popoverRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Always use formula system now (blocks always exist, single block = simple metric)
  const useFormula = true;

  // Set default metric name from metric name or label
  useEffect(() => {
    if (isOpen && !metricName) {
      const label = useFormula 
        ? (state.metricFormula.name || 'Untitled metric')
        : (state.metric.name || 'Untitled metric');
      setMetricName(label);
    }
  }, [isOpen, metricName, state.metric.name, useFormula, state.metricFormula.name]);

  // Focus name input when editing
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
        setView('main');
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        onClose();
        setView('main');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, buttonRef]);

  // Build PK include set from field filters (same logic as MetricHeader)
  const includeSet = useMemo(() => {
    if (state.filters.conditions.length > 0 && state.selectedObjects.length > 0 && state.selectedFields.length > 0) {
      const rawRows = buildDataListView({
        store: warehouse.store,
        selectedObjects: state.selectedObjects,
        selectedFields: state.selectedFields,
      });
      
      const filteredRows = applyFilters(rawRows, state.filters);
      return new Set(filteredRows.map(row => `${row.pk.object}:${row.pk.id}`));
    }
    
    return undefined;
  }, [state.filters, state.selectedObjects, state.selectedFields, warehouse.store]);

  // Calculate metric data for sparkline - supports both legacy and multi-block
  const { chartData, currentValue, comparisonValue, comparisonPercentage } = useMemo(() => {
    if (!warehouse.store || Object.keys(warehouse.store).length === 0 || state.selectedFields.length === 0) {
      return { chartData: [], currentValue: 0, comparisonValue: null, comparisonPercentage: null };
    }

    let result;
    if (useFormula) {
      // Use multi-block formula system
      const { result: formulaResult } = computeFormula({
        formula: state.metricFormula,
        start: state.start,
        end: state.end,
        granularity: state.granularity,
        store: warehouse.store,
        schema,
        selectedObjects: state.selectedObjects,
        selectedFields: state.selectedFields,
      });
      result = formulaResult;
    } else {
      // Use legacy single-metric system
      result = computeMetric({
        def: state.metric,
        start: state.start,
        end: state.end,
        granularity: state.granularity,
        store: warehouse.store,
        include: includeSet,
        schema,
        objects: state.selectedObjects,
      });
    }

    // Get last value as current
    const current = result.series && result.series.length > 0 ? result.series[result.series.length - 1].value : 0;
    
    // Calculate comparison if enabled
    let comparisonChange = null;
    let comparisonPercentage = null;
    if (state.chart.comparison !== 'none' && result.series && result.series.length > 1) {
      const previous = result.series[result.series.length - 2].value;
      if (previous !== 0) {
        const change = current - previous;
        const percentage = ((change) / Math.abs(previous)) * 100;
        comparisonChange = change;
        comparisonPercentage = percentage;
      }
    }

    return {
      chartData: result.series || [],
      currentValue: current,
      comparisonValue: comparisonChange,
      comparisonPercentage: comparisonPercentage,
    };
  }, [useFormula, state.metricFormula, warehouse.store, warehouse.version, state.selectedFields, state.metric, state.start, state.end, state.granularity, state.selectedObjects, state.chart.comparison, includeSet]);

  // Handle owner chip input
  const handleOwnerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Tab' || e.key === ',') && ownerInput.trim()) {
      e.preventDefault();
      setOwners([...owners, ownerInput.trim()]);
      setOwnerInput('');
    }
  };

  const removeOwner = (index: number) => {
    setOwners(owners.filter((_, i) => i !== index));
  };

  const handleCopyLink = () => {
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleSave = () => {
    onSave();
    onClose();
    setView('main');
  };

  const toggleGroup = (group: string) => {
    setSelectedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  if (!isOpen) return null;

  const visibilityLabel = visibility === 'private' ? 'Private to you' :
                         visibility === 'operations' ? 'Anyone in Operations' :
                         'Anyone at the company';

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 animate-fadeIn"
      style={{
        top: buttonRef.current ? buttonRef.current.offsetHeight + 8 : 60,
        right: 0,
        width: '400px',
        backgroundColor: 'var(--bg-elevated)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-popover)',
      }}
    >
      {view === 'main' && (
        <>
          {/* Heading */}
          <div style={{ padding: '16px 16px 0 16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {state.report === 'blank' ? 'Save metric' : 'Duplicate metric'}
            </h2>
          </div>

          {/* Metric Preview Widget - Full Width */}
          <div style={{ padding: '16px' }}>
            <div style={{ 
              backgroundColor: 'var(--bg-surface)', 
              padding: '16px', 
              borderRadius: '8px'
            }}>
              {/* Metric Title (editable label shows here, updates as user types) */}
              <div style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-primary)' }}>
                {metricName}
              </div>

              {/* Value and Comparison */}
              <div className="flex items-end gap-2 mb-3">
                <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {/* For multi-block, always use currency formatting; for single-metric, check operation */}
                  {useFormula || (!useFormula && state.metric.op !== 'count' && state.metric.op !== 'distinct_count')
                    ? currency(currentValue)
                    : formatNumber(currentValue)}
                </div>
                {comparisonValue !== null && (
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: comparisonValue >= 0 ? 'var(--color-positive)' : 'var(--color-negative)',
                      display: 'flex',
                      gap: '4px',
                      alignItems: 'baseline',
                    }}
                  >
                    <span>
                      {comparisonValue >= 0 ? '+' : ''}{useFormula || (!useFormula && state.metric.op !== 'count' && state.metric.op !== 'distinct_count')
                        ? currency(comparisonValue)
                        : formatNumber(comparisonValue)}
                    </span>
                    {comparisonPercentage !== null && (
                      <span>({comparisonPercentage >= 0 ? '+' : ''}{comparisonPercentage.toFixed(2)}%)</span>
                    )}
                  </div>
                )}
              </div>

              {/* Chart */}
              {chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={50}>
                  {state.chart.type === 'line' ? (
                    <LineChart data={chartData}>
                      <YAxis hide domain={[0, 'dataMax']} />
                      <ReferenceLine y={0} stroke="var(--chart-grid)" strokeWidth={1} strokeDasharray="3 3" />
                      <Line
                        type="linear"
                        dataKey="value"
                        stroke="var(--chart-line-primary)"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  ) : state.chart.type === 'area' ? (
                    <AreaChart data={chartData}>
                      <YAxis hide domain={[0, 'dataMax']} />
                      <ReferenceLine y={0} stroke="var(--chart-grid)" strokeWidth={1} strokeDasharray="3 3" />
                      <Area
                        type="linear"
                        dataKey="value"
                        stroke="var(--chart-line-primary)"
                        fill="var(--chart-area-fill)"
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  ) : (
                    <BarChart data={chartData}>
                      <YAxis hide domain={[0, 'dataMax']} />
                      <ReferenceLine y={0} stroke="var(--chart-grid)" strokeWidth={1} strokeDasharray="3 3" />
                      <Bar dataKey="value" fill="var(--chart-line-primary)" isAnimationActive={false} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Editable Metric Title - Below Widget */}
          <div style={{ paddingLeft: '16px', paddingRight: '16px', paddingBottom: '16px' }}>
            <div 
              className="flex items-center justify-between"
              onClick={() => !isEditingName && setIsEditingName(true)}
              style={{
                cursor: isEditingName ? 'default' : 'pointer',
                borderRadius: '6px',
                padding: '8px',
                marginLeft: '-8px',
                marginRight: '-8px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isEditingName) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {isEditingName ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  value={metricName}
                  onChange={(e) => setMetricName(e.target.value)}
                  onBlur={() => setIsEditingName(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditingName(false);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    fontSize: '14px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                  }}
                  autoFocus
                />
              ) : (
                <>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>
                    {metricName}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingName(true);
                    }}
                    className="p-1 rounded"
                    style={{ cursor: 'pointer' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M10.5 1.5L12.5 3.5L4.5 11.5H2.5V9.5L10.5 1.5Z"
                        stroke="var(--text-secondary)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {/* Visibility and Version */}
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              {visibilityLabel}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Version 1
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: 'var(--border-default)' }} />

          {/* Options List */}
          <div style={{ padding: '8px' }}>
            <button
              onClick={() => setView('ownership')}
              className="w-full flex items-center justify-between transition-colors rounded-lg"
              style={{ cursor: 'pointer', height: '28px', paddingLeft: '8px', paddingRight: '8px', marginBottom: '4px' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-primary)' }}>Owners (who can edit)</span>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-primary)' }}>You</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M6 4L10 8L6 12"
                    stroke="var(--text-secondary)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </button>

            <button
              onClick={() => setView('visibility')}
              className="w-full flex items-center justify-between transition-colors rounded-lg"
              style={{ cursor: 'pointer', height: '28px', paddingLeft: '8px', paddingRight: '8px', marginBottom: '4px' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-primary)' }}>Visibility</span>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-primary)' }}>{visibilityLabel}</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M6 4L10 8L6 12"
                    stroke="var(--text-secondary)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </button>

            <button
              onClick={() => setView('groups')}
              className="w-full flex items-center justify-between transition-colors rounded-lg"
              style={{ cursor: 'pointer', height: '28px', paddingLeft: '8px', paddingRight: '8px', marginBottom: '4px' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-primary)' }}>Add to groups</span>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-primary)' }}>
                  {selectedGroups.length > 0 ? selectedGroups.join(', ') : 'None'}
                </span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M6 4L10 8L6 12"
                    stroke="var(--text-secondary)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </button>

            <div 
              className="flex items-center justify-between rounded-lg transition-colors" 
              style={{ height: '28px', paddingLeft: '8px', paddingRight: '8px', marginBottom: '4px' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-primary)' }}>Publish as a cohort</span>
                <button
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title="Learn more about cohorts"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 7V11M8 5V5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => setCohortEnabled(!cohortEnabled)}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{
                  backgroundColor: cohortEnabled ? 'var(--button-primary-bg)' : 'var(--bg-surface)',
                }}
              >
                <span
                  className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                  style={{
                    transform: cohortEnabled ? 'translateX(1.5rem)' : 'translateX(0.25rem)',
                  }}
                />
              </button>
            </div>

            {cohortEnabled && (
              <div className="flex items-center justify-between rounded-lg" style={{ height: '28px', paddingLeft: '8px', paddingRight: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-primary)' }}>Cohort type</span>
                <select
                  value={cohortType}
                  onChange={(e) => setCohortType(e.target.value as 'updated' | 'fixed')}
                  style={{
                    fontSize: '14px',
                    fontWeight: 400,
                    padding: '4px 28px 4px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="updated">Updated</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: 'var(--border-default)' }} />

          {/* Action Buttons */}
          <div className="flex gap-2" style={{ padding: '16px' }}>
            <button
              onClick={handleCopyLink}
              className="flex-1 px-4 py-2 text-sm font-semibold rounded-md transition-colors"
              style={{
                backgroundColor: 'var(--button-secondary-bg)',
                color: 'var(--button-secondary-text)',
              }}
            >
              {linkCopied ? 'Link copied' : 'Copy link'}
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 text-sm font-semibold rounded-md transition-colors"
              style={{
                backgroundColor: 'var(--button-primary-bg)',
                color: 'var(--button-primary-text)',
              }}
            >
              {state.report === 'blank' ? 'Save and publish' : 'Duplicate and publish'}
            </button>
          </div>
        </>
      )}

      {view === 'ownership' && (
        <>
          <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <button
              onClick={() => setView('main')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 16L6 10L12 4"
                  stroke="var(--text-primary)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Owners (who can edit)
            </h3>
          </div>
          <div className="p-4">
            <div
              className="flex flex-wrap gap-2 p-2 border rounded-md"
              style={{
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'var(--bg-primary)',
                minHeight: '40px',
              }}
            >
              {owners.map((owner, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 px-2 py-1 rounded"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {owner}
                  <button
                    onClick={() => removeOwner(index)}
                    className="ml-1 hover:text-red-500"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
              <input
                type="text"
                value={ownerInput}
                onChange={(e) => setOwnerInput(e.target.value)}
                onKeyDown={handleOwnerKeyDown}
                placeholder="Add email address..."
                className="flex-1 min-w-[150px] outline-none"
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              />
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Press Tab or comma to add multiple editors
            </p>
          </div>
        </>
      )}

      {view === 'visibility' && (
        <>
          <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <button
              onClick={() => setView('main')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 16L6 10L12 4"
                  stroke="var(--text-primary)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Visibility
            </h3>
          </div>
          <div className="p-4 space-y-2">
            {(['private', 'operations', 'company'] as const).map((option) => (
              <label
                key={option}
                className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                <input
                  type="radio"
                  name="visibility"
                  value={option}
                  checked={visibility === option}
                  onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                  className="w-4 h-4"
                />
                <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                  {option === 'private' ? 'Private to you' :
                   option === 'operations' ? 'Anyone in Operations' :
                   'Anyone at the company'}
                </span>
              </label>
            ))}
          </div>
        </>
      )}

      {view === 'groups' && (
        <>
          <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <button
              onClick={() => setView('main')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 16L6 10L12 4"
                  stroke="var(--text-primary)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Add to groups
            </h3>
          </div>
          <div className="p-4 space-y-2">
            {['Starred', 'Churn', 'New subscriber performance', 'Drafts'].map((group) => (
              <label
                key={group}
                className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedGroups.includes(group)}
                  onChange={() => toggleGroup(group)}
                  className="w-4 h-4"
                />
                <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                  {group}
                </span>
              </label>
            ))}
            <button
              className="w-full text-left p-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
              style={{ fontSize: '14px', color: 'var(--text-link)' }}
            >
              + Create a new group
            </button>
          </div>
        </>
      )}
    </div>
  );
}

