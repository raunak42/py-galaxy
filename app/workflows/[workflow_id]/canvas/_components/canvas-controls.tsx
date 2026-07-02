"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { MiniMap, useEdges, useNodes, useReactFlow, useViewport, type Node } from "@xyflow/react";
import { createPortal } from "react-dom";
import { X, Play, Calculator, Wallet, Clock, Map, Minimize2, Download, Loader2, Check } from "lucide-react";
import { useNodeValueContext, useWorkflowRunContext } from "../_lib/contexts";
import { HISTORY_PANEL_OFFSET } from "../_lib/constants";
import { displayConnectedValue, valueToStringArray } from "../_lib/utils";
import { HoverTooltip } from "./tooltips";
export function SelectionRunOverlay({ nodes }: { nodes: Node[] }) {
  const { runSelectedNodes, workflowRunning, selectedExecutableCount } = useWorkflowRunContext();
  const { setEdges } = useReactFlow();
  const { zoom } = useViewport();
  const [selectionBounds, setSelectionBounds] = useState<DOMRect | null>(null);
  const selectedExecutableNodes = nodes.filter((node) => node.selected && (node.type === "geminiPreview" || node.type === "cropImage"));
  const selectedExecutableIds = selectedExecutableNodes.map((node) => node.id);
  const canRunSelection = selectedExecutableNodes.length >= 2 && selectedExecutableCount >= 2;
  const runPointerGuardRef = useRef(0);

  const runCurrentSelection = useCallback(() => {
    if (workflowRunning) return;
    const now = Date.now();
    if (now - runPointerGuardRef.current < 350) return;
    runPointerGuardRef.current = now;
    void runSelectedNodes(selectedExecutableIds);
  }, [runSelectedNodes, selectedExecutableIds, workflowRunning]);

  useEffect(() => {
    const updateSelectionBounds = () => {
      const rect = document.querySelector(".react-flow__nodesselection-rect");
      setSelectionBounds(rect ? rect.getBoundingClientRect() : null);
    };
    updateSelectionBounds();
    const flow = document.querySelector(".react-flow");
    const observer = new MutationObserver(updateSelectionBounds);
    if (flow) observer.observe(flow, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    window.addEventListener("resize", updateSelectionBounds);
    window.addEventListener("scroll", updateSelectionBounds, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSelectionBounds);
      window.removeEventListener("scroll", updateSelectionBounds, true);
    };
  }, [nodes]);

  useEffect(() => {
    if (selectedExecutableNodes.length === 0) return;
    setEdges((currentEdges) => currentEdges.some((edge) => edge.selected)
      ? currentEdges.map((edge) => edge.selected ? { ...edge, selected: false } : edge)
      : currentEdges);
  }, [selectedExecutableNodes.length, setEdges]);

  if (!canRunSelection || !selectionBounds) return null;

  return createPortal(
    <button
      type="button"
      data-selection-run-button="true"
      aria-label={`Run ${selectedExecutableCount} selected nodes`}
      disabled={workflowRunning}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        runCurrentSelection();
      }}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        runCurrentSelection();
      }}
      className="nodrag nopan fixed inline-flex cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-xl border border-[rgba(99,102,241,0.3)] bg-[#4f46e5] px-6 py-3.5 text-lg font-semibold text-white shadow-lg transition-colors hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        left: selectionBounds.left,
        top: Math.max(8, selectionBounds.top - 58 * zoom),
        zIndex: 10040,
        pointerEvents: "auto",
        transform: `scale(${zoom})`,
        transformOrigin: "left top",
      }}
    >
      <Play size={20} strokeWidth={2} className="h-5 w-5 fill-current" />
      <span>Run {selectedExecutableCount} nodes</span>
    </button>,
    document.body,
  );
}

export type AutoSaveStatus = "unsaved" | "saving" | "saved";

export function AutoSaveIndicator({ status }: { status: AutoSaveStatus | null }) {
  if (!status) return null;

  const text = status === "unsaved" ? "Save" : status === "saving" ? "Saving..." : "Saved";
  const textClass = status === "unsaved"
    ? "text-[#1b1b18]"
    : status === "saving"
      ? "text-[#737373]"
      : "text-green-600 dark:text-green-400 transition-all";
  const Icon = status === "unsaved" ? Download : status === "saving" ? Loader2 : Check;
  const iconClass = status === "unsaved"
    ? "text-[#1b1b18]"
    : status === "saving"
      ? "animate-spin text-[#737373]"
      : "text-green-600 dark:text-green-400";

  return (
    <div className="absolute left-1/2 top-5 z-50 -translate-x-1/2">
      <div className="pointer-events-none flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur-sm dark:border-surface-primary">
        <Icon size={16} strokeWidth={2} className={`h-4 w-4 ${iconClass}`} />
        <span
          key={status}
          className={`block font-['Google_Sans_Flex',Inter,sans-serif] text-xs font-medium leading-4 ${textClass}`}
        >
          {text}
        </span>
      </div>
    </div>
  );
}

