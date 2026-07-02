"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, X } from "lucide-react";
import { IconUpload } from "@tabler/icons-react";
import { toast } from "@/lib/toast";
import { displayConnectedValue, valueToStringArray } from "../_lib/utils";
import { useConnectedInputValue, useConnectedInputValues, useNodeValueContext } from "../_lib/contexts";
import { AddToRequestButton, FieldHandle } from "./edges";
import { HoverTooltip, InfoTooltip } from "./tooltips";
import { MediaLibraryModal } from "./media-library";
import { UploadPopover } from "./upload-popover";
import { connectedManualInputClass } from "./crop-node";
import { readFileAsDataUrl, uploadImageWithTransloadit } from "./request-fields";
export function GeminiTextarea({
  nodeId,
  id,
  label,
  required,
  placeholder,
  value,
  onChange,
}: {
  nodeId: string;
  id: string;
  label: string;
  required?: boolean;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const connected = useConnectedInputValue(nodeId, id);
  const displayValue = connected.isConnected ? displayConnectedValue(connected.value) : value;
  const { setNodeHandleValue } = useNodeValueContext();

  useEffect(() => {
    setNodeHandleValue(nodeId, id, value);
  }, [id, nodeId, setNodeHandleValue, value]);

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
          value={displayValue}
          onChange={(event) => onChange(event.target.value)}
          disabled={connected.isConnected}
          title={connected.isConnected ? "Connected input — disconnect to enter manually" : undefined}
          className={`nodrag nopan nowheel h-[86px] w-full resize-y rounded-lg border border-gray-200 bg-[#F5F5F5] p-3 text-sm leading-5 text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-300 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 disabled:opacity-70 ${connectedManualInputClass(connected.isConnected)}`}
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

export function GeminiUpload({
  nodeId,
  id,
  label,
  buttonText,
  showRequirements,
  handleColor,
}: {
  nodeId: string;
  id: string;
  label: string;
  buttonText: string;
  showRequirements?: boolean;
  handleColor?: string;
}) {
  const [uploadPopoverOpen, setUploadPopoverOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string; file: File }[]>([]);
  const [uploading, setUploading] = useState(false);
  const uploadButtonRef = useRef<HTMLButtonElement | null>(null);
  const connected = useConnectedInputValue(nodeId, id);
  const connectedValues = useConnectedInputValues(nodeId, id);
  const isConnected = connected.isConnected;
  const { setNodeHandleValue } = useNodeValueContext();

  useEffect(() => {
    setNodeHandleValue(nodeId, id, uploadedFiles.map((file) => file.url));
  }, [id, nodeId, setNodeHandleValue, uploadedFiles]);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const url = id === "image" ? await uploadImageWithTransloadit(file) : await readFileAsDataUrl(file);
      setUploadedFiles((prev) => [...prev, { name: file.name, url, file }]);
    } catch (error) {
      toast({ description: error instanceof Error ? error.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  }, [id]);

  const removeFile = useCallback((index: number) => {
    setUploadedFiles((prev) => {
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
          {id === "image" && connectedValues.isConnected && connectedValues.values.flatMap(valueToStringArray).length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {connectedValues.values.flatMap(valueToStringArray).map((url, i) => (
                <div key={`${url}-${i}`} className="group relative">
                  <img src={url} alt={`Connected image ${i + 1}`} className="h-16 w-16 rounded-lg border border-gray-200 object-cover" />
                </div>
              ))}
            </div>
          )}
          {uploadedFiles.length > 0 && !isConnected && (
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
              disabled={isConnected || uploading}
              title={isConnected ? "Connected input — disconnect to enter manually" : undefined}
              data-state={uploadPopoverOpen ? "open" : "closed"}
              className={`nodrag flex h-[38px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2.5 text-xs font-normal leading-4 text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700 disabled:pointer-events-none disabled:bg-gray-100 disabled:text-gray-400 ${connectedManualInputClass(isConnected)}`}
            >
              {uploading ? (
                <Loader2 size={14} strokeWidth={2} className="h-3.5 w-3.5 animate-spin text-gray-600" />
              ) : (
                <IconUpload size={14} stroke={2} className="h-3.5 w-3.5" />
              )}
              <span className="max-w-[180px] truncate capitalize">{uploading ? "Uploading to Transloadit…" : isConnected ? `${connectedValues.values.flatMap(valueToStringArray).length || 1} connected ${id === "image" ? "image" : "input"}${(connectedValues.values.flatMap(valueToStringArray).length || 1) === 1 ? "" : "s"}` : buttonText}</span>
            </button>
          </HoverTooltip>
          {!isConnected && !uploading && <UploadPopover
            open={uploadPopoverOpen}
            anchorRef={uploadButtonRef}
            onClose={() => setUploadPopoverOpen(false)}
            onSelectAsset={() => setAssetModalOpen(true)}
            onUpload={handleUpload}
          />}
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

