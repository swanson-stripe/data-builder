'use client';
import { useEffect, useState } from 'react';
import { generateSeries, mockRowsForDataList } from '@/data/mock';
import { ReportSeries } from '@/types';

/**
 * Test component to verify mock data generation
 * This can be used during development to test data consistency
 */
export function TestMockData() {
  const [series1, setSeries1] = useState<ReportSeries | null>(null);
  const [series2, setSeries2] = useState<ReportSeries | null>(null);
  const [rows, setRows] = useState<Record<string, string | number | boolean>[]>([]);

  useEffect(() => {
    // Test 1: Generate same series twice with same seed
    const startDate = new Date('2020-01-01');
    const endDate = new Date('2024-12-31');

    const s1 = generateSeries({
      key: 'mrr',
      start: startDate,
      end: endDate,
      granularity: 'month',
      seed: 12345,
    });

    const s2 = generateSeries({
      key: 'mrr',
      start: startDate,
      end: endDate,
      granularity: 'month',
      seed: 12345,
    });

    setSeries1(s1);
    setSeries2(s2);

    // Test 2: Generate mock rows
    const mockRows = mockRowsForDataList({
      objectsSelected: ['customer', 'subscription'],
      count: 10,
      seed: 12345,
    });

    setRows(mockRows);
  }, []);

  const areSame = series1 && series2 &&
    series1.points.length === series2.points.length &&
    series1.points.every((p, i) =>
      p.date === series2.points[i].date &&
      p.value === series2.points[i].value
    );

  return (
    <div className="p-4 space-y-4">
      <div className="border rounded p-3">
        <h3 className="font-semibold mb-2">Test: Same Seed = Same Output</h3>
        <p className="text-sm">
          Series 1 points: {series1?.points.length || 0}
        </p>
        <p className="text-sm">
          Series 2 points: {series2?.points.length || 0}
        </p>
        <p className="text-sm font-semibold">
          Are they identical? {areSame ? '✅ Yes' : '❌ No'}
        </p>
        {series1 && (
          <div className="mt-2 text-xs">
            <p>First 3 points:</p>
            {series1.points.slice(0, 3).map((p, i) => (
              <div key={i}>{p.date}: ${p.value}</div>
            ))}
          </div>
        )}
      </div>

      <div className="border rounded p-3">
        <h3 className="font-semibold mb-2">Test: Mock Rows Generation</h3>
        <p className="text-sm">Generated {rows.length} rows</p>
        {rows.length > 0 && (
          <div className="mt-2 text-xs">
            <p>Sample row fields:</p>
            <ul className="list-disc list-inside">
              {Object.keys(rows[0]).slice(0, 5).map((key) => (
                <li key={key}>{key}: {String(rows[0][key])}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
