'use client';
import { useMemo } from 'react';
import { useApp } from '@/state/app';
import { generateSeries } from '@/data/mock';
import { currency, percentageChange, shortDate } from '@/lib/format';

export function ValueTable() {
  const { state } = useApp();

  // Generate current period data
  const currentSeries = useMemo(() => {
    return generateSeries({
      key: state.report,
      start: new Date(state.start),
      end: new Date(state.end),
      granularity: state.granularity,
    });
  }, [state.report, state.start, state.end, state.granularity]);

  // Generate prior year data (shifted back one year)
  const priorSeries = useMemo(() => {
    const currentStart = new Date(state.start);
    const currentEnd = new Date(state.end);

    // Shift back one year
    const priorStart = new Date(currentStart);
    priorStart.setFullYear(priorStart.getFullYear() - 1);

    const priorEnd = new Date(currentEnd);
    priorEnd.setFullYear(priorEnd.getFullYear() - 1);

    return generateSeries({
      key: state.report,
      start: priorStart,
      end: priorEnd,
      granularity: state.granularity,
      seed: 54321, // Different seed for variation
    });
  }, [state.report, state.start, state.end, state.granularity]);

  // Get the most recent buckets to display (show last 6 periods)
  const displayCount = Math.min(6, currentSeries.points.length);
  const currentPoints = currentSeries.points.slice(-displayCount);
  const priorPoints = priorSeries.points.slice(-displayCount);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-2">
        <h3 className="text-sm font-semibold">{currentSeries.label}</h3>
        <p className="text-xs text-gray-500">
          Current period vs. prior year • Last {displayCount} periods
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-2 font-semibold text-gray-700 bg-gray-50">
                Period
              </th>
              {currentPoints.map((point, idx) => (
                <th
                  key={idx}
                  className="text-right py-2 px-2 font-medium text-gray-700 bg-gray-50 whitespace-nowrap"
                >
                  {shortDate(point.date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Current period row */}
            <tr className="border-b hover:bg-blue-50 transition-colors">
              <td className="py-2 px-2 font-medium text-gray-700">Current</td>
              {currentPoints.map((point, idx) => (
                <td
                  key={idx}
                  className="text-right py-2 px-2 font-mono tabular-nums hover:bg-blue-100 transition-colors focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  tabIndex={0}
                >
                  {currency(point.value, { compact: true })}
                </td>
              ))}
            </tr>

            {/* Prior year row */}
            <tr className="border-b hover:bg-gray-50 transition-colors">
              <td className="py-2 px-2 font-medium text-gray-500">
                Prior Year
              </td>
              {priorPoints.map((point, idx) => (
                <td
                  key={idx}
                  className="text-right py-2 px-2 font-mono tabular-nums text-gray-600 hover:bg-gray-100 transition-colors focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  tabIndex={0}
                >
                  {currency(point.value, { compact: true })}
                </td>
              ))}
            </tr>

            {/* Change row */}
            <tr className="hover:bg-green-50 transition-colors">
              <td className="py-2 px-2 font-medium text-gray-700">Change</td>
              {currentPoints.map((currentPoint, idx) => {
                const priorPoint = priorPoints[idx];
                const change = percentageChange(
                  currentPoint.value,
                  priorPoint.value
                );
                const isPositive = currentPoint.value > priorPoint.value;
                const isNegative = currentPoint.value < priorPoint.value;

                return (
                  <td
                    key={idx}
                    className={`text-right py-2 px-2 font-mono tabular-nums font-medium hover:bg-green-100 transition-colors focus:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 ${
                      isPositive
                        ? 'text-green-600'
                        : isNegative
                        ? 'text-red-600'
                        : 'text-gray-600'
                    }`}
                    tabIndex={0}
                  >
                    {change}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-2 flex gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded"></div>
          <span>Prior Year</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-green-600 font-medium">+</span>
          <span>Increase</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-red-600 font-medium">−</span>
          <span>Decrease</span>
        </div>
      </div>
    </div>
  );
}
