/**
 * Map View Element Types
 * Defines the structure for canvas elements in Map View
 */

export type MapElementType = 
  | 'dataList' 
  | 'chart' 
  | 'filter' 
  | 'grouping' 
  | 'metric' 
  | 'sqlQuery';

/**
 * Position on the canvas
 */
export type MapPosition = {
  x: number;
  y: number;
};

/**
 * Base element structure
 */
export type MapElement = {
  id: string;
  type: MapElementType;
  position: MapPosition;
  data: MapElementData;
};

/**
 * Element-specific data configurations
 */
export type MapElementData = 
  | DataListElementData
  | ChartElementData
  | FilterElementData
  | GroupingElementData
  | MetricElementData
  | SQLQueryElementData;

/**
 * DataList element configuration
 */
export type DataListElementData = {
  type: 'dataList';
  label?: string;
  selectedFields: { object: string; field: string }[];
  selectedObjects: string[];
};

/**
 * Chart element configuration
 */
export type ChartElementData = {
  type: 'chart';
  parentDataListId?: string; // Optional parent for branching
  chartType: 'line' | 'area' | 'bar' | 'table';
  showControls: boolean; // Whether to show date range/granularity controls
};

/**
 * Filter element configuration
 */
export type FilterElementData = {
  type: 'filter';
  label?: string;
  parentDataListId: string; // Required parent
  conditions: any[]; // FilterCondition[] from main types
};

/**
 * Grouping element configuration
 */
export type GroupingElementData = {
  type: 'grouping';
  parentDataListId: string; // Required parent
  groupField?: { object: string; field: string };
  selectedValues: string[];
};

/**
 * Metric element configuration
 */
export type MetricElementData = {
  type: 'metric';
  parentDataListId?: string; // Optional parent
  metricBlocks: any[]; // MetricBlock[] from main types
};

/**
 * SQL Query element configuration
 */
export type SQLQueryElementData = {
  type: 'sqlQuery';
  label?: string;
  parentDataListId?: string; // Optional parent
  query: string;
  mode: 'update' | 'create'; // Update parent or create new DataList
};

/**
 * Connection between elements
 */
export type MapConnection = {
  id: string;
  source: string; // Source element ID
  target: string; // Target element ID
  type?: 'default' | 'branch'; // Connection styling
};

/**
 * Viewport state (zoom, pan)
 */
export type MapViewport = {
  zoom: number;
  x: number;
  y: number;
};

