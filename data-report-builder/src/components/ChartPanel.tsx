'use client';
import { useMemo } from 'react';
import { useApp, actions } from '@/state/app';
import { generateSeries } from '@/data/mock';
import { Granularity, validateGranularityRange } from '@/lib/time';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

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

  // Validate granularity-range combination
  const validation = useMemo(() => {
    return validateGranularityRange(
      new Date(state.start),
      new Date(state.end),
      state.granularity
    );
  }, [state.start, state.end, state.granularity]);

  // Generate series data based on current state
  const series = useMemo(() => {
    return generateSeries({
      key: state.report,
      start: new Date(state.start),
      end: new Date(state.end),
      granularity: state.granularity,
    });
  }, [state.report, state.start, state.end, state.granularity]);

  // Format chart data for Recharts
  const chartData = series.points.map((point) => ({
    date: point.date,
    value: point.value,
  }));

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
      {/* Controls */}
      <div className="flex items-center justify-between mb-3 gap-3">
        {/* Range presets */}
        <div className="flex gap-1" role="group" aria-label="Date range presets">
          {rangePresets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                const range = preset.getValue();
                dispatch(actions.setRange(range.start, range.end));
              }}
              className="px-2 py-1 text-xs border rounded hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-2 py-1 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Chart title */}
      <div className="mb-2">
        <h3 className="text-sm font-semibold">{series.label}</h3>
        <p className="text-xs text-gray-500">
          {state.start} to {state.end} • {validation.bucketCount} data points
        </p>
        {!validation.valid && validation.warning && (
          <div className="mt-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1" role="alert">
            ⚠️ {validation.warning}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              stroke="#6b7280"
              tickFormatter={(value) => {
                // Shorten long dates for better display
                if (state.granularity === 'day' || state.granularity === 'week') {
                  // Show MM/DD format
                  const [year, month, day] = value.split('-');
                  return `${month}/${day}`;
                }
                return value;
              }}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="#6b7280"
              tickFormatter={formatValue}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                fontSize: '12px',
              }}
              formatter={(value: number) => [formatValue(value), series.label]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
