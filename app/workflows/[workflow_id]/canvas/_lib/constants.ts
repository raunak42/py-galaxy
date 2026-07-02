import type { Edge } from "@xyflow/react";
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2;

// ---- Sidebar widths, lifted from the reference site's `.chat-sidebar-shell` ----
export const SIDEBAR_COLLAPSED_WIDTH = 52; // measured
export const SIDEBAR_EXPANDED_WIDTH = 296;

export const PERMANENT_NODE_IDS = new Set(["request-inputs", "response"]);

// ---- Handle Type System (colors match reference site exactly) ----
export const HANDLE_COLORS: Record<string, string> = {
  text: "#f59e0b",
  number: "#ec4899",
  boolean: "#6366f1",
  image: "#3b82f6",
  audio: "#06b6d4",
  video: "#22c55e",
  media: "#086136",
  file: "#a855f7",
  result: "#6366f1",
};

export function handleTypeFromId(handleId: string | null | undefined): string {
  if (!handleId) return "text";
  const h = handleId.toLowerCase().replace(/^in:/, "").replace(/^out:/, "").replace(/^field_/, "");
  if (h === "result") return "result";
  if (h === "prompt" || h === "system-prompt" || h === "system_prompt" || h.includes("prompt") || h.includes("text_field") || h.includes("system")) return "text";
  if (h.includes("number") || h.includes("x_percent") || h.includes("y_percent") || h.includes("width") || h.includes("height")) return "number";
  if (h.includes("bool")) return "boolean";
  if (h.includes("image") || h === "img" || h === "input-image" || h === "output-image") return "image";
  if (h.includes("audio")) return "audio";
  if (h.includes("video")) return "video";
  if (h.includes("media") || h.includes("avmedia")) return "media";
  if (h.includes("file")) return "file";
  return "text";
}

export function areTypesCompatible(sourceType: string, targetType: string): boolean {
  if (targetType === "result") return true;
  return sourceType === targetType;
}
export function wouldCreateCycle(edges: Edge[], source: string, target: string): boolean {
  const adj: Record<string, string[]> = {};
  for (const e of edges) {
    if (!adj[e.source]) adj[e.source] = [];
    adj[e.source].push(e.target);
  }
  if (!adj[source]) adj[source] = [];
  adj[source].push(target);
  const visited: Record<string, true> = {};
  const stack = [target];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === source) return true;
    if (visited[node]) continue;
    visited[node] = true;
    for (const next of adj[node] ?? []) stack.push(next);
  }
  return false;
}