function estimateTokensForWorkflow(nodes: ReturnType<typeof useNodes>, edges: ReturnType<typeof useEdges>, values: Record<string, Record<string, unknown>>) {
  const nodeById = new globalThis.Map(nodes.map((node) => [node.id, node]));
  const estimatedTextOutputs = new globalThis.Map<string, number>();
  let total = 0;

  const readSourceValue = (sourceId: string, sourceHandle?: string | null) => {
    const node = nodeById.get(sourceId);
    const handle = sourceHandle ?? "result";
    const stored = values[sourceId]?.[handle];
    if (stored !== undefined && stored !== null && stored !== "") return stored;
    if (node?.type === "request") {
      const fields = Array.isArray(node.data?.fields) ? node.data.fields as Array<{ id?: string; label?: string; value?: unknown }> : [];
      return fields.find((field) => field.id === handle || field.label === handle)?.value ?? "";
    }
    return "";
  };

  const connectedText = (nodeId: string, targetHandle: string) => edges
    .filter((edge) => edge.target === nodeId && edge.targetHandle === targetHandle)
    .map((edge) => {
      if (edge.sourceHandle === "response" && estimatedTextOutputs.has(edge.source)) return "x".repeat((estimatedTextOutputs.get(edge.source) ?? 0) * 4);
      return displayConnectedValue(readSourceValue(edge.source, edge.sourceHandle));
    })
    .join("\n");

  const connectedAssetCount = (nodeId: string, targetHandle: string) => edges
    .filter((edge) => edge.target === nodeId && edge.targetHandle === targetHandle)
    .reduce((count, edge) => count + Math.max(1, valueToStringArray(readSourceValue(edge.source, edge.sourceHandle)).length), 0);

  for (const node of nodes) {
    if (node.type !== "geminiPreview") continue;
    const data = node.data ?? {};
    const prompt = connectedText(node.id, "prompt") || displayConnectedValue(values[node.id]?.prompt ?? data.prompt ?? "");
    const systemPrompt = connectedText(node.id, "system-prompt") || displayConnectedValue(values[node.id]?.["system-prompt"] ?? data.systemPrompt ?? "");
    const imageCount = connectedAssetCount(node.id, "image") + valueToStringArray(values[node.id]?.image).length;
    const videoCount = connectedAssetCount(node.id, "video") + valueToStringArray(values[node.id]?.video).length;
    const audioCount = connectedAssetCount(node.id, "audio") + valueToStringArray(values[node.id]?.audio).length;
    const fileCount = connectedAssetCount(node.id, "file") + valueToStringArray(values[node.id]?.file).length;
    const outputReserve = Number(values[node.id]?.maxOutputTokens ?? data.maxOutputTokens ?? 1024);
    const textTokens = Math.ceil((prompt.length + systemPrompt.length) / 4);
    const mediaTokens = imageCount * 258 + (videoCount + audioCount + fileCount) * 1024;
    const nodeTokens = textTokens + mediaTokens + outputReserve;
    estimatedTextOutputs.set(node.id, outputReserve);
    total += nodeTokens;
  }

  return total;
}

function formatMillionTokens(tokens: number) {
  if (tokens > 0 && tokens < 10_000) return "<0.01";
  return (tokens / 1_000_000).toFixed(2);
}

