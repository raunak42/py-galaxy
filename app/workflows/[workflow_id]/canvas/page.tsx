"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  SelectionMode,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import type { OnConnectEnd } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast, Toaster } from "@/lib/toast";
import { MIN_ZOOM, MAX_ZOOM, PERMANENT_NODE_IDS, HANDLE_COLORS, handleTypeFromId, areTypesCompatible, wouldCreateCycle } from "./_lib/constants";
import { initialNodes, initialEdges } from "./_lib/initial-workflow";
import { cloneWorkflowSnapshot } from "./_lib/utils";
import type { HistoryRunEntry, NodeOutputValues } from "./_lib/types";
import { NodeValueContext, WorkflowEditContext, WorkflowRunContext, SelectionBoxNodeContext } from "./_lib/contexts";
import { nodeTypes } from "./_components/node-types";
import { edgeTypes, CustomConnectionLine } from "./_components/edges";
import { Sidebar } from "./_components/sidebar";
import { CanvasZoomKeyboardHandler, CenterNodeToolbar, TopLeftCanvasTitle } from "./_components/canvas-toolbar";
import { BottomToolbar, type CanvasInteractionMode } from "./_components/canvas-toolbar";
import { WorkflowHistorySidebar } from "./_components/history-sidebar";
import { SelectionRunOverlay, TopRightCanvasControls, BottomRightCanvasControls } from "./_components/canvas-controls";
import { useWorkflowRunner } from "./_hooks/use-workflow-runner";

