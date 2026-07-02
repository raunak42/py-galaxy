"use client";

import React, { useCallback, useEffect, useState } from "react";
import { displayConnectedValue } from "../_lib/utils";
import { useConnectedInputValue, useNodeValueContext, useWorkflowEditContext } from "../_lib/contexts";
import { AddToRequestButton, FieldHandle } from "./edges";
import { HoverTooltip, InfoTooltip, ResetSettingButton } from "./tooltips";
export function GeminiSettings({ nodeId }: { nodeId: string }) {
  return (
    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
      <GeminiSettingSlider nodeId={nodeId} label="Temperature" value="0.7" min="0" max="2" step="0.1" tooltip="Controls randomness of the generated response." />
      <GeminiSettingNumber nodeId={nodeId} label="Max Tokens" value="1024" min="1" max="8192" tooltip="Maximum number of tokens to generate." />
      <GeminiSettingBoolean nodeId={nodeId} label="Reasoning" tooltip="Enable or disable reasoning-oriented generation." />
      <GeminiSettingSlider nodeId={nodeId} label="Top P" value="1" min="0" max="1" step="0.05" tooltip="Nucleus sampling threshold." />
      <GeminiSettingSlider nodeId={nodeId} label="Top K" value="0" min="0" max="500" step="1" tooltip="Restrict sampling to the top K tokens." />
      <GeminiSettingSlider nodeId={nodeId} label="Frequency Penalty" value="0" min="-2" max="2" step="0.1" tooltip="Penalizes tokens based on frequency so far." />
      <GeminiSettingSlider nodeId={nodeId} label="Presence Penalty" value="0" min="-2" max="2" step="0.1" tooltip="Penalizes tokens already present in the text." />
      <GeminiSettingSlider nodeId={nodeId} label="Repetition Penalty" value="1" min="0" max="2" step="0.05" tooltip="Discourages repetitive token selection." />
      <GeminiSettingSlider nodeId={nodeId} label="Min P" value="0" min="0" max="1" step="0.05" tooltip="Minimum probability threshold for sampling." />
      <GeminiSettingSlider nodeId={nodeId} label="Top A" value="0" min="0" max="1" step="0.05" tooltip="Alternative sampling threshold parameter." />
      <GeminiSettingNumber nodeId={nodeId} label="Seed" value="0" min="0" step="1" tooltip="Set a fixed seed for more reproducible output." />
      <GeminiSettingTextarea nodeId={nodeId} label="Stop Sequences" placeholder="e.g. END, STOP, ###" tooltip="Generation stops when any sequence matches." />
      <GeminiSettingBoolean nodeId={nodeId} label="JSON Mode" tooltip="Force the model to respond with JSON." />
    </div>
  );
}

export function GeminiSettingLabel({
  label,
  tooltip,
}: {
  label: string;
  tooltip: string;
}) {
  return (
    <span data-handle-anchor="label" className="flex min-w-0 shrink items-center truncate text-xs text-gray-500">
      <HoverTooltip text={label} side="top" triggerClassName="min-w-0 truncate">
        <span className="truncate">{label}</span>
      </HoverTooltip>
      <InfoTooltip text={tooltip} />
    </span>
  );
}

