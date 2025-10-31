'use client';
import { useApp, actions, ChartType, XSourceMode, YSourceMode, Comparison } from '@/state/app';
import { useMemo } from 'react';
import schema from '@/data/schema';

export function ChartTab() {
  const { state, dispatch } = useApp();

  const chartTypes: { value: ChartType; label: string }[] = [
    { value: 'line', label: 'Line' },
    { value: 'area', label: 'Area' },
    { value: 'bar', label: 'Bar' },
  ];

  const comparisonOptions: { value: Comparison; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'period_start', label: 'Period Start Baseline' },
    { value: 'previous_period', label: 'Previous Period' },
    { value: 'previous_year', label: 'Previous Year' },
  ];

  // Filter timestamp-like fields for X axis
  const xAxisFields = useMemo(() => {
    return state.selectedFields.filter(({ object, field }) => {
      // Find field in schema
      const schemaObj = schema.objects.find(o => o.name === object);
      if (!schemaObj) return false;
      const schemaField = schemaObj.fields.find(f => f.name === field);
      if (!schemaField) return false;

      // Include if type is 'date' or field name includes 'created' or 'date'
      return schemaField.type === 'date' ||
             field.toLowerCase().includes('created') ||
             field.toLowerCase().includes('date');
    });
  }, [state.selectedFields]);

  // Filter numeric fields for Y axis
  const yAxisFields = useMemo(() => {
    return state.selectedFields.filter(({ object, field }) => {
      const schemaObj = schema.objects.find(o => o.name === object);
      if (!schemaObj) return false;
      const schemaField = schemaObj.fields.find(f => f.name === field);
      if (!schemaField) return false;

      return schemaField.type === 'number';
    });
  }, [state.selectedFields]);

  // Current X source as qualified string
  const currentXSourceValue = state.chart.xSource
    ? `${state.chart.xSource.object}.${state.chart.xSource.field}`
    : '';

  // Current Y field as qualified string
  const currentYFieldValue = state.chart.yField
    ? `${state.chart.yField.object}.${state.chart.yField.field}`
    : '';

  const handleXSourceChange = (value: string) => {
    if (!value) {
      dispatch(actions.setXSource(undefined));
      return;
    }

    const [object, field] = value.split('.');
    dispatch(actions.setXSource({ object, field }));
  };

  const handleYFieldChange = (value: string) => {
    if (!value) {
      dispatch(actions.setYField(undefined));
      return;
    }

    const [object, field] = value.split('.');
    dispatch(actions.setYField({ object, field }));
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Chart Type */}
      <div>
        <label htmlFor="chart-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Chart Type
        </label>
        <select
          id="chart-type"
          value={state.chart.type}
          onChange={(e) => dispatch(actions.setChartType(e.target.value as ChartType))}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {chartTypes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* X Axis Source */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          X Axis Source
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="x-source-mode"
              value="time"
              checked={state.chart.xSourceMode === 'time'}
              onChange={(e) => dispatch(actions.setXSourceMode(e.target.value as XSourceMode))}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-800 dark:text-gray-200">Time</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="x-source-mode"
              value="field"
              checked={state.chart.xSourceMode === 'field'}
              onChange={(e) => dispatch(actions.setXSourceMode(e.target.value as XSourceMode))}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-800 dark:text-gray-200">Choose a field</span>
          </label>
        </div>
      </div>

      {/* X Field Selector (when mode is 'field') */}
      {state.chart.xSourceMode === 'field' && (
        <div>
          <label htmlFor="x-source" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            X Axis Field
          </label>
          <select
            id="x-source"
            value={currentXSourceValue}
            onChange={(e) => handleXSourceChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={xAxisFields.length === 0}
          >
            <option value="">— Select a timestamp field —</option>
            {xAxisFields.map((field) => (
              <option key={`${field.object}.${field.field}`} value={`${field.object}.${field.field}`}>
                {field.object}.{field.field}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Override time axis with a selected timestamp field
          </p>
        </div>
      )}

      {/* Y Axis Source */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Y Axis Source
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="y-source-mode"
              value="metric"
              checked={state.chart.ySourceMode === 'metric'}
              onChange={(e) => dispatch(actions.setYSourceMode(e.target.value as YSourceMode))}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-800 dark:text-gray-200">Metric</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="y-source-mode"
              value="field"
              checked={state.chart.ySourceMode === 'field'}
              onChange={(e) => dispatch(actions.setYSourceMode(e.target.value as YSourceMode))}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-800 dark:text-gray-200">Choose a field</span>
          </label>
        </div>
      </div>

      {/* Y Field Selector (when mode is 'field') */}
      {state.chart.ySourceMode === 'field' && (
        <div>
          <label htmlFor="y-field" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Y Axis Field
          </label>
          <select
            id="y-field"
            value={currentYFieldValue}
            onChange={(e) => handleYFieldChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={yAxisFields.length === 0}
          >
            <option value="">— Select a numeric field —</option>
            {yAxisFields.map((field) => (
              <option key={`${field.object}.${field.field}`} value={`${field.object}.${field.field}`}>
                {field.object}.{field.field}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Uses current Metric Operation + Type to aggregate this field
          </p>
        </div>
      )}

      {/* Comparison */}
      <div>
        <label htmlFor="comparison" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Comparison
        </label>
        <select
          id="comparison"
          value={state.chart.comparison}
          onChange={(e) => dispatch(actions.setComparison(e.target.value as Comparison))}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {comparisonOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Comparison Modes</h4>
        <dl className="space-y-2 text-xs">
          <div>
            <dt className="font-medium text-gray-700 dark:text-gray-300">Period Start Baseline</dt>
            <dd className="text-gray-500 dark:text-gray-400">Compare current value to the first bucket in the period</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-700 dark:text-gray-300">Previous Period</dt>
            <dd className="text-gray-500 dark:text-gray-400">Compare with the previous bucket (e.g., last month)</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-700 dark:text-gray-300">Previous Year</dt>
            <dd className="text-gray-500 dark:text-gray-400">Compare with the same bucket one year ago</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
