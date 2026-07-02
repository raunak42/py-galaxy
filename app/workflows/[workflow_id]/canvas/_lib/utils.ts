import type { Edge, Node } from "@xyflow/react";
import { GEMINI_MODEL_NAME } from "./constants";
export function cloneWorkflowSnapshot(nodes: Node[], edges: Edge[]) {
  return {
    nodes: nodes.map((node) => ({ ...node, data: { ...(node.data ?? {}) }, position: { ...node.position } })),
    edges: edges.map((edge) => ({ ...edge, data: edge.data ? { ...edge.data } : edge.data, style: edge.style ? { ...edge.style } : edge.style })),
  };
}

export function displayConnectedValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(displayConnectedValue).filter(Boolean).join(", ");
  return JSON.stringify(value);
}

export function valueToStringArray(value: unknown): string[] {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(valueToStringArray);
  const text = displayConnectedValue(value);
  return text ? [text] : [];
}

export function isImageUrl(value: string) {
  return value.startsWith("data:image/") || /^https?:\/\//i.test(value) && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(value);
}

export function nodeHistoryLabel(node: Node) {
  if (node.id === "gemini-1") return "Gemini #1 — Product description";
  if (node.id === "gemini-2") return "Gemini #2 — Tweet hook";
  if (node.id === "gemini-final") return "Final Gemini — Marketing post";
  if (node.id === "crop-1") return "Crop Image #1 — Product crop";
  if (node.id === "crop-2") return "Crop Image #2 — Banner crop";
  if (node.type === "geminiPreview") return GEMINI_MODEL_NAME;
  if (node.type === "cropImage") return "Crop Image";
  if (node.type === "request") return "Request-Inputs";
  if (node.type === "response") return "Response";
  return String(node.type ?? node.id);
}

export function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
