"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
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
import { initialNodes, initialEdges, sampleWorkflowNodes, sampleWorkflowEdges } from "./_lib/initial-workflow";
import { cloneWorkflowSnapshot } from "./_lib/utils";
import type { HistoryRunEntry, NodeOutputValues } from "./_lib/types";
import { NodeValueContext, WorkflowEditContext, WorkflowRunContext, SelectionBoxNodeContext } from "./_lib/contexts";
import { nodeTypes } from "./_components/node-types";
import { edgeTypes, CustomConnectionLine } from "./_components/edges";
import { Sidebar } from "./_components/sidebar";
import { CanvasZoomKeyboardHandler, CenterNodeToolbar, TopLeftCanvasTitle } from "./_components/canvas-toolbar";
import { BottomToolbar, type CanvasInteractionMode } from "./_components/canvas-toolbar";
import { WorkflowHistorySidebar } from "./_components/history-sidebar";
import { AutoSaveIndicator, SelectionRunOverlay, TopRightCanvasControls, BottomRightCanvasControls, type AutoSaveStatus } from "./_components/canvas-controls";
import { useWorkflowRunner } from "./_hooks/use-workflow-runner";

function sanitizeNodeForPersistence(node: Node) {
  const clean = { ...node } as Record<string, unknown>;
  delete clean.selected;
  delete clean.dragging;
  delete clean.measured;
  delete clean.resizing;
  delete clean.positionAbsolute;
  delete clean.internals;
  delete clean.width;
  delete clean.height;
  return clean;
}

function sanitizeEdgeForPersistence(edge: Edge) {
  const clean = { ...edge } as Record<string, unknown>;
  delete clean.selected;
  return clean;
}

type UndoRedoEntry = { nodes: Node[]; edges: Edge[]; values: NodeOutputValues };

function buildWorkflowPersistencePayload(
  currentNodes: Node[],
  currentEdges: Edge[],
  currentNodeValues: NodeOutputValues,
  undoStack: UndoRedoEntry[],
  redoStack: UndoRedoEntry[],
) {
  return {
    nodes: currentNodes.map(sanitizeNodeForPersistence),
    edges: currentEdges.map(sanitizeEdgeForPersistence),
    nodeValues: currentNodeValues,
    undoStack,
    redoStack,
  };
}

