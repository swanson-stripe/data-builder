'use client';
import { createContext, useContext, useReducer, ReactNode } from 'react';
import { Granularity } from '@/lib/time';
import { ReportKey, MetricDef, MetricOp, MetricType } from '@/types';

// Chart types
export type Comparison = 'none' | 'period_start' | 'previous_period' | 'previous_year' | 'benchmark';
export type ChartType = 'line' | 'area' | 'bar';
export type YSourceMode = 'metric' | 'field';

export type ChartSettings = {
  type: ChartType;
  comparison: Comparison;
  benchmark?: number;
  xSource?: { object: string; field: string }; // optional override (timestamp-like)
  ySourceMode: YSourceMode;
  yField?: { object: string; field: string }; // only used when ySourceMode='field'
};

// State type
export type AppState = {
  activeTab: 'data' | 'metric' | 'chart';
  selectedObjects: string[];
  selectedFields: { object: string; field: string }[];
  fieldOrder: string[]; // Qualified field names: "object.field"
  report: ReportKey;
  start: string;
  end: string;
  granularity: Granularity;
  selectedBucket?: {
    start: string;
    end: string;
    label: string;
  };
  chart: ChartSettings;
  metric: MetricDef;
};

// Action types
type SetTabAction = {
  type: 'SET_TAB';
  payload: 'data' | 'metric' | 'chart';
};

type ToggleObjectAction = {
  type: 'TOGGLE_OBJECT';
  payload: string;
};

type ToggleFieldAction = {
  type: 'TOGGLE_FIELD';
  payload: { object: string; field: string };
};

type SetReportAction = {
  type: 'SET_REPORT';
  payload: ReportKey;
};

type SetRangeAction = {
  type: 'SET_RANGE';
  payload: { start: string; end: string };
};

type SetGranularityAction = {
  type: 'SET_GRANULARITY';
  payload: Granularity;
};

type ResetSelectionsAction = {
  type: 'RESET_SELECTIONS';
};

type SetSelectedBucketAction = {
  type: 'SET_SELECTED_BUCKET';
  payload: {
    start: string;
    end: string;
    label: string;
  };
};

type ClearSelectedBucketAction = {
  type: 'CLEAR_SELECTED_BUCKET';
};

type SetChartTypeAction = {
  type: 'SET_CHART_TYPE';
  payload: ChartType;
};

type SetXSourceAction = {
  type: 'SET_X_SOURCE';
  payload: { object: string; field: string } | undefined;
};

type SetYSourceModeAction = {
  type: 'SET_Y_SOURCE_MODE';
  payload: YSourceMode;
};

type SetYFieldAction = {
  type: 'SET_Y_FIELD';
  payload: { object: string; field: string } | undefined;
};

type SetComparisonAction = {
  type: 'SET_COMPARISON';
  payload: Comparison;
};

type SetBenchmarkAction = {
  type: 'SET_BENCHMARK';
  payload: number;
};

type SetMetricSourceAction = {
  type: 'SET_METRIC_SOURCE';
  payload: { object: string; field: string } | undefined;
};

type SetMetricOpAction = {
  type: 'SET_METRIC_OP';
  payload: MetricOp;
};

type SetMetricTypeAction = {
  type: 'SET_METRIC_TYPE';
  payload: MetricType;
};

type SetMetricNameAction = {
  type: 'SET_METRIC_NAME';
  payload: string;
};

type ReorderFieldsAction = {
  type: 'REORDER_FIELDS';
  payload: string[]; // New fieldOrder array
};

export type AppAction =
  | SetTabAction
  | ToggleObjectAction
  | ToggleFieldAction
  | SetReportAction
  | SetRangeAction
  | SetGranularityAction
  | ResetSelectionsAction
  | SetSelectedBucketAction
  | ClearSelectedBucketAction
  | SetChartTypeAction
  | SetXSourceAction
  | SetYSourceModeAction
  | SetYFieldAction
  | SetComparisonAction
  | SetBenchmarkAction
  | SetMetricSourceAction
  | SetMetricOpAction
  | SetMetricTypeAction
  | SetMetricNameAction
  | ReorderFieldsAction;

