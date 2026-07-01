"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  useEdges,
  addEdge,
  useReactFlow,
  useViewport,
  useInternalNode,
  Handle,
  Position,
  NodeResizer,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { createPortal } from "react-dom";
import { getBezierPath } from "@xyflow/react";
import type { ConnectionLineComponentProps, OnConnectEnd } from "@xyflow/react";
import { IconAdjustmentsHorizontal, IconArrowsSplit, IconCloudUpload, IconLayout, IconLayoutGridFilled, IconLayoutList, IconUpload } from "@tabler/icons-react";
import {
  Plus,
  Search,
  GripVertical,
  Pencil,
  Copy,
  Trash2,
  FileOutput,
  X,
  StickyNote,
  Layers,
  Crop,
  MessageSquareMore,
  FolderOpen,
  Library,
  Boxes,
  BookOpen,
  Settings,
  RotateCcw,
  MoreHorizontal,
  Play,
  Info,
  Coins,
  Calculator,
  Wallet,
  Clock,
  Map,
  Minimize2,
  ArrowLeft,
  PanelLeftOpen,
  PanelLeftClose,
  Gift,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Undo2,
  Redo2,
  Command,
  ZoomOut,
  ZoomIn,
  Maximize2,
  LayoutGrid,
  Move,
  ImagePlus,
  RefreshCw,
  CloudUpload,
  Sparkles,
  Heart,
  ImageIcon,
  ArrowUpDown,
  Folder,
  Check,
  AlignLeft,
  Hash,
  Music,
  Video,
  File,
} from "lucide-react";
import { toast, Toaster } from "@/lib/toast";

// ---- Zoom limits: canvas should only zoom between 10% and 200% ----
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;

// ---- Sidebar widths, lifted from the reference site's `.chat-sidebar-shell` ----
const SIDEBAR_COLLAPSED_WIDTH = 52; // measured
const SIDEBAR_EXPANDED_WIDTH = 296;

const PERMANENT_NODE_IDS = new Set(["request-inputs", "response"]);

// ---- Handle Type System (colors match reference site exactly) ----
const HANDLE_COLORS: Record<string, string> = {
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

function handleTypeFromId(handleId: string | null | undefined): string {
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

function areTypesCompatible(sourceType: string, targetType: string): boolean {
  if (targetType === "result") return true;
  return sourceType === targetType;
}

function wouldCreateCycle(edges: Edge[], source: string, target: string): boolean {
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

const initialNodes: Node[] = [
  {
    id: "request-inputs",
    type: "request",
    position: { x: 96, y: 96 },
    deletable: false,
    data: {},
  },
  {
    id: "response",
    type: "response",
    position: { x: 960, y: 96 },
    deletable: false,
    data: {},
  },
];

const initialEdges: Edge[] = [];

function FieldHandle({
  id,
  color = "#f59e0b",
  top = 14,
}: {
  id: string;
  color?: string;
  top?: number;
}) {
  return (
    <div
      className="absolute left-[-23px] z-50 flex h-3.5 w-3.5 -translate-y-1/2 items-center"
      style={{ top }}
    >
      <Handle
        id={id}
        type="target"
        position={Position.Left}
        className="!relative !left-auto !top-auto !translate-x-0 !translate-y-0 !rounded-full !border-2"
        style={{
          position: "relative",
          left: "auto",
          top: "auto",
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: color,
          borderColor: `${color}80`,
          boxShadow: `${color}50 0px 0px 8px`,
          cursor: "crosshair",
          ['--handle-color' as string]: color,
        }}
      />
    </div>
  );
}

function SourceFieldHandle({
  id,
  color = "#f59e0b",
  top = 31,
}: {
  id: string;
  color?: string;
  top?: number;
}) {
  return (
    <div
      className="absolute right-[-23px] z-50 flex h-3.5 w-3.5 -translate-y-1/2 items-center"
      style={{ top }}
    >
      <Handle
        id={id}
        type="source"
        position={Position.Right}
        className="!relative !right-auto !top-auto !translate-x-0 !translate-y-0 !rounded-full !border-2"
        style={{
          position: "relative",
          right: "auto",
          top: "auto",
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: color,
          borderColor: `${color}80`,
          boxShadow: `${color}50 0px 0px 8px`,
          cursor: "crosshair",
          ['--handle-color' as string]: color,
        }}
      />
    </div>
  );
}

function AddToRequestButton({ className = "" }: { className?: string }) {
  return (
    <HoverTooltip text="Add to request" side="top" triggerClassName={`inline-flex shrink-0 ${className}`}>
      <button
        type="button"
        aria-label="Add to request"
        className="nodrag inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-[#F5F5F5] text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus size={16} strokeWidth={2} className="h-4 w-4" />
      </button>
    </HoverTooltip>
  );
}

function HoverTooltip({
  text,
  shortcut,
  children,
  side = "bottom",
  variant = "light",
  scaleWithZoom = true,
  className = "",
  triggerClassName = "",
  maxWidth,
}: {
  text: string;
  shortcut?: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  variant?: "light" | "dark";
  scaleWithZoom?: boolean;
  className?: string;
  triggerClassName?: string;
  maxWidth?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const { zoom } = useViewport();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const tooltipId = useId();

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const effectiveZoom = scaleWithZoom ? zoom : 1;
    const contentWidth = contentRef.current?.offsetWidth ?? 0;
    const contentHeight = contentRef.current?.offsetHeight ?? 0;
    const gap = 8 * effectiveZoom;
    const viewportPadding = 8;
    const clampX = (x: number) => {
      const scaledWidth = contentWidth * effectiveZoom;
      if (!scaledWidth) return x;
      return Math.min(Math.max(x, viewportPadding), window.innerWidth - scaledWidth - viewportPadding);
    };
    const clampY = (y: number) => {
      const scaledHeight = contentHeight * effectiveZoom;
      if (!scaledHeight) return y;
      return Math.min(Math.max(y, viewportPadding), window.innerHeight - scaledHeight - viewportPadding);
    };
    if (side === "left" || side === "right") {
      setPosition({
        x: clampX(side === "left" ? rect.left - contentWidth * effectiveZoom - gap : rect.right + gap),
        y: clampY(rect.top + rect.height / 2 - (contentHeight * effectiveZoom) / 2),
      });
      return;
    }
    setPosition({
      x: clampX(rect.left + rect.width / 2 - (contentWidth * effectiveZoom) / 2),
      y: clampY(side === "top" ? rect.top - contentHeight * effectiveZoom - gap : rect.bottom + gap),
    });
  }, [scaleWithZoom, side, zoom]);

  const showTooltip = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    updatePosition();
    setMounted(true);
    requestAnimationFrame(() => setOpen(true));
  }, [updatePosition]);

  const hideTooltip = useCallback(() => {
    setOpen(false);
    closeTimerRef.current = window.setTimeout(() => setMounted(false), 150);
  }, []);

  useLayoutEffect(() => {
    if (mounted) updatePosition();
  }, [mounted, text, zoom, updatePosition]);

  useEffect(() => {
    if (!mounted) return;
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [mounted, updatePosition]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const visualClass =
    variant === "dark"
      ? "flex items-center gap-1.5 rounded-lg border-0 bg-gray-900 px-2.5 py-1.5 text-xs font-medium leading-4 text-white shadow-lg"
      : "rounded-[18px] border border-[#e5e5e5] bg-[#f6f6f4] px-3 py-1.5 text-[11px] text-gray-700 shadow-lg";
  const accessibleText = shortcut ? `${text} ${shortcut}` : text;

  return (
    <>
      <span
        ref={triggerRef}
        tabIndex={0}
        data-state={open ? "instant-open" : "closed"}
        aria-describedby={mounted ? tooltipId : undefined}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className={triggerClassName}
      >
        {children}
      </span>
      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            data-radix-popper-content-wrapper=""
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              transform: `translate(${position.x}px, ${position.y}px) scale(${scaleWithZoom ? zoom : 1})`,
              transformOrigin: "top left",
              minWidth: maxWidth ? undefined : "max-content",
              maxWidth: maxWidth ?? undefined,
              willChange: "transform",
              zIndex: 100,
              ['--radix-popper-transform-origin' as string]: side === "top" ? '50% 100%' : side === "bottom" ? '50% 0px' : side === "left" ? '100% 50%' : '0px 50%',
            }}
          >
            <div
              ref={contentRef}
              data-side={side}
              data-align="center"
              data-state={open ? "instant-open" : "closed"}
               className={`py-tooltip-content z-[100] overflow-hidden animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ${maxWidth ? "whitespace-normal" : ""} ${visualClass} ${className}`}
              style={{
                ['--radix-tooltip-content-transform-origin' as string]: 'var(--radix-popper-transform-origin)',
                ['--radix-tooltip-content-available-width' as string]: 'var(--radix-popper-available-width)',
                ['--radix-tooltip-content-available-height' as string]: 'var(--radix-popper-available-height)',
                ['--radix-tooltip-trigger-width' as string]: 'var(--radix-popper-anchor-width)',
                ['--radix-tooltip-trigger-height' as string]: 'var(--radix-popper-anchor-height)',
                animationFillMode: open ? undefined : 'forwards',
                width: maxWidth ? "auto" : undefined,
              }}
            >
              <span>{text}</span>
              {shortcut ? <kbd className="ml-1 text-[10px] text-[#858589]">{shortcut}</kbd> : null}
              <span
                id={tooltipId}
                role="tooltip"
                style={{
                  position: 'absolute',
                  border: 0,
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: 'hidden',
                  clip: 'rect(0px, 0px, 0px, 0px)',
                  whiteSpace: 'nowrap',
                  overflowWrap: 'normal',
                }}
              >
                {accessibleText}
              </span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function InfoTooltip({
  text,
  size = 12,
  className = "ml-1",
  maxWidth,
}: {
  text: string;
  size?: number;
  className?: string;
  maxWidth?: number;
}) {
  return (
    <HoverTooltip text={text} side="bottom" maxWidth={maxWidth} triggerClassName={`${className} inline-flex shrink-0 cursor-pointer text-gray-400`}>
      <Info size={size} strokeWidth={2} className={size === 14 ? "h-3.5 w-3.5" : "h-3 w-3"} />
    </HoverTooltip>
  );
}

function ResetSettingButton() {
  return (
    <HoverTooltip text="Reset" side="top" triggerClassName="inline-flex shrink-0">
      <button aria-label="Reset" className="nodrag flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-[#F5F5F5] text-gray-400 hover:text-gray-600 disabled:opacity-50">
        <RotateCcw size={14} strokeWidth={2} className="h-3.5 w-3.5" />
      </button>
    </HoverTooltip>
  );
}

function MediaRadioMark({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
      style={{ borderColor: selected ? "#0b62f1" : "#c2c2c4" }}
    >
      {selected ? <span className="h-2.5 w-2.5 rounded-full bg-[#0b62f1]" /> : null}
    </span>
  );
}

function MediaCheckboxMark({ selected, disabled = false }: { selected: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border"
      style={{
        borderColor: selected ? "#0b62f1" : "#c2c2c4",
        backgroundColor: selected ? "#0b62f1" : "transparent",
        color: "white",
        opacity: disabled && !selected ? 0.4 : 1,
      }}
    >
      {selected ? <Check size={16} strokeWidth={2} className="h-4 w-4" /> : null}
    </span>
  );
}

function MediaLibraryPopover({
  open,
  anchorRef,
  width,
  height,
  maxHeight,
  onClose,
  children,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  width: number;
  height?: number;
  maxHeight?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const updatePosition = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ x: rect.right - width, y: rect.bottom + 6 });
  }, [anchorRef, width]);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as globalThis.Node;
      if (popoverRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, onClose, open, updatePosition]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-radix-popper-content-wrapper=""
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        transform: `translate(${position.x}px, ${position.y}px)`,
        minWidth: "max-content",
        zIndex: 400,
      }}
    >
      <div
        ref={popoverRef}
        data-side="bottom"
        data-align="end"
        data-state="open"
        role="dialog"
        tabIndex={-1}
        className="overflow-y-auto rounded-lg border-none bg-white px-0 py-2 text-[#1b1b18] shadow-lg outline-none"
        style={{
          width,
          height,
          maxHeight,
          animation: "enter 0.15s ease",
          "--tw-enter-opacity": 0,
          "--tw-enter-scale": 0.95,
          "--tw-enter-translate-y": "-0.5rem",
        } as React.CSSProperties}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function SortByPopover({ open, anchorRef, onClose }: { open: boolean; anchorRef: React.RefObject<HTMLButtonElement | null>; onClose: () => void }) {
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [date, setDate] = useState<string | null>(null);
  const rowClass = "flex w-full items-center gap-2 rounded-lg border-none bg-transparent px-4 py-2 text-left text-[14px] font-normal leading-5 outline-none transition-colors hover:bg-[#f5f5f5] hover:text-[#3d3d41] focus-visible:ring-2 focus-visible:ring-ring";
  const sectionLabel = "px-4 pb-1 pt-1 text-[12px] font-medium uppercase tracking-wider text-[#858589]";

  return (
    <MediaLibraryPopover open={open} anchorRef={anchorRef} width={220} height={365} maxHeight="min(70vh, 500px)" onClose={onClose}>
      <div className="flex w-full flex-col gap-1">
        <div className={sectionLabel}>Sort</div>
        <button type="button" aria-pressed={sort === "newest"} className={`${rowClass} ${sort === "newest" ? "text-[#3d3d41]" : "text-[#858589]"}`} onClick={() => setSort("newest")}>
          <MediaRadioMark selected={sort === "newest"} />
          Newest first
        </button>
        <button type="button" aria-pressed={sort === "oldest"} className={`${rowClass} cursor-pointer ${sort === "oldest" ? "text-[#3d3d41]" : "text-[#858589]"}`} onClick={() => setSort("oldest")}>
          <MediaRadioMark selected={sort === "oldest"} />
          Oldest first
        </button>
      </div>
      <div className="mx-4 my-2 h-px bg-[#e5e5e5]/60" />
      <div className="flex w-full flex-col gap-1">
        <div className="flex items-center justify-between px-4 pb-1 pt-1 text-[12px] font-medium uppercase tracking-wider text-[#737373]">
          <span>Date</span>
          <button type="button" disabled={!date} className="rounded-sm text-[12px] font-medium normal-case leading-4 tracking-normal text-[#1b1b18]/70 outline-none transition-colors hover:text-[#1b1b18] disabled:pointer-events-none disabled:text-[#737373] disabled:opacity-60" onClick={() => setDate(null)}>
            Reset
          </button>
        </div>
        {[
          "Today",
          "Yesterday",
          "Last 7 days",
          "Last 30 days",
          "Custom range",
        ].map((item) => (
          <button key={item} type="button" aria-pressed={date === item} className={`${rowClass} cursor-pointer ${date === item ? "text-[#3d3d41]" : "text-[#858589]"}`} onClick={() => setDate(item)}>
            <MediaRadioMark selected={date === item} />
            {item}
          </button>
        ))}
      </div>
    </MediaLibraryPopover>
  );
}

