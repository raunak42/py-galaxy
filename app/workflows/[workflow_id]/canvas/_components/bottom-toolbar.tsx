"use client";

import React, { useCallback, useState } from "react";
import { useReactFlow, useViewport } from "@xyflow/react";
import { ChevronLeft, ChevronRight, Undo2, Redo2, ZoomOut, ZoomIn, Maximize2, LayoutGrid, Move, Square } from "lucide-react";
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
  const { zoomIn, zoomOut, fitView, getNodes, getEdges, setNodes } = useReactFlow();
  const { zoom } = useViewport();
  const [collapsed, setCollapsed] = useState(false);
  const { undo, redo, canUndo, canRedo, recordSnapshot } = useWorkflowEditContext();

  const animateNodes = useCallback((updatedNodes: ReturnType<typeof getNodes>) => {
    const flow = document.querySelector(".react-flow");
    if (flow) flow.classList.add("auto-arranging");
    setNodes(updatedNodes);
    requestAnimationFrame(() => fitView({ duration: 300, padding: 0.15 }));
    setTimeout(() => {
      if (flow) flow.classList.remove("auto-arranging");
    }, 350);
  }, [fitView, setNodes]);

  const autoArrange = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();
    if (nodes.length === 0) return;
    recordSnapshot();
    const nodeWidth = 380;
    const horizontalGap = 100;
    const verticalGap = 80;
    const incomingEdges = new Map<string, string[]>();
    const outgoingEdges = new Map<string, string[]>();
    for (const node of nodes) {
      incomingEdges.set(node.id, []);
      outgoingEdges.set(node.id, []);
    }
    for (const edge of edges) {
      const sourceId = edge.source;
      const targetId = edge.target;
      if (incomingEdges.has(targetId) && !incomingEdges.get(targetId)!.includes(sourceId)) {
        incomingEdges.get(targetId)!.push(sourceId);
      }
      if (outgoingEdges.has(sourceId) && !outgoingEdges.get(sourceId)!.includes(targetId)) {
        outgoingEdges.get(sourceId)!.push(targetId);
      }
    }
    const levels = new Map<string, number>();
    const queue: string[] = [];
    for (const node of nodes) {
      if (incomingEdges.get(node.id)!.length === 0) {
        levels.set(node.id, 0);
        queue.push(node.id);
      }
    }
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i];
      const currentLevel = levels.get(current) ?? 0;
      for (const next of outgoingEdges.get(current) ?? []) {
        const existingLevel = levels.get(next);
        const newLevel = currentLevel + 1;
        if (existingLevel === undefined || newLevel > existingLevel) {
          levels.set(next, newLevel);
        }
        if (!queue.includes(next)) queue.push(next);
      }
    }
    for (const node of nodes) {
      if (!levels.has(node.id)) levels.set(node.id, 0);
    }
    const maxLevel = Math.max(...levels.values(), 0);
    const nodesByLevel: string[][] = Array.from({ length: maxLevel + 1 }, () => []);
    for (const node of nodes) {
      const level = levels.get(node.id) ?? 0;
      nodesByLevel[level].push(node.id);
    }
    const startX = 50;
    const startY = 50;
    const updatedNodes = nodes.map((node) => {
      const level = levels.get(node.id) ?? 0;
      const nodesInLevel = nodesByLevel[level];
      const levelHeight = nodesInLevel.length * (nodeWidth * 0.4 + verticalGap) - verticalGap;
      const centerOffset = levelHeight / 2;
      const posInLevel = nodesInLevel.indexOf(node.id);
      const y = startY + centerOffset - posInLevel * (nodeWidth * 0.4 + verticalGap);
      return {
        ...node,
        position: { x: startX + level * (nodeWidth + horizontalGap), y },
      };
    });
    animateNodes(updatedNodes);
  }, [animateNodes, getEdges, getNodes, recordSnapshot]);
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
      <div className={toolbarShellClass}>
      <ToolbarButton icon={ChevronLeft} label="Collapse controls" onClick={() => setCollapsed(true)} />
      <Divider />
      <ToolbarButton icon={Undo2} label="Undo" onClick={undo} disabled={!canUndo} />
      <ToolbarButton icon={Redo2} label="Redo" onClick={redo} disabled={!canRedo} />
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
      <ToolbarButton icon={Maximize2} label="Fit view" onClick={() => fitView({ duration: 300 })} />
      <ToolbarButton icon={LayoutGrid} label="Auto arrange" onClick={autoArrange} />
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
