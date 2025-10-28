'use client';
import { useMemo } from 'react';
import { useApp, actions } from '@/state/app';
import {
  generateSeries,
  shiftSeriesByPeriod,
  createPeriodStartSeries,
  createBenchmarkSeries,
} from '@/data/mock';
import { Granularity, validateGranularityRange, getBucketRange } from '@/lib/time';
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
  Tooltip,
  Legend,
  ResponsiveContainer,
  Dot,
} from 'recharts';
import { MetricHeader } from './MetricHeader';

type RangePreset = {
  label: string;
  getValue: () => { start: string; end: string };
};

const rangePresets: RangePreset[] = [
  {
    label: '1M',
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
  {
    label: '3M',
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 3);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
  {
    label: 'YTD',
    getValue: () => {
      const end = new Date();
      const start = new Date(end.getFullYear(), 0, 1);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
  {
    label: '1Y',
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setFullYear(start.getFullYear() - 1);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
  {
    label: '3Y',
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setFullYear(start.getFullYear() - 3);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
  {
    label: '5Y',
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setFullYear(start.getFullYear() - 5);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
];

const granularityOptions: Granularity[] = ['day', 'week', 'month', 'quarter', 'year'];

export function ChartPanel() {
  const { state, dispatch } = useApp();

  // Handle point click
  const handlePointClick = (data: any) => {
    const date = data.date as string;
    const bucketDate = new Date(date);
    const { start, end } = getBucketRange(bucketDate, state.granularity);
    dispatch(actions.setSelectedBucket(start, end, date));
  };

  // Validate granularity-range combination
  const validation = useMemo(() => {
    return validateGranularityRange(
      new Date(state.start),
      new Date(state.end),
      state.granularity
    );
  }, [state.start, state.end, state.granularity]);

  // Generate primary series data based on current state
  const series = useMemo(() => {
    return generateSeries({
      key: state.report,
      start: new Date(state.start),
      end: new Date(state.end),
      granularity: state.granularity,
    });
  }, [state.report, state.start, state.end, state.granularity]);

  // Generate comparison series based on comparison mode
  const comparisonSeries = useMemo(() => {
    if (state.chart.comparison === 'none') return null;

    switch (state.chart.comparison) {
      case 'period_start':
        return createPeriodStartSeries(series);

      case 'previous_period': {
        const bucketCount = series.points.length;
        const shiftedStart = new Date(state.start);
        const shiftedEnd = new Date(state.end);

        // Shift dates backward by the bucket count
        switch (state.granularity) {
          case 'day':
            shiftedStart.setDate(shiftedStart.getDate() - bucketCount);
            shiftedEnd.setDate(shiftedEnd.getDate() - bucketCount);
            break;
          case 'week':
            shiftedStart.setDate(shiftedStart.getDate() - bucketCount * 7);
            shiftedEnd.setDate(shiftedEnd.getDate() - bucketCount * 7);
            break;
          case 'month':
            shiftedStart.setMonth(shiftedStart.getMonth() - bucketCount);
            shiftedEnd.setMonth(shiftedEnd.getMonth() - bucketCount);
            break;
          case 'quarter':
            shiftedStart.setMonth(shiftedStart.getMonth() - bucketCount * 3);
            shiftedEnd.setMonth(shiftedEnd.getMonth() - bucketCount * 3);
            break;
          case 'year':
            shiftedStart.setFullYear(shiftedStart.getFullYear() - bucketCount);
            shiftedEnd.setFullYear(shiftedEnd.getFullYear() - bucketCount);
            break;
        }

        const prevSeries = generateSeries({
          key: state.report,
          start: shiftedStart,
          end: shiftedEnd,
          granularity: state.granularity,
          seed: 54321, // Different seed for variation
        });

        return {
          ...prevSeries,
          label: 'Previous Period',
        };
      }

      case 'previous_year': {
        const yearStart = new Date(state.start);
        yearStart.setFullYear(yearStart.getFullYear() - 1);
        const yearEnd = new Date(state.end);
        yearEnd.setFullYear(yearEnd.getFullYear() - 1);

        const prevYearSeries = generateSeries({
          key: state.report,
          start: yearStart,
          end: yearEnd,
          granularity: state.granularity,
          seed: 54321,
        });

        return {
          ...prevYearSeries,
          label: 'Previous Year',
        };
      }

      case 'benchmark':
        return createBenchmarkSeries(
          series,
          state.chart.benchmark || series.points[0]?.value || 0
        );

      default:
        return null;
    }
  }, [series, state.chart.comparison, state.chart.benchmark, state.start, state.end, state.granularity]);

  // Format chart data for Recharts - merge current and comparison series
  const chartData = useMemo(() => {
    const data = series.points.map((point, index) => ({
      date: point.date,
      current: point.value,
      comparison: comparisonSeries?.points[index]?.value,
    }));
    return data;
  }, [series, comparisonSeries]);

  // Format number for display
  const formatValue = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Metric Header */}
      <MetricHeader />

      {/* Controls */}
      <div className="flex items-center justify-between mb-3 mt-3 gap-3">
        {/* Range presets */}
        <div className="flex gap-1" role="group" aria-label="Date range presets">
          {rangePresets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                const range = preset.getValue();
                dispatch(actions.setRange(range.start, range.end));
              }}
              className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={`Set date range to ${preset.label}`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Granularity dropdown */}
        <div>
          <label htmlFor="granularity-select" className="sr-only">
            Data granularity
          </label>
          <select
            id="granularity-select"
            value={state.granularity}
            onChange={(e) =>
              dispatch(actions.setGranularity(e.target.value as Granularity))
            }
            className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Select data granularity"
          >
            {granularityOptions.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Date range info and warnings */}
      <div className="mb-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {state.start} to {state.end} • {validation.bucketCount} data points
        </p>
        {!validation.valid && validation.warning && (
          <div className="mt-1 text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1" role="alert">
            ⚠️ {validation.warning}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {state.chart.type === 'line' && (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-600" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                stroke="#6b7280"
                className="dark:stroke-gray-400"
                tickFormatter={(value) => {
                  if (state.granularity === 'day' || state.granularity === 'week') {
                    const [year, month, day] = value.split('-');
                    return `${month}/${day}`;
                  }
                  return value;
                }}
              />
              <YAxis
                scale={state.chart.yScale}
                tick={{ fontSize: 11 }}
                stroke="#6b7280"
                className="dark:stroke-gray-400"
                tickFormatter={formatValue}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
                wrapperClassName="dark:[&_.recharts-tooltip-wrapper]:bg-gray-800 dark:[&_.recharts-tooltip-wrapper]:border-gray-700"
              />
              {comparisonSeries && <Legend />}
              <Line
                type="monotone"
                dataKey="current"
                name={series.label}
                stroke="#3b82f6"
                strokeWidth={2}
                dot={(props: any) => {
                  const isSelected = state.selectedBucket?.label === props.payload.date;
                  const { key, ...dotProps } = props;
                  return (
                    <Dot
                      key={key}
                      {...dotProps}
                      r={isSelected ? 6 : 3}
                      fill={isSelected ? '#1d4ed8' : '#3b82f6'}
                      stroke={isSelected ? '#fff' : 'none'}
                      strokeWidth={isSelected ? 2 : 0}
                      style={{ cursor: 'pointer' }}
                    />
                  );
                }}
                activeDot={{ r: 5, style: { cursor: 'pointer' } }}
                onClick={handlePointClick}
              />
              {comparisonSeries && (
                <Line
                  type="monotone"
                  dataKey="comparison"
                  name={comparisonSeries.label}
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}
            </LineChart>
          )}

          {state.chart.type === 'area' && (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-600" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                stroke="#6b7280"
                className="dark:stroke-gray-400"
                tickFormatter={(value) => {
                  if (state.granularity === 'day' || state.granularity === 'week') {
                    const [year, month, day] = value.split('-');
                    return `${month}/${day}`;
                  }
                  return value;
                }}
              />
              <YAxis
                scale={state.chart.yScale}
                tick={{ fontSize: 11 }}
                stroke="#6b7280"
                className="dark:stroke-gray-400"
                tickFormatter={formatValue}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
                wrapperClassName="dark:[&_.recharts-tooltip-wrapper]:bg-gray-800 dark:[&_.recharts-tooltip-wrapper]:border-gray-700"
              />
              {comparisonSeries && <Legend />}
              {comparisonSeries && (
                <Area
                  type="monotone"
                  dataKey="comparison"
                  name={comparisonSeries.label}
                  fill="#fbbf24"
                  fillOpacity={0.3}
                  stroke="#f59e0b"
                  strokeWidth={2}
                />
              )}
              <Area
                type="monotone"
                dataKey="current"
                name={series.label}
                fill="#93c5fd"
                fillOpacity={0.4}
                stroke="#3b82f6"
                strokeWidth={2}
                onClick={handlePointClick}
              />
            </AreaChart>
          )}

          {state.chart.type === 'bar' && (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-600" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                stroke="#6b7280"
                className="dark:stroke-gray-400"
                tickFormatter={(value) => {
                  if (state.granularity === 'day' || state.granularity === 'week') {
                    const [year, month, day] = value.split('-');
                    return `${month}/${day}`;
                  }
                  return value;
                }}
              />
              <YAxis
                scale={state.chart.yScale}
                tick={{ fontSize: 11 }}
                stroke="#6b7280"
                className="dark:stroke-gray-400"
                tickFormatter={formatValue}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
                wrapperClassName="dark:[&_.recharts-tooltip-wrapper]:bg-gray-800 dark:[&_.recharts-tooltip-wrapper]:border-gray-700"
              />
              {comparisonSeries && <Legend />}
              <Bar
                dataKey="current"
                name={series.label}
                fill="#3b82f6"
                onClick={handlePointClick}
              />
              {comparisonSeries && (
                <Bar
                  dataKey="comparison"
                  name={comparisonSeries.label}
                  fill="#f59e0b"
                />
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
