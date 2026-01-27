'use client';

import { Handle, Position } from 'reactflow';
import { useCallback, useMemo, useState } from 'react';
import { useMapView, mapActions } from '@/state/mapView';
import { AddElementButton } from './AddElementButton';
import { ChartPanel } from '../ChartPanel';
import { AppProvider, useApp } from '@/state/app';
import type { ChartElementData, DataListElementData, FilterElementData } from '@/types/mapElements';
import { createDataListElement, createFilterElement, generateConnectionId } from '@/lib/mapElementCreation';
import { TIMESTAMP_FIELD_BY_OBJECT } from '@/lib/fields';
import { getObject } from '@/data/schema';

/**
 * ChartNode - Shows actual chart using ChartPanel with DataList data
 */
export function ChartNode({ data, id }: { data: ChartElementData & { isSelected?: boolean; onHoverChange?: (isHovered: boolean, elementId: string) => void }; id: string }) {
  const { state: mapState, dispatch } = useMapView();
  const { state: globalAppState } = useApp();
  const [isHovered, setIsHovered] = useState(false);
  const [openMenuCount, setOpenMenuCount] = useState(0);
  
  // Find parent DataList via connection
  const parentElement = useMemo(() => {
    if (data.parentDataListId) {
      return mapState.elements.find(el => el.id === data.parentDataListId);
    }
    
    const incomingConnection = mapState.connections.find(conn => conn.target === id);
    if (incomingConnection) {
      return mapState.elements.find(el => el.id === incomingConnection.source);
    }
    
    return null;
  }, [data.parentDataListId, mapState.elements, mapState.connections, id]);

  // Find the DataList
  const dataListElement = useMemo(() => {
    if (!parentElement) return null;
    
    if (parentElement.type === 'dataList') {
      return parentElement;
    }
    
    const parentData = parentElement.data as any;
    if (parentData.parentDataListId) {
      const upstream = mapState.elements.find(el => el.id === parentData.parentDataListId);
      if (upstream && upstream.type === 'dataList') {
        return upstream;
      }
    }
    
    const findUpstreamDataList = (elementId: string, visited = new Set<string>()): any => {
      if (visited.has(elementId)) return null;
      visited.add(elementId);
      
      const incomingConn = mapState.connections.find(conn => conn.target === elementId);
      if (!incomingConn) return null;
      
      const sourceEl = mapState.elements.find(el => el.id === incomingConn.source);
      if (!sourceEl) return null;
      
      if (sourceEl.type === 'dataList') return sourceEl;
      
      return findUpstreamDataList(sourceEl.id, visited);
    };
    
    return findUpstreamDataList(parentElement.id);
  }, [parentElement, mapState.elements, mapState.connections]);

  const dataListData = dataListElement?.data as DataListElementData | undefined;
  const hasConnection = !!dataListData;

  const dateField = useMemo(() => {
    if (!dataListData?.selectedObjects?.length) return null;
    const primaryObject = dataListData.selectedObjects[0];
    const objectSchema = getObject(primaryObject) || getObject(`${primaryObject}s`);
    const candidateFields = [
      ...(TIMESTAMP_FIELD_BY_OBJECT[primaryObject] || []),
      ...(TIMESTAMP_FIELD_BY_OBJECT[`${primaryObject}s`] || []),
    ];
    const selectedTimestamp = candidateFields.find((field) =>
      objectSchema?.fields.some((schemaField) => schemaField.name === field)
    );
    if (selectedTimestamp) {
      return { object: primaryObject, field: selectedTimestamp };
    }
    const fallback = (dataListData.selectedFields || []).find((field) => {
      const schemaObj = getObject(field.object);
      const schemaField = schemaObj?.fields.find((f) => f.name === field.field);
      return schemaField?.type === 'date';
    });
    return fallback || null;
  }, [dataListData]);

  // Create a modified app state with the DataList's data
  const chartAppState = useMemo(() => {
    if (!dataListData) return null;
    
    return {
      ...globalAppState,
      selectedFields: dataListData.selectedFields || [],
      selectedObjects: dataListData.selectedObjects || [],
      showChart: true,
      chart: {
        ...globalAppState.chart,
        type: data.chartType || globalAppState.chart.type,
      },
    };
  }, [dataListData, globalAppState, data.chartType]);

  const handleBucketDrilldown = useCallback((bucket: { start: string; end: string; label: string }) => {
    if (!dataListElement || !dataListData || !dateField) return;
    const chartElement = mapState.elements.find((el) => el.id === id);
    if (!chartElement) return;

    const chartWidth = 600;
    const filterWidth = 360;
    const gap = 120;
    const baseX = chartElement.position.x;
    const baseY = chartElement.position.y;

    const filterElement = createFilterElement(mapState.elements, dataListElement.id);
    filterElement.position = { x: baseX + chartWidth + gap, y: baseY };
    if (filterElement.type === 'filter') {
      const filterData = filterElement.data as FilterElementData;
      filterElement.data = {
        ...filterData,
        label: 'Date filter',
        conditions: [
          {
            field: { object: dateField.object, field: dateField.field },
            qualifiedField: `${dateField.object}.${dateField.field}`,
            operator: 'between',
            value: [bucket.start, bucket.end],
          },
        ],
      };
    }

    const newDataList = createDataListElement(
      mapState.elements,
      dataListData.selectedFields,
      dataListData.selectedObjects
    );
    newDataList.position = { x: filterElement.position.x + filterWidth + gap, y: baseY };

    dispatch(mapActions.addElement(filterElement));
    dispatch(mapActions.addElement(newDataList));
    dispatch(mapActions.addConnection({
      id: generateConnectionId(id, filterElement.id),
      source: id,
      target: filterElement.id,
    }));
    dispatch(mapActions.addConnection({
      id: generateConnectionId(filterElement.id, newDataList.id),
      source: filterElement.id,
      target: newDataList.id,
    }));
  }, [dataListElement, dataListData, dateField, mapState.elements, id, dispatch]);

  return (
    <div
      onMouseEnter={() => {
        setIsHovered(true);
        data.onHoverChange?.(true, id);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        data.onHoverChange?.(false, id);
      }}
      style={{
        position: 'relative',
        padding: '110px',
        margin: '-110px',
      }}
    >
      <div
        style={{
          position: 'relative', // Add relative positioning for button placement
          borderRadius: '12px',
          backgroundColor: 'var(--bg-surface)',
          border: data.isSelected 
            ? '1px solid #675DFF' 
            : isHovered 
            ? '1px solid #b8b3ff' 
            : '1px solid var(--border-default)',
          overflow: 'visible',
          minWidth: '600px',
          maxWidth: '600px',
          transition: 'all 0.15s ease-in-out',
          cursor: 'pointer',
        }}
      >
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: 'var(--chart-line-primary)',
            width: '8px',
            height: '8px',
            border: '2px solid var(--bg-elevated)',
          }}
        />

        {hasConnection && chartAppState ? (
          <div className="chart-node-wrapper">
            <style dangerouslySetInnerHTML={{
              __html: `
                .chart-node-wrapper > div > div:first-child {
                  display: none !important;
                }
              `
            }} />
            <AppProvider initialState={chartAppState} key={`${id}-${data.chartType || 'line'}`}>
              <ChartPanel isCompact hideControlChips onBucketClick={handleBucketDrilldown} />
            </AppProvider>
          </div>
        ) : (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>📊</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Connect to a data source to visualize
            </div>
          </div>
        )}

        <Handle
          type="source"
          position={Position.Right}
          style={{
            background: 'var(--chart-line-primary)',
            width: '8px',
            height: '8px',
            border: '2px solid var(--bg-elevated)',
          }}
        />
        
        {/* Add Element Buttons */}
        {(isHovered || data.isSelected || openMenuCount > 0) && (
          <>
            <AddElementButton 
              parentElementId={id} 
              position="left" 
              onHoverChange={data.onHoverChange}
              onMenuStateChange={(isOpen) => setOpenMenuCount(prev => isOpen ? prev + 1 : Math.max(0, prev - 1))}
            />
            <AddElementButton 
              parentElementId={id} 
              position="right" 
              onHoverChange={data.onHoverChange}
              onMenuStateChange={(isOpen) => setOpenMenuCount(prev => isOpen ? prev + 1 : Math.max(0, prev - 1))}
            />
            <AddElementButton 
              parentElementId={id} 
              position="bottom" 
              onHoverChange={data.onHoverChange}
              onMenuStateChange={(isOpen) => setOpenMenuCount(prev => isOpen ? prev + 1 : Math.max(0, prev - 1))}
            />
          </>
        )}
      </div>
    </div>
  );
}
