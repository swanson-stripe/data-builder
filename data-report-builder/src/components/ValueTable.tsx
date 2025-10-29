'use client';
import { useMemo } from 'react';
import { useApp, actions } from '@/state/app';
import {
  generateSeries,
  createPeriodStartSeries,
  createBenchmarkSeries,
} from '@/data/mock';
import { computeMetric } from '@/lib/metrics';
import { currency, number, percentageChange, shortDate } from '@/lib/format';
import { getBucketRange } from '@/lib/time';

export function ValueTable() {
  const { state, dispatch } = useApp();

  // Handle bucket selection
  const handleBucketClick = (date: string) => {
    const bucketDate = new Date(date);
    const { start, end } = getBucketRange(bucketDate, state.granularity);
    dispatch(actions.setSelectedBucket(start, end, date));
  };

  // Compute metric result (includes series)
  const metricResult = useMemo(() => {
    return computeMetric({
      def: state.metric,
      start: state.start,
      end: state.end,
      granularity: state.granularity,
      generateSeries: () => {
        const series = generateSeries({
          key: state.report,
          start: new Date(state.start),
          end: new Date(state.end),
          granularity: state.granularity,
        });
        return { points: series.points };
      },
    });
  }, [state.metric, state.report, state.start, state.end, state.granularity]);

  // Generate current period data (from metric result)
  const currentSeries = useMemo(() => {
    if (!metricResult.series) {
      return { key: state.report, label: state.metric.name, points: [] };
    }
    return {
      key: state.report,
      label: state.metric.name,
      points: metricResult.series,
    };
  }, [metricResult, state.report, state.metric.name]);

  // Generate comparison data based on comparison mode
  const comparisonSeries = useMemo(() => {
    if (state.chart.comparison === 'none') return null;

    switch (state.chart.comparison) {
      case 'period_start':
        return createPeriodStartSeries(currentSeries);

      case 'previous_period': {
        const bucketCount = currentSeries.points.length;
        const shiftedStart = new Date(state.start);
        const shiftedEnd = new Date(state.end);

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

        return generateSeries({
          key: state.report,
          start: shiftedStart,
          end: shiftedEnd,
          granularity: state.granularity,
          seed: 54321,
        });
      }

      case 'previous_year': {
        const yearStart = new Date(state.start);
        yearStart.setFullYear(yearStart.getFullYear() - 1);
        const yearEnd = new Date(state.end);
        yearEnd.setFullYear(yearEnd.getFullYear() - 1);

        return generateSeries({
          key: state.report,
          start: yearStart,
          end: yearEnd,
          granularity: state.granularity,
          seed: 54321,
        });
      }

      case 'benchmark':
        return createBenchmarkSeries(
          currentSeries,
          state.chart.benchmark || currentSeries.points[0]?.value || 0
        );

      default:
        return null;
    }
  }, [currentSeries, state.chart.comparison, state.chart.benchmark, state.start, state.end, state.granularity]);

  // Get the most recent buckets to display (show last 6 periods)
  const displayCount = Math.min(6, currentSeries.points.length);
  const currentPoints = currentSeries.points.slice(-displayCount);
  const comparisonPoints = comparisonSeries?.points.slice(-displayCount);

  // Get comparison label
  const getComparisonLabel = () => {
    switch (state.chart.comparison) {
      case 'period_start':
        return 'vs. Period Start';
      case 'previous_period':
        return 'Previous Period';
      case 'previous_year':
        return 'Previous Year';
      case 'benchmark':
        return 'Benchmark';
      default:
        return '';
    }
  };

  // Get value kind from metric result
  const valueKind = metricResult.kind || 'number';

  // Format value based on kind
  const formatValue = (val: number) => {
    if (valueKind === 'currency') {
      return currency(val, { compact: true });
    } else {
      return number(val, { decimals: 0 });
    }
  };

  // Show placeholder if metric not configured
  if (metricResult.series === null || !state.metric.source) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-gray-400 dark:text-gray-500 text-center">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-sm font-medium">No metric configured</p>
          <p className="text-xs mt-1">
            {metricResult.note || 'Select a source field in the Metric tab.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-2">
        <h3 className="text-sm font-semibold">{currentSeries.label}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {comparisonSeries
            ? `Current vs. ${getComparisonLabel()} • Last ${displayCount} periods`
            : `Last ${displayCount} periods`}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-2 font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700">
                Period
              </th>
              {currentPoints.map((point, idx) => (
                <th
                  key={idx}
                  className="text-right py-2 px-2 font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 whitespace-nowrap"
                >
                  {shortDate(point.date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Current period row */}
            <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors">
              <td className="py-2 px-2 font-medium text-gray-700 dark:text-gray-300">Current</td>
              {currentPoints.map((point, idx) => {
                const isSelected =
                  state.selectedBucket?.label === point.date;
                return (
                  <td
                    key={idx}
                    className={`text-right py-2 px-2 font-mono tabular-nums transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isSelected
                        ? 'bg-blue-200 hover:bg-blue-300 font-semibold'
                        : 'hover:bg-blue-100 focus:bg-blue-100'
                    }`}
                    tabIndex={0}
                    onClick={() => handleBucketClick(point.date)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleBucketClick(point.date);
                      }
                    }}
                    role="button"
                    aria-label={`Select period ${shortDate(point.date)}`}
                  >
                    {formatValue(point.value)}
                  </td>
                );
              })}
            </tr>

            {/* Comparison row */}
            {comparisonSeries && comparisonPoints && (
              <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <td className="py-2 px-2 font-medium text-gray-500 dark:text-gray-400">
                  {getComparisonLabel()}
                </td>
                {comparisonPoints.map((point, idx) => (
                  <td
                    key={idx}
                    className="text-right py-2 px-2 font-mono tabular-nums text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors focus:bg-gray-100 dark:focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    tabIndex={0}
                  >
                    {formatValue(point.value)}
                  </td>
                ))}
              </tr>
            )}

            {/* Change row */}
            {comparisonSeries && comparisonPoints && (
              <tr className="hover:bg-green-50 dark:hover:bg-gray-700 transition-colors">
                <td className="py-2 px-2 font-medium text-gray-700 dark:text-gray-300">Change</td>
                {currentPoints.map((currentPoint, idx) => {
                  const comparisonPoint = comparisonPoints[idx];
                  const change = percentageChange(
                    currentPoint.value,
                    comparisonPoint.value
                  );
                  const isPositive = currentPoint.value > comparisonPoint.value;
                  const isNegative = currentPoint.value < comparisonPoint.value;

                  return (
                    <td
                      key={idx}
                      className={`text-right py-2 px-2 font-mono tabular-nums font-medium hover:bg-green-100 dark:hover:bg-gray-600 transition-colors focus:bg-green-100 dark:focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 ${
                        isPositive
                          ? 'text-green-600'
                          : isNegative
                          ? 'text-red-600'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                      tabIndex={0}
                    >
                      {change}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-2 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-100 border border-blue-200 dark:border-gray-600 rounded"></div>
          <span>Current</span>
        </div>
        {comparisonSeries && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-100 dark:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded"></div>
            <span>{getComparisonLabel()}</span>
          </div>
        )}
        {comparisonSeries && (
          <>
            <div className="flex items-center gap-1">
              <span className="text-green-600 font-medium">+</span>
              <span>Increase</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-red-600 font-medium">−</span>
              <span>Decrease</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