export function GeminiSettingSlider({
  nodeId,
  label,
  value,
  min,
  max,
  step,
  tooltip,
}: {
  nodeId: string;
  label: string;
  value: string;
  min: string;
  max: string;
  step: string;
  tooltip: string;
}) {
  const handleId = `setting-${label}`;
  const { values, setNodeHandleValue } = useNodeValueContext();
  const [currentValue, setCurrentValue] = useState(() => {
    const stored = values[nodeId]?.[handleId];
    return typeof stored === "string" ? stored : value;
  });
  const connected = useConnectedInputValue(nodeId, handleId);
  const isConnected = connected.isConnected;
  const displayValue = isConnected ? displayConnectedValue(connected.value) : currentValue;
  const { recordSnapshot } = useWorkflowEditContext();

  useEffect(() => {
    const stored = values[nodeId]?.[handleId];
    if (typeof stored === "string" && stored !== currentValue) {
      setCurrentValue(stored);
    }
  }, [currentValue, handleId, nodeId, values]);

  useEffect(() => {
    setNodeHandleValue(nodeId, handleId, currentValue);
  }, [currentValue, handleId, nodeId, setNodeHandleValue]);

  const handleChange = useCallback((next: string) => {
    recordSnapshot();
    setCurrentValue(next);
  }, [recordSnapshot]);

  return (
    <div className="relative overflow-visible">
      <FieldHandle id={handleId} color="#ec4899" top={14} />
      <div className="space-y-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <GeminiSettingLabel label={label} tooltip={tooltip} />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={displayValue}
            onChange={(event) => handleChange(event.target.value)}
            disabled={isConnected}
            title={isConnected ? "Connected input — disconnect to enter manually" : undefined}
            className="nodrag h-2 min-w-[60px] flex-1 appearance-none rounded-lg bg-gray-200 accent-workflow-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <input
            type="number"
            min={min}
            max={max}
            value={displayValue}
            onChange={(event) => handleChange(event.target.value)}
            disabled={isConnected}
            title={isConnected ? "Connected input — disconnect to enter manually" : undefined}
            className="nodrag w-[56px] shrink-0 rounded-lg border border-gray-200 bg-[#F5F5F5] px-1 py-1 text-center text-xs leading-4 text-gray-900 outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:opacity-60"
          />
          <ResetSettingButton disabled={isConnected} />
          <AddToRequestButton />
        </div>
      </div>
    </div>
  );
}

export function GeminiSettingNumber({
  nodeId,
  label,
  value,
  min,
  max,
  step,
  tooltip,
}: {
  nodeId: string;
  label: string;
  value: string;
  min?: string;
  max?: string;
  step?: string;
  tooltip: string;
}) {
  const handleId = `setting-${label}`;
  const { values, setNodeHandleValue } = useNodeValueContext();
  const [currentValue, setCurrentValue] = useState(() => {
    const stored = values[nodeId]?.[handleId];
    return typeof stored === "string" ? stored : value;
  });
  const connected = useConnectedInputValue(nodeId, handleId);
  const isConnected = connected.isConnected;
  const displayValue = isConnected ? displayConnectedValue(connected.value) : currentValue;
  const { recordSnapshot } = useWorkflowEditContext();

  useEffect(() => {
    const stored = values[nodeId]?.[handleId];
    if (typeof stored === "string" && stored !== currentValue) {
      setCurrentValue(stored);
    }
  }, [currentValue, handleId, nodeId, values]);

  useEffect(() => {
    setNodeHandleValue(nodeId, handleId, currentValue);
  }, [currentValue, handleId, nodeId, setNodeHandleValue]);

  const handleChange = useCallback((next: string) => {
    recordSnapshot();
    setCurrentValue(next);
  }, [recordSnapshot]);

  return (
    <div className="relative overflow-visible">
      <FieldHandle id={handleId} color="#ec4899" top={14} />
      <div className="space-y-1.5">
        <div className="flex min-w-0 items-center gap-3">
          <GeminiSettingLabel label={label} tooltip={tooltip} />
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={displayValue}
            onChange={(event) => handleChange(event.target.value)}
            disabled={isConnected}
            title={isConnected ? "Connected input — disconnect to enter manually" : undefined}
            className="nodrag w-[56px] shrink-0 rounded-lg border border-gray-200 bg-[#F5F5F5] px-1 py-1 text-center text-xs leading-4 text-gray-900 outline-none focus:border-workflow-accent-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:opacity-60"
          />
          <ResetSettingButton disabled={isConnected} />
          <AddToRequestButton />
        </div>
      </div>
    </div>
  );
}

