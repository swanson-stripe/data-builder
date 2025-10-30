import { useEffect, useRef } from 'react';
import { useApp } from '@/state/app';
import { ReportKey } from '@/types';
import { applyPreset } from '@/lib/presets';

/**
 * Heuristic mapping: object name → suggested report
 */
const OBJECT_TO_REPORT_MAP: Record<string, ReportKey> = {
  refund: 'refund_count',
  payment: 'gross_volume',
  subscription: 'active_subscribers',
  charge: 'gross_volume',
  customer: 'active_subscribers',
};

/**
 * Custom hook that automatically switches report based on selected objects.
 * Only triggers once per object to avoid disrupting user choices.
 */
export function useReportHeuristics() {
  const { state, dispatch } = useApp();
  const triggeredObjects = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Skip if no objects selected
    if (state.selectedObjects.length === 0) {
      return;
    }

    // Check if we have a new object that hasn't triggered a switch yet
    const newObjects = state.selectedObjects.filter(
      (obj) => !triggeredObjects.current.has(obj)
    );

    if (newObjects.length === 0) {
      return;
    }

    // Find the first new object that has a heuristic mapping
    const objectWithHeuristic = newObjects.find(
      (obj) => obj in OBJECT_TO_REPORT_MAP
    );

    if (objectWithHeuristic) {
      const suggestedReport = OBJECT_TO_REPORT_MAP[objectWithHeuristic];

      // Only switch if the suggested report is different from current
      if (suggestedReport !== state.report) {
        console.log(
          `[Heuristic] Switching report from "${state.report}" to "${suggestedReport}" based on "${objectWithHeuristic}" selection`
        );
        // Apply the full preset configuration, not just set the report key
        applyPreset(suggestedReport, dispatch);
      }

      // Mark this object as having triggered a switch
      triggeredObjects.current.add(objectWithHeuristic);
    }

    // Mark all new objects as seen (even if they don't have heuristics)
    newObjects.forEach((obj) => triggeredObjects.current.add(obj));
  }, [state.selectedObjects, state.report, dispatch]);
}
