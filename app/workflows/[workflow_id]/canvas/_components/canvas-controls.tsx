"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { MiniMap, useReactFlow, useViewport, type Node } from "@xyflow/react";
import { createPortal } from "react-dom";
import { X, Play, Calculator, Wallet, Clock, Map, Minimize2 } from "lucide-react";
import { useWorkflowRunContext } from "../_lib/contexts";
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

export function TopRightCanvasControls() {
  const { runWorkflow, cancelWorkflow, workflowRunning, setHistoryOpen } = useWorkflowRunContext();
  const metricClass = "inline-flex h-7 items-center gap-1.5 rounded-lg border border-gray-200 bg-white/90 px-2.5 text-[11px] font-medium text-gray-700 shadow-sm backdrop-blur";

  return (
    <div className="absolute right-[15px] top-[15px] z-[5]">
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex">
            <span className={metricClass}>
              <Calculator size={14} strokeWidth={2} className="h-3.5 w-3.5" />
              <span className="text-gray-500">Est</span>
              <span className="tabular-nums">1.72</span>
              <span className="text-gray-500">M</span>
            </span>
          </span>
          <span className="hidden sm:inline-flex">
            <span className={metricClass}>
              <Wallet size={14} strokeWidth={2} className="h-3.5 w-3.5" />
              <span className="text-gray-500">Bal</span>
              <span className="tabular-nums">0.00</span>
              <span className="text-gray-500">M</span>
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
  const [minimapOpen, setMinimapOpen] = useState(true);
  const minimapButtonTitle = minimapOpen ? "Hide minimap" : "Show minimap";

  return (
    <>
      {minimapOpen && (
        <MiniMap
          className="!bottom-14 !right-4 !h-[152px] !w-[202px] !rounded-lg !border !border-gray-200 !bg-white dark:!border-zinc-700 dark:!bg-zinc-900 sm:!bottom-4"
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
        className="absolute rounded-lg border p-1.5 shadow-sm transition-colors hover:bg-[#f3f4f6] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
        style={{
          ...(minimapOpen ? { bottom: 172, right: 16, zIndex: 20 } : { bottom: 16, right: 75, zIndex: 20 }),
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

