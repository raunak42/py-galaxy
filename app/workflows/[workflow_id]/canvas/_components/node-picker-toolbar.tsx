"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReactFlow } from "@xyflow/react";
import { Search, StickyNote, Layers, Crop, ChevronRight, Plus, X, ArrowLeft } from "lucide-react";
import { useWorkflowRunContext } from "../_lib/contexts";
import { HISTORY_PANEL_OFFSET } from "../_lib/constants";
import { HoverTooltip } from "./tooltips";
export function CanvasZoomKeyboardHandler() {
  const { zoomIn, zoomOut } = useReactFlow();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't hijack +/- while the user is typing in an input, textarea,
      // or any contenteditable element (e.g. sidebar search, node fields).
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isTyping) return;

      // Handle +/- both with and without Cmd/Ctrl, and redirect them to
      // canvas zoom instead of the browser's native page zoom. preventDefault()
      // on keydown does stop native zoom in Chrome/Firefox for these keys —
      // it's only OS-level pinch gestures that can't be intercepted via JS.
      // (Safari's behavior on Cmd/Ctrl +/- specifically is less consistent
      // across versions since it's tied to a native View-menu shortcut —
      // verify on the Safari version you're targeting.)
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomOut();
      }
    };

    // Capture phase so this runs before any native shortcut handling has
    // a chance to fire, rather than fighting it in the bubble phase.
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [zoomIn, zoomOut]);

  return null;
}

export type PickerGroup = {
  label: "Utility" | "LLM Call";
  items: Array<{
    icon: React.ElementType;
    label: string;
  }>;
};

export const pickerGroups: PickerGroup[] = [
  {
    label: "Utility",
    items: [{ icon: StickyNote, label: "Sticky Note" }, { icon: Crop, label: "Crop Image" }],
  },
  {
    label: "LLM Call",
    items: [{ icon: Layers, label: "Gemini 3.1 Pro" }],
  },
];

