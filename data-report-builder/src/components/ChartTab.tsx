'use client';
import { useApp, actions, ChartType, XSourceMode, YSourceMode, Comparison } from '@/state/app';
import { useMemo } from 'react';
import schema, { getFieldLabel } from '@/data/schema';
import { CustomSelect } from './CustomSelect';

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
    // Collect fields from both selectedFields and metric blocks
    const allFields = [...state.selectedFields];
    
    // Add fields from metric blocks that aren't already in selectedFields
    state.metricFormula.blocks.forEach(block => {
      if (block.source) {
        const exists = allFields.some(f => 
          f.object === block.source!.object && f.field === block.source!.field
        );
        if (!exists) {
          allFields.push({ object: block.source.object, field: block.source.field });
        }
      }
    });
    
    return allFields.filter(({ object, field }) => {
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
  }, [state.selectedFields, state.metricFormula.blocks]);

  // Filter numeric fields for Y axis
  const yAxisFields = useMemo(() => {
    // Collect fields from both selectedFields and metric blocks
    const allFields = [...state.selectedFields];
    
    // Add fields from metric blocks that aren't already in selectedFields
    state.metricFormula.blocks.forEach(block => {
      if (block.source) {
        const exists = allFields.some(f => 
          f.object === block.source!.object && f.field === block.source!.field
        );
        if (!exists) {
          allFields.push({ object: block.source.object, field: block.source.field });
        }
      }
    });
    
    return allFields.filter(({ object, field }) => {
      const schemaObj = schema.objects.find(o => o.name === object);
      if (!schemaObj) return false;
      const schemaField = schemaObj.fields.find(f => f.name === field);
      if (!schemaField) return false;

      return schemaField.type === 'number';
    });
  }, [state.selectedFields, state.metricFormula.blocks]);

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
    <div className="flex flex-col h-full space-y-4" style={{ paddingTop: '20px' }}>
      {/* Chart Type */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          Chart Type
        </label>
        <CustomSelect
          value={state.chart.type}
          onChange={(value) => dispatch(actions.setChartType(value as ChartType))}
          options={chartTypes}
        />
      </div>

      {/* X Axis Source */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          X axis source
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="x-source-mode"
              value="time"
              checked={state.chart.xSourceMode === 'time'}
              onChange={(e) => dispatch(actions.setXSourceMode(e.target.value as XSourceMode))}
            />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Time (default)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="x-source-mode"
              value="field"
              checked={state.chart.xSourceMode === 'field'}
              onChange={(e) => dispatch(actions.setXSourceMode(e.target.value as XSourceMode))}
            />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Choose a field</span>
          </label>
        </div>
      </div>

      {/* X Field Selector (when mode is 'field') */}
      {state.chart.xSourceMode === 'field' && (
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            X axis field
          </label>
          <CustomSelect
            value={currentXSourceValue}
            onChange={handleXSourceChange}
            options={[
              { value: '', label: '— Select a timestamp field —' },
              ...xAxisFields.map((field) => ({
                value: `${field.object}.${field.field}`,
                label: getFieldLabel(field.object, field.field),
              })),
            ]}
            disabled={xAxisFields.length === 0}
            placeholder="— Select a timestamp field —"
          />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Override time axis with a selected timestamp field
          </p>
        </div>
      )}

      {/* Y Axis Source */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Y axis source
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="y-source-mode"
              value="metric"
              checked={state.chart.ySourceMode === 'metric'}
              onChange={(e) => dispatch(actions.setYSourceMode(e.target.value as YSourceMode))}
            />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Metric (default)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="y-source-mode"
              value="field"
              checked={state.chart.ySourceMode === 'field'}
              onChange={(e) => dispatch(actions.setYSourceMode(e.target.value as YSourceMode))}
            />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Choose a field</span>
          </label>
        </div>
      </div>

      {/* Y Field Selector (when mode is 'field') */}
      {state.chart.ySourceMode === 'field' && (
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Y axis field
          </label>
          <CustomSelect
            value={currentYFieldValue}
            onChange={handleYFieldChange}
            options={[
              { value: '', label: '— Select a numeric field —' },
              ...yAxisFields.map((field) => ({
                value: `${field.object}.${field.field}`,
                label: getFieldLabel(field.object, field.field),
              })),
            ]}
            disabled={yAxisFields.length === 0}
            placeholder="— Select a numeric field —"
          />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Uses current Metric Operation + Type to aggregate this field
          </p>
        </div>
      )}

      {/* Comparison */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          Comparison
        </label>
        <CustomSelect
          value={state.chart.comparison}
          onChange={(value) => dispatch(actions.setComparison(value as Comparison))}
          options={comparisonOptions}
        />
      </div>

      {/* Description */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Comparison types</h4>
        <dl className="space-y-2 text-xs">
          <div>
            <dt className="font-medium text-gray-700 dark:text-gray-300">Period start baseline</dt>
            <dd className="text-gray-500 dark:text-gray-400">Compare current value to the first bucket in the period</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-700 dark:text-gray-300">Previous period</dt>
            <dd className="text-gray-500 dark:text-gray-400">Compare with the previous bucket (e.g., last month)</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-700 dark:text-gray-300">Previous year</dt>
            <dd className="text-gray-500 dark:text-gray-400">Compare with the same bucket one year ago</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
