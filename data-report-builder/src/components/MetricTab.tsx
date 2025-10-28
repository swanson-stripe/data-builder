'use client';
import { useApp, actions } from '@/state/app';
import { MetricOp, MetricScope } from '@/types';

export function MetricTab() {
  const { state, dispatch } = useApp();

  const metricOps: { value: MetricOp; label: string }[] = [
    { value: 'sum', label: 'Sum' },
    { value: 'avg', label: 'Average' },
    { value: 'latest', label: 'Latest' },
    { value: 'first', label: 'First' },
  ];

  const metricScopes: { value: MetricScope; label: string; description: string }[] = [
    {
      value: 'per_bucket',
      label: 'Per Bucket',
      description: 'Flow: Measure value at each time period'
    },
    {
      value: 'entire_period',
      label: 'Entire Period',
      description: 'Snapshot: Single aggregate across all periods'
    },
  ];

  // Build list of qualified field names from selected fields
  const fieldOptions = state.selectedFields.map((field) => ({
    value: `${field.object}.${field.field}`,
    label: `${field.object}.${field.field}`,
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
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={fieldOptions.length === 0}
        >
          <option value="">— Select a field —</option>
          {fieldOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
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
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {metricOps.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Scope */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Scope
        </label>
        <div className="space-y-2">
          {metricScopes.map((option) => (
            <label
              key={option.value}
              className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <input
                type="radio"
                name="metric-scope"
                value={option.value}
                checked={state.metric.scope === option.value}
                onChange={(e) => dispatch(actions.setMetricScope(e.target.value as MetricScope))}
                className="mt-0.5 text-blue-600 focus:ring-blue-500 focus:ring-2"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {option.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
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
          <strong>Per Bucket</strong> measures values at each time period (flow metrics like revenue, events).
          <strong className="ml-1">Entire Period</strong> aggregates all periods into a single value (snapshot metrics like total, average).
        </p>
      </div>
    </div>
  );
}