export function CenterNodeToolbar({
  onAddGemini,
  onAddCrop,
  onAddStickyNote,
}: {
  onAddGemini: () => void;
  onAddCrop: () => void;
  onAddStickyNote: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const { historyOpen } = useWorkflowRunContext();

  return (
    <div
      className="absolute bottom-[15px] left-1/2 z-[100] transition-transform duration-300 ease-out"
      style={{ transform: `translateX(calc(-50% - ${historyOpen ? HISTORY_PANEL_OFFSET : 0}px))` }}
    >
      <div className="flex h-[46px] items-center gap-1 overflow-visible rounded-xl border border-gray-200 bg-white/95 px-2 py-1.5 shadow-[0_0_0_0_rgba(0,0,0,0),0_0_0_0_rgba(0,0,0,0),0_1px_2px_0_rgba(0,0,0,0.05)] backdrop-blur-sm">
        <HoverTooltip text="Add Sticky Note" side="top" variant="dark" scaleWithZoom={false} triggerClassName="inline-flex">
          <button
            onClick={onAddStickyNote}
            aria-label="Sticky Note"
            className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <StickyNote size={16} strokeWidth={2} className="h-4 w-4" />
          </button>
        </HoverTooltip>

        <div className="relative h-8 w-8">
          <button
            ref={addButtonRef}
            type="button"
            title="Add node"
            aria-label="Add node"
            onClick={() => setPickerOpen((open) => !open)}
            className={`relative z-[70] rounded p-2 transition-colors ${
              pickerOpen
                ? "bg-gray-200 text-gray-900"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <Plus size={16} strokeWidth={2} className="h-4 w-4" />
          </button>

          {pickerOpen && (
            <NodePicker
              anchorRef={addButtonRef}
              onClose={() => setPickerOpen(false)}
              onAddGemini={() => {
                onAddGemini();
                setPickerOpen(false);
              }}
              onAddCrop={() => {
                onAddCrop();
                setPickerOpen(false);
              }}
              onAddStickyNote={() => {
                onAddStickyNote();
                setPickerOpen(false);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function NodePicker({
  anchorRef,
  onClose,
  onAddGemini,
  onAddCrop,
  onAddStickyNote,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onAddGemini: () => void;
  onAddCrop: () => void;
  onAddStickyNote: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<PickerGroup | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleGroups = pickerGroups
    .map((group) => {
      const groupMatches = group.label.toLowerCase().includes(normalizedQuery);
      return {
        ...group,
        items:
          !normalizedQuery || groupMatches
            ? group.items
            : group.items.filter((item) =>
                item.label.toLowerCase().includes(normalizedQuery)
              ),
      };
    })
    .filter((group) => !normalizedQuery || group.items.length > 0);
  const displayedGroup = normalizedQuery
    ? visibleGroups.find((group) => group.label === activeGroup?.label) ??
      visibleGroups[0]
    : activeGroup;
  const activeItems = (displayedGroup?.items ?? []).filter((item) => item.label !== "Sticky Note");
  const searchResults = visibleGroups.flatMap((group) =>
    group.items.map((item) => ({ ...item, groupLabel: group.label }))
  );
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const updatePosition = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ x: rect.left - 96, y: rect.top - 430 - 14 });
  }, [anchorRef]);

  useLayoutEffect(() => {
    updatePosition();
    requestAnimationFrame(() => searchInputRef.current?.focus());
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [updatePosition]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed z-[10000]"
      style={{ left: position.x, top: position.y }}
    >
      <div className="relative h-[430px] w-[529px]" onMouseLeave={() => setActiveGroup(null)}>
        <div className="h-[430px] w-[280px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl backdrop-blur">
          <div className="p-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  size={16}
                  strokeWidth={2}
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                />
                <input
                  ref={searchInputRef}
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search nodes or models..."
                  className="h-[38px] w-full rounded-xl border border-transparent bg-transparent py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-0"
                />
              </div>
              <button
                type="button"
                title="Close"
                onClick={onClose}
                className="shrink-0 rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <X size={16} strokeWidth={2} className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="h-[370px] overflow-y-auto px-2 pb-2">
            {normalizedQuery ? (
              <>
                <div className="px-2 py-1 text-[11px] font-normal leading-[16.5px] text-gray-500">
                  Results
                </div>
                {searchResults.map(({ icon: Icon, label, groupLabel }) => (
                  <button
                    key={`${groupLabel}-${label}`}
                    type="button"
                    draggable
                    onClick={label === "Gemini 3.1 Pro" ? onAddGemini : label === "Crop Image" ? onAddCrop : label === "Sticky Note" ? onAddStickyNote : undefined}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-gray-50"
                  >
                    <Icon size={20} strokeWidth={2} className="h-5 w-5 shrink-0 text-gray-700" />
                    <div className="min-w-0">
                      <div className="truncate text-sm leading-5 text-gray-900">
                        {label}
                      </div>
                      <div className="truncate text-[11px] leading-[16.5px] text-gray-500">
                        Others • {groupLabel}
                      </div>
                    </div>
                  </button>
                ))}
                {searchResults.length === 0 && (
                  <div className="px-2.5 py-2 text-[13px] leading-snug text-gray-400">
                    No nodes found
                  </div>
                )}
              </>
            ) : (
              <div className="pb-1">
                <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium uppercase leading-[16.5px] tracking-wide text-gray-500">
                  <Layers size={14} strokeWidth={2} className="h-3.5 w-3.5" />
                  Others
                </div>
                <div className="space-y-0">
                  {visibleGroups.map((group) => (
                    <button
                      key={group.label}
                      type="button"
                      onMouseEnter={() => setActiveGroup(group)}
                      onFocus={() => setActiveGroup(group)}
                      onClick={() => setActiveGroup(group)}
                      className={`flex w-full select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-gray-50 ${
                        displayedGroup?.label === group.label ? "bg-gray-50" : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1 text-[13px] leading-snug text-gray-700">
                        {group.label}
                      </span>
                      <ChevronRight
                        size={16}
                        strokeWidth={2}
                        className="h-4 w-4 shrink-0 text-gray-400"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {!normalizedQuery && displayedGroup && (
          <div className="absolute left-[286px] top-0 h-[430px] w-[237px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl backdrop-blur">
            <div className="p-2.5">
              <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium uppercase leading-[16.5px] tracking-wide text-gray-500">
                {displayedGroup?.label ?? "Results"}
              </div>
              <div className="space-y-0">
                {activeItems.map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    type="button"
                    draggable
                    onClick={label === "Gemini 3.1 Pro" ? onAddGemini : label === "Crop Image" ? onAddCrop : label === "Sticky Note" ? onAddStickyNote : undefined}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-gray-50"
                  >
                    <Icon size={16} strokeWidth={2} className="h-4 w-4 text-gray-700" />
                    <span className="truncate text-[13px] leading-snug text-gray-700">
                      {label}
                    </span>
                  </button>
                ))}
                {activeItems.length === 0 && (
                  <div className="px-2.5 py-1.5 text-[13px] leading-snug text-gray-400">
                    No nodes found
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function TopLeftCanvasTitle() {
  const [title, setTitle] = useState("Trial Task Workflow");

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-50 sm:left-16">
      <div className="pointer-events-auto flex items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/85 px-2 py-1.5 shadow-md backdrop-blur">
          <HoverTooltip text="Back to Workflow" side="bottom" triggerClassName="inline-flex">
            <a
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
              aria-label="Back to Workflow"
              href="/app/flow"
            >
              <ArrowLeft size={24} strokeWidth={2} className="lucide lucide-arrow-left h-4 w-4" />
            </a>
          </HoverTooltip>
          <div className="relative">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Untitled"
              maxLength={120}
              className="h-8 w-[120px] bg-transparent text-[14px] font-normal text-gray-900 outline-none placeholder:text-gray-400 sm:w-[160px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

