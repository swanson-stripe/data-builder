'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  ConnectionLineType,
  MarkerType,
  Node,
  Edge,
  Connection,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  BackgroundVariant,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useMapView, mapActions } from '@/state/mapView';
import { MapElement, MapConnection } from '@/types/mapElements';
import { BaseNode } from './canvas/BaseNode';
import { DataListNode } from './canvas/DataListNode';
import { ChartNode } from './canvas/ChartNode';
import { FilterNode } from './canvas/FilterNode';
import { MetricNode } from './canvas/MetricNode';
import { SQLQueryNode } from './canvas/SQLQueryNode';
import { FloatingConfigPanel } from './canvas/FloatingConfigPanel';
import { useReactFlow } from 'reactflow';

/**
 * MapCanvas - React Flow canvas for draggable elements
 */
export function MapCanvas() {
  const { state, dispatch } = useMapView();
  const reactFlowInstance = useReactFlow();

  // Local nodes state for React Flow to manage during drag
  const [localNodes, setLocalNodes] = useState<Node[]>([]);
  
  // Hover state for showing config panel
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const nodeHoverActiveRef = useRef(false);
  const panelHoverActiveRef = useRef(false);
  const hoverClearTimeoutRef = useRef<number | null>(null);

  const handleNodeHoverChange = useCallback((isHovered: boolean, elementId: string) => {
    if (isHovered) {
      nodeHoverActiveRef.current = true;
      if (hoverClearTimeoutRef.current) {
        window.clearTimeout(hoverClearTimeoutRef.current);
        hoverClearTimeoutRef.current = null;
      }
      setHoveredElementId(elementId);
      return;
    }

    nodeHoverActiveRef.current = false;
    if (hoverClearTimeoutRef.current) {
      window.clearTimeout(hoverClearTimeoutRef.current);
    }
    hoverClearTimeoutRef.current = window.setTimeout(() => {
      if (!panelHoverActiveRef.current) {
        setHoveredElementId((prev) => (prev === elementId ? null : prev));
      }
      hoverClearTimeoutRef.current = null;
    }, 100);
  }, []);

  const handlePanelHoverChange = useCallback((isHovered: boolean) => {
    panelHoverActiveRef.current = isHovered;
    if (isHovered && hoverClearTimeoutRef.current) {
      window.clearTimeout(hoverClearTimeoutRef.current);
      hoverClearTimeoutRef.current = null;
    }
    if (!isHovered && !nodeHoverActiveRef.current) {
      setHoveredElementId(null);
    }
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.metaKey) return;
    event.preventDefault();
    event.stopPropagation();

    const viewport = reactFlowInstance.getViewport();
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const nextZoom = Math.min(1.5, Math.max(0.5, viewport.zoom * zoomFactor));
    reactFlowInstance.zoomTo(nextZoom);
  }, [reactFlowInstance]);

  // Register custom node types
  const nodeTypes: NodeTypes = useMemo(
    () => ({
      dataList: DataListNode,
      chart: ChartNode,
      filter: FilterNode,
      grouping: BaseNode, // TODO: Create GroupingNode
      metric: MetricNode,
      sqlQuery: SQLQueryNode,
    }),
    []
  );

  // Sync state.elements to localNodes when state changes
  useEffect(() => {
    const newNodes = state.elements.map((element) => ({
      id: element.id,
      type: element.type,
      position: element.position,
      data: {
        ...element.data,
        isSelected: element.id === state.selectedElementId,
        onHoverChange: handleNodeHoverChange,
      },
      selected: element.id === state.selectedElementId,
      draggable: true,
    }));
    setLocalNodes(newNodes);
  }, [state.elements, state.selectedElementId, handleNodeHoverChange]);

  // Convert MapConnections to React Flow edges
  const edges: Edge[] = useMemo(
    () =>
      state.connections.map((connection) => ({
        id: connection.id,
        source: connection.source,
        target: connection.target,
        type: 'default',
        animated: false,
        style: {
          stroke: 'var(--chart-line-primary)',
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: 'var(--chart-line-primary)',
        },
      })),
    [state.connections]
  );

  // Handle node changes - let React Flow update visually
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setLocalNodes((nds) => applyNodeChanges(changes, nds));
    },
    []
  );

  // Handle node position changes (dragging) - only save to state when drag ends
  const onNodeDragStop = useCallback(
    (_: any, node: Node) => {
      dispatch(
        mapActions.updateElement(node.id, {
          position: node.position,
        })
      );
    },
    [dispatch]
  );

  // Handle node click for selection
  const onNodeClick = useCallback(
    (_: any, node: Node) => {
      dispatch(mapActions.selectElement(node.id));
    },
    [dispatch]
  );

  // Handle pane click for deselection
  const onPaneClick = useCallback(() => {
    dispatch(mapActions.deselectElement());
  }, [dispatch]);

  // Handle node deletion
  const onNodesDelete = useCallback(
    (nodesToDelete: Node[]) => {
      nodesToDelete.forEach((node) => {
        dispatch(mapActions.deleteElement(node.id));
      });
    },
    [dispatch]
  );

  // Handle new connections (dragging between nodes)
  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        const newConnection: MapConnection = {
          id: `conn_${connection.source}_${connection.target}_${Date.now()}`,
          source: connection.source,
          target: connection.target,
        };
        dispatch(mapActions.addConnection(newConnection));
      }
    },
    [dispatch]
  );

  // Handle edge deletion
  const onEdgesDelete = useCallback(
    (edgesToDelete: Edge[]) => {
      edgesToDelete.forEach((edge) => {
        dispatch(mapActions.deleteConnection(edge.id));
      });
    },
    [dispatch]
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isTextInput) return;

      // Delete selected element
      if (
        (event.key === 'Backspace' || event.key === 'Delete') &&
        state.selectedElementId
      ) {
        dispatch(mapActions.deleteElement(state.selectedElementId));
      }
      // Deselect on Escape
      else if (event.key === 'Escape' && state.selectedElementId) {
        dispatch(mapActions.deselectElement());
      }
      // Cmd + / Cmd - zoom
      else if (event.metaKey && (event.key === '=' || event.key === '-')) {
        event.preventDefault();
        const viewport = reactFlowInstance.getViewport();
        const zoomFactor = event.key === '=' ? 1.1 : 0.9;
        const nextZoom = Math.min(1.5, Math.max(0.5, viewport.zoom * zoomFactor));
        reactFlowInstance.zoomTo(nextZoom);
      }
      // Opt-1: fit all elements
      else if (event.altKey && event.code === 'Digit1') {
        event.preventDefault();
        reactFlowInstance.fitView({ padding: 0.2 });
      }
      // Opt-0: zoom to 100% (no pan)
      else if (event.altKey && event.code === 'Digit0') {
        event.preventDefault();
        reactFlowInstance.setViewport({ x: 0, y: 0, zoom: 1 });
      }
      // Opt-2: zoom + center selected element
      else if (event.altKey && event.code === 'Digit2') {
        if (!state.selectedElementId) return;
        event.preventDefault();
        const node = reactFlowInstance.getNode(state.selectedElementId);
        if (node) {
          reactFlowInstance.fitView({ nodes: [node], padding: 0.3, maxZoom: 1.5 });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (hoverClearTimeoutRef.current) {
        window.clearTimeout(hoverClearTimeoutRef.current);
        hoverClearTimeoutRef.current = null;
      }
    };
  }, [state.selectedElementId, dispatch, reactFlowInstance]);

  return (
    <div className="w-full h-full" onWheel={handleWheel}>
      <ReactFlow
        nodes={localNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.5}
        maxZoom={1.5}
        fitView={false}
        panOnScroll
        zoomOnScroll={false}
        selectNodesOnDrag={false}
        multiSelectionKeyCode={null}
        deleteKeyCode="Backspace"
        connectionLineStyle={{ stroke: 'var(--chart-line-primary)', strokeWidth: 2 }}
        connectionLineType={ConnectionLineType.SmoothStep}
        proOptions={{ hideAttribution: true }}
        style={{
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        {/* Dot grid background */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="var(--border-subtle)"
        />
      </ReactFlow>

      {/* Floating config panel for hovered or selected element */}
      {(() => {
        const configElementId = hoveredElementId || state.selectedElementId;
        if (configElementId) {
          const element = state.elements.find((el) => el.id === configElementId);
          if (element) {
            return (
              <FloatingConfigPanel
                selectedElement={element}
                nodePosition={element.position}
                onHoverChange={handlePanelHoverChange}
              />
            );
          }
        }
        return null;
      })()}

      {/* Empty state message */}
      {state.elements.length === 0 && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ color: 'var(--text-secondary)' }}
        >
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              style={{ margin: '0 auto 16px', opacity: 0.5 }}
            >
              <rect
                x="8"
                y="8"
                width="32"
                height="32"
                rx="4"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <path
                d="M24 20V28M20 24H28"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              Get started with your workflow
            </h3>
            <p style={{ fontSize: '14px', opacity: 0.8 }}>
              Use the panel on the left to add data, charts, filters, and more to your canvas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

