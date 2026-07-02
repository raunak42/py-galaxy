"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { RotateCcw, MoreHorizontal, Info, Coins, ChevronDown } from "lucide-react";
import { toast } from "@/lib/toast";
import { displayConnectedValue, valueToStringArray } from "../_lib/utils";
import { useConnectedInputValue, useConnectedInputValues, useNodeValueContext, useWorkflowEditContext, useWorkflowRunContext } from "../_lib/contexts";
import { GeminiTextarea, GeminiUpload } from "./gemini-inputs";
import { GeminiSettings } from "./gemini-settings";
import { MagicaNodeRunButton, NodeMenu } from "./menus";
import { HoverTooltip, InfoTooltip } from "./tooltips";
export function GeminiPreviewNode({ id: nodeId, data }: { id: string; data?: Record<string, unknown> }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [prompt, setPromptState] = useState(String(data?.prompt ?? ""));
  const [systemPrompt, setSystemPromptState] = useState(String(data?.systemPrompt ?? ""));
  const setPrompt = useCallback((value: string) => {
    recordSnapshot();
    setPromptState(value);
  }, [recordSnapshot]);
  const setSystemPrompt = useCallback((value: string) => {
    recordSnapshot();
    setSystemPromptState(value);
  }, [recordSnapshot]);
  const [response, setResponse] = useState("");
  const [runError, setRunError] = useState("");
  const [running, setRunning] = useState(false);
  const runTokenRef = useRef(0);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const { values, setNodeHandleValue } = useNodeValueContext();
  const { runningNodeIds, pendingNodeIds, addHistoryEntry } = useWorkflowRunContext();
  const { recordSnapshot } = useWorkflowEditContext();
  const connectedPrompt = useConnectedInputValue(nodeId, "prompt");
  const connectedSystemPrompt = useConnectedInputValue(nodeId, "system-prompt");
  const connectedImage = useConnectedInputValues(nodeId, "image");
  const connectedVideo = useConnectedInputValues(nodeId, "video");
  const connectedAudio = useConnectedInputValues(nodeId, "audio");
  const connectedFile = useConnectedInputValues(nodeId, "file");
  const effectivePrompt = connectedPrompt.isConnected ? displayConnectedValue(connectedPrompt.value) : prompt;
  const effectiveSystemPrompt = connectedSystemPrompt.isConnected ? displayConnectedValue(connectedSystemPrompt.value) : systemPrompt;
  const displayedResponse = response || displayConnectedValue(values[nodeId]?.response);
  const isNodeRunning = running || runningNodeIds.has(nodeId);
  const isNodePending = !isNodeRunning && pendingNodeIds.has(nodeId);

  useEffect(() => {
    setNodeHandleValue(nodeId, "response", response);
  }, [nodeId, response, setNodeHandleValue]);

  const runGemini = useCallback(async () => {
    if (!effectivePrompt.trim()) {
      setRunError("Prompt is required");
      return;
    }
    const startedAt = Date.now();
    const runToken = runTokenRef.current + 1;
    runTokenRef.current = runToken;
    setRunning(true);
    setRunError("");
    setResponse("");
    const geminiInputs = {
      prompt: effectivePrompt,
      systemPrompt: effectiveSystemPrompt.trim() || undefined,
      imageUrls: connectedImage.isConnected ? connectedImage.values.flatMap(valueToStringArray) : valueToStringArray(values[nodeId]?.image),
      videoUrls: connectedVideo.isConnected ? connectedVideo.values.flatMap(valueToStringArray) : valueToStringArray(values[nodeId]?.video),
      audioUrls: connectedAudio.isConnected ? connectedAudio.values.flatMap(valueToStringArray) : valueToStringArray(values[nodeId]?.audio),
      fileUrls: connectedFile.isConnected ? connectedFile.values.flatMap(valueToStringArray) : valueToStringArray(values[nodeId]?.file),
      model: "gemini-3.1-pro",
    };
    try {
      const res = await fetch("/api/tasks/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiInputs),
      });
      const json = await res.json() as { output?: { response?: string }; error?: string; details?: { message?: string } | unknown };
      if (!res.ok) {
        const detailMessage = typeof json.details === "object" && json.details && "message" in json.details && typeof json.details.message === "string" ? json.details.message : undefined;
        throw new Error(detailMessage ?? json.error ?? "Gemini run failed");
      }
      if (runTokenRef.current !== runToken) return;
      const output = json.output?.response ?? "";
      setResponse(output);
      addHistoryEntry({
        scope: "single",
        status: "success",
        durationMs: Date.now() - startedAt,
        nodeDetails: [{ nodeId, label: "Gemini 3.1 Pro", status: "success", durationMs: Date.now() - startedAt, inputs: geminiInputs, output }],
      });
    } catch (error) {
      if (runTokenRef.current !== runToken) return;
      const message = error instanceof Error ? error.message : "Gemini run failed";
      setRunError(message);
      toast({ description: message });
      addHistoryEntry({
        scope: "single",
        status: "failed",
        durationMs: Date.now() - startedAt,
        nodeDetails: [{ nodeId, label: "Gemini 3.1 Pro", status: "failed", durationMs: Date.now() - startedAt, inputs: geminiInputs, error: message }],
      });
    } finally {
      if (runTokenRef.current === runToken) setRunning(false);
    }
  }, [addHistoryEntry, connectedAudio.isConnected, connectedAudio.values, connectedFile.isConnected, connectedFile.values, connectedImage.isConnected, connectedImage.values, connectedVideo.isConnected, connectedVideo.values, effectivePrompt, effectiveSystemPrompt, nodeId, values]);

  const cancelGeminiRun = useCallback(() => {
    runTokenRef.current += 1;
    setRunning(false);
    setRunError("Run canceled");
    toast({ description: "Run canceled" });
  }, []);

  return (
    <div className={`py-node-shell w-[380px] max-w-[380px] overflow-visible rounded-xl border border-gray-200 bg-white text-[#1b1b18] shadow-2xl transition-all duration-300 ${isNodeRunning ? "node-running" : ""}`}>
      <div className="flex h-[59px] items-start justify-between border-b border-gray-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="w-full min-w-0 cursor-grab select-none truncate text-sm font-medium leading-5 text-gray-900">
            Gemini 3.1 Pro
          </div>
        </div>
        <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
          <InfoTooltip
            text="Generate text using Gemini 3.1 Pro (Google) via OpenRouter"
            size={14}
            className=""
          />
          <button className="nodrag rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40">
            <RotateCcw size={14} strokeWidth={2} className="h-3.5 w-3.5" />
          </button>
          <MagicaNodeRunButton state={running ? "running" : runningNodeIds.has(nodeId) ? "workflow-running" : isNodePending ? "pending" : "idle"} onRun={runGemini} onCancel={cancelGeminiRun} />
          <button
            ref={menuButtonRef}
            type="button"
            id="node-menu-trigger"
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            data-state={menuOpen ? "open" : "closed"}
            onClick={() => setMenuOpen((open) => !open)}
            className="nodrag inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
          >
            <MoreHorizontal size={16} strokeWidth={2} className="h-4 w-4" />
          </button>
          <NodeMenu open={menuOpen} anchorRef={menuButtonRef} onClose={() => setMenuOpen(false)} />
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="space-y-4">
          <GeminiTextarea nodeId={nodeId} id="prompt" label="Prompt" required placeholder="Enter your prompt..." value={prompt} onChange={setPrompt} />
          <GeminiTextarea nodeId={nodeId} id="system-prompt" label="System Prompt" placeholder="You are a helpful assistant..." value={systemPrompt} onChange={setSystemPrompt} />
          <GeminiUpload nodeId={nodeId} id="image" label="Image (Vision)" buttonText="Upload Image" showRequirements handleColor="#3b82f6" />
          <GeminiUpload nodeId={nodeId} id="video" label="Video" buttonText="Upload Video" handleColor="#22c55e" />
          <GeminiUpload nodeId={nodeId} id="audio" label="Audio" buttonText="Upload Audio" handleColor="#06b6d4" />
          <GeminiUpload nodeId={nodeId} id="file" label="File" buttonText="Upload File" handleColor="#a855f7" />
        </div>

        <div className="relative">
          <button onClick={() => setSettingsOpen((open) => !open)} className="nodrag group mt-5 flex cursor-pointer items-center gap-2">
            <ChevronDown size={16} strokeWidth={2} className={`h-4 w-4 text-gray-400 transition-transform ${settingsOpen ? "" : "-rotate-90"}`} />
            <span className="text-xs text-gray-400 group-hover:text-gray-600">Settings</span>
          </button>
        </div>

        {settingsOpen && <GeminiSettings nodeId={nodeId} />}

        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="relative overflow-visible">
            <div className="absolute right-[-23px] top-2 z-50 flex -translate-y-1/2 items-center">
              <Handle
                id="response"
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
                  background: "#f59e0b",
                  borderColor: "#f59e0b80",
                  boxShadow: "#f59e0b50 0px 0px 8px",
                  cursor: "crosshair",
                  ['--handle-color' as string]: "#f59e0b",
                }}
              />
            </div>
            <div className="mb-1.5 text-xs font-normal leading-4 text-gray-500">Response</div>
            <div className="min-h-[84px] max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white p-3">
              {isNodeRunning ? (
                <div className="py-6 text-center text-xs leading-4 text-gray-400">Running Gemini…</div>
              ) : runError ? (
                <div className="max-w-full whitespace-pre-wrap break-words text-xs leading-5 text-red-500 [overflow-wrap:anywhere]">{runError}</div>
              ) : displayedResponse ? (
                <div className="max-w-full whitespace-pre-wrap break-words text-sm leading-5 text-gray-900 [overflow-wrap:anywhere]">{displayedResponse}</div>
              ) : (
                <div className="py-6 text-center text-xs leading-4 text-gray-400">No output yet</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-1 text-[10px] leading-[15px] text-gray-400">
          <Coins size={12} strokeWidth={2} className="h-3 w-3" />
          <span>~0.0001 M</span>
          <HoverTooltip text="Variable credits based on actual token usage" side="top" triggerClassName="inline-flex shrink-0 cursor-help text-gray-400">
            <Info size={12} strokeWidth={2} className="h-3 w-3" />
          </HoverTooltip>
        </div>
      </div>
    </div>
  );
}

