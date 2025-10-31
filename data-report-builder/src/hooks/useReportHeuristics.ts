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
  // Disabled: Automatic preset switching was too disruptive to manual workflows
  // Users can select presets manually from the dropdown when needed
  
  // const { state, dispatch } = useApp();
  // const triggeredObjects = useRef<Set<string>>(new Set());

  // useEffect(() => {
  //   // Heuristic logic disabled
  // }, [state.selectedObjects, state.report, dispatch]);
}
