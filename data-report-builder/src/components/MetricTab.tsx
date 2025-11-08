'use client';
import { useApp, actions } from '@/state/app';
import { MetricOp, MetricType } from '@/types';
import { getFieldLabel } from '@/data/schema';

export function MetricTab() {
  const { state, dispatch } = useApp();

  const metricOps: { value: MetricOp; label: string; description: string }[] = [
    { value: 'sum', label: 'Sum', description: 'Total of all values' },
    { value: 'avg', label: 'Average', description: 'Mean of all values' },
    { value: 'median', label: 'Median', description: 'Middle value when sorted' },
    { value: 'mode', label: 'Mode', description: 'Most frequent value' },
    { value: 'count', label: 'Count', description: 'Number of records' },
    { value: 'distinct_count', label: 'Distinct Count', description: 'Number of unique values' },
  ];

  const metricTypes: { value: MetricType; label: string; description: string }[] = [
    {
      value: 'sum_over_period',
      label: 'Sum over period',
      description: 'Sum values within each bucket, total across all buckets'
    },
    {
      value: 'average_over_period',
      label: 'Average over period',
      description: 'Average values within each bucket, mean across all buckets'
    },
    {
      value: 'latest',
      label: 'Latest value',
      description: 'Snapshot at end of each bucket/range'
    },
    {
      value: 'first',
      label: 'First value',
      description: 'Snapshot at start of each bucket/range'
    },
  ];

  // Build list of qualified field names from selected fields
  const fieldOptions = state.selectedFields.map((field) => ({
    value: `${field.object}.${field.field}`,
    label: `${field.object}.${field.field}`,
    plainName: getFieldLabel(field.object, field.field),
    object: field.object,
    field: field.field,
  }));

  // Current source as qualified string
  const currentSourceValue = state.metric.source
    ? `${state.metric.source.object}.${state.metric.source.field}`
    : '';

  const handleSourceChange = (value: string) => {
    if (!value) {
      dispatch(actions.setMetricSource(undefined));
      return;
    }

    const selected = fieldOptions.find((opt) => opt.value === value);
    if (selected) {
      dispatch(actions.setMetricSource({
        object: selected.object,
        field: selected.field,
      }));
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Metric Name */}
      <div>
        <label htmlFor="metric-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Metric Name
        </label>
        <input
          id="metric-name"
          type="text"
          value={state.metric.name}
          onChange={(e) => dispatch(actions.setMetricName(e.target.value))}
          className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
          style={{ 
            borderColor: 'var(--border-default)',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#675DFF';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border-default)';
          }}
          placeholder="Enter metric name"
        />
      </div>

      {/* Source Field */}
      <div>
        <label htmlFor="metric-source" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Source Field
        </label>
        <select
          id="metric-source"
          value={currentSourceValue}
          onChange={(e) => handleSourceChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none"
          style={{ 
            borderColor: 'var(--border-default)',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#675DFF';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border-default)';
          }}
          disabled={fieldOptions.length === 0}
        >
          <option value="">— Select a field —</option>
          {fieldOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.plainName}
            </option>
          ))}
        </select>
        {fieldOptions.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            No fields selected. Go to the Data tab to select fields.
          </p>
        )}
      </div>

      {/* Operation */}
      <div>
        <label htmlFor="metric-op" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Operation
        </label>
        <select
          id="metric-op"
          value={state.metric.op}
          onChange={(e) => dispatch(actions.setMetricOp(e.target.value as MetricOp))}
          className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none"
          style={{ 
            borderColor: 'var(--border-default)',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#675DFF';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border-default)';
          }}
        >
          {metricOps.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {metricOps.find(op => op.value === state.metric.op)?.description}
        </p>
      </div>

      {/* Type (Aggregation Basis) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Type (Aggregation Basis)
        </label>
        <div className="space-y-2">
          {metricTypes.map((option) => (
            <label
              key={option.value}
              className="flex items-start gap-2 cursor-pointer p-2 rounded transition-colors"
              style={{
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <input
                type="radio"
                name="metric-type"
                value={option.value}
                checked={state.metric.type === option.value}
                onChange={(e) => dispatch(actions.setMetricType(e.target.value as MetricType))}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {option.label}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {option.description}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Helper Text */}
      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          <strong>Operation</strong> determines how values are computed within each bucket.
          <strong className="ml-1">Type</strong> determines how bucket values are aggregated over time.
        </p>
      </div>
    </div>
  );
}
