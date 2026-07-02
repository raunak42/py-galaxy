"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Search, X, ChevronDown, RefreshCw, CloudUpload, Sparkles, Heart, ImageIcon, ArrowUpDown, Folder } from "lucide-react";
import { IconAdjustmentsHorizontal, IconCloudUpload, IconLayout, IconLayoutGridFilled, IconLayoutList } from "@tabler/icons-react";
import { HoverTooltip, MediaCheckboxMark, MediaRadioMark } from "./tooltips";
export function MediaLibraryPopover({
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

export function SortByPopover({ open, anchorRef, onClose }: { open: boolean; anchorRef: React.RefObject<HTMLButtonElement | null>; onClose: () => void }) {
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

export function FiltersPopover({ open, anchorRef, onClose }: { open: boolean; anchorRef: React.RefObject<HTMLButtonElement | null>; onClose: () => void }) {
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

export function MediaLibraryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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

