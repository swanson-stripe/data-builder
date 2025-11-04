'use client';
import { createContext, useContext, useReducer, ReactNode } from 'react';
import { Granularity } from '@/lib/time';
import { ReportKey, MetricDef, MetricOp, MetricType, FilterGroup, FilterCondition } from '@/types';

// Chart types
export type Comparison = 'none' | 'period_start' | 'previous_period' | 'previous_year' | 'benchmarks';
export type ChartType = 'line' | 'area' | 'bar';
export type XSourceMode = 'time' | 'field';
export type YSourceMode = 'metric' | 'field';

export type ChartSettings = {
  type: ChartType;
  comparison: Comparison;
  xSourceMode: XSourceMode;
  xSource?: { object: string; field: string }; // only used when xSourceMode='field'
  ySourceMode: YSourceMode;
  yField?: { object: string; field: string }; // only used when ySourceMode='field'
};

export type GridSelection = {
  rowIds: { object: string; id: string }[]; // PKs instead of string rowKeys
  columns: string[];            // qualified field names (e.g., "payment.amount")
  cells: { rowId: { object: string; id: string }; col: string }[]; // cells with PKs
  isRectangular: boolean;
};

// State type
export type AppState = {
  activeTab: 'data' | 'metric' | 'chart' | 'sql';
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
  selectedGrid?: GridSelection;
  chart: ChartSettings;
  metric: MetricDef;
  filters: FilterGroup;
};