function FiltersPopover({ open, anchorRef, onClose }: { open: boolean; anchorRef: React.RefObject<HTMLButtonElement | null>; onClose: () => void }) {
  const items = ["Images", "Video", "Audio", "PDF", "Word", "Spreadsheet", "Presentation", "Code & Text"];
  return (
    <MediaLibraryPopover open={open} anchorRef={anchorRef} width={176} height={332} onClose={onClose}>
      <div className="flex w-full flex-col gap-1">
        {items.map((item, index) => {
          const selected = index === 0;
          const disabled = !selected;
          return (
            <button
              key={item}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              className={`flex w-full items-center gap-2 rounded-lg border-none bg-transparent px-4 py-2 text-left text-[14px] font-normal leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring ${disabled ? "cursor-not-allowed text-[#1b1b18]/30" : "cursor-default text-[#858589]"}`}
            >
              <MediaCheckboxMark selected={selected} disabled={disabled} />
              {item}
            </button>
          );
        })}
      </div>
    </MediaLibraryPopover>
  );
}

function MediaLibraryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sortOpen, setSortOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);
  const filtersButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) return;
    const timeout = window.setTimeout(() => {
      setSortOpen(false);
      setFiltersOpen(false);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const filterButtonClass =
    "relative flex items-center gap-2 rounded-lg border-none bg-transparent p-2 text-[14px] font-normal leading-5 text-[#3d3d41] outline-none transition-colors hover:bg-[#f5f5f5] focus:outline-none focus-visible:outline-none";
  const folderButtonClass =
    "flex items-center gap-2 rounded-lg px-3 py-2 text-[14px] leading-5 transition-colors";

  return createPortal(
    <div data-media-library-modal="true" className="pointer-events-auto fixed inset-0 z-[300] flex items-end justify-center md:items-center">
      <button aria-label="Close media library overlay" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex h-[95vh] w-full flex-col overflow-hidden rounded-t-2xl bg-[#f4f4f4] shadow-2xl md:h-[88vh] md:w-[1060px] md:max-w-[96vw] md:rounded-2xl">
        <input
          multiple
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx"
          className="hidden"
          type="file"
        />

        <div className="mx-3 mb-3 mt-3 flex flex-col gap-2 rounded-xl bg-white p-3 md:mx-4 md:mb-5 md:mt-4 md:gap-3 md:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <div className="flex min-w-0 flex-col">
                <h2 className="truncate text-base font-semibold leading-6 text-[#3d3d41]">
                  <span className="font-semibold">Select Image</span>
                </h2>
                <span className="text-[12px] leading-4 text-[#858589]">0 files</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl bg-[#f5f5f5] p-2 md:hidden">
                <HoverTooltip text="Grid view" side="top" triggerClassName="inline-flex">
                  <button aria-pressed="false" aria-label="Grid view" className="flex h-5 w-5 items-center justify-center text-[#858589] transition-colors hover:text-[#3d3d41]">
                    <IconLayoutGridFilled size={20} className="h-5 w-5" />
                  </button>
                </HoverTooltip>
                <span aria-hidden="true" className="h-5 w-px bg-[#e5e5e5]" />
                <HoverTooltip text="List view" side="top" triggerClassName="inline-flex">
                  <button aria-pressed="true" aria-label="List view" className="flex h-5 w-5 items-center justify-center text-[#3d3d41] transition-colors">
                    <IconLayoutList size={20} stroke={2} className="h-5 w-5" />
                  </button>
                </HoverTooltip>
              </div>
              <HoverTooltip text="Close" side="top" triggerClassName="inline-flex">
                <button
                  aria-label="Close media library"
                  onClick={onClose}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#858589] transition-colors hover:bg-[#f5f5f5] hover:text-[#3d3d41]"
                >
                  <X size={16} strokeWidth={2} className="h-4 w-4" />
                </button>
              </HoverTooltip>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex h-[42px] min-w-0 flex-1 items-center gap-3 rounded-xl bg-[#f5f5f5] px-3 md:h-12 md:px-5">
              <Search size={20} strokeWidth={2} className="h-4 w-4 shrink-0 text-[#858589] md:h-5 md:w-5" />
              <input
                placeholder="Search prompts & file names…"
                aria-label="Search assets"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-[#3d3d41] outline-none placeholder:text-[#858589] md:text-[14px]"
              />
            </div>
            <HoverTooltip text="Refresh library" side="top" triggerClassName="inline-flex shrink-0">
              <button
                aria-label="Refresh media library"
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-[#f5f5f5] text-[#858589] transition-colors hover:bg-[#f0f0f0] hover:text-[#3d3d41] md:h-12 md:w-12"
              >
                <RefreshCw size={20} strokeWidth={2} className="h-5 w-5" />
              </button>
            </HoverTooltip>
            <HoverTooltip text="Upload images, videos, audio, or documents to your library" side="top" triggerClassName="inline-flex shrink-0">
              <button
                aria-label="Upload files to media library"
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center gap-2 rounded-xl bg-[#4f46e6] px-0 text-[14px] font-semibold leading-5 text-white shadow-sm transition-colors hover:bg-[#4338ca] md:h-12 md:w-[172px]"
              >
                <IconCloudUpload size={20} stroke={2} className="h-5 w-5 shrink-0" />
                <span className="hidden md:inline">Upload Media</span>
              </button>
            </HoverTooltip>
          </div>
        </div>

        <div className="relative flex flex-1 overflow-hidden md:pr-4">
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-col gap-3 px-3 pb-4 pt-4 md:flex-row md:items-end md:justify-between md:gap-4 md:px-4 md:pb-9">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="text-[14px] font-semibold leading-5 text-[#1b1b18]">Your Media</p>
                <div className="flex gap-1.5 overflow-x-auto md:gap-3">
                  <button aria-label="Show all assets" aria-pressed="true" className="flex items-center gap-1.5 rounded-full bg-[#dcdafa] px-2.5 py-1.5 text-[13px] font-normal leading-5 text-[#4f46e6] transition-colors md:gap-2 md:px-3 md:py-2 md:text-[14px]">
                    <IconLayout size={20} stroke={2} className="h-4 w-4 shrink-0 md:h-5 md:w-5" />
                    <span className="whitespace-nowrap leading-5">All</span>
                  </button>
                  <button aria-label="AI-generated content from your chats and workflows" aria-pressed="false" className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-normal leading-5 text-[#1b1b18] transition-colors hover:bg-black/5 md:gap-2 md:px-3 md:py-2 md:text-[14px]">
                    <Sparkles size={20} strokeWidth={2} className="lucide lucide-sparkles h-4 w-4 shrink-0 md:h-5 md:w-5" />
                    <span className="whitespace-nowrap leading-5">Generated</span>
                  </button>
                  <button aria-label="Files you uploaded directly" aria-pressed="false" className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-normal leading-5 text-[#1b1b18] transition-colors hover:bg-black/5 md:gap-2 md:px-3 md:py-2 md:text-[14px]">
                    <CloudUpload size={20} strokeWidth={2} className="h-4 w-4 shrink-0 md:h-5 md:w-5" />
                    <span className="whitespace-nowrap leading-5">My Uploads</span>
                  </button>
                  <button aria-label="Items you marked as favorite" aria-pressed="false" className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-normal leading-5 text-[#1b1b18] transition-colors hover:bg-black/5 md:gap-2 md:px-3 md:py-2 md:text-[14px]">
                    <Heart size={20} strokeWidth={2} className="h-4 w-4 shrink-0 md:h-5 md:w-5" />
                    <span className="whitespace-nowrap leading-5">Favorites</span>
                  </button>
                </div>
              </div>
              <div className="flex w-full items-center justify-between gap-2 md:w-auto md:justify-start">
                <button
                  ref={sortButtonRef}
                  type="button"
                  aria-label="Sort media library by Newest first"
                  aria-haspopup="dialog"
                  aria-expanded={sortOpen}
                  data-state={sortOpen ? "open" : "closed"}
                  className={`${filterButtonClass} order-2 bg-[#f5f5f5] text-[#858589] md:order-1 md:bg-transparent md:text-[#3d3d41]`}
                  onClick={() => {
                    setSortOpen((value) => !value);
                    setFiltersOpen(false);
                  }}
                >
                  <ArrowUpDown size={20} strokeWidth={1.5} className="h-5 w-5 shrink-0" />
                  <span className="whitespace-nowrap leading-5">Sort By</span>
                  <ChevronDown size={20} strokeWidth={2} className={`h-5 w-5 shrink-0 transition-transform ${sortOpen ? "rotate-180" : ""}`} />
                </button>
                <button
                  ref={filtersButtonRef}
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={filtersOpen}
                  data-state={filtersOpen ? "open" : "closed"}
                  className={`${filterButtonClass} order-1 bg-[#f5f5f5] text-[#858589] md:order-2 md:bg-transparent md:text-[#3d3d41]`}
                  onClick={() => {
                    setFiltersOpen((value) => !value);
                    setSortOpen(false);
                  }}
                >
                  <IconAdjustmentsHorizontal size={20} stroke={1.5} className="h-5 w-5 shrink-0" />
                  <span className="whitespace-nowrap leading-5">Filters</span>
                  <ChevronDown size={20} strokeWidth={2} className={`h-5 w-5 shrink-0 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
                  <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#0b62f1]" />
                </button>
                <div className="order-3 hidden items-center gap-2 rounded-xl bg-[#f5f5f5]/30 p-2 md:flex">
                  <HoverTooltip text="Grid view" side="top" triggerClassName="inline-flex">
                    <button aria-pressed="false" aria-label="Grid view" className="flex h-5 w-5 items-center justify-center text-[#737373] transition-colors hover:text-[#1b1b18]">
                      <IconLayoutGridFilled size={20} className="h-5 w-5" />
                    </button>
                  </HoverTooltip>
                  <span aria-hidden="true" className="h-5 w-px bg-[#e5e5e5]" />
                  <HoverTooltip text="List view" side="top" triggerClassName="inline-flex">
                    <button aria-pressed="true" aria-label="List view" className="flex h-5 w-5 items-center justify-center text-[#1b1b18] transition-colors">
                      <IconLayoutList size={20} stroke={2} className="h-5 w-5" />
                    </button>
                  </HoverTooltip>
                </div>
                <button type="button" className="order-3 ml-auto flex items-center gap-2 rounded-lg bg-[#f5f5f5] p-2 text-[14px] font-normal leading-5 text-[#858589] outline-none transition-colors hover:bg-[#f0f0f0] md:hidden">
                  <IconLayoutGridFilled size={20} className="h-5 w-5 shrink-0" />
                </button>
              </div>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="px-6" />
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl">
                  <ImageIcon size={32} strokeWidth={2} className="h-8 w-8" style={{ color: "rgba(115, 115, 115, 0.4)" }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-[#1b1b18]">No images found</p>
                  <p className="mt-1 text-xs text-[#737373]">Upload files above, or generate content in chat</p>
                </div>
                <button aria-label="Upload images, videos, audio, or documents" className="mt-1 flex items-center gap-1.5 rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#737373] transition-colors hover:bg-black/5 hover:text-[#1b1b18]">
                  <CloudUpload size={16} strokeWidth={2} className="h-4 w-4" />
                  Upload files
                </button>
              </div>
            </div>
          </div>

          <div className="hidden w-[188px] shrink-0 flex-col pt-7 md:flex">
            <div className="flex shrink-0 flex-col gap-3">
              <button aria-pressed="true" className={`${folderButtonClass} bg-[#f5f5f5] font-semibold text-[#3d3d41]`}>
                <IconLayout size={20} stroke={2} className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 text-left">All</span>
              </button>
              <button aria-pressed="false" className={`${folderButtonClass} font-normal text-[#858589] hover:bg-black/5 hover:text-[#3d3d41]`}>
                <Folder size={20} strokeWidth={2} className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 text-left">My Folders</span>
              </button>
            </div>
          </div>
        </div>
        <SortByPopover open={sortOpen} anchorRef={sortButtonRef} onClose={() => setSortOpen(false)} />
        <FiltersPopover open={filtersOpen} anchorRef={filtersButtonRef} onClose={() => setFiltersOpen(false)} />
      </div>
    </div>,
    document.body,
  );
}

function UploadPopover({
  open,
  anchorRef,
  onClose,
  onSelectAsset,
  onUpload,
  accept = "image/*",
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onSelectAsset: () => void;
  onUpload?: (file: File) => void;
  accept?: string;
}) {
  const { zoom } = useViewport();
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const popoverId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updatePosition = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      x: rect.left,
      y: rect.bottom + 8 * zoom,
    });
  }, [anchorRef, zoom]);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, zoom, updatePosition]);

  useEffect(() => {
    if (open) {
      const timeout = window.setTimeout(() => {
        setMounted(true);
        setVisible(true);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    const timeout = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(() => setMounted(false), 150);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as globalThis.Node;
      if (anchorRef.current?.contains(target)) return;
      const popover = document.getElementById(popoverId);
      if (popover?.contains(target)) return;
      onClose();
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, mounted, onClose, popoverId, updatePosition]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      onUpload(file);
    }
    onClose();
    if (e.target) e.target.value = "";
  }, [onUpload, onClose]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      id={popoverId}
      data-radix-popper-content-wrapper=""
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
        transformOrigin: "top left",
        minWidth: "max-content",
        willChange: "transform",
        zIndex: 50,
        ['--radix-popper-transform-origin' as string]: '50% 0px',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
      />
      <div
        className="chat-upload-popover py-upload-popover-content"
        data-state={visible ? "open" : "closed"}
        data-side="bottom"
        style={{
          ['--radix-tooltip-content-transform-origin' as string]: 'var(--radix-popper-transform-origin)',
        }}
      >
        <p className="text-xs text-[#3d3d41]">Add a file from your device or select one from your library</p>
        <button
          type="button"
          onClick={() => {
            onClose();
            onSelectAsset();
          }}
          className="chat-upload-popover-action chat-upload-popover-action-secondary"
        >
          <ImagePlus size={16} strokeWidth={2} className="h-4 w-4" />
          Select Asset
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="chat-upload-popover-action chat-upload-popover-action-primary"
        >
          <Plus size={16} strokeWidth={2} className="h-4 w-4" />
          Upload
        </button>
      </div>
    </div>,
    document.body,
  );
}

function NodeMenu({
  open,
  anchorRef,
  onClose,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const { zoom } = useViewport();
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuId = useId();

  const updatePosition = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      x: rect.right - 200 * zoom,
      y: rect.bottom + 4 * zoom,
    });
  }, [anchorRef, zoom]);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, zoom, updatePosition]);

  useEffect(() => {
    if (open) {
      const timeout = window.setTimeout(() => {
        setMounted(true);
        setVisible(true);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    const timeout = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(() => setMounted(false), 150);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as globalThis.Node;
      if (anchorRef.current?.contains(target)) return;
      const menu = document.getElementById(menuId);
      if (menu?.contains(target)) return;
      onClose();
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, menuId, onClose, open, updatePosition]);

  if (!mounted || typeof document === "undefined") return null;

  const itemClass =
    "relative flex h-9 cursor-pointer select-none items-center gap-3 rounded-[14px] px-3.5 text-sm outline-none transition-colors hover:bg-accent focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0";

  return createPortal(
    <div
      data-radix-popper-content-wrapper=""
      dir="ltr"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
        transformOrigin: "top left",
        minWidth: "max-content",
        ['--radix-popper-transform-origin' as string]: '100% 0px',
        willChange: "transform",
        zIndex: 50,
      }}
    >
      <div
        id={menuId}
        data-side="bottom"
        data-align="end"
        role="menu"
        aria-orientation="vertical"
        data-state={visible ? "open" : "closed"}
        data-radix-menu-content=""
        dir="ltr"
        className="py-menu-content z-50 flex min-w-[8rem] w-[200px] flex-col gap-1 overflow-hidden rounded-[18px] bg-popover p-2 text-popover-foreground shadow-lg"
        tabIndex={-1}
        data-orientation="vertical"
        style={{
          outline: "none",
          ['--radix-dropdown-menu-content-transform-origin' as string]: 'var(--radix-popper-transform-origin)',
          pointerEvents: "auto",
        }}
      >
        <div role="menuitem" className={itemClass} tabIndex={-1} data-orientation="vertical" data-radix-collection-item="">Duplicate</div>
        <div role="menuitem" className={itemClass} tabIndex={-1} data-orientation="vertical" data-radix-collection-item="">Duplicate with Edges</div>
        <div role="menuitem" className={itemClass} tabIndex={-1} data-orientation="vertical" data-radix-collection-item="">Lock</div>
        <div role="menuitem" className={itemClass} tabIndex={-1} data-orientation="vertical" data-radix-collection-item="">Delete</div>
      </div>
    </div>,
    document.body,
  );
}

function LiveNodeHeader({
  title,
  tooltip,
  onMenuOpen,
  menuOpen,
  menuButtonRef,
}: {
  title: string;
  tooltip: string;
  onMenuOpen: () => void;
  menuOpen: boolean;
  menuButtonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="flex h-[59px] items-start justify-between border-b border-gray-100 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="w-full min-w-0 cursor-grab select-none truncate text-sm font-medium leading-5 text-gray-900">
          {title}
        </div>
      </div>
      <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
        <InfoTooltip text={tooltip} size={14} className="" />
        <button className="nodrag rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40">
          <RotateCcw size={14} strokeWidth={2} className="h-3.5 w-3.5" />
        </button>
        <button className="nodrag flex items-center gap-1.5 rounded-md border border-green-500/30 bg-green-500/20 px-3 py-1.5 text-xs font-medium leading-4 text-green-500 transition-all hover:bg-green-500/30">
          <Play size={12} strokeWidth={2} className="h-3 w-3 fill-current" />
          <span>Run</span>
        </button>
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          data-state={menuOpen ? "open" : "closed"}
          onClick={onMenuOpen}
          className="nodrag inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
        >
          <MoreHorizontal size={16} strokeWidth={2} className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function LiveNodeShell({ children }: { children: ReactNode }) {
  return <div className="w-[380px] max-w-[380px] overflow-visible rounded-xl border border-gray-200 bg-white text-[#1b1b18] shadow-2xl transition-all duration-300">{children}</div>;
}

const FIELD_TOOLTIPS: Record<string, string> = {
  text_field: "Text input — accepts any string value",
  number_field: "Number input — accepts numeric values",
  boolean_field: "Boolean toggle — true or false",
  image_field: "Image input — accepts an image URL",
  audio_field: "Audio input — accepts an audio URL",
  video_field: "Video input — accepts a video URL",
  media_field: "Media input — accepts audio or video files",
  file_field: "File input — accepts any file upload",
};

function fieldTypeFromLabel(label: string): string {
  if (label.startsWith("number")) return "number_field";
  if (label.startsWith("boolean") || label.startsWith("bool")) return "boolean_field";
  if (label.startsWith("image")) return "image_field";
  if (label.startsWith("audio")) return "audio_field";
  if (label.startsWith("video")) return "video_field";
  if (label.startsWith("media") || label.startsWith("avmedia")) return "media_field";
  if (label.startsWith("file")) return "file_field";
  return "text_field";
}

function RequestFieldHeader({ label, canDelete = true }: { label: string; canDelete?: boolean }) {
  const fieldType = fieldTypeFromLabel(label);
  const tooltipText = FIELD_TOOLTIPS[fieldType] ?? FIELD_TOOLTIPS.text_field;
  return (
    <div className="mb-2 flex w-full min-w-0 items-center gap-2">
      <div className="nodrag nopan shrink-0 cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing">
        <GripVertical size={14} strokeWidth={2} className="h-3.5 w-3.5" />
      </div>
      <span className="group/label flex min-w-0 flex-1 items-center gap-1 text-xs font-medium leading-4 text-gray-900 hover:text-[#6366f1]">
        <span className="truncate">{label}</span>
        <Pencil size={12} strokeWidth={2} className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/label:opacity-100" />
        <InfoTooltip text={tooltipText} size={12} className="shrink-0 text-gray-400" maxWidth={200} />
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button type="button" title="Copy value" className="nodrag rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <Copy size={14} strokeWidth={2} className="h-3.5 w-3.5" />
        </button>
        <button type="button" title="Delete" disabled={!canDelete} className="nodrag rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 disabled:opacity-50">
          <Trash2 size={14} strokeWidth={2} className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function RequestTextField({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div className="relative w-full">
      <div className="w-full min-w-0">
        <RequestFieldHeader label={label} />
        <div className="w-full min-w-0">
          <div className="relative">
            <textarea
              readOnly
              value={value}
              rows={3}
              className="nodrag nowheel h-[78px] w-full min-w-0 resize-y rounded-lg border border-gray-200 bg-[#F5F5F5] px-3 py-2 text-sm leading-5 text-gray-900 outline-none focus:border-[#6366f1] disabled:opacity-50"
            />
            <button type="button" title="Expand" className="nodrag absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-md bg-gray-200/80 text-gray-500 transition-colors hover:bg-gray-300 hover:text-gray-700">
              <Maximize2 size={12} strokeWidth={2} className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
      <SourceFieldHandle id={id} color="#f59e0b" top={31} />
    </div>
  );
}

function RequestImageField({ id, label }: { id: string; label: string }) {
  const [uploadPopoverOpen, setUploadPopoverOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const uploadButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleUpload = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setUploadedUrl(url);
  }, []);

  return (
    <div className="relative w-full">
      <div className="w-full min-w-0">
        <RequestFieldHeader label={label} />
        <div className="w-full min-w-0">
          <div className="min-w-0">
            <div className="relative">
              {uploadedUrl ? (
                <div className="relative">
                  <img src={uploadedUrl} alt="Uploaded preview" className="h-32 w-full rounded-lg border border-gray-200 object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(uploadedUrl);
                      setUploadedUrl(null);
                    }}
                    className="nodrag absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                  >
                    <X size={12} strokeWidth={2} className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <HoverTooltip text="Upload image" side="top" triggerClassName="block">
                  <button
                    ref={uploadButtonRef}
                    type="button"
                    tabIndex={-1}
                    aria-label="Upload image"
                    onClick={() => setUploadPopoverOpen((open) => !open)}
                    data-state={uploadPopoverOpen ? "open" : "closed"}
                    className="nodrag flex h-[38px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2.5 text-xs font-normal leading-4 text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
                  >
                    <IconUpload size={14} stroke={2} className="h-3.5 w-3.5" />
                    <span className="capitalize">Upload image</span>
                  </button>
                </HoverTooltip>
              )}
            </div>
          </div>
        </div>
      </div>
      {!uploadedUrl && (
        <UploadPopover
          open={uploadPopoverOpen}
          anchorRef={uploadButtonRef}
          onClose={() => setUploadPopoverOpen(false)}
          onSelectAsset={() => setAssetModalOpen(true)}
          onUpload={handleUpload}
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        />
      )}
      <MediaLibraryModal open={assetModalOpen} onClose={() => setAssetModalOpen(false)} />
      <SourceFieldHandle id={id} color="#3b82f6" top={31} />
    </div>
  );
}

const FIELD_TYPE_ITEMS = [
  { type: "text_field", label: "Text", icon: AlignLeft },
  { type: "number_field", label: "Number", icon: Hash },
  { type: "boolean_field", label: "Boolean", icon: Check },
  { type: "image_field", label: "Image", icon: ImageIcon },
  { type: "audio_field", label: "Audio", icon: Music },
  { type: "video_field", label: "Video", icon: Video },
  { type: "media_field", label: "Media", icon: Music },
  { type: "file_field", label: "File", icon: File },
];

function FieldTypeMenu({ onSelect }: { onSelect: (type: string) => void }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  const show = useCallback(() => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ x: rect.right - 140, y: rect.bottom + 4 });
    setMounted(true);
    requestAnimationFrame(() => setOpen(true));
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
    setTimeout(() => setMounted(false), 150);
  }, []);

  const select = useCallback((type: string) => {
    setOpen(false);
    setTimeout(() => {
      setMounted(false);
      onSelect(type);
    }, 150);
  }, [onSelect]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target instanceof Node ? e.target : null;
      if (btnRef.current && target && !btnRef.current.contains(target)) {
        const menuEl = document.getElementById(menuId);
        if (menuEl && !menuEl.contains(target)) {
          hide();
        }
      }
    };
    window.addEventListener("mousedown", handler, true);
    return () => window.removeEventListener("mousedown", handler, true);
  }, [open, hide, menuId]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        data-state={open ? "open" : "closed"}
        onClick={show}
        className="nodrag flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 disabled:opacity-50"
      >
        <Plus size={16} strokeWidth={2} className="h-4 w-4" />
      </button>
      {mounted &&
        createPortal(
          <div
            id={menuId}
            role="menu"
            aria-orientation="vertical"
            data-state={open ? "open" : "closed"}
            className={`fixed z-50 min-w-[140px] overflow-hidden rounded-[18px] border border-gray-200 bg-white p-1 text-gray-700 shadow-lg transition-all duration-150 ${open ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
            style={{ left: position.x, top: position.y }}
          >
            {FIELD_TYPE_ITEMS.map((item) => (
              <div
                key={item.type}
                role="menuitem"
                tabIndex={-1}
                onClick={() => select(item.type)}
                className="relative flex cursor-pointer select-none items-center gap-2 rounded-[18px] px-3 py-2 text-xs text-gray-700 outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100"
              >
                <span className="text-gray-500">
                  <item.icon size={14} strokeWidth={2} className="h-3.5 w-3.5" />
                </span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

function RequestInputsNode() {
  const [fields, setFields] = useState([
    { type: "text_field", id: "text_field", label: "text_field" },
    { type: "image_field", id: "image_field", label: "image_field" },
  ]);

  const addField = useCallback((type: string) => {
    setFields((prev) => {
      const existing = prev.filter((f) => f.type === type);
      const id = existing.length === 0 ? type : `${type}_${existing.length + 1}`;
      return [...prev, { type, id, label: id }];
    });
  }, []);

  return (
    <div className="w-[380px] rounded-xl border border-gray-200 bg-white text-[#1b1b18] shadow-2xl">
      <div className="flex h-[57px] items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium leading-5 text-gray-900">Request-Inputs</span>
          <InfoTooltip text="Define the input fields for your workflow. These become the request parameters when running via Playground or API." size={14} className="" maxWidth={280} />
        </div>
        <div className="flex items-center gap-1.5">
          <FieldTypeMenu onSelect={addField} />
        </div>
      </div>
      <div className="relative w-full px-4 py-4">
        <div className="w-full space-y-4">
          {fields.map((f) =>
            f.type === "image_field" ? (
              <RequestImageField key={f.id} id={f.id} label={f.label} />
            ) : (
              <RequestTextField key={f.id} id={f.id} label={f.label} value="" />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function ResponseOutputCard({ label }: { label: string }) {
  return (
    <div className="space-y-2 rounded-lg bg-[#F5F5F5] p-3">
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-sm leading-5 text-gray-900" title={label}>{label}</span>
        <button type="button" title="Rename" className="nodrag flex-shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
          <Pencil size={12} strokeWidth={2} className="h-3 w-3" />
        </button>
        <button type="button" title="Disconnect" className="nodrag flex-shrink-0 rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-500">
          <Trash2 size={14} strokeWidth={2} className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex h-10 items-center justify-center rounded border border-gray-200 bg-white">
        <span className="text-xs leading-4 text-gray-400">No output yet</span>
      </div>
    </div>
  );
}

function ResponseNode() {
  const edges = useEdges();
  const allEdges = edges.filter((e) => e.target === "response" && e.targetHandle === "result");
  const cards = allEdges.length > 0
    ? allEdges.map((e) => ({ key: e.id, label: e.sourceHandle ?? e.source }))
    : [{ key: "default", label: "final_result" }];

  return (
    <div className="w-[380px] rounded-xl border border-gray-200 bg-white text-[#1b1b18] shadow-2xl transition-all duration-300">
      <div className="flex h-[57px] items-center gap-3 border-b border-gray-100 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6366f1]/10 text-[#6366f1]">
          <FileOutput size={16} strokeWidth={2} className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold leading-5 text-gray-900">Response</span>
        <InfoTooltip text="Connect node outputs here to define what your workflow returns. These values appear as results in Playground and API responses." size={14} className="" maxWidth={280} />
      </div>
      <div className="space-y-3 p-4">
        <div className="relative h-6">
          <FieldHandle id="result" color="#6366f1" top={12} />
          <span className="text-xs leading-4 text-gray-500">result</span>
        </div>
        <div className="border-t border-gray-100" />
        <div className="space-y-3">
          {cards.map((card) => (
            <ResponseOutputCard key={card.key} label={card.label} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CropImageNode() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <LiveNodeShell>
      <LiveNodeHeader
        title="Crop Image"
        tooltip="Crop an image by percentage coordinates."
        menuOpen={menuOpen}
        menuButtonRef={menuButtonRef}
        onMenuOpen={() => setMenuOpen((open) => !open)}
      />
      <NodeMenu open={menuOpen} anchorRef={menuButtonRef} onClose={() => setMenuOpen(false)} />
      <div className="px-4 py-4">
        <div className="space-y-4">
          <CropImageUpload id="input-image" label="Input Image" required />
          <CropImageNumber id="x-position" label="X Position (%)" defaultValue="0" />
          <CropImageNumber id="y-position" label="Y Position (%)" defaultValue="0" />
          <CropImageNumber id="width" label="Width (%)" defaultValue="100" />
          <CropImageNumber id="height" label="Height (%)" defaultValue="100" />
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="relative overflow-visible">
            <div className="absolute right-[-23px] top-2 z-50 flex -translate-y-1/2 items-center">
              <Handle
                id="output-image"
                type="source"
                position={Position.Right}
                className="!relative !right-auto !top-auto !translate-x-0 !translate-y-0 !rounded-full !border-2"
                style={{
                  position: "relative",
                  right: "auto",
                  top: "auto",
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#3b82f6",
                  borderColor: "#3b82f680",
                  boxShadow: "#3b82f650 0px 0px 8px",
                  cursor: "crosshair",
                  ['--handle-color' as string]: "#3b82f6",
                }}
              />
            </div>
            <div className="mb-1.5 text-xs font-normal leading-4 text-gray-500">Output Image</div>
            <div className="flex h-10 items-center justify-center rounded border border-gray-200 bg-white">
              <span className="text-xs text-gray-400">No output yet</span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-1 text-[10px] leading-[15px] text-gray-400">
          <Coins size={12} strokeWidth={2} className="h-3 w-3" />
          <span>~0.005 M</span>
        </div>
      </div>
    </LiveNodeShell>
  );
}

const STICKY_COLORS = [
  { name: "Yellow", color: "#fef9c3" },
  { name: "Blue", color: "#dbeafe" },
  { name: "Green", color: "#dcfce7" },
  { name: "Pink", color: "#fce7f3" },
  { name: "Purple", color: "#f3e4ff" },
  { name: "Orange", color: "#ffedd5" },
] as const;

const STICKY_FONTS = [
  { name: "Sans", family: "sans-serif" },
  { name: "Serif", family: "serif" },
  { name: "Mono", family: "monospace" },
  { name: "Cursive", family: "cursive" },
] as const;

function StickyNoteNode({ id, selected, data }: { id: string; selected: boolean; data: { color?: string; fontSize?: number; fontFamily?: string; bold?: boolean; text?: string } }) {
  const [text, setText] = useState(data.text ?? "");
  const [bgColor, setBgColor] = useState(data.color ?? STICKY_COLORS[0].color);
  const [fontSize, setFontSize] = useState(data.fontSize ?? 24);
  const [fontFamily, setFontFamily] = useState(data.fontFamily ?? "sans-serif");
  const [isBold, setBold] = useState(data.bold ?? true);
  const [focused, setFocused] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  const [toolbarPos, setToolbarPos] = useState({ top: -9999, left: -9999 });
  const { x: vx, y: vy, zoom } = useViewport();
  const internalNode = useInternalNode(id);
  const w = internalNode?.measured?.width ?? 200;
  const h = internalNode?.measured?.height ?? 200;
  const px = internalNode?.internals.positionAbsolute.x ?? 0;
  const py = internalNode?.internals.positionAbsolute.y ?? 0;

  useLayoutEffect(() => {
    if (!selected || !nodeRef.current) {
      setToolbarPos({ top: -9999, left: -9999 });
      return;
    }
    const rect = nodeRef.current.getBoundingClientRect();
    setToolbarPos({ top: rect.top, left: rect.left + rect.width + 8 });
  }, [selected, zoom, w, h, px, py, vx, vy]);

  return (
    <>
      <div ref={nodeRef} className="relative" style={{ width: w, height: h }}>
        <NodeResizer
          minWidth={120}
          minHeight={80}
          isVisible={selected}
          handleClassName="!w-2.5 !h-2.5 !bg-transparent !border-none"
          lineClassName="!border-transparent"
          color="transparent"
        />
        <div
          className={`h-full w-full rounded-xl p-2.5 shadow-sm transition-shadow ${selected ? "" : "cursor-grab active:cursor-grabbing"}`}
          style={{
            backgroundColor: bgColor,
            boxShadow: selected ? "#a3a3a3 0px 0px 0px 2px" : undefined,
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Type a note..."
            className="h-full w-full resize-none rounded-lg border-none p-3 leading-relaxed text-gray-800 outline-2 outline-offset-2 outline-transparent transition-colors placeholder:font-normal placeholder:text-gray-400/60 dark:text-gray-800 nodrag"
            style={{
              backgroundColor: focused ? "rgba(255, 255, 255, 0.58)" : "transparent",
              boxShadow: focused ? "inset 0 0 0 1px rgba(255, 255, 255, 0.48)" : "none",
              cursor: focused ? "text" : undefined,
              fontFamily,
              fontSize,
              fontWeight: isBold ? 700 : 400,
            }}
          />
        </div>
      </div>
      {selected && createPortal(
        <div
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            transform: `translate(${toolbarPos.left}px, ${toolbarPos.top}px) scale(${zoom})`,
            transformOrigin: "top left",
            zIndex: 40,
          }}
        >
          <StickyNoteToolbar
            color={bgColor}
            fontSize={fontSize}
            fontFamily={fontFamily}
            bold={isBold}
            onColorChange={setBgColor}
            onFontSizeChange={setFontSize}
            onFontFamilyChange={setFontFamily}
            onBoldChange={setBold}
          />
        </div>,
        document.body
      )}
    </>
  );
}

function StickyNoteToolbar({
  color,
  fontSize,
  fontFamily,
  bold,
  onColorChange,
  onFontSizeChange,
  onFontFamilyChange,
  onBoldChange,
}: {
  color: string;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  onColorChange: (color: string) => void;
  onFontSizeChange: (size: number) => void;
  onFontFamilyChange: (family: string) => void;
  onBoldChange: (bold: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
      <div className="flex flex-col gap-1">
        {STICKY_COLORS.map(({ name, color: c }) => (
          <HoverTooltip key={name} text={name} side="right" triggerClassName="inline-flex">
            <button
              aria-label={name}
              onClick={() => onColorChange(c)}
              className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${c === color ? "scale-110" : ""}`}
              style={{ backgroundColor: c, borderColor: c === color ? "#000" : "transparent" }}
            />
          </HoverTooltip>
        ))}
      </div>

      <div className="mx-0.5 h-px bg-[#e5e7eb]" />

      <HoverTooltip text={bold ? "Remove bold" : "Bold"} side="right" triggerClassName="inline-flex">
        <button
          aria-label={bold ? "Remove bold" : "Bold"}
          onClick={() => onBoldChange(!bold)}
          className={`flex h-6 w-6 items-center justify-center rounded-md text-xs transition-colors ${
            bold
              ? "bg-gray-800 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
          }`}
        >
          <span className="font-bold">B</span>
        </button>
      </HoverTooltip>

      <div className="mx-0.5 h-px bg-[#e5e7eb]" />

      <div className="flex flex-col items-center gap-0.5">
        <HoverTooltip text="Increase font size" side="right" triggerClassName="inline-flex">
          <button
            aria-label="Increase font size"
            onClick={() => onFontSizeChange(Math.min(72, fontSize + 2))}
            disabled={fontSize >= 72}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30"
          >
            A+
          </button>
        </HoverTooltip>
        <span className="select-none text-[9px] leading-none text-gray-500">
          {fontSize}
        </span>
        <HoverTooltip text="Decrease font size" side="right" triggerClassName="inline-flex">
          <button
            aria-label="Decrease font size"
            onClick={() => onFontSizeChange(Math.max(8, fontSize - 2))}
            disabled={fontSize <= 8}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-[10px] text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30"
          >
            A−
          </button>
        </HoverTooltip>
      </div>

      <div className="mx-0.5 h-px bg-[#e5e7eb]" />

      <div className="flex flex-col gap-1">
        {STICKY_FONTS.map(({ name, family }) => (
          <HoverTooltip key={name} text={name} side="right" triggerClassName="inline-flex">
            <button
              aria-label={name}
              onClick={() => onFontFamilyChange(family)}
              className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] transition-colors ${
                family === fontFamily
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
              }`}
              style={{ fontFamily: family }}
            >
              Aa
            </button>
          </HoverTooltip>
        ))}
      </div>
    </div>
  );
}

function CropImageUpload({ id, label, required }: { id: string; label: string; required?: boolean }) {
  return (
    <div className="relative">
      <FieldHandle id={id} color="#3b82f6" top={12} />
      <div className="flex items-start gap-3">
        <div className="flex h-6 min-w-[96px] shrink-0 items-center text-xs font-normal leading-4 text-gray-500">
          {label}{required && <span className="text-red-400">*</span>}
        </div>
        <div className="min-w-0 flex-1">
          <HoverTooltip text="Upload image" side="top" triggerClassName="block">
            <button
              type="button"
              tabIndex={-1}
              aria-label="Upload image"
              className="nodrag flex h-[38px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2.5 text-xs font-normal leading-4 text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
            >
              <IconUpload size={14} stroke={2} className="h-3.5 w-3.5" />
              <span>Upload Image</span>
            </button>
          </HoverTooltip>
        </div>
        <AddToRequestButton className="mt-1.5" />
      </div>
    </div>
  );
}

function CropImageNumber({ id, label, defaultValue }: { id: string; label: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);

  const reset = () => setValue(defaultValue);
  const update = (next: string) => {
    const parsed = Number(next);
    if (Number.isNaN(parsed)) {
      setValue(next);
      return;
    }
    setValue(String(Math.min(100, Math.max(0, parsed))));
  };

  return (
    <div className="relative overflow-visible">
      <FieldHandle id={id} color="#ec4899" top={14} />
      <div className="space-y-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex min-w-0 shrink items-center truncate text-xs font-normal leading-4 text-gray-500">
            {label}
            <InfoTooltip text={`${label} from 0 to 100`} className="ml-1" />
          </span>
          <input
            min="0"
            max="100"
            step="1"
            type="range"
            value={value}
            onChange={(event) => update(event.target.value)}
            className="nodrag h-2 min-w-[60px] flex-1 appearance-none rounded-lg bg-gray-200 accent-workflow-accent-500 disabled:opacity-50"
          />
          <input
            min="0"
            max="100"
            type="number"
            value={value}
            onChange={(event) => update(event.target.value)}
            className="nodrag w-[56px] shrink-0 rounded-lg border border-gray-200 bg-[#F5F5F5] px-1 py-1 text-center text-xs leading-4 text-gray-900 outline-none disabled:opacity-50"
          />
          <HoverTooltip text="Reset" side="top" triggerClassName="inline-flex shrink-0">
            <button
              type="button"
              aria-label="Reset"
              onClick={reset}
              className="nodrag flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-[#F5F5F5] text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <RotateCcw size={14} strokeWidth={2} className="h-3.5 w-3.5" />
            </button>
          </HoverTooltip>
          <AddToRequestButton />
        </div>
      </div>
    </div>
  );
}

function GeminiPreviewNode() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div className="w-[380px] max-w-[380px] overflow-visible rounded-xl border border-gray-200 bg-white text-[#1b1b18] shadow-2xl transition-all duration-300">
      <div className="flex h-[59px] items-start justify-between border-b border-gray-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="w-full min-w-0 cursor-grab select-none truncate text-sm font-medium leading-5 text-gray-900">
            Gemini 3.1 Pro
          </div>
        </div>
        <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
          <InfoTooltip
            text="Generate text using Gemini 3.1 Pro (Google) via OpenRouter"
            size={14}
            className=""
          />
          <button className="nodrag rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40">
            <RotateCcw size={14} strokeWidth={2} className="h-3.5 w-3.5" />
          </button>
          <button className="nodrag flex items-center gap-1.5 rounded-md border border-green-500/30 bg-green-500/20 px-3 py-1.5 text-xs font-medium leading-4 text-green-500 transition-all hover:bg-green-500/30">
            <Play size={12} strokeWidth={2} className="h-3 w-3 fill-current" />
            <span>Run</span>
          </button>
          <button
            ref={menuButtonRef}
            type="button"
            id="node-menu-trigger"
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            data-state={menuOpen ? "open" : "closed"}
            onClick={() => setMenuOpen((open) => !open)}
            className="nodrag inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
          >
            <MoreHorizontal size={16} strokeWidth={2} className="h-4 w-4" />
          </button>
          <NodeMenu open={menuOpen} anchorRef={menuButtonRef} onClose={() => setMenuOpen(false)} />
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="space-y-4">
          <GeminiTextarea id="prompt" label="Prompt" required placeholder="Enter your prompt..." />
          <GeminiTextarea id="system-prompt" label="System Prompt" placeholder="You are a helpful assistant..." />
          <GeminiUpload id="image" label="Image (Vision)" buttonText="Upload Image" showRequirements handleColor="#3b82f6" />
          <GeminiUpload id="video" label="Video" buttonText="Upload Video" handleColor="#22c55e" />
          <GeminiUpload id="audio" label="Audio" buttonText="Upload Audio" handleColor="#06b6d4" />
        </div>

        <div className="relative">
          <button onClick={() => setSettingsOpen((open) => !open)} className="nodrag group mt-5 flex cursor-pointer items-center gap-2">
            <ChevronDown size={16} strokeWidth={2} className={`h-4 w-4 text-gray-400 transition-transform ${settingsOpen ? "" : "-rotate-90"}`} />
            <span className="text-xs text-gray-400 group-hover:text-gray-600">Settings</span>
          </button>
        </div>

        {settingsOpen && <GeminiSettings />}

        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="relative overflow-visible">
            <div className="absolute right-[-23px] top-2 z-50 flex -translate-y-1/2 items-center">
              <Handle
                id="response"
                type="source"
                position={Position.Right}
                className="!relative !right-auto !top-auto !translate-x-0 !translate-y-0 !rounded-full !border-2"
                style={{
                  position: "relative",
                  right: "auto",
                  top: "auto",
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#f59e0b",
                  borderColor: "#f59e0b80",
                  boxShadow: "#f59e0b50 0px 0px 8px",
                  cursor: "crosshair",
                  ['--handle-color' as string]: "#f59e0b",
                }}
              />
            </div>
            <div className="mb-1.5 text-xs font-normal leading-4 text-gray-500">Response</div>
            <div className="min-h-[84px] rounded-lg border border-gray-200 bg-white p-3">
              <div className="py-6 text-center text-xs leading-4 text-gray-400">No output yet</div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-1 text-[10px] leading-[15px] text-gray-400">
          <Coins size={12} strokeWidth={2} className="h-3 w-3" />
          <span>~0.0001 M</span>
          <HoverTooltip text="Variable credits based on actual token usage" side="top" triggerClassName="inline-flex shrink-0 cursor-help text-gray-400">
            <Info size={12} strokeWidth={2} className="h-3 w-3" />
          </HoverTooltip>
        </div>
      </div>
    </div>
  );
}

function GeminiTextarea({
  id,
  label,
  required,
  placeholder,
}: {
  id: string;
  label: string;
  required?: boolean;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <FieldHandle id={id} color="#f59e0b" />
      <div className="mb-1.5 flex h-7 items-center text-xs font-normal leading-4 text-gray-500">
        <span>{label}</span>
        {required && <span className="text-red-400">*</span>}
        <InfoTooltip text={label === "Prompt" ? "The message to send to the LLM" : "Instructions that define the model's behavior"} />
        <span className="ml-auto">
          <AddToRequestButton />
        </span>
      </div>
      <div className="relative">
        <textarea
          rows={3}
          placeholder={placeholder}
          className="nodrag nowheel h-[86px] w-full resize-y rounded-lg border border-gray-200 bg-[#F5F5F5] p-3 text-sm leading-5 text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-300"
        />
        <div className="absolute bottom-2 right-2">
          <HoverTooltip text="Expand" side="top" triggerClassName="inline-flex">
            <button type="button" aria-label="Expand" className="nodrag flex h-6 w-6 items-center justify-center rounded-md bg-gray-200/80 text-gray-500 transition-colors hover:bg-gray-300 hover:text-gray-700">
              <Maximize2 size={14} strokeWidth={2} className="h-3.5 w-3.5" />
            </button>
          </HoverTooltip>
        </div>
      </div>
    </div>
  );
}

function GeminiUpload({
  id,
  label,
  buttonText,
  showRequirements,
  handleColor,
}: {
  id: string;
  label: string;
  buttonText: string;
  showRequirements?: boolean;
  handleColor?: string;
}) {
  const [uploadPopoverOpen, setUploadPopoverOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string; file: File }[]>([]);
  const uploadButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleUpload = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setUploadedFiles((prev) => [...prev, { name: file.name, url, file }]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setUploadedFiles((prev) => {
      const f = prev[index];
      if (f) URL.revokeObjectURL(f.url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  return (
    <div className="relative">
      <FieldHandle id={id} color={handleColor ?? "#3b82f6"} top={12} />
      <div className="flex items-start gap-3">
        <div className="flex h-6 min-w-[96px] shrink-0 items-center text-xs font-normal leading-4 text-gray-500">
          {label}
        </div>
        <div className="min-w-0 flex-1">
          {uploadedFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {uploadedFiles.map((f, i) => (
                <div key={i} className="group relative">
                  <img src={f.url} alt={f.name} className="h-16 w-16 rounded-lg border border-gray-200 object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="nodrag absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X size={10} strokeWidth={2} className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <HoverTooltip text={`Upload ${buttonText.replace(/^Upload\s+/i, "").toLowerCase()}`} side="top" triggerClassName="block">
            <button
              ref={uploadButtonRef}
              type="button"
              tabIndex={-1}
              aria-label={`Upload ${buttonText.replace(/^Upload\s+/i, "").toLowerCase()}`}
              onClick={() => setUploadPopoverOpen((open) => !open)}
              data-state={uploadPopoverOpen ? "open" : "closed"}
              className="nodrag flex h-[38px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2.5 text-xs font-normal leading-4 text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
            >
              <IconUpload size={14} stroke={2} className="h-3.5 w-3.5" />
              <span className="capitalize">{buttonText}</span>
            </button>
          </HoverTooltip>
          <UploadPopover
            open={uploadPopoverOpen}
            anchorRef={uploadButtonRef}
            onClose={() => setUploadPopoverOpen(false)}
            onSelectAsset={() => setAssetModalOpen(true)}
            onUpload={handleUpload}
          />
          <MediaLibraryModal open={assetModalOpen} onClose={() => setAssetModalOpen(false)} />
          {showRequirements && (
            <div className="mt-1 flex items-center gap-1">
              <InfoTooltip
                text="Max images: 10"
                className=""
              />
              <span className="text-[10px] text-gray-400">Upload requirements</span>
            </div>
          )}
        </div>
        <AddToRequestButton className="mt-1.5" />
      </div>
    </div>
  );
}

function GeminiSettings() {
  return (
    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
      <GeminiSettingSlider label="Temperature" value="0.7" min="0" max="2" step="0.1" tooltip="Controls randomness of the generated response." />
      <GeminiSettingNumber label="Max Tokens" value="1024" min="1" max="8192" tooltip="Maximum number of tokens to generate." />
      <GeminiSettingBoolean label="Reasoning" tooltip="Enable or disable reasoning-oriented generation." />
      <GeminiSettingSlider label="Top P" value="1" min="0" max="1" step="0.05" tooltip="Nucleus sampling threshold." />
      <GeminiSettingSlider label="Top K" value="0" min="0" max="500" step="1" tooltip="Restrict sampling to the top K tokens." />
      <GeminiSettingSlider label="Frequency Penalty" value="0" min="-2" max="2" step="0.1" tooltip="Penalizes tokens based on frequency so far." />
      <GeminiSettingSlider label="Presence Penalty" value="0" min="-2" max="2" step="0.1" tooltip="Penalizes tokens already present in the text." />
      <GeminiSettingSlider label="Repetition Penalty" value="1" min="0" max="2" step="0.05" tooltip="Discourages repetitive token selection." />
      <GeminiSettingSlider label="Min P" value="0" min="0" max="1" step="0.05" tooltip="Minimum probability threshold for sampling." />
      <GeminiSettingSlider label="Top A" value="0" min="0" max="1" step="0.05" tooltip="Alternative sampling threshold parameter." />
      <GeminiSettingNumber label="Seed" value="0" min="0" step="1" tooltip="Set a fixed seed for more reproducible output." />
      <GeminiSettingTextarea label="Stop Sequences" placeholder="e.g. END, STOP, ###" tooltip="Generation stops when any sequence matches." />
      <GeminiSettingBoolean label="JSON Mode" tooltip="Force the model to respond with JSON." />
    </div>
  );
}

function GeminiSettingLabel({
  label,
  tooltip,
}: {
  label: string;
  tooltip: string;
}) {
  return (
    <span data-handle-anchor="label" className="flex min-w-0 shrink items-center truncate text-xs text-gray-500">
      <HoverTooltip text={label} side="top" triggerClassName="min-w-0 truncate">
        <span className="truncate">{label}</span>
      </HoverTooltip>
      <InfoTooltip text={tooltip} />
    </span>
  );
}

function GeminiSettingSlider({
  label,
  value,
  min,
  max,
  step,
  tooltip,
}: {
  label: string;
  value: string;
  min: string;
  max: string;
  step: string;
  tooltip: string;
}) {
  const [currentValue, setCurrentValue] = useState(value);

  return (
    <div className="relative overflow-visible">
      <FieldHandle id={`setting-${label}`} color="#ec4899" top={14} />
      <div className="space-y-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <GeminiSettingLabel label={label} tooltip={tooltip} />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={currentValue}
            onChange={(event) => setCurrentValue(event.target.value)}
            className="nodrag h-2 min-w-[60px] flex-1 appearance-none rounded-lg bg-gray-200 accent-workflow-accent-500 disabled:opacity-50"
          />
          <input
            type="number"
            min={min}
            max={max}
            value={currentValue}
            onChange={(event) => setCurrentValue(event.target.value)}
            className="nodrag w-[56px] shrink-0 rounded-lg border border-gray-200 bg-[#F5F5F5] px-1 py-1 text-center text-xs leading-4 text-gray-900 outline-none disabled:opacity-50"
          />
          <ResetSettingButton />
          <AddToRequestButton />
        </div>
      </div>
    </div>
  );
}

function GeminiSettingNumber({
  label,
  value,
  min,
  max,
  step,
  tooltip,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  step?: string;
  tooltip: string;
}) {
  const [currentValue, setCurrentValue] = useState(value);

  return (
    <div className="relative overflow-visible">
      <FieldHandle id={`setting-${label}`} color="#ec4899" top={14} />
      <div className="space-y-1.5">
        <div className="flex min-w-0 items-center gap-3">
          <GeminiSettingLabel label={label} tooltip={tooltip} />
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={currentValue}
            onChange={(event) => setCurrentValue(event.target.value)}
            className="nodrag w-[56px] shrink-0 rounded-lg border border-gray-200 bg-[#F5F5F5] px-1 py-1 text-center text-xs leading-4 text-gray-900 outline-none focus:border-workflow-accent-500 disabled:opacity-50"
          />
          <ResetSettingButton />
          <AddToRequestButton />
        </div>
      </div>
    </div>
  );
}

function GeminiSettingBoolean({
  label,
  tooltip,
}: {
  label: string;
  tooltip: string;
}) {
  return (
    <div className="relative flex min-w-0 items-center gap-3 overflow-visible">
      <FieldHandle id={`setting-${label}`} color="#6366f1" top={14} />
      <GeminiSettingLabel label={label} tooltip={tooltip} />
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[10px] font-medium text-gray-600">False</span>
          <button
            type="button"
            role="switch"
            aria-checked="false"
            data-state="unchecked"
            value="on"
            className="peer nodrag inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=unchecked]:bg-input data-[state=checked]:bg-workflow-accent-500"
          >
            <span data-state="unchecked" className="pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
          </button>
          <span className="text-[10px] font-medium text-gray-400">True</span>
        </div>
        <AddToRequestButton />
      </div>
    </div>
  );
}

function GeminiSettingTextarea({
  label,
  placeholder,
  tooltip,
}: {
  label: string;
  placeholder: string;
  tooltip: string;
}) {
  return (
    <div className="relative overflow-visible">
      <FieldHandle id={`setting-${label}`} color="#f59e0b" top={14} />
      <div className="mb-1.5 flex h-7 items-center text-xs text-gray-500">
        <GeminiSettingLabel label={label} tooltip={tooltip} />
        <span className="ml-auto">
          <AddToRequestButton />
        </span>
      </div>
      <textarea
        rows={2}
        placeholder={placeholder}
        className="nodrag nowheel w-full resize-y rounded-lg border border-gray-200 bg-[#F5F5F5] p-3 text-sm text-gray-900 outline-none focus:border-workflow-accent-500 disabled:opacity-50"
      />
    </div>
  );
}

const nodeTypes = {
  request: RequestInputsNode,
  response: ResponseNode,
  geminiPreview: GeminiPreviewNode,
  cropImage: CropImageNode,
  stickyNote: StickyNoteNode,
};

const quickActions = [
  { icon: Plus, label: "New task", shortcut: "CtrlShift+O" },
  { icon: Search, label: "Search tasks", shortcut: "CtrlK" },
];

const mainNavItems = [
  { icon: MessageSquareMore, label: "Tasks", href: "/app/chat/recent" },
  { icon: FolderOpen, label: "Projects", href: "/app/chat/projects" },
  { icon: Library, label: "Library", href: "/app/library" },
  { icon: IconArrowsSplit, label: "Flow", href: "/app/flow" },
  { icon: Boxes, label: "Tools", href: "/app/nodes" },
  { icon: BookOpen, label: "API and MCP", href: "https://magica.com/docs" },
];

function Sidebar({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const [isMobileSidebar, setIsMobileSidebar] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
  const [footerDetailsOpen, setFooterDetailsOpen] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobileSidebar(event.matches);
      setOpen(false);
    };

    handleChange(media);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [setOpen]);

  const navIconClass = "h-5 w-5 shrink-0 text-[#3d3d41]";
  const navItemClass =
    "chat-sidebar-nav-item group flex w-full items-center gap-[9px] overflow-clip rounded-lg p-2 text-sm font-normal leading-5 tracking-normal text-[#3d3d41] transition-colors hover:bg-[#dadada]";
  const collapsedIconClass =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-[18px] text-sm font-medium leading-5 text-[#3d3d41] transition-colors hover:bg-[#f0f0f0]";

  return (
    <div
      className={`chat-sidebar-shell flex h-full flex-shrink-0 flex-col overflow-hidden transition-[width,min-width,max-width,opacity,transform] duration-200 ease-in-out ${
        isMobileSidebar ? "fixed inset-y-0 left-0 z-50" : "relative"
      }`}
      style={{
        width: isMobileSidebar ? 0.5 : open ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH,
        minWidth: isMobileSidebar ? 0 : undefined,
        backgroundColor: "rgb(240, 240, 240)",
        borderRight: "0.5px solid rgb(224, 224, 226)",
      }}
    >
      {/* 1. Shrunk state */}
      <div
        className={`group/sidebar h-full flex-col items-center ${open || isMobileSidebar ? "hidden" : "flex visible"}`}
        style={{ width: SIDEBAR_COLLAPSED_WIDTH }}
      >
        <HoverTooltip text="Open sidebar" shortcut="Ctrl." side="right" triggerClassName="inline-flex mb-6 mt-2">
          <button
            aria-label="Open sidebar"
            onClick={() => setOpen(true)}
            className="relative inline-flex h-9 w-9 items-center justify-center gap-2 rounded-[18px] text-sm font-medium leading-5 text-[#3d3d41] transition-colors hover:bg-[#f0f0f0]"
          >
            <img
              src="/favicon.ico"
              alt="Magica"
              className="h-5 w-5 object-contain transition-opacity group-hover/sidebar:opacity-0"
            />
            <PanelLeftOpen
              size={20}
              strokeWidth={2}
              className="absolute text-[#3d3d41] opacity-0 transition-opacity group-hover/sidebar:opacity-100"
            />
          </button>
        </HoverTooltip>

        <div className="flex flex-col items-center gap-1">
          {quickActions.map(({ icon: Icon, label, shortcut }) => (
            <HoverTooltip key={label} text={label} shortcut={shortcut} side="right" triggerClassName="inline-flex">
              <button aria-label={label} className={collapsedIconClass}>
                <Icon size={20} strokeWidth={2} className={navIconClass} />
              </button>
            </HoverTooltip>
          ))}
          {mainNavItems.map(({ icon: Icon, label, href }) => {
            const isTasks = label === "Tasks";
            return (
              <HoverTooltip key={label} text={label} side="right" triggerClassName="inline-flex">
                <a aria-label={label} href={href} className={collapsedIconClass}>
                  <Icon
                    size={isTasks ? 18 : 20}
                    strokeWidth={2}
                    className={isTasks ? "h-[18px] w-[18px] shrink-0 text-[#3d3d41]" : navIconClass}
                  />
                </a>
              </HoverTooltip>
            );
          })}
        </div>

        <div className="mt-auto pb-4">
          <HoverTooltip text="Settings" side="right" triggerClassName="inline-flex">
            <button aria-label="Settings" className="inline-flex h-8 w-8 shrink-0 items-center justify-center gap-2 rounded-[18px] text-sm font-medium leading-5 text-[#3d3d41] transition-colors hover:bg-[#f0f0f0]">
              <Settings size={16} strokeWidth={2} className="h-4 w-4 shrink-0 text-[#3d3d41]" />
            </button>
          </HoverTooltip>
        </div>
      </div>

      {/* 2. Expanded state */}
      <div
        className={`h-full flex-col ${open && !isMobileSidebar ? "flex visible" : "hidden"}`}
        style={{ width: SIDEBAR_EXPANDED_WIDTH }}
      >
        <div className="flex h-[52px] shrink-0 items-start justify-between px-4 pt-2">
          <a href="/app" className="flex h-9 w-[104px] items-center">
            <img
              src="/galaxy.webp"
              alt="Magica"
              className="block h-[26px] w-[104px] object-contain"
            />
          </a>
          <HoverTooltip text="Close sidebar" shortcut="Ctrl." side="bottom" triggerClassName="inline-flex">
            <button
              aria-label="Close sidebar"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center gap-2 rounded-[18px] text-sm font-medium leading-5 text-[#3d3d41] transition-colors hover:bg-[#f0f0f0]"
            >
              <PanelLeftClose size={20} strokeWidth={2} className="!h-5 !w-5" />
            </button>
          </HoverTooltip>
        </div>

        <div className="flex flex-col gap-1 px-2 pb-1">
          {quickActions.map(({ icon: Icon, label, shortcut }) => (
            <button key={label} className={navItemClass}>
              <span className="flex items-center gap-[9px]">
                <Icon size={20} strokeWidth={2} className={navIconClass} />
                <span className="truncate text-left">{label}</span>
              </span>
              <span className="text-[10px] font-normal leading-5 text-[#a3a3a7] opacity-0 transition-opacity group-hover:opacity-100">
                {shortcut}
              </span>
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 pb-2 [scrollbar-width:thin]">
          <div className="flex flex-col gap-1">
            {mainNavItems.map(({ icon: Icon, label, href }) => {
              const isTasks = label === "Tasks";
              return (
                <a key={label} href={href} className={navItemClass}>
                  <span className="flex items-center gap-[9px]">
                    <Icon
                      size={isTasks ? 18 : 20}
                      strokeWidth={2}
                      className={isTasks ? "h-[18px] w-[18px] shrink-0 text-[#3d3d41]" : navIconClass}
                    />
                    <span className="truncate">{label}</span>
                  </span>
                </a>
              );
            })}
          </div>
          <div className="px-3 py-8 text-center text-sm font-normal leading-5 text-[#a3a3a7]">No tasks yet</div>
        </div>

        <div className="relative z-10 flex-shrink-0 bg-[rgb(240,240,240)] px-2">
          <div
            data-testid="sidebar-footer"
            className={`overflow-hidden transition-all duration-300 ease-in-out ${footerDetailsOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}`}
          >
            <div className="space-y-3" data-testid="auth-section">
              <div className="relative w-full">
                <button className="inline-flex h-8 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-[18px] border border-gray-200 bg-white px-3 text-xs font-medium leading-4 text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
                  <Settings size={16} strokeWidth={2} className="h-3.5 w-3.5 shrink-0" />
                  <span>Settings</span>
                </button>
              </div>
              <button className="relative inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-[18px] bg-indigo-600/90 px-4 py-2 text-sm font-medium leading-5 text-white shadow-lg transition-all duration-300 before:absolute before:inset-0 before:translate-x-[-200%] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:transition-transform before:duration-1000 before:ease-in-out hover:bg-indigo-700 hover:shadow-xl hover:before:translate-x-[200%] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
                <Gift size={16} strokeWidth={2} className="h-4 w-4 shrink-0 text-[#3d3d41]" />
                <span>Claim Offer</span>
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200">
            <HoverTooltip text={footerDetailsOpen ? "Hide sidebar details" : "Show sidebar details"} side="top" triggerClassName="block">
              <button
                aria-label={footerDetailsOpen ? "Hide sidebar details" : "Show sidebar details"}
                onClick={() => setFooterDetailsOpen((open) => !open)}
                className="flex h-5 w-full items-center justify-center py-1 text-gray-400 transition-all hover:bg-gray-50 hover:text-gray-600"
              >
                {footerDetailsOpen ? (
                  <ChevronDown size={12} strokeWidth={2} className="h-3 w-3" />
                ) : (
                  <ChevronUp size={12} strokeWidth={2} className="h-3 w-3" />
                )}
              </button>
            </HoverTooltip>
            <div className="flex items-center justify-center px-4 py-2">
              <HoverTooltip text="Open user menu" side="top" triggerClassName="inline-flex">
                <button aria-label="Open user menu" className="cl-userButtonTrigger flex h-7 items-center justify-center rounded-md text-[13px] font-medium leading-[18px] text-[#212126]">
                  <span className="flex h-7 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-300 text-xs font-medium text-gray-600">
                      R
                    </span>
                    <span className="block truncate pl-2 text-[13px] font-medium leading-[18px] text-black">
                      Raunak Lanjewar
                    </span>
                  </span>
                </button>
              </HoverTooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CanvasZoomKeyboardHandler() {
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

type PickerGroup = {
  label: "Utility" | "LLM Call";
  items: Array<{
    icon: React.ElementType;
    label: string;
  }>;
};

const pickerGroups: PickerGroup[] = [
  {
    label: "Utility",
    items: [{ icon: StickyNote, label: "Sticky Note" }, { icon: Crop, label: "Crop Image" }],
  },
  {
    label: "LLM Call",
    items: [{ icon: Layers, label: "Gemini 3.1 Pro" }],
  },
];

function CenterNodeToolbar({
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

  return (
    <div className="absolute bottom-[15px] left-1/2 z-[100] -translate-x-1/2">
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

function NodePicker({
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

function TopLeftCanvasTitle() {
  const [title, setTitle] = useState("Dummy Workflow Title");

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-50 sm:left-16">
      <div className="pointer-events-auto flex items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/85 px-2 py-1.5 shadow-md backdrop-blur">
          <HoverTooltip text="Back to Workflow" side="bottom" triggerClassName="inline-flex">
            <a
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
              aria-label="Back to Workflow"
              href="/workflows"
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

function TopRightCanvasControls() {
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
          <HoverTooltip text="Run Workflow" side="bottom" variant="dark" scaleWithZoom={false} triggerClassName="inline-flex">
            <button aria-label="Run Workflow" className="flex h-8 w-9 items-center justify-center rounded-lg border border-[#818cf8] bg-[#6366f1] text-white shadow-sm transition-all hover:bg-[#4f46e5] disabled:cursor-not-allowed disabled:opacity-50">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="butt"
                strokeLinejoin="miter"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
            </button>
          </HoverTooltip>
          <HoverTooltip text="Execution History" side="bottom" variant="dark" scaleWithZoom={false} triggerClassName="inline-flex">
            <button aria-label="Execution History" className="flex h-8 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-800 shadow-sm transition-all hover:bg-gray-100">
              <Clock size={14} strokeWidth={2} className="h-3.5 w-3.5" />
            </button>
          </HoverTooltip>
        </div>
      </div>
    </div>
  );
}

function BottomRightCanvasControls() {
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

function BottomToolbar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const [collapsed, setCollapsed] = useState(false);

  const noop = () => {};
  const toolbarShellClass =
    "absolute bottom-[15px] left-[15px] z-10 flex items-center gap-1 rounded-xl border border-gray-200 bg-white/95 px-2 py-1.5 shadow-[0_0_0_0_rgba(0,0,0,0),0_0_0_0_rgba(0,0,0,0),0_1px_2px_0_rgba(0,0,0,0.05)] backdrop-blur-sm";

  if (collapsed) {
    return (
      <div className={toolbarShellClass}>
        <ToolbarButton icon={ChevronRight} label="Expand controls" onClick={() => setCollapsed(false)} />
      </div>
    );
  }

  return (
    <div className={toolbarShellClass}>
      <ToolbarButton icon={ChevronLeft} label="Collapse controls" onClick={() => setCollapsed(true)} />
      <Divider />
      <ToolbarButton icon={Undo2} label="Undo" onClick={noop} disabled />
      <ToolbarButton icon={Redo2} label="Redo" onClick={noop} disabled />
      <ToolbarButton icon={Command} label="Keyboard shortcuts" onClick={noop} />
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
      <ToolbarButton icon={Move} label="Pan tool" onClick={noop} />
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent disabled:hover:text-gray-300"
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

function Divider() {
  return <div className="mx-0.5 h-5 w-px bg-gray-200" />;
}

function CustomConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  connectionStatus,
  fromHandle,
  toNode,
}: ConnectionLineComponentProps) {
  const handleId = fromHandle?.id;
  const sourceType = handleTypeFromId(handleId);
  const color = HANDLE_COLORS[sourceType] ?? "#f59e0b";
  const [edgePath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });
  const invalid = connectionStatus === "invalid";
  return (
    <g>
      <path
        fill="none"
        stroke={invalid ? "#ef4444" : color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={invalid ? "5,5" : "none"}
        d={edgePath}
        style={{ opacity: 0.9 }}
      />
      {toNode !== null && (
        <circle
          cx={toX}
          cy={toY}
          r={6}
          fill={invalid ? "#ef4444" : color}
          fillOpacity={0.3}
          stroke={invalid ? "#ef4444" : color}
          strokeWidth={2}
        >
          <animate attributeName="r" values="4;8;4" dur="1s" repeatCount="indefinite" />
          <animate attributeName="fillOpacity" values="0.5;0.2;0.5" dur="1s" repeatCount="indefinite" />
        </circle>
      )}
    </g>
  );
}

export default function WorkflowCanvasPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeBase>[0]) => {
      onNodesChangeBase(
        changes.filter(
          (change) => change.type !== "remove" || !PERMANENT_NODE_IDS.has(change.id),
        ),
      );
    },
    [onNodesChangeBase],
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
      setEdges((eds) =>
        addEdge(
          { ...connection, style: { stroke: color, strokeWidth: 2 } },
          eds,
        ),
      );
    },
    [setEdges, edges],
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

  const handleAddGemini = useCallback(() => {
    setNodes((nds) => [
      ...nds,
      {
        id: `gemini-${Date.now()}`,
        type: "geminiPreview",
        position: { x: 420, y: 120 },
        data: {},
      },
    ]);
  }, [setNodes]);

  const handleAddCrop = useCallback(() => {
    setNodes((nds) => [
      ...nds,
      {
        id: `crop-${Date.now()}`,
        type: "cropImage",
        position: { x: 360, y: 360 },
        data: {},
      },
    ]);
  }, [setNodes]);

  const handleAddStickyNote = useCallback(() => {
    setNodes((nds) => [
      ...nds,
      {
        id: `sticky-${Date.now()}`,
        type: "stickyNote",
        position: { x: 420, y: 200 },
        data: { color: "#fef9c3", fontSize: 24, fontFamily: "sans-serif", bold: true, text: "" },
      },
    ]);
  }, [setNodes]);

  return (
    <ReactFlowProvider>
      <Toaster />
      <div className="flex h-screen w-full">
        {/* <PromoTopbar /> */}
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

        <div className="relative flex-1">
          <ReactFlow
            nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          isValidConnection={isValidConnection}
          connectionLineComponent={CustomConnectionLine}

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
          <BottomToolbar />
          <CenterNodeToolbar onAddGemini={handleAddGemini} onAddCrop={handleAddCrop} onAddStickyNote={handleAddStickyNote} />
          </ReactFlow>
        </div>
      </div>
    </ReactFlowProvider>
  );
}