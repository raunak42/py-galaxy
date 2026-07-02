"use client";

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useViewport } from "@xyflow/react";
import { createPortal } from "react-dom";
import { Plus, RotateCcw, Info, Check } from "lucide-react";
export function AddToRequestButton({ className = "" }: { className?: string }) {
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

export function HoverTooltip({
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
      : "rounded-[18px] border border-[#e5e5e5] bg-[#f6f6f4] px-3 py-1.5 text-xs font-normal leading-4 text-[#1b1b18] shadow-md";
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

export function InfoTooltip({
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

export function ResetSettingButton({ disabled = false }: { disabled?: boolean }) {
  return (
    <HoverTooltip text="Reset" side="top" triggerClassName="inline-flex shrink-0">
      <button type="button" aria-label="Reset" disabled={disabled} className="nodrag flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-[#F5F5F5] text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50">
        <RotateCcw size={14} strokeWidth={2} className="h-3.5 w-3.5" />
      </button>
    </HoverTooltip>
  );
}

export function MediaRadioMark({ selected }: { selected: boolean }) {
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

export function MediaCheckboxMark({ selected, disabled = false }: { selected: boolean; disabled?: boolean }) {
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

