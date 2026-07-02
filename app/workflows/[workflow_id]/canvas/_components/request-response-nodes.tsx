"use client";

import React, { useCallback, useState } from "react";
import { useEdges, useReactFlow } from "@xyflow/react";
import { Pencil, Trash2, FileOutput } from "lucide-react";
import { displayConnectedValue, isImageUrl } from "../_lib/utils";
import { useNodeValueContext, useWorkflowEditContext } from "../_lib/contexts";
import { FieldHandle } from "./edges";
import { InfoTooltip } from "./tooltips";
import { FieldTypeMenu, RequestBooleanField, RequestNumberField, RequestTextField, RequestUploadField } from "./request-fields";
export function RequestInputsNode({ id: nodeId, data }: { id: string; data?: Record<string, unknown> }) {
  const initialFields = Array.isArray(data?.fields)
    ? data.fields as Array<{ type: string; id: string; label: string; value?: string }>
    : [
        { type: "text_field", id: "text_field", label: "text_field", value: "" },
        { type: "image_field", id: "image_field", label: "image_field" },
      ];
  const [fields, setFields] = useState(initialFields);
  const { setEdges } = useReactFlow();
  const { values } = useNodeValueContext();
  const { recordSnapshot } = useWorkflowEditContext();

  const renameField = useCallback((fieldId: string, currentLabel: string) => {
    const next = window.prompt("Rename field", currentLabel)?.trim();
    if (!next) return;
    recordSnapshot();
    setFields((prev) => prev.map((field) => field.id === fieldId ? { ...field, label: next } : field));
  }, [recordSnapshot]);

  const deleteField = useCallback((fieldId: string) => {
    recordSnapshot();
    setFields((prev) => prev.filter((field) => field.id !== fieldId));
    setEdges((current) => current.filter((edge) => !(edge.source === nodeId && edge.sourceHandle === fieldId)));
  }, [nodeId, recordSnapshot, setEdges]);

  const addField = useCallback((type: string) => {
    recordSnapshot();
    setFields((prev) => {
      const existing = prev.filter((f) => f.type === type);
      const id = existing.length === 0 ? type : `${type}_${existing.length + 1}`;
      return [...prev, { type, id, label: id }];
    });
  }, [recordSnapshot]);

  return (
    <div
      className="py-node-shell w-[380px] rounded-xl border border-gray-200 bg-white shadow-2xl"
      style={{
        overflow: "visible",
        minWidth: 380,
        width: 380,
        backgroundColor: "rgb(255, 255, 255)",
        color: "rgb(27, 27, 24)",
        borderColor: "rgb(229, 231, 235)",
      }}
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-900">Request-Inputs</span>
          <InfoTooltip text="Define the input fields for your workflow. These become the request parameters when running via Playground or API." size={14} className="" maxWidth={280} />
        </div>
        <div className="flex items-center gap-1.5">
          <FieldTypeMenu onSelect={addField} />
        </div>
      </div>
      <div className="relative w-full px-4 py-4" style={{ overflow: "visible", minWidth: 380 }}>
        <div className="w-full space-y-4">
          {fields.map((f) => {
            const fieldActions = {
              onRename: () => renameField(f.id, f.label),
              onDelete: () => deleteField(f.id),
            };
            if (f.type === "number_field") return <RequestNumberField key={f.id} nodeId={nodeId} id={f.id} label={f.label} {...fieldActions} />;
            if (f.type === "boolean_field") return <RequestBooleanField key={f.id} nodeId={nodeId} id={f.id} label={f.label} {...fieldActions} />;
            if (f.type === "image_field" || f.type === "audio_field" || f.type === "video_field" || f.type === "media_field" || f.type === "file_field") {
              return <RequestUploadField key={f.id} nodeId={nodeId} id={f.id} label={f.label} type={f.type} value={typeof values[nodeId]?.[f.id] === "string" ? values[nodeId]?.[f.id] as string : f.value ?? ""} {...fieldActions} />;
            }
            return <RequestTextField key={f.id} nodeId={nodeId} id={f.id} label={f.label} value={f.value ?? ""} {...fieldActions} />;
          })}
        </div>
      </div>
    </div>
  );
}

export function ResponseOutputCard({ label, value }: { label: string; value: unknown }) {
  const textValue = displayConnectedValue(value);
  const isImage = isImageUrl(textValue);

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
      <div className="min-h-10 rounded border border-gray-200 bg-white p-2">
        {textValue ? (
          isImage ? (
            <img src={textValue} alt={label} className="max-h-32 w-full rounded object-contain" />
          ) : (
            <div className="max-h-40 overflow-auto whitespace-pre-wrap text-xs leading-5 text-gray-700">{textValue}</div>
          )
        ) : (
          <div className="flex h-6 items-center justify-center text-xs leading-4 text-gray-400">No output yet</div>
        )}
      </div>
    </div>
  );
}

export function ResponseNode() {
  const edges = useEdges();
  const { values } = useNodeValueContext();
  const allEdges = edges.filter((e) => e.target === "response" && e.targetHandle === "result");
  const cards = allEdges.length > 0
    ? allEdges.map((e) => {
        const handle = e.sourceHandle ?? "result";
        return {
          key: e.id,
          label: handle,
          value: values[e.source]?.[handle] ?? values[e.source]?.response ?? values[e.source]?.outputImageUrl,
        };
      })
    : [{ key: "default", label: "final_result", value: undefined }];

  return (
    <div className="py-node-shell w-[380px] rounded-xl border border-gray-200 bg-white text-[#1b1b18] shadow-2xl transition-all duration-300">
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
            <ResponseOutputCard key={card.key} label={card.label} value={card.value} />
          ))}
        </div>
      </div>
    </div>
  );
}

