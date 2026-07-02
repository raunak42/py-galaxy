"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useViewport } from "@xyflow/react";
import { Plus, GripVertical, Pencil, Copy, Trash2, X, Maximize2, Image, Check, AlignLeft, Hash, Music, Video, File, Loader2 } from "lucide-react";
import { IconUpload } from "@tabler/icons-react";
import { toast } from "@/lib/toast";
import { HANDLE_COLORS } from "../_lib/constants";
import { useNodeValueContext, useWorkflowEditContext } from "../_lib/contexts";
import { SourceFieldHandle } from "./edges";
import { InfoTooltip } from "./tooltips";
import { MediaLibraryModal } from "./media-library";
import { UploadPopover } from "./upload-popover";
import { FloatingPickerMenu } from "./menus";
export const FIELD_TOOLTIPS: Record<string, string> = {
  text_field: "Text input — accepts any string value",
  number_field: "Number input — accepts numeric values",
  boolean_field: "Boolean toggle — true or false",
  image_field: "Image input — accepts an image URL",
  audio_field: "Audio input — accepts an audio URL",
  video_field: "Video input — accepts a video URL",
  media_field: "Media input — accepts audio or video files",
  file_field: "File input — accepts any file upload",
};

export function fieldTypeFromLabel(label: string): string {
  if (label.startsWith("number")) return "number_field";
  if (label.startsWith("boolean") || label.startsWith("bool")) return "boolean_field";
  if (label.startsWith("image")) return "image_field";
  if (label.startsWith("audio")) return "audio_field";
  if (label.startsWith("video")) return "video_field";
  if (label.startsWith("media") || label.startsWith("avmedia")) return "media_field";
  if (label.startsWith("file")) return "file_field";
  return "text_field";
}

export function RequestFieldHeader({ label, canDelete = true, onRename, onDelete }: { label: string; canDelete?: boolean; onRename?: () => void; onDelete?: () => void }) {
  const fieldType = fieldTypeFromLabel(label);
  const tooltipText = FIELD_TOOLTIPS[fieldType] ?? FIELD_TOOLTIPS.text_field;
  return (
    <div className="mb-2 flex w-full min-w-0 items-center gap-2">
      <div className="nodrag nopan shrink-0 cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing">
        <GripVertical size={14} strokeWidth={2} className="h-3.5 w-3.5" />
      </div>
      <button type="button" onClick={onRename} className="group/label flex min-w-0 flex-1 cursor-pointer items-center gap-1 text-left text-xs font-medium leading-4 text-gray-900 hover:text-[#6366f1]">
        <span className="truncate">{label}</span>
        <Pencil size={12} strokeWidth={2} className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/label:opacity-100" />
        <InfoTooltip text={tooltipText} size={12} className="shrink-0 text-gray-400" maxWidth={200} />
      </button>
      <div className="ml-auto flex items-center gap-1">
        <button type="button" title="Copy value" className="nodrag rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <Copy size={14} strokeWidth={2} className="h-3.5 w-3.5" />
        </button>
        <button type="button" title="Delete" disabled={!canDelete} onClick={onDelete} className="nodrag rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50">
          <Trash2 size={14} strokeWidth={2} className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function handleColorForFieldType(type: string): string {
  const key = type.replace("_field", "");
  return HANDLE_COLORS[key] ?? "#f59e0b";
}

export function uploadLabelForFieldType(type: string): string | null {
  if (type === "image_field") return "Upload image";
  if (type === "audio_field") return "Upload audio";
  if (type === "video_field") return "Upload video";
  if (type === "media_field") return "Upload media";
  if (type === "file_field") return "Upload file";
  return null;
}

export function uploadAcceptForFieldType(type: string): string {
  if (type === "image_field") return "image/jpeg,image/jpg,image/png,image/webp,image/gif";
  if (type === "audio_field") return "audio/*";
  if (type === "video_field") return "video/*";
  if (type === "media_field") return "audio/*,video/*";
  if (type === "file_field") return "*/*";
  return "image/*";
}

export function RequestTextField({ nodeId, id, label, value, onRename, onDelete }: { nodeId: string; id: string; label: string; value: string; onRename?: () => void; onDelete?: () => void }) {
  const { values, setNodeHandleValue } = useNodeValueContext();
  const [textValue, setTextValue] = useState(() => {
    const stored = values[nodeId]?.[id];
    return typeof stored === "string" ? stored : value;
  });
  const { recordSnapshot } = useWorkflowEditContext();

  useEffect(() => {
    const stored = values[nodeId]?.[id];
    if (typeof stored === "string" && stored !== textValue) {
      setTextValue(stored);
    }
  }, [id, nodeId, textValue, values]);

  useEffect(() => {
    setNodeHandleValue(nodeId, id, textValue);
  }, [id, nodeId, setNodeHandleValue, textValue]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    recordSnapshot();
    setTextValue(e.target.value);
  }, [recordSnapshot]);

  return (
    <div className="relative w-full" style={{ overflow: "visible" }}>
      <div className="w-full min-w-0">
        <RequestFieldHeader label={label} onRename={onRename} onDelete={onDelete} />
        <div className="w-full min-w-0">
          <div className="relative">
            <textarea
              value={textValue}
              onChange={handleTextChange}
              rows={3}
              placeholder="Enter text..."
              className="nodrag nopan nowheel w-full min-w-0 resize-y rounded-lg border border-gray-200 bg-[#F5F5F5] px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#6366f1] disabled:opacity-50"
            />
            <button type="button" title="Expand" className="nodrag absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-md bg-gray-200/80 text-gray-500 transition-colors hover:bg-gray-300 hover:text-gray-700">
              <Maximize2 size={12} strokeWidth={2} className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
      <SourceFieldHandle id={id} color={handleColorForFieldType("text_field")} top={31} />
    </div>
  );
}

export function RequestNumberField({ nodeId, id, label, onRename, onDelete }: { nodeId: string; id: string; label: string; onRename?: () => void; onDelete?: () => void }) {
  const { values, setNodeHandleValue } = useNodeValueContext();
  const [value, setValue] = useState(() => {
    const stored = values[nodeId]?.[id];
    if (stored !== undefined && stored !== null) return String(stored);
    return "0";
  });
  const { recordSnapshot } = useWorkflowEditContext();

  useEffect(() => {
    const stored = values[nodeId]?.[id];
    const storedStr = typeof stored === "number" ? String(stored) : typeof stored === "string" ? stored : null;
    if (storedStr !== null && storedStr !== value) {
      setValue(storedStr);
    }
  }, [id, nodeId, value, values]);

  useEffect(() => {
    setNodeHandleValue(nodeId, id, Number(value));
  }, [id, nodeId, setNodeHandleValue, value]);

  const handleNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    recordSnapshot();
    setValue(e.target.value);
  }, [recordSnapshot]);

  return (
    <div className="relative w-full" style={{ overflow: "visible" }}>
      <div className="w-full min-w-0">
        <RequestFieldHeader label={label} onRename={onRename} onDelete={onDelete} />
        <div className="w-full min-w-0">
          <input
            type="number"
            step="any"
            value={value}
            onChange={handleNumberChange}
            className="nodrag w-full min-w-0 rounded-lg border border-gray-200 bg-[#F5F5F5] px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#6366f1] disabled:opacity-50"
          />
        </div>
      </div>
      <SourceFieldHandle id={id} color={handleColorForFieldType("number_field")} top={31} />
    </div>
  );
}

