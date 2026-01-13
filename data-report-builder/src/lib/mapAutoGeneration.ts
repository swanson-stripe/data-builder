/**
 * Auto-generation: Convert AppState report to Map View elements
 * Creates a canvas layout from the current table view configuration
 */

import { AppState } from '@/state/app';
import { MapElement, MapConnection } from '@/types/mapElements';
import {
  generateElementId,
  generateConnectionId,
  calculateNewElementPosition,
} from './mapElementCreation';

/**
 * Generate Map View from current AppState
 * Creates elements and connections matching the table view configuration
 */
export function generateMapFromAppState(appState: AppState): {
  elements: MapElement[];
  connections: MapConnection[];
} {
  const elements: MapElement[] = [];
  const connections: MapConnection[] = [];

  let currentY = 100;
  const baseX = 100;
  const verticalSpacing = 200;
  const horizontalSpacing = 300;

  // 1. Create DataList element (always present)
  const dataListElement: MapElement = {
    id: generateElementId('dataList'),
    type: 'dataList',
    position: { x: baseX, y: currentY },
    data: {
      type: 'dataList',
      selectedFields: appState.selectedFields,
      selectedObjects: appState.selectedObjects,
    },
  };
  elements.push(dataListElement);

  let branchY = currentY;

  // 2. Create Filter elements if filters exist
  if (appState.filters && appState.filters.conditions && appState.filters.conditions.length > 0) {
    const filterElement: MapElement = {
      id: generateElementId('filter'),
      type: 'filter',
      position: { x: baseX + horizontalSpacing, y: branchY },
      data: {
        type: 'filter',
        parentDataListId: dataListElement.id,
        conditions: appState.filters.conditions,
      },
    };
    elements.push(filterElement);
    connections.push({
      id: generateConnectionId(dataListElement.id, filterElement.id),
      source: dataListElement.id,
      target: filterElement.id,
    });

    branchY += verticalSpacing;
  }

  // 3. Create Grouping element if groupBy exists
  if (appState.groupBy && appState.groupBy.field) {
    const groupingElement: MapElement = {
      id: generateElementId('grouping'),
      type: 'grouping',
      position: { x: baseX + horizontalSpacing, y: branchY },
      data: {
        type: 'grouping',
        parentDataListId: dataListElement.id,
        groupField: appState.groupBy.field,
        selectedValues: appState.groupBy.selectedValues || [],
      },
    };
    elements.push(groupingElement);
    connections.push({
      id: generateConnectionId(dataListElement.id, groupingElement.id),
      source: dataListElement.id,
      target: groupingElement.id,
    });

    branchY += verticalSpacing;
  }

  // 4. Create Chart element if chart is enabled
  if (appState.showChart && appState.chartType) {
    const chartElement: MapElement = {
      id: generateElementId('chart'),
      type: 'chart',
      position: { x: baseX + horizontalSpacing * 2, y: currentY },
      data: {
        type: 'chart',
        parentDataListId: dataListElement.id,
        chartType: appState.chartType,
        showControls: true,
      },
    };
    elements.push(chartElement);
    connections.push({
      id: generateConnectionId(dataListElement.id, chartElement.id),
      source: dataListElement.id,
      target: chartElement.id,
    });
  }

  // 5. Create Metric elements if metrics exist
  if (appState.metricBlocks && appState.metricBlocks.length > 0) {
    const metricElement: MapElement = {
      id: generateElementId('metric'),
      type: 'metric',
      position: { x: baseX + horizontalSpacing * 2, y: currentY + verticalSpacing },
      data: {
        type: 'metric',
        parentDataListId: dataListElement.id,
        metricBlocks: appState.metricBlocks,
      },
    };
    elements.push(metricElement);
    connections.push({
      id: generateConnectionId(dataListElement.id, metricElement.id),
      source: dataListElement.id,
      target: metricElement.id,
    });
  }

  return { elements, connections };
}

/**
 * Check if the map should be auto-generated
 * Only auto-generate if there are no elements yet
 */
export function shouldAutoGenerate(existingElements: MapElement[]): boolean {
  return existingElements.length === 0;
}