// Action types
type SetTabAction = {
  type: 'SET_TAB';
  payload: 'data' | 'metric' | 'chart' | 'sql';
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

type SetXSourceModeAction = {
  type: 'SET_X_SOURCE_MODE';
  payload: XSourceMode;
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

type SetGridSelectionAction = {
  type: 'SET_GRID_SELECTION';
  payload: GridSelection;
};

type ClearGridSelectionAction = {
  type: 'CLEAR_GRID_SELECTION';
};

type AddFilterAction = {
  type: 'ADD_FILTER';
  payload: FilterCondition;
};

type UpdateFilterAction = {
  type: 'UPDATE_FILTER';
  payload: { index: number; condition: FilterCondition };
};

type RemoveFilterAction = {
  type: 'REMOVE_FILTER';
  payload: number; // index
};

type SetFilterLogicAction = {
  type: 'SET_FILTER_LOGIC';
  payload: 'AND' | 'OR';
};

type ClearFiltersAction = {
  type: 'CLEAR_FILTERS';
};

type ResetAllAction = {
  type: 'RESET_ALL';
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
  | SetXSourceModeAction
  | SetYSourceModeAction
  | SetYFieldAction
  | SetComparisonAction
  | SetMetricSourceAction
  | SetMetricOpAction
  | SetMetricTypeAction
  | SetMetricNameAction
  | ReorderFieldsAction
  | SetGridSelectionAction
  | ClearGridSelectionAction
  | AddFilterAction
  | UpdateFilterAction
  | RemoveFilterAction
  | SetFilterLogicAction
  | ClearFiltersAction
  | ResetAllAction;

// Helper function to build initial state with preset applied
function buildInitialState(): AppState {
  const baseState: AppState = {
    activeTab: 'data',
    selectedObjects: [],
    selectedFields: [],
    fieldOrder: [],
    report: 'mrr',
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Jan 1 this year (YTD)
    end: new Date().toISOString().split('T')[0], // Today
    granularity: 'month',
    chart: {
      type: 'line',
      comparison: 'none',
      xSourceMode: 'time',
      ySourceMode: 'metric',
    },
    metric: {
      name: 'Metric',
      op: 'sum',
      type: 'sum_over_period',
    },
    filters: {
      conditions: [],
      logic: 'AND',
    },
  };

  // Apply MRR preset synchronously to initial state
  // Import PRESET_CONFIGS from presets to avoid circular deps
  const { PRESET_CONFIGS } = require('@/lib/presets');
  const preset = PRESET_CONFIGS['mrr'];
  
  if (preset) {
    return {
      ...baseState,
      selectedObjects: [...preset.objects],
      selectedFields: [...preset.fields],
      fieldOrder: preset.fields.map((f: { object: string; field: string }) => `${f.object}.${f.field}`),
      metric: {
        name: preset.metric.name,
        op: preset.metric.op,
        type: preset.metric.type,
        source: preset.metric.source,
      },
      start: preset.range?.start || baseState.start,
      end: preset.range?.end || baseState.end,
      granularity: preset.range?.granularity || baseState.granularity,
      filters: {
        conditions: preset.filters || [],
        logic: 'AND',
      },
    };
  }
  
  return baseState;
}

// Initial state with MRR preset applied
const initialState: AppState = buildInitialState();

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
        filters: {
          conditions: [],
          logic: 'AND',
        },
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

    case 'SET_X_SOURCE_MODE':
      return {
        ...state,
        chart: {
          ...state.chart,
          xSourceMode: action.payload,
          // Clear xSource when switching to time mode
          xSource: action.payload === 'time' ? undefined : state.chart.xSource,
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

    case 'SET_GRID_SELECTION':
      return {
        ...state,
        selectedGrid: action.payload,
      };

    case 'CLEAR_GRID_SELECTION':
      return {
        ...state,
        selectedGrid: undefined,
      };

    case 'ADD_FILTER':
      return {
        ...state,
        filters: {
          ...state.filters,
          conditions: [...state.filters.conditions, action.payload],
        },
      };

    case 'UPDATE_FILTER':
      return {
        ...state,
        filters: {
          ...state.filters,
          conditions: state.filters.conditions.map((c, i) =>
            i === action.payload.index ? action.payload.condition : c
          ),
        },
      };

    case 'REMOVE_FILTER':
      return {
        ...state,
        filters: {
          ...state.filters,
          conditions: state.filters.conditions.filter((_, i) => i !== action.payload),
        },
      };

    case 'SET_FILTER_LOGIC':
      return {
        ...state,
        filters: {
          ...state.filters,
          logic: action.payload,
        },
      };

    case 'CLEAR_FILTERS':
      return {
        ...state,
        filters: {
          conditions: [],
          logic: 'AND',
        },
      };

    case 'RESET_ALL':
      // Reset to blank preset, keeping activeTab to avoid jarring tab switch
      const { PRESET_CONFIGS } = require('@/lib/presets');
      const blankPreset = PRESET_CONFIGS['blank'];
      
      return {
        activeTab: state.activeTab,
        selectedObjects: [],
        selectedFields: [],
        fieldOrder: [],
        report: 'blank',
        start: blankPreset.range?.start || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        end: blankPreset.range?.end || new Date().toISOString().split('T')[0],
        granularity: blankPreset.range?.granularity || 'month',
        selectedBucket: undefined, // Clear bucket selection
        selectedGrid: undefined, // Clear grid selection
        chart: {
          type: 'line',
          comparison: 'none',
          xSourceMode: 'time',
          ySourceMode: 'metric',
        },
        metric: {
          name: 'Metric',
          op: 'sum',
          type: 'sum_over_period',
          source: undefined,
        },
        filters: {
          conditions: [],
          logic: 'AND',
        },
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
  setTab: (tab: 'data' | 'metric' | 'chart' | 'sql'): SetTabAction => ({
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

  setXSourceMode: (mode: XSourceMode): SetXSourceModeAction => ({
    type: 'SET_X_SOURCE_MODE',
    payload: mode,
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

  setGridSelection: (selection: GridSelection): SetGridSelectionAction => ({
    type: 'SET_GRID_SELECTION',
    payload: selection,
  }),

  clearGridSelection: (): ClearGridSelectionAction => ({
    type: 'CLEAR_GRID_SELECTION',
  }),

  addFilter: (condition: FilterCondition): AddFilterAction => ({
    type: 'ADD_FILTER',
    payload: condition,
  }),

  updateFilter: (index: number, condition: FilterCondition): UpdateFilterAction => ({
    type: 'UPDATE_FILTER',
    payload: { index, condition },
  }),

  removeFilter: (index: number): RemoveFilterAction => ({
    type: 'REMOVE_FILTER',
    payload: index,
  }),

  setFilterLogic: (logic: 'AND' | 'OR'): SetFilterLogicAction => ({
    type: 'SET_FILTER_LOGIC',
    payload: logic,
  }),

  clearFilters: (): ClearFiltersAction => ({
    type: 'CLEAR_FILTERS',
  }),

  resetAll: (): ResetAllAction => ({
    type: 'RESET_ALL',
  }),
};
