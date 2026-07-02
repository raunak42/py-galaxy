"use client";

import { createContext, useContext } from "react";
import { useEdges } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import type { NodeValueContextValue, WorkflowEditContextValue, WorkflowRunContextValue } from "./types";
export const NodeValueContext = createContext<NodeValueContextValue | null>(null);
export const WorkflowRunContext = createContext<WorkflowRunContextValue | null>(null);
export const WorkflowEditContext = createContext<WorkflowEditContextValue | null>(null);
export const SelectionBoxNodeContext = createContext<Set<string>>(new Set<string>());

export function useNodeValueContext() {
  const context = useContext(NodeValueContext);
  if (!context) throw new Error("useNodeValueContext must be used inside NodeValueContext.Provider");
  return context;
}

export function useWorkflowRunContext() {
  const context = useContext(WorkflowRunContext);
  if (!context) throw new Error("useWorkflowRunContext must be used inside WorkflowRunContext.Provider");
  return context;
}

export function useWorkflowEditContext() {
  const context = useContext(WorkflowEditContext);
  if (!context) throw new Error("useWorkflowEditContext must be used inside WorkflowEditContext.Provider");
  return context;
}

export function cloneWorkflowSnapshot(nodes: Node[], edges: Edge[]) {
  return {
    nodes: nodes.map((node) => ({ ...node, data: { ...(node.data ?? {}) }, position: { ...node.position } })),
    edges: edges.map((edge) => ({ ...edge, data: edge.data ? { ...edge.data } : edge.data, style: edge.style ? { ...edge.style } : edge.style })),
  };
}

export function useConnectedInputValue(nodeId: string, handleId: string) {
  const connected = useConnectedInputValues(nodeId, handleId);
  return { isConnected: connected.isConnected, value: connected.values[0] };
}

export function useConnectedInputValues(nodeId: string, handleId: string) {
  const edges = useEdges();
  const { values } = useNodeValueContext();
  const matchedEdges = edges.filter((item) => item.target === nodeId && item.targetHandle === handleId);
  return {
    isConnected: matchedEdges.length > 0,
    values: matchedEdges.map((edge) => {
      const sourceHandle = edge.sourceHandle ?? "result";
      const sourceValues = values[edge.source] ?? {};
      return sourceValues[sourceHandle];
    }),
  };
}
