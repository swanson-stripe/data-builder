'use client';

import { useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { ReactFlowProvider } from 'reactflow';
import { useApp } from '@/state/app';
import { useMapView, mapActions } from '@/state/mapView';
import { loadMapState, saveMapState } from '@/lib/mapSession';
import { generateMapFromAppState, shouldAutoGenerate } from '@/lib/mapAutoGeneration';
import { MapCanvas } from './MapCanvas';
import { MapConfigPanel } from './MapConfigPanel';
import { ElementConfigPanel } from './ElementConfigPanel';

/**
 * MapView - Canvas-based workflow visualizer
 * Displays report configuration as draggable, connectable elements
 */
export function MapView() {
  const params = useParams();
  const reportSlug = params.report as string;
  const { state: appState } = useApp();
  const { state: mapState, dispatch: mapDispatch } = useMapView();
  const hasInitialized = useRef(false); // Prevent double initialization

  // Load saved map state on mount, or auto-generate from AppState
  useEffect(() => {
    // Prevent double initialization
    if (hasInitialized.current) {
      console.log('[MapView] Already initialized, skipping');
      return;
    }

    // Debug logging
    console.log('[MapView] Effect running:', {
      reportSlug,
      hasElements: mapState.elements.length > 0,
      selectedFields: appState.selectedFields,
      selectedObjects: appState.selectedObjects,
      filters: appState.filters,
      metricBlocks: appState.metricBlocks,
      showChart: appState.showChart,
    });

    // Don't do anything if we already have elements
    if (mapState.elements.length > 0) {
      console.log('[MapView] Already have elements, skipping');
      hasInitialized.current = true;
      return;
    }

    const savedState = loadMapState(reportSlug);
    
    // Check if saved state has valid data
    if (savedState && savedState.elements && savedState.elements.length > 0) {
      // Validate that saved elements actually have data
      const hasValidData = savedState.elements.some(el => {
        if (el.type === 'dataList' && el.data.type === 'dataList') {
          return (el.data.selectedFields?.length > 0 || el.data.selectedObjects?.length > 0);
        }
        return true; // Other element types are OK
      });

      if (hasValidData) {
        // Load saved state
        console.log('[MapView] Loading saved state:', savedState.elements.length, 'elements');
        mapDispatch(mapActions.loadMapState(savedState));
        hasInitialized.current = true;
        return;
      } else {
        // Saved state is invalid, clear it
        console.log('[MapView] Saved state has invalid data, clearing and regenerating');
        sessionStorage.removeItem(`map-state-${reportSlug}`);
      }
    }

    // Check if AppState has data before generating
    const hasAppData = 
      appState.selectedFields.length > 0 || 
      appState.selectedObjects.length > 0 ||
      (appState.filters.conditions && appState.filters.conditions.length > 0) ||
      appState.metricBlocks.length > 0 ||
      appState.showChart;

    console.log('[MapView] hasAppData:', hasAppData);

    if (hasAppData && shouldAutoGenerate(mapState.elements)) {
      // Auto-generate from current AppState
      console.log('[MapView] Auto-generating from AppState');
      const { elements, connections } = generateMapFromAppState(appState);
      
      console.log('[MapView] Generated:', {
        elementCount: elements.length,
        connectionCount: connections.length,
        elements: elements.map(e => ({ type: e.type, data: e.data })),
      });
      
      // Load the generated elements and connections
      elements.forEach((element) => {
        mapDispatch(mapActions.addElement(element));
      });
      connections.forEach((connection) => {
        mapDispatch(mapActions.addConnection(connection));
      });
      
      hasInitialized.current = true;
    }
  }, [reportSlug, appState.selectedFields.length, appState.selectedObjects.length]); // Only depend on data counts, not full arrays

  // Save map state when it changes
  useEffect(() => {
    if (mapState.elements.length > 0 || mapState.connections.length > 0) {
      saveMapState(reportSlug, {
        elements: mapState.elements,
        connections: mapState.connections,
        viewport: mapState.viewport,
      });
    }
  }, [reportSlug, mapState.elements, mapState.connections, mapState.viewport]);

  return (
    <ReactFlowProvider>
      <div className="h-full w-full flex dot-grid-bg" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {/* Left Config Panel */}
        <MapConfigPanel />

        {/* Main Canvas Area */}
        <div className="flex-1 relative">
          <MapCanvas />
        </div>

        {/* Element Config Panel (appears when element selected) */}
        <ElementConfigPanel />
      </div>
    </ReactFlowProvider>
  );
}