export function TopRightCanvasControls() {
  const { runWorkflow, cancelWorkflow, workflowRunning, historyOpen, setHistoryOpen } = useWorkflowRunContext();
  const nodes = useNodes();
  const edges = useEdges();
  const { values } = useNodeValueContext();
  const [balanceMillions, setBalanceMillions] = useState<number | null>(null);
  const metricClass = "inline-flex h-7 items-center gap-1.5 rounded-lg border border-gray-200 bg-white/90 px-2.5 text-[11px] font-medium text-gray-700 shadow-sm backdrop-blur";
  const estimatedTokens = estimateTokensForWorkflow(nodes, edges, values);

  useEffect(() => {
    let canceled = false;
    void fetch("/api/usage", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ balanceMillions: number | null }>)
      .then((json) => {
        if (!canceled) setBalanceMillions(json.balanceMillions);
      })
      .catch(() => {
        if (!canceled) setBalanceMillions(null);
      });
    return () => {
      canceled = true;
    };
  }, []);

  return (
    <div
      className="absolute top-[15px] z-[5] transition-[right] duration-300 ease-out"
      style={{ right: historyOpen ? HISTORY_PANEL_OFFSET : 15 }}
    >
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex">
            <span className={metricClass}>
              <Calculator size={14} strokeWidth={2} className="h-3.5 w-3.5" />
              <span className="text-gray-500">Est</span>
              <span className="tabular-nums">{formatMillionTokens(estimatedTokens)}</span>
              <span className="text-gray-500">M</span>
            </span>
          </span>
          <span className="hidden sm:inline-flex">
            <span className={metricClass}>
              <Wallet size={14} strokeWidth={2} className="h-3.5 w-3.5" />
              <span className="text-gray-500">Bal</span>
              <span className="tabular-nums">{balanceMillions === null ? "N/A" : balanceMillions.toFixed(2)}</span>
              {balanceMillions === null ? null : <span className="text-gray-500">M</span>}
            </span>
          </span>
          {workflowRunning ? (
            <>
              <HoverTooltip text="Running..." side="bottom" variant="dark" scaleWithZoom={false} triggerClassName="inline-flex">
                <button type="button" aria-label="Workflow running" disabled className="flex h-8 w-9 cursor-not-allowed items-center justify-center rounded-lg border border-[#818cf8] bg-[#6366f1] text-white opacity-60 shadow-sm">
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </button>
              </HoverTooltip>
              <HoverTooltip text="Cancel Run" side="bottom" variant="dark" scaleWithZoom={false} triggerClassName="inline-flex">
                <button type="button" aria-label="Cancel workflow run" onClick={cancelWorkflow} className="flex h-8 w-9 cursor-pointer items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 shadow-sm transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50">
                  <X size={15} strokeWidth={2} className="h-3.5 w-3.5" />
                </button>
              </HoverTooltip>
            </>
          ) : (
            <HoverTooltip text="Run Workflow" side="bottom" variant="dark" scaleWithZoom={false} triggerClassName="inline-flex">
              <button type="button" aria-label="Run Workflow" onClick={runWorkflow} className="flex h-8 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#818cf8] bg-[#6366f1] text-white shadow-sm transition-all hover:bg-[#4f46e5] disabled:cursor-not-allowed disabled:opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="butt" strokeLinejoin="miter" className="h-3.5 w-3.5" aria-hidden="true">
                  <polygon points="6 3 20 12 6 21 6 3" />
                </svg>
              </button>
            </HoverTooltip>
          )}
          <HoverTooltip text="Execution History" side="bottom" variant="dark" scaleWithZoom={false} triggerClassName="inline-flex">
            <button type="button" aria-label="Execution History" onClick={() => setHistoryOpen(true)} className="flex h-8 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-800 shadow-sm transition-all hover:bg-gray-100">
              <Clock size={14} strokeWidth={2} className="h-3.5 w-3.5" />
            </button>
          </HoverTooltip>
        </div>
      </div>
    </div>
  );
}

export function BottomRightCanvasControls() {
  const { historyOpen } = useWorkflowRunContext();
  const [minimapOpen, setMinimapOpen] = useState(true);
  const minimapButtonTitle = minimapOpen ? "Hide minimap" : "Show minimap";
  const rightOffset = historyOpen ? HISTORY_PANEL_OFFSET + 1 : 16;

  return (
    <>
      {minimapOpen && (
        <MiniMap
          className="!bottom-14 !h-[152px] !w-[202px] !rounded-lg !border !border-gray-200 !bg-white !transition-[right] !duration-300 !ease-out dark:!border-zinc-700 dark:!bg-zinc-900 sm:!bottom-4"
          style={{ right: rightOffset }}
          nodeColor={(node) => {
            if (node.type === "geminiPreview") return "rgb(59, 130, 246)";
            if (node.type === "cropImage") return "rgb(249, 115, 22)";
            return "rgb(68, 68, 68)";
          }}
          nodeStrokeWidth={0}
          nodeBorderRadius={5}
          maskColor="rgba(0, 0, 0, 0.8)"
          pannable
          zoomable
        />
      )}
      <button
        type="button"
        title={minimapButtonTitle}
        onClick={() => setMinimapOpen((open) => !open)}
        className="absolute rounded-lg border p-1.5 shadow-sm transition-[right,background-color,color] duration-300 ease-out hover:bg-[#f3f4f6] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
        style={{
          ...(minimapOpen ? { bottom: 172, right: rightOffset, zIndex: 20 } : { bottom: 16, right: historyOpen ? HISTORY_PANEL_OFFSET + 60 : 75, zIndex: 20 }),
          color: "#6b7280",
          backgroundColor: "#ffffff",
          borderColor: "#e5e7eb",
        }}
      >
        {minimapOpen ? (
          <Minimize2 size={14} strokeWidth={2} className="lucide lucide-minimize2 lucide-minimize-2 h-3.5 w-3.5" />
        ) : (
          <Map size={16} strokeWidth={2} className="lucide lucide-map h-4 w-4" />
        )}
      </button>
    </>
  );
}

