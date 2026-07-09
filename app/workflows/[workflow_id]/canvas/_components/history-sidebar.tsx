"use client";

import React, { useState } from "react";
import { useEdges } from "@xyflow/react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { useWorkflowRunContext } from "../_lib/contexts";
import { formatDuration } from "../_lib/utils";
import type { HistoryNodeDetail, HistoryRunEntry } from "../_lib/types";
import { ExecutionDependencyTree, HistoryValueView } from "./history-values";
export function WorkflowHistorySidebar() {
  const { historyEntries, historyOpen, setHistoryOpen } = useWorkflowRunContext();
  const graphEdges = useEdges();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedRun = historyEntries.find((entry) => entry.id === expandedId) ?? null;
  const selectedNode = selectedRun?.nodeDetails.find((detail) => detail.nodeId === selectedNodeId) ?? selectedRun?.nodeDetails[0] ?? null;
  const requestDetail = selectedRun?.nodeDetails.find((detail) => detail.nodeId === "request-inputs") ?? null;
  const responseDetail = selectedRun?.nodeDetails.find((detail) => detail.nodeId === "response") ?? null;

  const magicaStatus = (status: HistoryRunEntry["status"]) => {
    if (status === "success") return "Completed";
    if (status === "failed") return "Failed";
    if (status === "running") return "Running";
    return "Partial";
  };

  const statusDotClass = (status: HistoryRunEntry["status"] | HistoryNodeDetail["status"]) => {
    if (status === "success") return "bg-emerald-500";
    if (status === "failed") return "bg-red-500";
    if (status === "running") return "bg-blue-500 animate-pulse";
    return "bg-amber-500";
  };

  const openRun = (entry: HistoryRunEntry) => {
    const nextId = expandedId === entry.id ? null : entry.id;
    setExpandedId(nextId);
    setSelectedNodeId(nextId ? entry.nodeDetails[0]?.nodeId ?? null : null);
  };

  return (
    <div
      className={`absolute right-0 top-0 z-[80] h-full min-h-0 w-[360px] border-l border-gray-200 bg-gray-50 shadow-2xl transition-transform duration-300 ease-out ${historyOpen ? "translate-x-0" : "translate-x-full"}`}
      style={{ pointerEvents: historyOpen ? "auto" : "none" }}
      aria-hidden={!historyOpen}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-gray-900">Execution History</div>
            <button type="button" onClick={() => setHistoryOpen(false)} className="inline-flex h-8 cursor-pointer items-center justify-center rounded-[18px] px-3 text-xs font-medium transition-colors hover:bg-gray-100 hover:text-gray-900">
              Close
            </button>
          </div>
          <div className="mt-3 flex rounded-lg border border-gray-200 bg-gray-100 p-0.5">
            <button type="button" className="flex-1 cursor-pointer rounded-md bg-white px-3 py-1.5 text-[11px] font-medium text-gray-900 shadow-sm">
              UI Runs
            </button>
            <button type="button" className="flex-1 cursor-pointer rounded-md px-3 py-1.5 text-[11px] font-medium text-gray-500 transition-colors hover:text-gray-700">
              API Runs
            </button>
          </div>
        </div>

        <div className="site-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          {selectedRun ? (
            <div className="space-y-4">
              <button type="button" onClick={() => setExpandedId(null)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100">
                <ChevronLeft size={14} strokeWidth={2} className="h-3.5 w-3.5" />
                Back to history
              </button>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-xs font-semibold text-gray-900">Run summary</div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-500">
                  <div>
                    Status: <span className="font-medium text-gray-900">{magicaStatus(selectedRun.status)}</span>
                  </div>
                  <div className="text-right">
                    Mode: <span className="capitalize text-gray-900">{selectedRun.scope}</span>
                  </div>
                  <div>
                    Started: <span className="text-gray-900">{new Date(selectedRun.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="text-right">
                    Duration: <span className="text-gray-900">{formatDuration(selectedRun.durationMs)}</span>
                  </div>
                </div>
              </div>

              <ExecutionDependencyTree
                details={selectedRun.nodeDetails}
                graphEdges={graphEdges}
                selectedNodeId={selectedNode?.nodeId ?? null}
                onSelectNode={setSelectedNodeId}
              />

              {selectedNode?.nodeId === "response" && requestDetail ? (
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-gray-900">Request-Inputs</div>
                      <div className="mt-0.5 text-[11px] text-gray-400">Workflow request parameters</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">{formatDuration(requestDetail.durationMs)}</span>
                      <span className={`h-2 w-2 rounded-full ${statusDotClass(requestDetail.status)} inline-block`} />
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
                    <div className="text-xs font-semibold text-gray-900">Resolved request values</div>
                    <div className="mt-1 text-[11px] leading-4 text-gray-400">
                      Values supplied at workflow start. Downstream nodes read these same values from the Request-Inputs field handles.
                    </div>
                    <div className="mt-2 max-h-72 overflow-auto">
                      <HistoryValueView value={requestDetail.output ?? requestDetail.inputs ?? "No request values captured."} />
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedNode?.nodeId === "response" && responseDetail ? (
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-gray-900">Response</div>
                      <div className="mt-0.5 text-[11px] text-gray-400">Final captured result</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">{formatDuration(responseDetail.durationMs)}</span>
                      <span className={`h-2 w-2 rounded-full ${statusDotClass(responseDetail.status)} inline-block`} />
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
                    <div className="text-xs font-semibold text-gray-900">Final response</div>
                    <div className="mt-1 text-[11px] leading-4 text-gray-400">Values captured by the Response node for display/export.</div>
                    <div className="mt-2 max-h-72 overflow-auto">
                      <HistoryValueView value={responseDetail.output || responseDetail.inputs || "No response captured."} />
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedNode && selectedNode.nodeId !== "response" ? (
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-gray-900">{selectedNode.label}</div>
                      <div className="mt-0.5 text-[11px] text-gray-400">{selectedNode.nodeId === "request-inputs" ? "Workflow request parameters" : selectedNode.nodeId === "response" ? "Final captured result" : "Node-level execution details"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">{formatDuration(selectedNode.durationMs)}</span>
                      <span className={`h-2 w-2 rounded-full ${statusDotClass(selectedNode.status)} inline-block`} />
                    </div>
                  </div>
                  {selectedNode.error ? (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                      <div className="text-sm font-medium text-red-700">Error</div>
                      <div className="mt-2 rounded bg-red-100/50 p-2 text-[12px] leading-5 text-red-600">{selectedNode.error}</div>
                    </div>
                  ) : null}
                  {selectedNode.nodeId === "request-inputs" ? (
                    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
                      <div className="text-xs font-semibold text-gray-900">Resolved request values</div>
                      <div className="mt-1 text-[11px] leading-4 text-gray-400">
                        Values supplied at workflow start. Downstream nodes read these same values from the Request-Inputs field handles.
                      </div>
                      <div className="mt-2 max-h-72 overflow-auto">
                        <HistoryValueView value={selectedNode.output ?? selectedNode.inputs ?? "No request values captured."} />
                      </div>
                    </div>
                  ) : selectedNode.nodeId === "response" ? (
                    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
                      <div className="text-xs font-semibold text-gray-900">Final response</div>
                      <div className="mt-1 text-[11px] leading-4 text-gray-400">Values captured by the Response node for display/export.</div>
                      <div className="mt-2 max-h-72 overflow-auto">
                        <HistoryValueView value={selectedNode.output || selectedNode.inputs || (selectedNode.error ? "No output." : "No output yet.")} />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-3">
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="text-xs font-semibold text-gray-900">Inputs used</div>
                        <div className="mt-2 max-h-72 overflow-auto">
                          <HistoryValueView value={selectedNode.inputs ?? "No inputs captured."} />
                        </div>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="text-xs font-semibold text-gray-900">Output</div>
                        <div className="mt-1 text-[11px] leading-4 text-gray-400">The value returned by this executable node.</div>
                        <div className="mt-2 max-h-72 overflow-auto">
                          <HistoryValueView value={selectedNode.output || (selectedNode.error ? "No output." : "No output yet.")} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium text-gray-600">Run history</div>
                <button type="button" className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 transition-colors hover:bg-gray-50">
                  All
                  <ChevronDown size={14} strokeWidth={2} className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {historyEntries.length === 0 ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-xs text-gray-500">No runs for this filter yet.</div>
                ) : (
                  historyEntries.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => openRun(entry)}
                      className="w-full cursor-pointer rounded-xl border border-gray-200 bg-white px-3 py-3 text-left transition hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${statusDotClass(entry.status)} inline-block`} />
                          <span className="text-sm text-gray-900">{magicaStatus(entry.status)}</span>
                        </div>
                        <span className="text-xs text-gray-400">{new Date(entry.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
                        <span>Scope: <span className="capitalize text-gray-700">{entry.scope}</span></span>
                        <span>Duration: <span className="tabular-nums text-gray-700">{formatDuration(entry.durationMs)}</span></span>
                        <span>Credits: <span className="tabular-nums text-gray-700">0M</span></span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

