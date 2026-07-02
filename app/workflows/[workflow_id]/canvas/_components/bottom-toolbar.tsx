"use client";

import React, { useCallback, useRef, useState } from "react";
import { useReactFlow, useViewport, type Node, type Edge } from "@xyflow/react";
import { FileOutput, ChevronLeft, ChevronRight, Undo2, Redo2, Command, ZoomOut, ZoomIn, Maximize2, LayoutGrid, Move, Square, CloudUpload } from "lucide-react";
import { toast } from "@/lib/toast";
import { MIN_ZOOM, MAX_ZOOM } from "../_lib/constants";
import { useWorkflowEditContext } from "../_lib/contexts";
import { HoverTooltip } from "./tooltips";
export type CanvasInteractionMode = "select" | "pan";

export function BottomToolbar({
  interactionMode,
  setInteractionMode,
}: {
  interactionMode: CanvasInteractionMode;
  setInteractionMode: (mode: CanvasInteractionMode) => void;
}) {
  const { zoomIn, zoomOut, fitView, getNodes, getEdges, setNodes, setEdges } = useReactFlow();
  const { zoom } = useViewport();
  const [collapsed, setCollapsed] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const { undo, redo, canUndo, canRedo, recordSnapshot } = useWorkflowEditContext();

  const noop = () => {};

  const exportWorkflowJson = useCallback(() => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      nodes: getNodes(),
      edges: getEdges(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `py-workflow-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast({ description: "Workflow exported as JSON" });
  }, [getEdges, getNodes]);

  const importWorkflowJson = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { nodes?: Node[]; edges?: Edge[] };
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        throw new Error("Invalid workflow JSON: expected nodes and edges arrays");
      }
      recordSnapshot();
      setNodes(parsed.nodes);
      setEdges(parsed.edges);
      requestAnimationFrame(() => fitView({ padding: 0.15 }));
      toast({ description: "Workflow imported" });
    } catch (error) {
      toast({ description: error instanceof Error ? error.message : "Import failed" });
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }, [fitView, recordSnapshot, setEdges, setNodes]);
  const toolbarShellClass =
    "nodrag nopan absolute bottom-[15px] left-[15px] z-10 flex items-center gap-1 rounded-xl border border-gray-200 bg-white/95 px-2 py-1.5 shadow-[0_0_0_0_rgba(0,0,0,0),0_0_0_0_rgba(0,0,0,0),0_1px_2px_0_rgba(0,0,0,0.05)] backdrop-blur-sm";

  if (collapsed) {
    return (
      <div className={toolbarShellClass}>
        <ToolbarButton icon={ChevronRight} label="Expand controls" onClick={() => setCollapsed(false)} />
      </div>
    );
  }

  return (
    <>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importWorkflowJson(file);
        }}
      />
      <div className={toolbarShellClass}>
      <ToolbarButton icon={ChevronLeft} label="Collapse controls" onClick={() => setCollapsed(true)} />
      <Divider />
      <ToolbarButton icon={Undo2} label="Undo" onClick={undo} disabled={!canUndo} />
      <ToolbarButton icon={Redo2} label="Redo" onClick={redo} disabled={!canRedo} />
      <ToolbarButton icon={Command} label="Keyboard shortcuts" onClick={noop} />
      <Divider />
      <ToolbarButton icon={FileOutput} label="Export workflow JSON" onClick={exportWorkflowJson} />
      <ToolbarButton icon={CloudUpload} label="Import workflow JSON" onClick={() => importInputRef.current?.click()} />
      <Divider />
      <ToolbarButton
        icon={ZoomOut}
        label="Zoom out"
        onClick={() => zoomOut()}
        disabled={zoom <= MIN_ZOOM + 0.001}
      />
      <span className="min-w-[44px] select-none text-center text-xs font-medium leading-4 text-gray-500">
        {Math.round(zoom * 100)}%
      </span>
      <ToolbarButton
        icon={ZoomIn}
        label="Zoom in"
        onClick={() => zoomIn()}
        disabled={zoom >= MAX_ZOOM - 0.001}
      />
      <Divider />
      <ToolbarButton icon={Maximize2} label="Fit view" onClick={() => fitView()} />
      <ToolbarButton icon={LayoutGrid} label="Toggle minimap" onClick={noop} />
      <Divider />
      <PanSelectToggle
        interactionMode={interactionMode}
        setInteractionMode={setInteractionMode}
      />
      </div>
    </>
  );
}

export function PanSelectToggle({
  interactionMode,
  setInteractionMode,
}: {
  interactionMode: CanvasInteractionMode;
  setInteractionMode: (mode: CanvasInteractionMode) => void;
}) {
  const panActive = interactionMode === "pan";
  const Icon = panActive ? Move : Square;
  const label = panActive ? "Select mode" : "Pan mode";

  return (
    <HoverTooltip text={label} side="top" variant="dark" scaleWithZoom={false} triggerClassName="inline-flex">
      <button
        data-preserve-selection="true"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setInteractionMode(panActive ? "select" : "pan");
        }}
        aria-label={label}
        aria-pressed={panActive}
        className={`nodrag nopan cursor-pointer rounded-lg p-2 transition-colors ${!panActive ? "bg-workflow-accent-600 text-white" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"}`}
      >
        <Icon size={14} strokeWidth={2} className="h-3.5 w-3.5" />
      </button>
    </HoverTooltip>
  );
}

export function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={`cursor-pointer rounded-lg p-2 transition-colors disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent disabled:hover:text-gray-300 ${active ? "bg-gray-900 text-white shadow-sm hover:bg-gray-800 hover:text-white" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"}`}
    >
      <Icon size={14} strokeWidth={2} className="h-3.5 w-3.5" />
    </button>
  );

  if (disabled) return button;

  return (
    <HoverTooltip text={label} side="top" variant="dark" scaleWithZoom={false} triggerClassName="inline-flex">
      {button}
    </HoverTooltip>
  );
}

export function Divider() {
  return <div className="mx-0.5 h-5 w-px bg-gray-200" />;
}