export function RequestBooleanField({ nodeId, id, label, onRename, onDelete }: { nodeId: string; id: string; label: string; onRename?: () => void; onDelete?: () => void }) {
  const { values, setNodeHandleValue } = useNodeValueContext();
  const [checked, setChecked] = useState(() => {
    const stored = values[nodeId]?.[id];
    return typeof stored === "boolean" ? stored : false;
  });
  const { recordSnapshot } = useWorkflowEditContext();

  useEffect(() => {
    const stored = values[nodeId]?.[id];
    if (typeof stored === "boolean" && stored !== checked) {
      setChecked(stored);
    }
  }, [id, nodeId, checked, values]);

  useEffect(() => {
    setNodeHandleValue(nodeId, id, checked);
  }, [checked, id, nodeId, setNodeHandleValue]);

  const handleBooleanChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    recordSnapshot();
    setChecked(e.target.checked);
  }, [recordSnapshot]);

  return (
    <div className="relative w-full" style={{ overflow: "visible" }}>
      <div className="w-full min-w-0">
        <RequestFieldHeader label={label} onRename={onRename} onDelete={onDelete} />
        <div className="w-full min-w-0">
          <label className="nodrag flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={checked} onChange={handleBooleanChange} className="h-4 w-4 rounded border-gray-300 text-workflow-accent-500 focus:ring-workflow-accent-500 disabled:opacity-50" />
            <span className="text-sm text-gray-700">{checked ? "True" : "False"}</span>
          </label>
        </div>
      </div>
      <SourceFieldHandle id={id} color={handleColorForFieldType("boolean_field")} top={31} />
    </div>
  );
}

