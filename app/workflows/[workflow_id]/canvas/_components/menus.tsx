"use client";

import React, { useCallback, useEffect, useId, useLayoutEffect, useState, type ComponentType, type ReactNode } from "react";
import { useViewport } from "@xyflow/react";
import { createPortal } from "react-dom";
import { RotateCcw, MoreHorizontal, Play, RefreshCw } from "lucide-react";
import { InfoTooltip } from "./tooltips";
export type PickerMenuItem = {
  key: string;
  label: string;
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  onSelect?: () => void;
};

export function FloatingPickerMenu({
  open,
  anchorRef,
  onClose,
  items,
  width,
  align = "start",
  offset = 4,
  scale = 1,
  contentClassName,
  itemClassName,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  items: PickerMenuItem[];
  width: number;
  align?: "start" | "end";
  offset?: number;
  scale?: number;
  contentClassName: string;
  itemClassName: string;
}) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuId = useId();

  const updatePosition = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      x: align === "end" ? rect.right - width * scale : rect.left,
      y: rect.bottom + offset * scale,
    });
  }, [align, anchorRef, offset, scale, width]);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, scale, updatePosition]);

  useEffect(() => {
    if (open) {
      const frame = window.requestAnimationFrame(() => {
        setMounted(true);
        setVisible(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }
    const frame = window.requestAnimationFrame(() => setVisible(false));
    const timeout = window.setTimeout(() => setMounted(false), 150);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof globalThis.Node ? event.target : null;
      if (!target) return;
      if (anchorRef.current?.contains(target)) return;
      const menu = document.getElementById(menuId);
      if (menu?.contains(target)) return;
      onClose();
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, menuId, onClose, open, updatePosition]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-radix-popper-content-wrapper=""
      dir="ltr"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
        transformOrigin: "top left",
        minWidth: "max-content",
        willChange: "transform",
        zIndex: 50,
        ['--radix-popper-transform-origin' as string]: align === "end" ? "100% 0px" : "0px 0px",
      }}
    >
      <div
        id={menuId}
        data-side="bottom"
        data-align={align}
        role="menu"
        aria-orientation="vertical"
        data-state={visible ? "open" : "closed"}
        data-radix-menu-content=""
        dir="ltr"
        className={contentClassName}
        tabIndex={-1}
        data-orientation="vertical"
        style={{
          outline: "none",
          ['--radix-dropdown-menu-content-transform-origin' as string]: 'var(--radix-popper-transform-origin)',
          pointerEvents: "auto",
        }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              role="menuitem"
              className={itemClassName}
              tabIndex={-1}
              data-orientation="vertical"
              data-radix-collection-item=""
              onClick={() => {
                item.onSelect?.();
                onClose();
              }}
            >
              {Icon ? (
                <span className="text-gray-600 dark:text-zinc-400">
                  <Icon strokeWidth={2} className="h-3.5 w-3.5" />
                </span>
              ) : null}
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

export function NodeMenu({
  open,
  anchorRef,
  onClose,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const { zoom } = useViewport();
  const itemClass =
    "relative flex h-9 cursor-pointer select-none items-center gap-3 rounded-[14px] px-3.5 text-sm outline-none transition-colors hover:bg-gray-200 hover:text-gray-950 focus:bg-gray-200 focus:text-gray-950 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0";

  return (
    <FloatingPickerMenu
      open={open}
      anchorRef={anchorRef}
      onClose={onClose}
      width={200}
      align="end"
      scale={zoom}
      contentClassName="py-menu-content z-50 flex min-w-[8rem] w-[200px] flex-col gap-1 overflow-hidden rounded-[18px] bg-popover p-2 text-popover-foreground shadow-lg"
      itemClassName={itemClass}
      items={[
        { key: "duplicate", label: "Duplicate" },
        { key: "duplicate-with-edges", label: "Duplicate with Edges" },
        { key: "lock", label: "Lock" },
        { key: "delete", label: "Delete" },
      ]}
    />
  );
}

export type MagicaRunButtonState = "idle" | "running" | "pending" | "workflow-running" | "disabled" | "locked";

export function MagicaNodeRunButton({ state, onRun, onCancel, disabled }: { state: MagicaRunButtonState; onRun?: () => void; onCancel?: () => void; disabled?: boolean }) {
  const isBusy = state === "running" || state === "pending" || state === "workflow-running";
  const isHardDisabled = disabled || state === "locked" || state === "disabled" || state === "pending" || state === "workflow-running" || (state === "running" && !onCancel);
  const label = state === "running" ? "Cancel" : state === "pending" ? "Pending" : state === "workflow-running" ? "Running" : "Run";
  const className = [
    "nodrag flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
    state === "running" ? "border border-red-500/30 bg-red-500/20 text-red-400 hover:bg-red-500/30" : "",
    state === "locked" ? "cursor-not-allowed border border-amber-500/30 bg-amber-500/20 text-amber-400 opacity-60" : "",
    state === "disabled" ? "cursor-not-allowed border border-gray-500/30 bg-gray-500/20 text-gray-400 opacity-60" : "",
    state === "pending" ? "cursor-wait border border-yellow-500/30 bg-yellow-500/20 text-yellow-500 opacity-80" : "",
    state === "workflow-running" ? "cursor-not-allowed border border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.2)] text-[#818cf8] opacity-90" : "",
    state === "idle" ? "cursor-pointer border border-green-500/30 bg-green-500/20 text-green-500 hover:bg-green-500/30" : "",
  ].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      disabled={isHardDisabled}
      onClick={state === "running" ? onCancel : onRun}
      className={className}
    >
      {isBusy ? <RefreshCw size={12} strokeWidth={2} className="h-3 w-3 animate-spin" /> : <Play size={12} strokeWidth={2} className="h-3 w-3 fill-current" />}
      <span>{label}</span>
    </button>
  );
}

export function LiveNodeHeader({
  title,
  tooltip,
  onMenuOpen,
  menuOpen,
  menuButtonRef,
  onRun,
  onCancel,
  running = false,
  pending = false,
  runState,
}: {
  title: string;
  tooltip: string;
  onMenuOpen: () => void;
  menuOpen: boolean;
  menuButtonRef: React.RefObject<HTMLButtonElement | null>;
  onRun?: () => void;
  onCancel?: () => void;
  running?: boolean;
  pending?: boolean;
  runState?: MagicaRunButtonState;
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
        <MagicaNodeRunButton state={runState ?? (running ? "running" : pending ? "pending" : onRun ? "idle" : "disabled")} onRun={onRun} onCancel={onCancel} disabled={!onRun} />
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

export function LiveNodeShell({ children, running = false }: { children: ReactNode; running?: boolean }) {
  return <div className={`py-node-shell w-[380px] max-w-[380px] overflow-visible rounded-xl border border-gray-200 bg-white text-[#1b1b18] shadow-2xl transition-all duration-300 ${running ? "node-running" : ""}`}>{children}</div>;
}