export default function WorkflowCanvasPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState(initialEdges);
  const [nodeValues, setNodeValues] = useState<NodeOutputValues>({});
  const [runningNodeIds, setRunningNodeIds] = useState<Set<string>>(new Set());
  const [pendingNodeIds, setPendingNodeIds] = useState<Set<string>>(new Set());
  const [workflowRunning, setWorkflowRunning] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryRunEntry[]>([]);
  const [interactionMode, setInteractionMode] = useState<CanvasInteractionMode>("select");
  const [selectionBoxNodeIds, setSelectionBoxNodeIds] = useState<Set<string>>(() => new Set());
  const selectionBoxInProgressRef = useRef(false);
  const undoStackRef = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const redoStackRef = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const [editHistoryCounts, setEditHistoryCounts] = useState({ undo: 0, redo: 0 });

  const refreshEditHistoryCounts = useCallback(() => {
    setEditHistoryCounts({ undo: undoStackRef.current.length, redo: redoStackRef.current.length });
  }, []);

  const recordSnapshot = useCallback(() => {
    undoStackRef.current.push(cloneWorkflowSnapshot(nodes, edges));
    if (undoStackRef.current.length > 80) undoStackRef.current.shift();
    redoStackRef.current = [];
    refreshEditHistoryCounts();
  }, [edges, nodes, refreshEditHistoryCounts]);

  const undo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    redoStackRef.current.push(cloneWorkflowSnapshot(nodes, edges));
    setNodes(previous.nodes);
    setEdges(previous.edges);
    refreshEditHistoryCounts();
  }, [edges, nodes, refreshEditHistoryCounts, setEdges, setNodes]);

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(cloneWorkflowSnapshot(nodes, edges));
    setNodes(next.nodes);
    setEdges(next.edges);
    refreshEditHistoryCounts();
  }, [edges, nodes, refreshEditHistoryCounts, setEdges, setNodes]);

  const canUndo = editHistoryCounts.undo > 0;
  const canRedo = editHistoryCounts.redo > 0;

  const addHistoryEntry = useCallback((entry: Omit<HistoryRunEntry, "id" | "timestamp">) => {
    setHistoryEntries((current) => [
      { ...entry, id: `run-${Date.now()}-${Math.random().toString(36).slice(2)}`, timestamp: Date.now() },
      ...current,
    ]);
  }, []);

  const setNodeHandleValue = useCallback((nodeId: string, handleId: string, value: unknown) => {
    setNodeValues((current) => {
      if (current[nodeId]?.[handleId] === value) return current;
      return {
        ...current,
        [nodeId]: {
          ...(current[nodeId] ?? {}),
          [handleId]: value,
        },
      };
    });
  }, []);

  const onNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeBase>[0]) => {
      const meaningful = changes.some((change) => {
        const maybeDragging = "dragging" in change ? change.dragging : false;
        return change.type === "remove" || change.type === "add" || (change.type === "position" && !maybeDragging);
      });
      if (meaningful) recordSnapshot();
      onNodesChangeBase(
        changes.filter(
          (change) => change.type !== "remove" || !PERMANENT_NODE_IDS.has(change.id),
        ),
      );
    },
    [onNodesChangeBase, recordSnapshot],
  );

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChangeBase>[0]) => {
      if (changes.some((change) => change.type === "remove" || change.type === "add")) recordSnapshot();
      onEdgesChangeBase(changes);
    },
    [onEdgesChangeBase, recordSnapshot],
  );

  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      const sourceType = handleTypeFromId(connection.sourceHandle);
      const targetType = handleTypeFromId(connection.targetHandle);
      if (!areTypesCompatible(sourceType, targetType)) return false;
      if (connection.source === connection.target) return false;
      if (wouldCreateCycle(edges, connection.source, connection.target)) return false;
      return true;
    },
    [edges],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceType = handleTypeFromId(connection.sourceHandle);
      const targetType = handleTypeFromId(connection.targetHandle);
      if (!areTypesCompatible(sourceType, targetType)) return;
      if (connection.source === connection.target) return;
      if (wouldCreateCycle(edges, connection.source, connection.target)) return;
      const color = HANDLE_COLORS[sourceType] ?? "#f59e0b";
      recordSnapshot();
      setEdges((eds) =>
        addEdge(
          { ...connection, type: "removable", animated: false, style: { stroke: color, strokeWidth: 2 } },
          eds,
        ),
      );
    },
    [setEdges, edges, recordSnapshot],
  );

  const onConnectEnd = useCallback<OnConnectEnd>(
    (_event, connectionState) => {
      if ("isValid" in connectionState && !connectionState.isValid && connectionState.toNode && connectionState.toHandle) {
        const sourceType = handleTypeFromId(connectionState.fromHandle.id);
        const targetType = handleTypeFromId(connectionState.toHandle.id);
        let reason = "Invalid connection";
        if (sourceType !== targetType) {
          reason = `Cannot connect ${sourceType} output to ${targetType} input`;
        } else if (connectionState.fromNode.id === connectionState.toNode.id) {
          reason = "Cannot connect to the same node";
        } else {
          reason = "This connection would create a cycle";
        }
        toast({ description: reason });
      }
    },
    [],
  );

  const selectOnlyNode = useCallback(
    (nodeId: string | null) => {
      setSelectionBoxNodeIds(new Set());
      setNodes((nds) => nds.map((node) => ({ ...node, selected: nodeId === null ? false : node.id === nodeId })));
    },
    [setNodes],
  );

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const nodeEl = target.closest(".react-flow__node");
      if (nodeEl instanceof HTMLElement) {
        if (event.shiftKey || event.ctrlKey || event.metaKey) return;
        const nodeId = nodeEl.getAttribute("data-id");
        if (nodeId) selectOnlyNode(nodeId);
        return;
      }
      if (target.closest("[data-preserve-selection='true']")) return;
      if (!target.closest("[role='menu'], .react-flow__edge, [data-selection-run-button='true']")) {
        selectOnlyNode(null);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [selectOnlyNode]);

  const handleAddGemini = useCallback(() => {
    recordSnapshot();
    setNodes((nds) => [
      ...nds,
      {
        id: `gemini-${Date.now()}`,
        type: "geminiPreview",
        position: { x: 420, y: 120 },
        data: {},
      },
    ]);
  }, [recordSnapshot, setNodes]);

  const handleAddCrop = useCallback(() => {
    recordSnapshot();
    setNodes((nds) => [
      ...nds,
      {
        id: `crop-${Date.now()}`,
        type: "cropImage",
        position: { x: 360, y: 360 },
        data: {},
      },
    ]);
  }, [recordSnapshot, setNodes]);

  const handleAddStickyNote = useCallback(() => {
    recordSnapshot();
    setNodes((nds) => [
      ...nds,
      {
        id: `sticky-${Date.now()}`,
        type: "stickyNote",
        position: { x: 420, y: 200 },
        data: { color: "#fef9c3", fontSize: 24, fontFamily: "sans-serif", bold: true, text: "" },
      },
    ]);
  }, [recordSnapshot, setNodes]);

  const { runWorkflow, runSelectedNodes, cancelWorkflow, selectedExecutableCount } = useWorkflowRunner({
    nodes,
    edges,
    nodeValues,
    setNodeValues,
    setNodes,
    setEdges,
    workflowRunning,
    setWorkflowRunning,
    setRunningNodeIds,
    setPendingNodeIds,
    addHistoryEntry,
    setSelectionBoxNodeIds,
  });

  return (
    <ReactFlowProvider>
      <Toaster />
      <div className="flex h-screen w-full">
        {/* <PromoTopbar /> */}
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

        <div className="relative flex-1">
          <NodeValueContext.Provider value={{ values: nodeValues, setNodeHandleValue }}>
          <WorkflowRunContext.Provider value={{ runningNodeIds, pendingNodeIds, runWorkflow, runSelectedNodes, cancelWorkflow, workflowRunning, selectedExecutableCount, addHistoryEntry, historyEntries, historyOpen, setHistoryOpen }}>
          <WorkflowEditContext.Provider value={{ undo, redo, recordSnapshot, canUndo, canRedo }}>
          <SelectionBoxNodeContext.Provider value={selectionBoxNodeIds}>
          <WorkflowHistorySidebar />
          <SelectionRunOverlay nodes={nodes} />
          <ReactFlow
            nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          onNodeClick={(event, node) => {
            setSelectionBoxNodeIds(new Set());
            if (event.shiftKey || event.ctrlKey || event.metaKey) {
              setNodes((nds) => nds.map((item) => item.id === node.id ? { ...item, selected: !item.selected } : item));
              return;
            }
            selectOnlyNode(node.id);
          }}
          onPaneClick={() => selectOnlyNode(null)}
          onSelectionStart={() => {
            selectionBoxInProgressRef.current = true;
            setSelectionBoxNodeIds(new Set());
          }}
          onSelectionChange={({ nodes: selectedNodes }) => {
            if (!selectionBoxInProgressRef.current) return;
            setSelectionBoxNodeIds(new Set(selectedNodes.map((node) => node.id)));
          }}
          onSelectionEnd={() => {
            selectionBoxInProgressRef.current = false;
          }}
          isValidConnection={isValidConnection}
          connectionLineComponent={CustomConnectionLine}
          panOnDrag={interactionMode === "pan"}
          selectionOnDrag={interactionMode === "select"}
          selectionMode={SelectionMode.Partial}
          panOnScroll={false}
          selectNodesOnDrag={false}

          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          // canvas background color, matched from reference screenshots (#f4f4f4)
          style={{ backgroundColor: "#f4f4f4" }}
        >
          {/* dot grid: gap=30.5, size=2.5 (radius) */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={30.5}
            size={2.5}
            color="#cacaca"
          />
          <CanvasZoomKeyboardHandler />
          <TopLeftCanvasTitle />
          <TopRightCanvasControls />
          <BottomRightCanvasControls />
          <BottomToolbar interactionMode={interactionMode} setInteractionMode={setInteractionMode} />
          <CenterNodeToolbar onAddGemini={handleAddGemini} onAddCrop={handleAddCrop} onAddStickyNote={handleAddStickyNote} />
          </ReactFlow>
          </SelectionBoxNodeContext.Provider>
          </WorkflowEditContext.Provider>
          </WorkflowRunContext.Provider>
          </NodeValueContext.Provider>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
