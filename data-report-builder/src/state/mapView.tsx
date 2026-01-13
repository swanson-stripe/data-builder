'use client';
import { createContext, useContext, useReducer, ReactNode } from 'react';
import { MapElement, MapConnection, MapViewport } from '@/types/mapElements';

/**
 * Map View State
 * Parallel state management for canvas elements, separate from main AppState
 */
export type MapViewState = {
  elements: MapElement[];
  connections: MapConnection[];
  viewport: MapViewport;
  selectedElementId: string | null;
  isPanelExpanded: boolean; // Config panel expansion state
  activePanelSection: 'new' | 'chat' | 'templates' | 'helper' | null;
};

/**
 * Action Types
 */
type AddElementAction = {
  type: 'ADD_ELEMENT';
  payload: MapElement;
};

type UpdateElementAction = {
  type: 'UPDATE_ELEMENT';
  payload: { id: string; updates: Partial<MapElement> };
};

type DeleteElementAction = {
  type: 'DELETE_ELEMENT';
  payload: string; // element ID
};

type AddConnectionAction = {
  type: 'ADD_CONNECTION';
  payload: MapConnection;
};

type DeleteConnectionAction = {
  type: 'DELETE_CONNECTION';
  payload: string; // connection ID
};

type SetViewportAction = {
  type: 'SET_VIEWPORT';
  payload: Partial<MapViewport>;
};

type SelectElementAction = {
  type: 'SELECT_ELEMENT';
  payload: string; // element ID
};

type DeselectElementAction = {
  type: 'DESELECT_ELEMENT';
};

type SetPanelExpandedAction = {
  type: 'SET_PANEL_EXPANDED';
  payload: boolean;
};

type SetActivePanelSectionAction = {
  type: 'SET_ACTIVE_PANEL_SECTION';
  payload: 'new' | 'chat' | 'templates' | 'helper' | null;
};

type ResetMapAction = {
  type: 'RESET_MAP';
};

type LoadMapStateAction = {
  type: 'LOAD_MAP_STATE';
  payload: Partial<MapViewState>;
};

export type MapViewAction =
  | AddElementAction
  | UpdateElementAction
  | DeleteElementAction
  | AddConnectionAction
  | DeleteConnectionAction
  | SetViewportAction
  | SelectElementAction
  | DeselectElementAction
  | SetPanelExpandedAction
  | SetActivePanelSectionAction
  | ResetMapAction
  | LoadMapStateAction;

/**
 * Initial State
 */
const initialState: MapViewState = {
  elements: [],
  connections: [],
  viewport: {
    zoom: 1,
    x: 0,
    y: 0,
  },
  selectedElementId: null,
  isPanelExpanded: false,
  activePanelSection: null,
};

/**
 * Reducer
 */
function mapViewReducer(state: MapViewState, action: MapViewAction): MapViewState {
  switch (action.type) {
    case 'ADD_ELEMENT':
      return {
        ...state,
        elements: [...state.elements, action.payload],
      };

    case 'UPDATE_ELEMENT':
      return {
        ...state,
        elements: state.elements.map(el =>
          el.id === action.payload.id
            ? { ...el, ...action.payload.updates }
            : el
        ),
      };

    case 'DELETE_ELEMENT': {
      const elementId = action.payload;
      // Also remove connections involving this element
      return {
        ...state,
        elements: state.elements.filter(el => el.id !== elementId),
        connections: state.connections.filter(
          conn => conn.source !== elementId && conn.target !== elementId
        ),
        selectedElementId: state.selectedElementId === elementId ? null : state.selectedElementId,
      };
    }

    case 'ADD_CONNECTION':
      return {
        ...state,
        connections: [...state.connections, action.payload],
      };

    case 'DELETE_CONNECTION':
      return {
        ...state,
        connections: state.connections.filter(conn => conn.id !== action.payload),
      };

    case 'SET_VIEWPORT':
      return {
        ...state,
        viewport: { ...state.viewport, ...action.payload },
      };

    case 'SELECT_ELEMENT':
      return {
        ...state,
        selectedElementId: action.payload,
      };

    case 'DESELECT_ELEMENT':
      return {
        ...state,
        selectedElementId: null,
      };

    case 'SET_PANEL_EXPANDED':
      return {
        ...state,
        isPanelExpanded: action.payload,
        // Close active section when collapsing panel
        activePanelSection: action.payload ? state.activePanelSection : null,
      };

    case 'SET_ACTIVE_PANEL_SECTION':
      return {
        ...state,
        activePanelSection: action.payload,
        // Expand panel when opening a section
        isPanelExpanded: action.payload !== null,
      };

    case 'RESET_MAP':
      return initialState;

    case 'LOAD_MAP_STATE':
      return {
        ...state,
        ...action.payload,
      };

    default:
      return state;
  }
}

/**
 * Context
 */
type MapViewContextType = {
  state: MapViewState;
  dispatch: React.Dispatch<MapViewAction>;
};

const MapViewContext = createContext<MapViewContextType | undefined>(undefined);

/**
 * Provider
 */
export function MapViewProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(mapViewReducer, initialState);

  return (
    <MapViewContext.Provider value={{ state, dispatch }}>
      {children}
    </MapViewContext.Provider>
  );
}

/**
 * Hook
 */
export function useMapView() {
  const context = useContext(MapViewContext);
  if (!context) {
    throw new Error('useMapView must be used within MapViewProvider');
  }
  return context;
}

/**
 * Action Creators
 */
export const mapActions = {
  addElement: (element: MapElement): AddElementAction => ({
    type: 'ADD_ELEMENT',
    payload: element,
  }),

  updateElement: (id: string, updates: Partial<MapElement>): UpdateElementAction => ({
    type: 'UPDATE_ELEMENT',
    payload: { id, updates },
  }),

  deleteElement: (id: string): DeleteElementAction => ({
    type: 'DELETE_ELEMENT',
    payload: id,
  }),

  addConnection: (connection: MapConnection): AddConnectionAction => ({
    type: 'ADD_CONNECTION',
    payload: connection,
  }),

  deleteConnection: (id: string): DeleteConnectionAction => ({
    type: 'DELETE_CONNECTION',
    payload: id,
  }),

  setViewport: (viewport: Partial<MapViewport>): SetViewportAction => ({
    type: 'SET_VIEWPORT',
    payload: viewport,
  }),

  selectElement: (id: string): SelectElementAction => ({
    type: 'SELECT_ELEMENT',
    payload: id,
  }),

  deselectElement: (): DeselectElementAction => ({
    type: 'DESELECT_ELEMENT',
  }),

  setPanelExpanded: (expanded: boolean): SetPanelExpandedAction => ({
    type: 'SET_PANEL_EXPANDED',
    payload: expanded,
  }),

  setActivePanelSection: (section: 'new' | 'chat' | 'templates' | 'helper' | null): SetActivePanelSectionAction => ({
    type: 'SET_ACTIVE_PANEL_SECTION',
    payload: section,
  }),

  resetMap: (): ResetMapAction => ({
    type: 'RESET_MAP',
  }),

  loadMapState: (state: Partial<MapViewState>): LoadMapStateAction => ({
    type: 'LOAD_MAP_STATE',
    payload: state,
  }),
};

