"use client";

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useViewport } from "@xyflow/react";
import { createPortal } from "react-dom";
import { Plus, ImagePlus, File } from "lucide-react";
export function UploadPopover({
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

