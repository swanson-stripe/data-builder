/**
 * Map element creation utilities
 * Functions for creating new elements on the canvas
 */

import { MapElement, MapConnection } from '@/types/mapElements';

/**
 * Generate unique ID for elements
 */
export function generateElementId(type: string): string {
  return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique ID for connections
 */
export function generateConnectionId(source: string, target: string): string {
  return `conn_${source}_${target}`;
}

/**
 * Calculate position for new element
 * Places elements with spacing to avoid overlap
 */
export function calculateNewElementPosition(
  existingElements: MapElement[],
  preferredPosition?: { x: number; y: number }
): { x: number; y: number } {
  if (preferredPosition) {
    return preferredPosition;
  }

  // Default starting position
  const baseX = 100;
  const baseY = 100;
  const spacing = 250;

  if (existingElements.length === 0) {
    return { x: baseX, y: baseY };
  }

  // Stack elements vertically with spacing
  const yOffset = Math.floor(existingElements.length / 3) * spacing;
  const xOffset = (existingElements.length % 3) * spacing;

  return {
    x: baseX + xOffset,
    y: baseY + yOffset,
  };
}

/**
 * Create a new DataList element
 */
export function createDataListElement(
  existingElements: MapElement[],
  selectedFields?: { object: string; field: string }[],
  selectedObjects?: string[]
): MapElement {
  return {
    id: generateElementId('dataList'),
    type: 'dataList',
    position: calculateNewElementPosition(existingElements),
    data: {
      type: 'dataList',
      selectedFields: selectedFields || [],
      selectedObjects: selectedObjects || [],
    },
  };
}

/**
 * Create a new Chart element
 */
export function createChartElement(
  existingElements: MapElement[],
  parentDataListId?: string
): MapElement {
  return {
    id: generateElementId('chart'),
    type: 'chart',
    position: calculateNewElementPosition(existingElements),
    data: {
      type: 'chart',
      parentDataListId,
      chartType: 'line',
      showControls: true,
    },
  };
}

/**
 * Create a new Filter element
 */
export function createFilterElement(
  existingElements: MapElement[],
  parentDataListId: string
): MapElement {
  return {
    id: generateElementId('filter'),
    type: 'filter',
    position: calculateNewElementPosition(existingElements),
    data: {
      type: 'filter',
      parentDataListId,
      conditions: [],
    },
  };
}

/**
 * Create a new Grouping element
 */
export function createGroupingElement(
  existingElements: MapElement[],
  parentDataListId: string
): MapElement {
  return {
    id: generateElementId('grouping'),
    type: 'grouping',
    position: calculateNewElementPosition(existingElements),
    data: {
      type: 'grouping',
      parentDataListId,
      selectedValues: [],
    },
  };
}

/**
 * Create a new Metric element
 */
export function createMetricElement(
  existingElements: MapElement[],
  parentDataListId?: string
): MapElement {
  return {
    id: generateElementId('metric'),
    type: 'metric',
    position: calculateNewElementPosition(existingElements),
    data: {
      type: 'metric',
      parentDataListId,
      metricBlocks: [],
    },
  };
}

/**
 * Create a new SQL Query element
 */
export function createSQLQueryElement(
  existingElements: MapElement[],
  parentDataListId?: string
): MapElement {
  return {
    id: generateElementId('sqlQuery'),
    type: 'sqlQuery',
    position: calculateNewElementPosition(existingElements),
    data: {
      type: 'sqlQuery',
      parentDataListId,
      query: '',
      mode: 'create',
    },
  };
}