// Initial state
const initialState: AppState = {
  activeTab: 'data',
  selectedObjects: [],
  selectedFields: [],
  fieldOrder: [],
  report: 'mrr',
  start: new Date(new Date().getFullYear() - 1, 0, 1).toISOString().split('T')[0], // Jan 1 last year
  end: new Date().toISOString().split('T')[0], // Today
  granularity: 'month',
  chart: {
    type: 'line',
    comparison: 'none',
    ySourceMode: 'metric',
  },
  metric: {
    name: 'Metric',
    op: 'sum',
    type: 'sum_over_period',
  },
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_TAB':
      return {
        ...state,
        activeTab: action.payload,
      };

    case 'TOGGLE_OBJECT': {
      const objectName = action.payload;
      const isSelected = state.selectedObjects.includes(objectName);

      if (isSelected) {
        // Remove object and all its fields
        // If the metric source is from this object, clear it
        const shouldClearMetricSource =
          state.metric.source?.object === objectName;

        // Remove fields from fieldOrder
        const newFieldOrder = state.fieldOrder.filter(
          qualifiedField => !qualifiedField.startsWith(`${objectName}.`)
        );

        return {
          ...state,
          selectedObjects: state.selectedObjects.filter(obj => obj !== objectName),
          selectedFields: state.selectedFields.filter(
            field => field.object !== objectName
          ),
          fieldOrder: newFieldOrder,
          metric: shouldClearMetricSource
            ? { ...state.metric, source: undefined }
            : state.metric,
        };
      } else {
        // Add object
        return {
          ...state,
          selectedObjects: [...state.selectedObjects, objectName],
        };
      }
    }

    case 'TOGGLE_FIELD': {
      const { object, field } = action.payload;
      const qualifiedField = `${object}.${field}`;
      const existingIndex = state.selectedFields.findIndex(
        f => f.object === object && f.field === field
      );

      if (existingIndex >= 0) {
        // Remove field
        // If this field is the metric source, clear it
        const shouldClearMetricSource =
          state.metric.source?.object === object &&
          state.metric.source?.field === field;

        // Remove from fieldOrder
        const newFieldOrder = state.fieldOrder.filter(f => f !== qualifiedField);

        return {
          ...state,
          selectedFields: state.selectedFields.filter(
            (_, index) => index !== existingIndex
          ),
          fieldOrder: newFieldOrder,
          metric: shouldClearMetricSource
            ? { ...state.metric, source: undefined }
            : state.metric,
        };
      } else {
        // Add field (ensure object is selected first)
        const selectedObjects = state.selectedObjects.includes(object)
          ? state.selectedObjects
          : [...state.selectedObjects, object];

        // Add to fieldOrder if not already present
        const newFieldOrder = state.fieldOrder.includes(qualifiedField)
          ? state.fieldOrder
          : [...state.fieldOrder, qualifiedField];

        return {
          ...state,
          selectedObjects,
          selectedFields: [...state.selectedFields, { object, field }],
          fieldOrder: newFieldOrder,
        };
      }
    }

    case 'SET_REPORT':
      return {
        ...state,
        report: action.payload,
      };

    case 'SET_RANGE':
      return {
        ...state,
        start: action.payload.start,
        end: action.payload.end,
      };

    case 'SET_GRANULARITY':
      return {
        ...state,
        granularity: action.payload,
      };

    case 'RESET_SELECTIONS':
      return {
        ...state,
        selectedObjects: [],
        selectedFields: [],
        fieldOrder: [],
      };

    case 'SET_SELECTED_BUCKET':
      return {
        ...state,
        selectedBucket: action.payload,
      };

    case 'CLEAR_SELECTED_BUCKET':
      return {
        ...state,
        selectedBucket: undefined,
      };

    case 'SET_CHART_TYPE':
      return {
        ...state,
        chart: {
          ...state.chart,
          type: action.payload,
        },
      };

    case 'SET_X_SOURCE':
      return {
        ...state,
        chart: {
          ...state.chart,
          xSource: action.payload,
        },
      };

    case 'SET_Y_SOURCE_MODE':
      return {
        ...state,
        chart: {
          ...state.chart,
          ySourceMode: action.payload,
          // Clear yField when switching to metric mode
          yField: action.payload === 'metric' ? undefined : state.chart.yField,
        },
      };

    case 'SET_Y_FIELD':
      return {
        ...state,
        chart: {
          ...state.chart,
          yField: action.payload,
        },
      };

    case 'SET_COMPARISON':
      return {
        ...state,
        chart: {
          ...state.chart,
          comparison: action.payload,
        },
      };

    case 'SET_BENCHMARK':
      return {
        ...state,
        chart: {
          ...state.chart,
          benchmark: action.payload,
        },
      };

    case 'SET_METRIC_SOURCE':
      return {
        ...state,
        metric: {
          ...state.metric,
          source: action.payload,
        },
      };

    case 'SET_METRIC_OP':
      return {
        ...state,
        metric: {
          ...state.metric,
          op: action.payload,
        },
      };

    case 'SET_METRIC_TYPE':
      return {
        ...state,
        metric: {
          ...state.metric,
          type: action.payload,
        },
      };

    case 'SET_METRIC_NAME':
      return {
        ...state,
        metric: {
          ...state.metric,
          name: action.payload,
        },
      };

    case 'REORDER_FIELDS':
      return {
        ...state,
        fieldOrder: action.payload,
      };

    default:
      // Exhaustive check
      const _exhaustiveCheck: never = action;
      return state;
  }
}

