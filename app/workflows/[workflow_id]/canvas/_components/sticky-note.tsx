"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { NodeResizer, useViewport, useInternalNode } from "@xyflow/react";
import { createPortal } from "react-dom";
import { HoverTooltip } from "./tooltips";
export const STICKY_COLORS = [
  { name: "Yellow", color: "#fef9c3" },
  { name: "Blue", color: "#dbeafe" },
  { name: "Green", color: "#dcfce7" },
  { name: "Pink", color: "#fce7f3" },
  { name: "Purple", color: "#f3e4ff" },
  { name: "Orange", color: "#ffedd5" },
] as const;

export const STICKY_FONTS = [
  { name: "Sans", family: "sans-serif" },
  { name: "Serif", family: "serif" },
  { name: "Mono", family: "monospace" },
  { name: "Cursive", family: "cursive" },
] as const;

export function StickyNoteNode({ id, selected, data }: { id: string; selected: boolean; data: { color?: string; fontSize?: number; fontFamily?: string; bold?: boolean; text?: string } }) {
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

export function StickyNoteToolbar({
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

