/**
 * AI Chat for Map View
 * Handles natural language commands to modify the canvas
 */

import { useState } from 'react';
import { MapElement, MapConnection } from '@/types/mapElements';
import {
  createDataListElement,
  createChartElement,
  createFilterElement,
  createGroupingElement,
  createMetricElement,
  createSQLQueryElement,
  generateConnectionId,
} from './mapElementCreation';

type ChatResponse = {
  message: string;
  newElements?: MapElement[];
  newConnections?: MapConnection[];
};

/**
 * Hook for AI chat in Map View
 */
export function useMapAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<string>('');

  /**
   * Process natural language command
   * Returns elements/connections to add to canvas
   */
  async function processCommand(
    command: string,
    existingElements: MapElement[]
  ): Promise<ChatResponse> {
    setIsLoading(true);

    try {
      // Simple pattern matching for v1 proof of concept
      const lowerCommand = command.toLowerCase();
      const newElements: MapElement[] = [];
      const newConnections: MapConnection[] = [];

      // Pattern: "add [element type]"
      if (lowerCommand.includes('add chart') || lowerCommand.includes('create chart')) {
        const dataList = existingElements.find((el) => el.type === 'dataList');
        if (dataList) {
          const chart = createChartElement(existingElements, dataList.id);
          newElements.push(chart);
          newConnections.push({
            id: generateConnectionId(dataList.id, chart.id),
            source: dataList.id,
            target: chart.id,
          });
          return {
            message: '✅ Added a chart connected to your data list.',
            newElements,
            newConnections,
          };
        } else {
          // Create DataList first
          const dataList = createDataListElement(existingElements);
          const chart = createChartElement([...existingElements, dataList], dataList.id);
          newElements.push(dataList, chart);
          newConnections.push({
            id: generateConnectionId(dataList.id, chart.id),
            source: dataList.id,
            target: chart.id,
          });
          return {
            message: '✅ Created a data list and added a chart.',
            newElements,
            newConnections,
          };
        }
      }

      if (lowerCommand.includes('add filter') || lowerCommand.includes('create filter')) {
        const dataList = existingElements.find((el) => el.type === 'dataList');
        if (dataList) {
          const filter = createFilterElement(existingElements, dataList.id);
          newElements.push(filter);
          newConnections.push({
            id: generateConnectionId(dataList.id, filter.id),
            source: dataList.id,
            target: filter.id,
          });
          return {
            message: '✅ Added a filter connected to your data list.',
            newElements,
            newConnections,
          };
        } else {
          return {
            message: '❌ You need a data list before adding a filter.',
          };
        }
      }

      if (lowerCommand.includes('add metric') || lowerCommand.includes('create metric')) {
        const metric = createMetricElement(existingElements);
        newElements.push(metric);
        return {
          message: '✅ Added a metric element.',
          newElements,
          newConnections,
        };
      }

      if (lowerCommand.includes('add field') || lowerCommand.includes('add data')) {
        const dataList = createDataListElement(existingElements);
        newElements.push(dataList);
        return {
          message: '✅ Added a data list. You can configure fields by clicking on it.',
          newElements,
          newConnections,
        };
      }

      if (lowerCommand.includes('add sql') || lowerCommand.includes('create query')) {
        const sql = createSQLQueryElement(existingElements);
        newElements.push(sql);
        return {
          message: '✅ Added a SQL query element.',
          newElements,
          newConnections,
        };
      }

      // Default response
      return {
        message: `💡 I can help you add elements to the canvas. Try:\n\n• "Add a chart"\n• "Add a filter"\n• "Add a metric"\n• "Add a data field"\n• "Add a SQL query"`,
      };
    } catch (error) {
      console.error('AI processing error:', error);
      return {
        message: '❌ Sorry, I encountered an error processing your request.',
      };
    } finally {
      setIsLoading(false);
    }
  }

  return {
    processCommand,
    isLoading,
    lastResponse,
  };
}