export function GeminiSettingBoolean({
  nodeId,
  label,
  tooltip,
}: {
  nodeId: string;
  label: string;
  tooltip: string;
}) {
  const handleId = `setting-${label}`;
  const { values, setNodeHandleValue } = useNodeValueContext();
  const [enabled, setEnabled] = useState(() => {
    const stored = values[nodeId]?.[handleId];
    if (typeof stored === "boolean") return stored;
    if (stored === "true") return true;
    return false;
  });
  const connected = useConnectedInputValue(nodeId, handleId);
  const isConnected = connected.isConnected;
  const currentState = isConnected
    ? connected.value === true || displayConnectedValue(connected.value).toLowerCase() === "true"
    : enabled;
  const { recordSnapshot } = useWorkflowEditContext();

  useEffect(() => {
    const stored = values[nodeId]?.[handleId];
    const storedBool = typeof stored === "boolean" ? stored : stored === "true";
    if (typeof stored !== "undefined" && storedBool !== enabled) {
      setEnabled(storedBool);
    }
  }, [enabled, handleId, nodeId, values]);

  useEffect(() => {
    setNodeHandleValue(nodeId, handleId, enabled);
  }, [enabled, handleId, nodeId, setNodeHandleValue]);

  const toggle = useCallback(() => {
    recordSnapshot();
    setEnabled((prev) => !prev);
  }, [recordSnapshot]);

  return (
    <div className="relative flex min-w-0 items-center gap-3 overflow-visible">
      <FieldHandle id={handleId} color="#6366f1" top={14} />
      <GeminiSettingLabel label={label} tooltip={tooltip} />
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`text-[10px] font-medium ${isConnected ? (currentState ? "text-gray-400" : "text-gray-600") : "text-gray-600"}`}>False</span>
          <button
            type="button"
            role="switch"
            aria-checked={currentState}
            data-state={currentState ? "checked" : "unchecked"}
            value="on"
            onClick={toggle}
            disabled={isConnected}
            title={isConnected ? "Connected input — disconnect to enter manually" : undefined}
            className="peer nodrag inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=unchecked]:bg-input data-[state=checked]:bg-workflow-accent-500"
          >
            <span data-state={currentState ? "checked" : "unchecked"} className="pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
          </button>
          <span className={`text-[10px] font-medium ${isConnected && currentState ? "text-gray-600" : "text-gray-400"}`}>True</span>
        </div>
        <AddToRequestButton />
      </div>
    </div>
  );
}

export function GeminiSettingTextarea({
  nodeId,
  label,
  placeholder,
  tooltip,
}: {
  nodeId: string;
  label: string;
  placeholder: string;
  tooltip: string;
}) {
  const handleId = `setting-${label}`;
  const { values, setNodeHandleValue } = useNodeValueContext();
  const [text, setText] = useState(() => {
    const stored = values[nodeId]?.[handleId];
    return typeof stored === "string" ? stored : "";
  });
  const connected = useConnectedInputValue(nodeId, handleId);
  const isConnected = connected.isConnected;
  const displayValue = isConnected ? displayConnectedValue(connected.value) : text;
  const { recordSnapshot } = useWorkflowEditContext();

  useEffect(() => {
    const stored = values[nodeId]?.[handleId];
    if (typeof stored === "string" && stored !== text) {
      setText(stored);
    }
  }, [handleId, nodeId, text, values]);

  useEffect(() => {
    if (text) setNodeHandleValue(nodeId, handleId, text);
  }, [handleId, nodeId, setNodeHandleValue, text]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    recordSnapshot();
    setText(e.target.value);
  }, [recordSnapshot]);

  return (
    <div className="relative overflow-visible">
      <FieldHandle id={handleId} color="#f59e0b" top={14} />
      <div className="mb-1.5 flex h-7 items-center text-xs text-gray-500">
        <GeminiSettingLabel label={label} tooltip={tooltip} />
        <span className="ml-auto">
          <AddToRequestButton />
        </span>
      </div>
      <textarea
        rows={2}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        disabled={isConnected}
        title={isConnected ? "Connected input — disconnect to enter manually" : undefined}
        className="nodrag nopan nowheel w-full resize-y rounded-lg border border-gray-200 bg-[#F5F5F5] p-3 text-sm text-gray-900 outline-none focus:border-workflow-accent-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:opacity-60"
      />
    </div>
  );
}

