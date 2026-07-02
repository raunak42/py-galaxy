"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { RotateCcw, Coins, File, Loader2 } from "lucide-react";
import { IconUpload } from "@tabler/icons-react";
import { toast } from "@/lib/toast";
import { displayConnectedValue, isImageUrl } from "../_lib/utils";
import { useConnectedInputValue, useNodeValueContext, useWorkflowRunContext } from "../_lib/contexts";
import { AddToRequestButton, FieldHandle } from "./edges";
import { HoverTooltip, InfoTooltip } from "./tooltips";
import { MediaLibraryModal } from "./media-library";
import { UploadPopover } from "./upload-popover";
import { LiveNodeHeader, LiveNodeShell, NodeMenu } from "./menus";
import { uploadImageWithTransloadit } from "./request-fields";
export function connectedManualInputClass(isConnected: boolean) {
  return isConnected ? "opacity-55 grayscale cursor-not-allowed" : "";
}

export function CropImageNode({ id, data }: { id: string; data?: Record<string, unknown> }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [localRunning, setLocalRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const runTokenRef = useRef(0);
  const { runningNodeIds, pendingNodeIds, addHistoryEntry } = useWorkflowRunContext();
  const { values, setNodeHandleValue } = useNodeValueContext();
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const connectedInput = useConnectedInputValue(id, "input-image");
  const connectedX = useConnectedInputValue(id, "x-position");
  const connectedY = useConnectedInputValue(id, "y-position");
  const connectedWidth = useConnectedInputValue(id, "width");
  const connectedHeight = useConnectedInputValue(id, "height");
  const isRunning = localRunning || runningNodeIds.has(id);
  const isPending = !isRunning && pendingNodeIds.has(id);
  const outputImage = displayConnectedValue(values[id]?.["output-image"] ?? values[id]?.outputImageUrl);

  const effectiveCropValue = useCallback((handle: string, connected: { isConnected: boolean; value: unknown }, fallback: unknown) => {
    if (connected.isConnected) return displayConnectedValue(connected.value);
    const manual = displayConnectedValue(values[id]?.[handle]);
    return manual || displayConnectedValue(fallback);
  }, [id, values]);

  const runCrop = useCallback(async () => {
    if (isRunning) return;
    const startedAt = Date.now();
    const inputImageUrl = effectiveCropValue("input-image", connectedInput, "");
    const cropInputs = {
      inputImageUrl,
      x: Number(effectiveCropValue("x-position", connectedX, data?.x || 0)),
      y: Number(effectiveCropValue("y-position", connectedY, data?.y || 0)),
      width: Number(effectiveCropValue("width", connectedWidth, data?.width || 100)),
      height: Number(effectiveCropValue("height", connectedHeight, data?.height || 100)),
    };
    if (!inputImageUrl) {
      setRunError("Input Image is required");
      toast({ description: "Input Image is required" });
      return;
    }

    const runToken = runTokenRef.current + 1;
    runTokenRef.current = runToken;
    setLocalRunning(true);
    setRunError("");
    try {
      const res = await fetch("/api/tasks/crop-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cropInputs),
      });
      const json = await res.json() as { output?: { outputImageUrl?: string }; error?: string; details?: { message?: string } | unknown };
      if (!res.ok) {
        const detailMessage = typeof json.details === "object" && json.details && "message" in json.details && typeof json.details.message === "string" ? json.details.message : undefined;
        throw new Error(detailMessage ?? json.error ?? "Crop node failed");
      }
      if (runTokenRef.current !== runToken) return;
      const url = json.output?.outputImageUrl ?? "";
      setNodeHandleValue(id, "output-image", url);
      setNodeHandleValue(id, "outputImageUrl", url);
      addHistoryEntry({
        scope: "single",
        status: "success",
        durationMs: Date.now() - startedAt,
        nodeDetails: [{ nodeId: id, label: "Crop Image", status: "success", durationMs: Date.now() - startedAt, inputs: cropInputs, output: url }],
      });
    } catch (error) {
      if (runTokenRef.current !== runToken) return;
      const message = error instanceof Error ? error.message : "Crop node failed";
      setRunError(message);
      toast({ description: message });
      addHistoryEntry({
        scope: "single",
        status: "failed",
        durationMs: Date.now() - startedAt,
        nodeDetails: [{ nodeId: id, label: "Crop Image", status: "failed", durationMs: Date.now() - startedAt, inputs: cropInputs, error: message }],
      });
    } finally {
      if (runTokenRef.current === runToken) setLocalRunning(false);
    }
  }, [addHistoryEntry, connectedHeight, connectedInput, connectedWidth, connectedX, connectedY, data, effectiveCropValue, id, isRunning, setNodeHandleValue]);

  const cancelCropRun = useCallback(() => {
    runTokenRef.current += 1;
    setLocalRunning(false);
    setRunError("Run canceled");
    toast({ description: "Run canceled" });
  }, []);

  return (
    <LiveNodeShell running={isRunning}>
      <LiveNodeHeader
        title="Crop Image"
        tooltip="Crop an image by percentage coordinates."
        menuOpen={menuOpen}
        menuButtonRef={menuButtonRef}
        onMenuOpen={() => setMenuOpen((open) => !open)}
        onRun={runCrop}
        running={isRunning}
        pending={isPending}
        runState={localRunning ? "running" : runningNodeIds.has(id) ? "workflow-running" : isPending ? "pending" : "idle"}
        onCancel={cancelCropRun}
      />
      <NodeMenu open={menuOpen} anchorRef={menuButtonRef} onClose={() => setMenuOpen(false)} />
      <div className="px-4 py-4">
        <div className="space-y-4">
          <CropImageUpload nodeId={id} id="input-image" label="Input Image" required />
          <CropImageNumber nodeId={id} id="x-position" label="X Position (%)" defaultValue={String(data?.x ?? "0")} />
          <CropImageNumber nodeId={id} id="y-position" label="Y Position (%)" defaultValue={String(data?.y ?? "0")} />
          <CropImageNumber nodeId={id} id="width" label="Width (%)" defaultValue={String(data?.width ?? "100")} />
          <CropImageNumber nodeId={id} id="height" label="Height (%)" defaultValue={String(data?.height ?? "100")} />
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
            <div className="min-h-10 rounded border border-gray-200 bg-white p-2">
              {isRunning ? (
                <div className="flex h-8 items-center justify-center text-xs text-gray-400">Cropping image…</div>
              ) : runError ? (
                <div className="whitespace-pre-wrap text-xs leading-5 text-red-500">{runError}</div>
              ) : outputImage ? (
                <img src={outputImage} alt="Cropped output" className="max-h-40 w-full rounded object-contain" />
              ) : (
                <div className="flex h-8 items-center justify-center text-xs text-gray-400">No output yet</div>
              )}
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

export function CropImageUpload({ nodeId, id, label, required }: { nodeId: string; id: string; label: string; required?: boolean }) {
  const [uploadPopoverOpen, setUploadPopoverOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const uploadButtonRef = useRef<HTMLButtonElement | null>(null);
  const connected = useConnectedInputValue(nodeId, id);
  const isConnected = connected.isConnected;
  const { setNodeHandleValue } = useNodeValueContext();

  useEffect(() => {
    setNodeHandleValue(nodeId, id, uploadedUrl);
  }, [id, nodeId, setNodeHandleValue, uploadedUrl]);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImageWithTransloadit(file);
      setUploadedUrl(url);
      setUploadPopoverOpen(false);
    } catch (error) {
      toast({ description: error instanceof Error ? error.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  }, []);

  const displayValue = isConnected ? displayConnectedValue(connected.value) : uploadedUrl;

  return (
    <div className="relative">
      <FieldHandle id={id} color="#3b82f6" top={12} />
      <div className="flex items-start gap-3">
        <div className="flex h-6 min-w-[96px] shrink-0 items-center text-xs font-normal leading-4 text-gray-500">
          {label}{required && <span className="text-red-400">*</span>}
        </div>
        <div className="min-w-0 flex-1">
          {displayValue && isImageUrl(displayValue) && (
            <div className="mb-2">
              <img src={displayValue} alt="Input preview" className="h-20 w-full rounded-lg border border-gray-200 object-cover" />
            </div>
          )}
          <HoverTooltip text="Upload image" side="top" triggerClassName="block">
            <button
              ref={uploadButtonRef}
              type="button"
              tabIndex={-1}
              aria-label="Upload image"
              disabled={isConnected || uploading}
              onClick={() => setUploadPopoverOpen((open) => !open)}
              title={isConnected ? "Connected input — disconnect to enter manually" : "Upload image"}
              className={`nodrag flex h-[38px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2.5 text-xs font-normal leading-4 text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700 disabled:pointer-events-none disabled:bg-gray-100 disabled:text-gray-400 ${connectedManualInputClass(isConnected)}`}
            >
              {uploading ? (
                <Loader2 size={14} strokeWidth={2} className="h-3.5 w-3.5 animate-spin text-gray-600" />
              ) : (
                <IconUpload size={14} stroke={2} className="h-3.5 w-3.5" />
              )}
              <span className="max-w-[180px] truncate">{uploading ? "Uploading to Transloadit…" : displayValue || "Upload Image"}</span>
            </button>
          </HoverTooltip>
        </div>
        <AddToRequestButton className="mt-1.5" />
      </div>
      {!isConnected && !uploading && (
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
    </div>
  );
}

export function CropImageNumber({ nodeId, id, label, defaultValue }: { nodeId: string; id: string; label: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const connected = useConnectedInputValue(nodeId, id);
  const isConnected = connected.isConnected;
  const displayValue = isConnected ? displayConnectedValue(connected.value) : value;
  const { setNodeHandleValue } = useNodeValueContext();

  useEffect(() => {
    setNodeHandleValue(nodeId, id, Number(value));
  }, [id, nodeId, setNodeHandleValue, value]);

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
            value={displayValue}
            onChange={(event) => update(event.target.value)}
            disabled={isConnected}
            title={isConnected ? "Connected input — disconnect to enter manually" : undefined}
            className="nodrag h-2 min-w-[60px] flex-1 appearance-none rounded-lg bg-gray-200 accent-workflow-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <input
            min="0"
            max="100"
            type="number"
            value={displayValue}
            onChange={(event) => update(event.target.value)}
            disabled={isConnected}
            title={isConnected ? "Connected input — disconnect to enter manually" : undefined}
            className="nodrag w-[56px] shrink-0 rounded-lg border border-gray-200 bg-[#F5F5F5] px-1 py-1 text-center text-xs leading-4 text-gray-900 outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:opacity-60"
          />
          <HoverTooltip text="Reset" side="top" triggerClassName="inline-flex shrink-0">
            <button
              type="button"
              aria-label="Reset"
              onClick={reset}
              disabled={isConnected}
              className="nodrag flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-[#F5F5F5] text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
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