// Context
type AppContextType = {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Hook
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

// Action creators for convenience
export const actions = {
  setTab: (tab: 'data' | 'metric' | 'chart'): SetTabAction => ({
    type: 'SET_TAB',
    payload: tab,
  }),

  toggleObject: (objectName: string): ToggleObjectAction => ({
    type: 'TOGGLE_OBJECT',
    payload: objectName,
  }),

  toggleField: (object: string, field: string): ToggleFieldAction => ({
    type: 'TOGGLE_FIELD',
    payload: { object, field },
  }),

  setReport: (report: ReportKey): SetReportAction => ({
    type: 'SET_REPORT',
    payload: report,
  }),

  setRange: (start: string, end: string): SetRangeAction => ({
    type: 'SET_RANGE',
    payload: { start, end },
  }),

  setGranularity: (granularity: Granularity): SetGranularityAction => ({
    type: 'SET_GRANULARITY',
    payload: granularity,
  }),

  resetSelections: (): ResetSelectionsAction => ({
    type: 'RESET_SELECTIONS',
  }),

  setSelectedBucket: (
    start: string,
    end: string,
    label: string
  ): SetSelectedBucketAction => ({
    type: 'SET_SELECTED_BUCKET',
    payload: { start, end, label },
  }),

  clearSelectedBucket: (): ClearSelectedBucketAction => ({
    type: 'CLEAR_SELECTED_BUCKET',
  }),

  setChartType: (chartType: ChartType): SetChartTypeAction => ({
    type: 'SET_CHART_TYPE',
    payload: chartType,
  }),

  setXSource: (source: { object: string; field: string } | undefined): SetXSourceAction => ({
    type: 'SET_X_SOURCE',
    payload: source,
  }),

  setYSourceMode: (mode: YSourceMode): SetYSourceModeAction => ({
    type: 'SET_Y_SOURCE_MODE',
    payload: mode,
  }),

  setYField: (field: { object: string; field: string } | undefined): SetYFieldAction => ({
    type: 'SET_Y_FIELD',
    payload: field,
  }),

  setComparison: (comparison: Comparison): SetComparisonAction => ({
    type: 'SET_COMPARISON',
    payload: comparison,
  }),

  setBenchmark: (benchmark: number): SetBenchmarkAction => ({
    type: 'SET_BENCHMARK',
    payload: benchmark,
  }),

  setMetricSource: (
    source: { object: string; field: string } | undefined
  ): SetMetricSourceAction => ({
    type: 'SET_METRIC_SOURCE',
    payload: source,
  }),

  setMetricOp: (op: MetricOp): SetMetricOpAction => ({
    type: 'SET_METRIC_OP',
    payload: op,
  }),

  setMetricType: (type: MetricType): SetMetricTypeAction => ({
    type: 'SET_METRIC_TYPE',
    payload: type,
  }),

  setMetricName: (name: string): SetMetricNameAction => ({
    type: 'SET_METRIC_NAME',
    payload: name,
  }),

  reorderFields: (fieldOrder: string[]): ReorderFieldsAction => ({
    type: 'REORDER_FIELDS',
    payload: fieldOrder,
  }),
};
