"use client";

import React, { useState } from "react";
import { type Edge } from "@xyflow/react";
import { ChevronDown } from "lucide-react";
import { displayConnectedValue, formatDuration } from "../_lib/utils";
import type { HistoryNodeDetail } from "../_lib/types";
export function historyValueEntries(value: unknown): Array<{ key: string; value: unknown }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [{ key: "value", value }];
  return Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined && item !== null && item !== "").map(([key, item]) => ({ key, value: item }));
}

export function prettyHistoryKey(key: string) {
  return key
    .replace(/Urls$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isLikelyHistoryImage(key: string, value: unknown) {
  if (typeof value !== "string") return false;
  return value.startsWith("data:image/") || /^https?:\/\//i.test(value) || key.toLowerCase().includes("image") || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(value);
}

export function HistoryValueView({ value, title }: { value: unknown; title?: string }) {
  const entries = historyValueEntries(value);

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const values = Array.isArray(entry.value) ? entry.value : [entry.value];
        return (
          <div key={entry.key} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
            {title || entry.key !== "value" ? <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{title ?? prettyHistoryKey(entry.key)}</div> : null}
            <div className="space-y-2">
              {values.length === 0 ? <div className="text-[11px] text-gray-400">No value captured.</div> : null}
              {values.map((item, index) => {
                if (isLikelyHistoryImage(entry.key, item)) {
                  return (
                    <div key={`${entry.key}-${index}`} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                      <img src={String(item)} alt={prettyHistoryKey(entry.key)} className="max-h-44 w-full object-contain" />
                    </div>
                  );
                }
                if (typeof item === "string" && /^https?:\/\//i.test(item)) {
                  return <div key={`${entry.key}-${index}`} className="rounded-md bg-white px-2 py-1.5 text-[11px] text-gray-500">Uploaded file captured</div>;
                }
                const text = typeof item === "string" ? item : displayConnectedValue(item);
                return <div key={`${entry.key}-${index}`} className="whitespace-pre-wrap break-words rounded-md bg-white px-2 py-1.5 text-[12px] leading-5 text-gray-700">{text || "No value captured."}</div>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ExecutionDependencyTree({
  details,
  graphEdges,
  selectedNodeId,
  onSelectNode,
}: {
  details: HistoryNodeDetail[];
  graphEdges: Edge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}) {
  const detailById = new globalThis.Map(details.map((detail) => [detail.nodeId, detail]));
  const detailOrder = new globalThis.Map(details.map((detail, index) => [detail.nodeId, index]));
  const includedIds = new Set(details.map((detail) => detail.nodeId));
  const parentMap = new globalThis.Map<string, string[]>();
  const childMap = new globalThis.Map<string, string[]>();

  for (const edge of graphEdges) {
    if (!includedIds.has(edge.source) || !includedIds.has(edge.target)) continue;
    parentMap.set(edge.target, [...(parentMap.get(edge.target) ?? []), edge.source]);
    childMap.set(edge.source, [...(childMap.get(edge.source) ?? []), edge.target]);
  }

  const depthMemo = new globalThis.Map<string, number>();
  const depthOf = (nodeId: string, visiting = new Set<string>()): number => {
    const cached = depthMemo.get(nodeId);
    if (cached !== undefined) return cached;
    if (visiting.has(nodeId)) return 0;
    visiting.add(nodeId);
    const parents = parentMap.get(nodeId) ?? [];
    const depth = parents.length === 0 ? 0 : Math.max(...parents.map((parentId) => depthOf(parentId, new Set(visiting)))) + 1;
    depthMemo.set(nodeId, depth);
    return depth;
  };

  const layers = details.reduce<Array<{ index: number; items: HistoryNodeDetail[] }>>((acc, detail) => {
    const index = depthOf(detail.nodeId);
    let layer = acc.find((item) => item.index === index);
    if (!layer) {
      layer = { index, items: [] };
      acc.push(layer);
    }
    layer.items.push(detail);
    return acc;
  }, []).sort((a, b) => a.index - b.index).map((layer) => ({
    ...layer,
    items: layer.items.sort((a, b) => (detailOrder.get(a.nodeId) ?? 0) - (detailOrder.get(b.nodeId) ?? 0)),
  }));

  const signature = details.map((detail) => detail.nodeId).join("|");
  const defaultExpandedLayers = new Set<number>();
  const [expandedState, setExpandedState] = useState<{ signature: string; layers: Set<number> }>(() => ({ signature, layers: defaultExpandedLayers }));
  const expandedLayers = expandedState.signature === signature ? expandedState.layers : defaultExpandedLayers;

  const toggleLayer = (index: number) => {
    setExpandedState((current) => {
      const base = current.signature === signature ? current.layers : defaultExpandedLayers;
      const next = new Set(base);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { signature, layers: next };
    });
  };

  const layerKind = (layer: { index: number; items: HistoryNodeDetail[] }, arrayIndex: number) => {
    const hasMerge = layer.items.some((detail) => (parentMap.get(detail.nodeId) ?? []).length > 1);
    if (arrayIndex === 0) return "Inputs";
    if (arrayIndex === layers.length - 1) return "Output";
    if (hasMerge) return "Merge point";
    if (layer.items.length > 1) return "Parallel fan-out";
    return "Sequential step";
  };

  const statusDotClass = (status: HistoryNodeDetail["status"]) => status === "success" ? "bg-emerald-500" : "bg-red-500";

  const formatLayerDuration = (items: HistoryNodeDetail[]) => {
    if (items.length === 0) return "0ms";
    const elapsed = Math.max(...items.map((item) => item.durationMs));
    return items.length > 1 ? `≈ ${formatDuration(elapsed)}` : formatDuration(elapsed);
  };

  const totalNodes = layers.reduce((count, layer) => count + layer.items.length, 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-gray-900">Execution layers</div>
          <div className="mt-1 text-[11px] leading-4 text-gray-500">Topological run order. Nodes in the same layer are eligible to run together.</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-600">DAG</span>
          <span className="text-[10px] text-gray-400">{layers.length} layers · {totalNodes} nodes</span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {layers.map((layer, arrayIndex) => {
          const expanded = expandedLayers.has(layer.index);
          const kind = layerKind(layer, arrayIndex);
          const isParallel = layer.items.length > 1;
          return (
            <div key={layer.index} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <button
                type="button"
                onClick={() => toggleLayer(layer.index)}
                className="flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left transition hover:bg-gray-50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-[11px] font-semibold text-white shadow-sm">
                  {arrayIndex + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-900">Layer {arrayIndex + 1}</span>
                    {isParallel ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">parallel</span> : null}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-gray-500">{kind} · {layer.items.length} node{layer.items.length === 1 ? "" : "s"}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-medium tabular-nums text-gray-500">{formatLayerDuration(layer.items)}</span>
                  <ChevronDown size={14} strokeWidth={2} className={`h-3.5 w-3.5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </div>
              </button>

              {expanded ? (
                <div className="border-t border-gray-100 bg-gray-50/70 px-3 py-2">
                  <div className="space-y-2">
                    {layer.items.map((detail) => {
                      const parents = (parentMap.get(detail.nodeId) ?? [])
                        .map((parentId) => detailById.get(parentId))
                        .filter((parent): parent is HistoryNodeDetail => Boolean(parent));
                      const children = (childMap.get(detail.nodeId) ?? [])
                        .map((childId) => detailById.get(childId))
                        .filter((child): child is HistoryNodeDetail => Boolean(child));
                      const selected = detail.nodeId === selectedNodeId;
                      return (
                        <button
                          type="button"
                          key={detail.nodeId}
                          onClick={() => onSelectNode(detail.nodeId)}
                          className={`relative w-full cursor-pointer rounded-lg border bg-white p-3 text-left text-xs shadow-sm transition ${selected ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(detail.status)} inline-block`} />
                              <span className="truncate font-medium text-gray-900">{detail.label}</span>
                            </div>
                            <span className="shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium tabular-nums text-gray-500">{formatDuration(detail.durationMs)}</span>
                          </div>
                          {(parents.length > 0 || children.length > 0) ? (
                            <div className="mt-2 flex flex-wrap gap-1.5 pl-4">
                              {parents.length > 0 ? (
                                <span className="rounded-md border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                                  waits for {parents.length === 1 ? parents[0].label : `${parents.length} inputs`}
                                </span>
                              ) : null}
                              {children.length > 0 ? (
                                <span className="rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
                                  feeds {children.length === 1 ? children[0].label : `${children.length} nodes`}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                          {detail.error ? <div className="mt-2 line-clamp-2 rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-600">{detail.error}</div> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