export async function uploadImageWithTransloadit(file: File) {
  const formData = new FormData();
  formData.append("file", file, file.name);

  const response = await fetch("/api/transloadit/upload", {
    method: "POST",
    body: formData,
  });
  const json = await response.json() as { url?: string; error?: string };

  if (!response.ok || !json.url) {
    throw new Error(json.error ?? "Transloadit upload failed");
  }

  return json.url;
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read file"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function RequestUploadField({ nodeId, id, label, type, value = "", onRename, onDelete }: { nodeId: string; id: string; label: string; type: string; value?: string; onRename?: () => void; onDelete?: () => void }) {
  const [uploadPopoverOpen, setUploadPopoverOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const { values, setNodeHandleValue } = useNodeValueContext();
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(() => {
    const stored = values[nodeId]?.[id];
    return typeof stored === "string" && stored ? stored : (value || null);
  });
  const [uploading, setUploading] = useState(false);
  const uploadButtonRef = useRef<HTMLButtonElement | null>(null);
  const uploadLabel = uploadLabelForFieldType(type)!;
  const accept = uploadAcceptForFieldType(type);
  const { recordSnapshot } = useWorkflowEditContext();

  useEffect(() => {
    const stored = values[nodeId]?.[id];
    if (typeof stored === "string" && stored && stored !== uploadedUrl) {
      setUploadedUrl(stored);
    }
  }, [id, nodeId, uploadedUrl, values]);

  useEffect(() => {
    setNodeHandleValue(nodeId, id, uploadedUrl ?? "");
  }, [id, nodeId, setNodeHandleValue, uploadedUrl]);

  const handleUpload = useCallback(async (file: File) => {
    recordSnapshot();
    setUploading(true);
    try {
      const url = type === "image_field"
        ? await uploadImageWithTransloadit(file)
        : await readFileAsDataUrl(file);
      setUploadedUrl(url);
      setUploadPopoverOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      toast({ description: message });
    } finally {
      setUploading(false);
    }
  }, [recordSnapshot, type]);

  return (
    <div className="relative w-full" style={{ overflow: "visible" }}>
      <div className="w-full min-w-0">
        <RequestFieldHeader label={label} onRename={onRename} onDelete={onDelete} />
        <div className="w-full min-w-0">
          <div>
            <div className="min-w-0">
              <div className="relative">
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-[#F5F5F5] px-3 py-2 text-xs text-gray-500">
                    <Loader2 size={14} strokeWidth={2} className="h-3.5 w-3.5 animate-spin text-gray-600" />
                    <span>Uploading to Transloadit…</span>
                  </div>
                ) : uploadedUrl ? (
                  type === "image_field" ? (
                    <div className="relative inline-block">
                      <img src={uploadedUrl} alt="Uploaded preview" className="h-24 w-24 rounded-lg border border-gray-200 object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedUrl(null);
                        }}
                        className="nodrag absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                      >
                        <X size={12} strokeWidth={2} className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-[#F5F5F5] px-3 py-2 text-xs text-gray-500">
                      File uploaded
                    </div>
                  )
                ) : (
                  <button
                    ref={uploadButtonRef}
                    type="button"
                    tabIndex={-1}
                    title={uploadLabel}
                    onClick={() => setUploadPopoverOpen((open) => !open)}
                    disabled={uploading}
                    data-state={uploadPopoverOpen ? "open" : "closed"}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed transition-colors disabled:cursor-not-allowed disabled:opacity-50 nodrag border-gray-300 bg-white px-3 py-2.5 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700"
                  >
                    <IconUpload size={14} stroke={2} className="h-3.5 w-3.5" />
                    <span className="capitalize">{uploadLabel}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {!uploadedUrl && !uploading && (
        <UploadPopover
          open={uploadPopoverOpen}
          anchorRef={uploadButtonRef}
          onClose={() => setUploadPopoverOpen(false)}
          onSelectAsset={() => setAssetModalOpen(true)}
          onUpload={handleUpload}
          accept={accept}
        />
      )}
      <MediaLibraryModal open={assetModalOpen} onClose={() => setAssetModalOpen(false)} />
      <SourceFieldHandle id={id} color={handleColorForFieldType(type)} top={31} />
    </div>
  );
}

export const FIELD_TYPE_ITEMS = [
  { type: "text_field", label: "Text", icon: AlignLeft },
  { type: "number_field", label: "Number", icon: Hash },
  { type: "boolean_field", label: "Boolean", icon: Check },
  { type: "image_field", label: "Image", icon: Image },
  { type: "audio_field", label: "Audio", icon: Music },
  { type: "video_field", label: "Video", icon: Video },
  { type: "media_field", label: "Media", icon: Music },
  { type: "file_field", label: "File", icon: File },
];

export function FieldTypeMenu({ onSelect }: { onSelect: (type: string) => void }) {
  const { zoom } = useViewport();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => setOpen(false), []);
  const items = FIELD_TYPE_ITEMS.map((item) => ({
    key: item.type,
    label: item.label,
    icon: item.icon,
    onSelect: () => onSelect(item.type),
  }));

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        tabIndex={-1}
        aria-haspopup="menu"
        aria-expanded={open}
        data-state={open ? "open" : "closed"}
        onClick={() => setOpen((current) => !current)}
        className="nodrag flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 disabled:opacity-50"
      >
        <Plus size={24} strokeWidth={2} className="h-4 w-4" aria-hidden />
      </button>
      <FloatingPickerMenu
        open={open}
        anchorRef={btnRef}
        onClose={close}
        width={140}
        align="start"
        scale={zoom}
        contentClassName="z-50 w-[140px] min-w-[8rem] overflow-hidden rounded-[18px] border border-border/20 bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
        itemClassName="relative flex cursor-pointer select-none items-center gap-2 rounded-[18px] px-3 py-2 text-xs outline-none transition-colors hover:bg-gray-200 hover:text-gray-950 focus:bg-gray-200 focus:text-gray-950 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0"
        items={items}
      />
    </>
  );
}