export default function WorkflowCanvasPage() {
  const params = useParams<{ workflow_id: string }>();
  const workflowId = params.workflow_id;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [workflowLoaded, setWorkflowLoaded] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus | null>(null);

  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState(initialEdges);
  const [nodeValues, setNodeValues] = useState<NodeOutputValues>({});
  const [runningNodeIds, setRunningNodeIds] = useState<Set<string>>(new Set());
  const [pendingNodeIds, setPendingNodeIds] = useState<Set<string>>(new Set());
  const [workflowRunning, setWorkflowRunning] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryRunEntry[]>([]);
  const [interactionMode, setInteractionMode] = useState<CanvasInteractionMode>("pan");
  const [selectionBoxNodeIds, setSelectionBoxNodeIds] = useState<Set<string>>(() => new Set());
  const selectionBoxInProgressRef = useRef(false);
  const autoSaveInitializedRef = useRef(false);
  const templateWorkflowRef = useRef(false);
  const autoSaveSequenceRef = useRef(0);
  const lastPersistedWorkflowSignatureRef = useRef<string | null>(null);
  const latestNodesRef = useRef(nodes);
  const latestEdgesRef = useRef(edges);
  const latestNodeValuesRef = useRef(nodeValues);
  const [workflowDirtyRevision, setWorkflowDirtyRevision] = useState(0);
  const undoStackRef = useRef<UndoRedoEntry[]>([]);
  const redoStackRef = useRef<UndoRedoEntry[]>([]);
  const [editHistoryCounts, setEditHistoryCounts] = useState({ undo: 0, redo: 0 });

  useEffect(() => {
    latestNodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    latestEdgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    latestNodeValuesRef.current = nodeValues;
  }, [nodeValues]);

  const markWorkflowDirty = useCallback(() => {
    setWorkflowDirtyRevision((revision) => revision + 1);
  }, []);

  const refreshEditHistoryCounts = useCallback(() => {
    setEditHistoryCounts({ undo: undoStackRef.current.length, redo: redoStackRef.current.length });
  }, []);

  const recordSnapshot = useCallback(() => {
    const snap = cloneWorkflowSnapshot(nodes, edges);
    undoStackRef.current.push({ ...snap, values: JSON.parse(JSON.stringify(nodeValues)) });
    if (undoStackRef.current.length > 80) undoStackRef.current.shift();
    redoStackRef.current = [];
    markWorkflowDirty();
    refreshEditHistoryCounts();
  }, [edges, markWorkflowDirty, nodeValues, nodes, refreshEditHistoryCounts]);

  const undo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    const currentSnap = cloneWorkflowSnapshot(nodes, edges);
    redoStackRef.current.push({ ...currentSnap, values: JSON.parse(JSON.stringify(nodeValues)) });
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setNodeValues(previous.values);
    markWorkflowDirty();
    refreshEditHistoryCounts();
  }, [edges, markWorkflowDirty, nodeValues, nodes, refreshEditHistoryCounts, setEdges, setNodes]);

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    const currentSnap = cloneWorkflowSnapshot(nodes, edges);
    undoStackRef.current.push({ ...currentSnap, values: JSON.parse(JSON.stringify(nodeValues)) });
    setNodes(next.nodes);
    setEdges(next.edges);
    setNodeValues(next.values);
    markWorkflowDirty();
    refreshEditHistoryCounts();
  }, [edges, markWorkflowDirty, nodeValues, nodes, refreshEditHistoryCounts, setEdges, setNodes]);

  const canUndo = editHistoryCounts.undo > 0;
  const canRedo = editHistoryCounts.redo > 0;

  const buildPersistedWorkflowPayload = useCallback(() => buildWorkflowPersistencePayload(
    latestNodesRef.current,
    latestEdgesRef.current,
    latestNodeValuesRef.current,
    undoStackRef.current,
    redoStackRef.current,
  ), []);

  const addHistoryEntry = useCallback((entry: Omit<HistoryRunEntry, "id" | "timestamp">) => {
    const optimisticEntry = { ...entry, id: `run-${Date.now()}-${Math.random().toString(36).slice(2)}`, timestamp: Date.now() };
    setHistoryEntries((current) => [optimisticEntry, ...current]);

    void fetch(`/api/workflows/${workflowId}/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(optimisticEntry),
    })
      .then(async (response) => {
        const json = await response.json() as { run?: HistoryRunEntry; error?: string };
        if (!response.ok || !json.run) throw new Error(json.error ?? "Failed to save run history");
        setHistoryEntries((current) => current.map((item) => item.id === optimisticEntry.id ? json.run! : item));
      })
      .catch((error) => {
        toast({ description: error instanceof Error ? error.message : "Failed to save run history" });
      });
  }, [workflowId]);

  useEffect(() => {
    let canceled = false;

    async function loadWorkflow() {
      try {
        const workflowResponse = await fetch(`/api/workflows/${workflowId}`, { cache: "no-store" });
        const workflowJson = await workflowResponse.json() as { workflow?: { nodes?: Node[]; edges?: Edge[]; nodeValues?: NodeOutputValues; undoStack?: Array<{ nodes: Node[]; edges: Edge[] }>; redoStack?: Array<{ nodes: Node[]; edges: Edge[] }> }; error?: string };
        if (!workflowResponse.ok || !workflowJson.workflow) {
          templateWorkflowRef.current = true;
          const loadedNodes = sampleWorkflowNodes;
          const loadedEdges = sampleWorkflowEdges;
          const loadedNodeValues = {};
          setNodes(loadedNodes);
          setEdges(loadedEdges);
          setNodeValues(loadedNodeValues);
          undoStackRef.current = [];
          redoStackRef.current = [];
          lastPersistedWorkflowSignatureRef.current = JSON.stringify(buildWorkflowPersistencePayload(
            loadedNodes,
            loadedEdges,
            loadedNodeValues,
            [],
            [],
          ));
          refreshEditHistoryCounts();
          setWorkflowLoaded(true);
          return;
        }
        const historyResponse = await fetch(`/api/workflows/${workflowId}/history`, { cache: "no-store" });
        const historyJson = await historyResponse.json() as { runs?: HistoryRunEntry[]; error?: string };
        if (!historyResponse.ok) throw new Error(historyJson.error ?? "Failed to load history");
        if (canceled) return;
        const loadedNodes = Array.isArray(workflowJson.workflow.nodes) ? workflowJson.workflow.nodes : initialNodes;
        const loadedEdges = Array.isArray(workflowJson.workflow.edges) ? workflowJson.workflow.edges : initialEdges;
        const loadedNodeValues = workflowJson.workflow.nodeValues ?? {};
        setNodes(loadedNodes);
        setEdges(loadedEdges);
        setNodeValues(loadedNodeValues);
        const rawUndo = Array.isArray(workflowJson.workflow.undoStack) ? workflowJson.workflow.undoStack : [];
        const rawRedo = Array.isArray(workflowJson.workflow.redoStack) ? workflowJson.workflow.redoStack : [];
        undoStackRef.current = rawUndo.map((entry) => ({
          nodes: entry.nodes ?? [],
          edges: entry.edges ?? [],
          values: ("values" in entry ? entry.values : {}) as NodeOutputValues,
        }));
        redoStackRef.current = rawRedo.map((entry) => ({
          nodes: entry.nodes ?? [],
          edges: entry.edges ?? [],
          values: ("values" in entry ? entry.values : {}) as NodeOutputValues,
        }));
        lastPersistedWorkflowSignatureRef.current = JSON.stringify(buildWorkflowPersistencePayload(
          loadedNodes,
          loadedEdges,
          loadedNodeValues,
          undoStackRef.current,
          redoStackRef.current,
        ));
        refreshEditHistoryCounts();
        setHistoryEntries(historyJson.runs ?? []);
        setWorkflowLoaded(true);
      } catch (error) {
        if (!canceled) {
          toast({ description: error instanceof Error ? error.message : "Failed to load workflow" });
          setWorkflowLoaded(true);
        }
      }
    }

    void loadWorkflow();
    return () => {
      canceled = true;
    };
  }, [refreshEditHistoryCounts, setEdges, setNodes, workflowId]);

  useEffect(() => {
    if (!workflowLoaded) return;
    if (!autoSaveInitializedRef.current) {
      autoSaveInitializedRef.current = true;
      return;
    }

    if (templateWorkflowRef.current && workflowDirtyRevision === 0) return;

    const payload = buildPersistedWorkflowPayload();
    const signature = JSON.stringify(payload);
    if (signature === lastPersistedWorkflowSignatureRef.current) return;

    const sequence = autoSaveSequenceRef.current + 1;
    autoSaveSequenceRef.current = sequence;
    let dismissTimeout: number | null = null;
    const unsavedFrame = requestAnimationFrame(() => setAutoSaveStatus("unsaved"));

    const saveTimeout = window.setTimeout(() => {
      setAutoSaveStatus("saving");
      if (templateWorkflowRef.current) {
        void fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, name: "Trial Task Workflow Copy" }),
        })
          .then(async (response) => {
            if (!response.ok) throw new Error("Failed to save workflow");
            const result = await response.json() as { workflow?: { id: string } };
            const newId = result.workflow?.id;
            if (!newId) throw new Error("Failed to save workflow");
            if (autoSaveSequenceRef.current !== sequence) return;
            lastPersistedWorkflowSignatureRef.current = signature;
            setAutoSaveStatus("saved");
            window.location.href = `/app/flow/${newId}/canvas`;
          })
          .catch(() => {
            if (autoSaveSequenceRef.current !== sequence) return;
            toast({ description: "Failed to save workflow" });
            setAutoSaveStatus(null);
          });
      } else {
        void fetch(`/api/workflows/${workflowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then((response) => {
            if (!response.ok) throw new Error("Failed to save workflow");
            if (autoSaveSequenceRef.current !== sequence) return;
            lastPersistedWorkflowSignatureRef.current = signature;
            setAutoSaveStatus("saved");
            dismissTimeout = window.setTimeout(() => {
              if (autoSaveSequenceRef.current === sequence) setAutoSaveStatus(null);
            }, 1500);
          })
          .catch(() => {
            if (autoSaveSequenceRef.current !== sequence) return;
            toast({ description: "Failed to save workflow" });
            setAutoSaveStatus(null);
          });
      }
    }, 1000);

    return () => {
      cancelAnimationFrame(unsavedFrame);
      window.clearTimeout(saveTimeout);
      if (dismissTimeout) window.clearTimeout(dismissTimeout);
    };
  }, [buildPersistedWorkflowPayload, workflowDirtyRevision, workflowId, workflowLoaded]);

  const setNodeHandleValue = useCallback((nodeId: string, handleId: string, value: unknown) => {
    const currentVal = latestNodeValuesRef.current[nodeId]?.[handleId];
    if (JSON.stringify(currentVal) === JSON.stringify(value)) return;
    setNodeValues((current) => ({
      ...current,
      [nodeId]: {
        ...(current[nodeId] ?? {}),
        [handleId]: value,
      },
    }));
    if (currentVal !== undefined) markWorkflowDirty();
  }, [markWorkflowDirty]);

  const onNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeBase>[0]) => {
      if (changes.some((change) => change.type === "remove" || change.type === "add")) recordSnapshot();
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
    markWorkflowDirty,
  });

  return (
    <ReactFlowProvider>
      <Toaster />
      <div className="flex h-screen w-full">
        {/* <PromoTopbar /> */}
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

        <div className="relative flex-1 overflow-hidden">
          {!workflowLoaded ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#444444]" />
            </div>
          ) : (
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
          onNodeDragStart={recordSnapshot}
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

          defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
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
          <TopLeftCanvasTitle sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <AutoSaveIndicator status={autoSaveStatus} />
          <TopRightCanvasControls />
          <BottomRightCanvasControls />
          <BottomToolbar interactionMode={interactionMode} setInteractionMode={setInteractionMode} />
          <CenterNodeToolbar onAddGemini={handleAddGemini} onAddCrop={handleAddCrop} onAddStickyNote={handleAddStickyNote} />
          </ReactFlow>
          </SelectionBoxNodeContext.Provider>
          </WorkflowEditContext.Provider>
          </WorkflowRunContext.Provider>
          </NodeValueContext.Provider>
          )}
        </div>
      </div>
    </ReactFlowProvider>
  );
}
