'use client';
import { useApp, actions, ChartType, YScale, Comparison } from '@/state/app';

export function ChartTab() {
  const { state, dispatch } = useApp();

  const chartTypes: { value: ChartType; label: string }[] = [
    { value: 'line', label: 'Line' },
    { value: 'area', label: 'Area' },
    { value: 'bar', label: 'Bar' },
  ];

  const yScaleOptions: { value: YScale; label: string }[] = [
    { value: 'linear', label: 'Linear' },
    { value: 'log', label: 'Logarithmic' },
  ];

  const comparisonOptions: { value: Comparison; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'period_start', label: 'Period Start Baseline' },
    { value: 'previous_period', label: 'Previous Period' },
    { value: 'previous_year', label: 'Previous Year' },
    { value: 'benchmark', label: 'Benchmark' },
  ];

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

      {/* Y-Axis Scale */}
      <div>
        <label htmlFor="y-scale" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Y-Axis Scale
        </label>
        <select
          id="y-scale"
          value={state.chart.yScale}
          onChange={(e) => dispatch(actions.setYScale(e.target.value as YScale))}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {yScaleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

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

      {/* Benchmark Value (conditional) */}
      {state.chart.comparison === 'benchmark' && (
        <div>
          <label htmlFor="benchmark" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Benchmark Value
          </label>
          <input
            id="benchmark"
            type="number"
            value={state.chart.benchmark || 0}
            onChange={(e) => dispatch(actions.setBenchmark(Number(e.target.value)))}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter benchmark value"
          />
        </div>
      )}

      {/* Description */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Comparison Modes</h4>
        <dl className="space-y-2 text-xs">
          <div>
            <dt className="font-medium text-gray-700 dark:text-gray-300">Period Start Baseline</dt>
            <dd className="text-gray-500 dark:text-gray-400">Compare all values to the first period</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-700 dark:text-gray-300">Previous Period</dt>
            <dd className="text-gray-500 dark:text-gray-400">Compare with the same window shifted backward</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-700 dark:text-gray-300">Previous Year</dt>
            <dd className="text-gray-500 dark:text-gray-400">Compare with the same period one year ago</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-700 dark:text-gray-300">Benchmark</dt>
            <dd className="text-gray-500 dark:text-gray-400">Compare against a fixed reference value</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
