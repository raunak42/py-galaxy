"use client";
import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import type { Edge, Node } from "@xyflow/react";
import { CROP_NODE_TIMEOUT_MS, fetchWithTimeout, GEMINI_NODE_TIMEOUT_MS } from "@/lib/fetch-timeout";
import { toast } from "@/lib/toast";
import { initialNodes } from "../_lib/initial-workflow";
import { displayConnectedValue, nodeHistoryLabel, valueToStringArray } from "../_lib/utils";
import type { HistoryNodeDetail, HistoryRunEntry, NodeOutputValues } from "../_lib/types";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : typeof error === "string" ? error : fallback;
}

type UseWorkflowRunnerParams = {
  nodes: Node[];
  edges: Edge[];
  nodeValues: NodeOutputValues;
  setNodeValues: Dispatch<SetStateAction<NodeOutputValues>>;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  workflowRunning: boolean;
  setWorkflowRunning: Dispatch<SetStateAction<boolean>>;
  setRunningNodeIds: Dispatch<SetStateAction<Set<string>>>;
  setPendingNodeIds: Dispatch<SetStateAction<Set<string>>>;
  addHistoryEntry: (entry: Omit<HistoryRunEntry, "id" | "timestamp">) => void;
  setSelectionBoxNodeIds: Dispatch<SetStateAction<Set<string>>>;
  markWorkflowDirty: () => void;
  workflowId: string;
  historyEntries: HistoryRunEntry[];
  setHistoryEntries: Dispatch<SetStateAction<HistoryRunEntry[]>>;
};
export function useWorkflowRunner({
  nodes,
  edges,
  nodeValues,
  setNodeValues,
  setNodes,
  setEdges,
  workflowRunning,
  setWorkflowRunning,
  setRunningNodeIds,
  setPendingNodeIds,
  addHistoryEntry,
  setSelectionBoxNodeIds,
  markWorkflowDirty,
  workflowId,
  historyEntries,
  setHistoryEntries,
}: UseWorkflowRunnerParams) {
  const runCancelTokenRef = useRef(0);
  const resolveActiveRunRef = useRef<(() => void) | null>(null);
  const runExecutableScope = useCallback(async (targetIds: Set<string> | null, scope: "full" | "partial" | "single") => {
    if (workflowRunning) return;
    const runToken = runCancelTokenRef.current + 1;
    runCancelTokenRef.current = runToken;
    setWorkflowRunning(true);
    type NodeRunResult = { nodeId: string; values: Record<string, unknown>; inputs: Record<string, unknown> };
    const runStartedAt = Date.now();
    const nodeDetails: HistoryNodeDetail[] = [];
    const outputs: NodeOutputValues = Object.fromEntries(
      Object.entries(nodeValues).map(([nodeId, values]) => [nodeId, { ...values }]),
    );
    const nodeById = new globalThis.Map(nodes.map((node) => [node.id, node]));
    for (const node of nodes) {
      if (node.type !== "request") continue;
      const fields = Array.isArray(node.data?.fields) ? node.data.fields as Array<{ id?: string; label?: string; value?: unknown }> : [];
      for (const field of fields) {
        const fieldId = field.id ?? field.label;
        if (!fieldId || field.value === undefined) continue;
        if (outputs[node.id]?.[fieldId] !== undefined) continue;
        outputs[node.id] = { ...(outputs[node.id] ?? {}), [fieldId]: field.value };
      }
    }
    for (const node of nodes) {
      if (node.type === "geminiPreview" || node.type === "cropImage") {
        const shouldClear = !targetIds || targetIds.has(node.id);
        if (shouldClear && outputs[node.id]) outputs[node.id] = {};
      }
    }
    setNodeValues((current) => {
      const next = { ...current };
      for (const node of nodes) {
        if (node.type === "geminiPreview" || node.type === "cropImage") {
          const shouldClear = !targetIds || targetIds.has(node.id);
          if (shouldClear) next[node.id] = {};
        }
      }
      return next;
    });
    const allExecutable = nodes.filter((node) => node.type === "geminiPreview" || node.type === "cropImage");
    const executable = targetIds ? allExecutable.filter((node) => targetIds.has(node.id)) : allExecutable;
    const executableIds = new Set(executable.map((node) => node.id));
    const completed = new Set(nodes.filter((node) => !executableIds.has(node.id)).map((node) => node.id));
    const running = new Set<string>();
    if (executable.length === 0) {
      toast({ description: "Select at least one executable node" });
      setWorkflowRunning(false);
      return;
    }
    if (targetIds) {
      const isExecutableNode = (node: Node | undefined) => node?.type === "geminiPreview" || node?.type === "cropImage";
      const externalUpstream = new Set<string>();
      const selectedBlockedBy = new globalThis.Map<string, string>();
      for (const selectedNode of executable) {
        const queue = edges.filter((edge) => edge.target === selectedNode.id).map((edge) => edge.source);
        const visited = new Set<string>();
        while (queue.length > 0) {
          const sourceId = queue.shift()!;
          if (visited.has(sourceId)) continue;
          visited.add(sourceId);
          if (executableIds.has(sourceId)) {
            edges.filter((edge) => edge.target === sourceId).forEach((edge) => queue.push(edge.source));
            continue;
          }
          const sourceNode = nodeById.get(sourceId);
          if (isExecutableNode(sourceNode)) {
            const existingOutputs = nodeValues[sourceId];
            const hasOutput = existingOutputs && Object.values(existingOutputs).some(v => v !== undefined && v !== null && v !== "");
            if (!hasOutput) {
              externalUpstream.add(sourceId);
              if (!selectedBlockedBy.has(selectedNode.id)) selectedBlockedBy.set(selectedNode.id, sourceId);
            }
            edges.filter((edge) => edge.target === sourceId).forEach((edge) => queue.push(edge.source));
          }
        }
      }
      if (externalUpstream.size > 0) {
        const blockedNodeId = selectedBlockedBy.keys().next().value as string | undefined;
        const upstreamId = blockedNodeId ? selectedBlockedBy.get(blockedNodeId) : [...externalUpstream][0];
        const blockedNode = blockedNodeId ? nodeById.get(blockedNodeId) : executable[0];
        const upstreamNode = upstreamId ? nodeById.get(upstreamId) : undefined;
        const blockedLabel = blockedNode ? nodeHistoryLabel(blockedNode) : "the selected node";
        const upstreamLabel = upstreamNode ? nodeHistoryLabel(upstreamNode) : "an unselected upstream node";
        const message = `Cannot run selection because "${blockedLabel}" depends on "${upstreamLabel}". Select the upstream node too, run it first as part of this selection, or run the full workflow.`;
        addHistoryEntry({
          scope,
          status: "failed",
          durationMs: Date.now() - runStartedAt,
          nodeDetails: executable.map((node) => ({
            nodeId: node.id,
            label: nodeHistoryLabel(node),
            status: "failed",
            durationMs: Date.now() - runStartedAt,
            error: message,
          })),
        });
        toast({ description: message });
        setRunningNodeIds(new Set());
        setPendingNodeIds(new Set());
        setWorkflowRunning(false);
        return;
      }
    }
    const syncRunningNodes = () => {
      setRunningNodeIds(new Set(running));
      setPendingNodeIds(new Set(executable.filter((node) => !completed.has(node.id) && !running.has(node.id)).map((node) => node.id)));
    };
    const readConnected = (targetNodeId: string, targetHandle: string) => {
      const edge = edges.find((item) => item.target === targetNodeId && item.targetHandle === targetHandle);
      if (!edge) return "";
      const sourceHandle = edge.sourceHandle ?? "result";
      const outputValue = outputs[edge.source]?.[sourceHandle];
      if (outputValue !== undefined) return displayConnectedValue(outputValue);
      const sourceNode = nodeById.get(edge.source);
      if (sourceNode?.type === "request") {
        const fields = Array.isArray(sourceNode.data?.fields) ? sourceNode.data.fields as Array<{ id?: string; label?: string; value?: unknown }> : [];
        const field = fields.find((item) => (item.id ?? item.label) === sourceHandle);
        if (field?.value !== undefined) return displayConnectedValue(field.value);
      }
      return "";
    };
    const readConnectedValues = (targetNodeId: string, targetHandle: string) => {
      return edges
        .filter((item) => item.target === targetNodeId && item.targetHandle === targetHandle)
        .flatMap((edge) => {
          const sourceHandle = edge.sourceHandle ?? "result";
          const outputValue = outputs[edge.source]?.[sourceHandle];
          if (outputValue !== undefined) return valueToStringArray(outputValue);
          const sourceNode = nodeById.get(edge.source);
          if (sourceNode?.type === "request") {
            const fields = Array.isArray(sourceNode.data?.fields) ? sourceNode.data.fields as Array<{ id?: string; label?: string; value?: unknown }> : [];
            const field = fields.find((item) => (item.id ?? item.label) === sourceHandle);
            if (field?.value !== undefined) return valueToStringArray(field.value);
          }
          return [];
        })
        .filter(Boolean);
    };
    const readManual = (targetNodeId: string, targetHandle: string) => outputs[targetNodeId]?.[targetHandle];
    const readEffective = (targetNodeId: string, targetHandle: string, fallback: unknown = "") => {
      const connected = readConnected(targetNodeId, targetHandle);
      if (connected) return connected;
      const manualText = displayConnectedValue(readManual(targetNodeId, targetHandle));
      return manualText || fallback;
    };
    const buildRequestDetail = (node: Node): HistoryNodeDetail => {
      const fields = Array.isArray(node.data?.fields) ? node.data.fields as Array<{ id?: string; label?: string; value?: unknown }> : [];
      const output = Object.fromEntries(fields.map((field) => {
        const id = field.id ?? field.label ?? "field";
        return [field.label ?? id, outputs[node.id]?.[id] ?? field.value ?? ""];
      }));
      return { nodeId: node.id, label: nodeHistoryLabel(node), status: "success", durationMs: 100, inputs: output, output };
    };
    const buildResponseDetail = (node: Node): HistoryNodeDetail => {
      const connectedValues = readConnectedValues(node.id, "result");
      const value = connectedValues.length <= 1 ? connectedValues[0] ?? "" : connectedValues;
      return { nodeId: node.id, label: nodeHistoryLabel(node), status: "success", durationMs: 100, inputs: { result: value }, output: value };
    };
    const buildExecutableInputs = (node: Node): Record<string, unknown> => {
      if (node.type === "geminiPreview") {
        const prompt = String(readEffective(node.id, "prompt", typeof node.data?.prompt === "string" ? node.data.prompt : ""));
        const systemPrompt = String(readEffective(node.id, "system-prompt", typeof node.data?.systemPrompt === "string" ? node.data.systemPrompt : ""));
        return {
          prompt,
          systemPrompt: systemPrompt || undefined,
          imageUrls: [...readConnectedValues(node.id, "image"), ...valueToStringArray(readManual(node.id, "image"))],
          videoUrls: [...readConnectedValues(node.id, "video"), ...valueToStringArray(readManual(node.id, "video"))],
          audioUrls: [...readConnectedValues(node.id, "audio"), ...valueToStringArray(readManual(node.id, "audio"))],
          fileUrls: [...readConnectedValues(node.id, "file"), ...valueToStringArray(readManual(node.id, "file"))],
          model: "gemini-3.1-pro",
        };
      }
      return {
        inputImageUrl: String(readEffective(node.id, "input-image", "")),
        x: Number(readEffective(node.id, "x-position", node.data?.x || 0)),
        y: Number(readEffective(node.id, "y-position", node.data?.y || 0)),
        width: Number(readEffective(node.id, "width", node.data?.width || 100)),
        height: Number(readEffective(node.id, "height", node.data?.height || 100)),
      };
    };
    const composeHistoryDetails = (includeResponse: boolean) => {
      if (scope !== "full") return nodeDetails;
      const byNodeId = new globalThis.Map(nodeDetails.map((detail) => [detail.nodeId, detail]));
      return nodes.flatMap((node): HistoryNodeDetail[] => {
        if (node.type === "request") return [buildRequestDetail(node)];
        if (node.type === "response") return includeResponse ? [buildResponseDetail(node)] : [];
        const detail = byNodeId.get(node.id);
        return detail ? [detail] : [];
      });
    };
    const hasSelectedExecutableUpstream = (targetNodeId: string, targetHandle: string) => {
      return edges.some((edge) => edge.target === targetNodeId && edge.targetHandle === targetHandle && executableIds.has(edge.source));
    };
    const missingRequiredInput = executable.find((node) => {
      if (node.type === "geminiPreview") {
        if (hasSelectedExecutableUpstream(node.id, "prompt")) return false;
        return !String(readEffective(node.id, "prompt", typeof node.data?.prompt === "string" ? node.data.prompt : "")).trim();
      }
      if (node.type === "cropImage") {
        if (hasSelectedExecutableUpstream(node.id, "input-image")) return false;
        return !String(readEffective(node.id, "input-image", "")).trim();
      }
      return false;
    });
    if (missingRequiredInput) {
      const message = missingRequiredInput.type === "cropImage" ? "Input Image is required" : "Prompt is required";
      const detail: HistoryNodeDetail = {
        nodeId: missingRequiredInput.id,
        label: nodeHistoryLabel(missingRequiredInput),
        status: "failed",
        durationMs: Date.now() - runStartedAt,
        inputs: buildExecutableInputs(missingRequiredInput),
        error: message,
      };
      addHistoryEntry({ scope, status: "failed", durationMs: Date.now() - runStartedAt, nodeDetails: scope === "full" ? [buildRequestDetail(nodes.find((node) => node.type === "request") ?? initialNodes[0]), detail] : [detail] });
      toast({ description: message });
      setRunningNodeIds(new Set());
      setPendingNodeIds(new Set());
      setWorkflowRunning(false);
      return;
    }

    try {
      running.clear();
      for (const node of executable) {
        const directExecutableDeps = edges
          .filter((edge) => edge.target === node.id && executableIds.has(edge.source))
          .map((edge) => edge.source);
        if (directExecutableDeps.length === 0) running.add(node.id);
      }
      syncRunningNodes();
      const res = await fetch(`/api/workflows/${workflowId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          selectedNodeIds: targetIds ? [...targetIds] : undefined,
          nodes,
          edges,
          nodeValues: outputs,
        }),
      });
      const json = await res.json() as { run?: HistoryRunEntry; error?: string };
      if (!res.ok || !json.run) throw new Error(json.error ?? "Failed to start workflow run");
      setHistoryEntries((current) => [json.run!, ...current.filter((entry) => entry.id !== json.run!.id)]);
      toast({ description: "Workflow is running in the background. You can refresh this page and execution will continue." });
      return;
    } catch (error) {
      const message = getErrorMessage(error, "Failed to start workflow run");
      toast({ description: message });
      addHistoryEntry({
        scope,
        status: "failed",
        durationMs: Date.now() - runStartedAt,
        nodeDetails: executable.map((node) => ({ nodeId: node.id, label: nodeHistoryLabel(node), status: "failed", durationMs: Date.now() - runStartedAt, error: message })),
      });
      running.clear();
      setRunningNodeIds(new Set());
      setPendingNodeIds(new Set());
      setWorkflowRunning(false);
      return;
    }
    const validateExecutableNodeInputs = (node: Node) => {
      if (node.type === "geminiPreview") {
        const prompt = String(readEffective(node.id, "prompt", typeof node.data?.prompt === "string" ? node.data.prompt : ""));
        return prompt.trim() ? null : "Prompt is required";
      }
      if (node.type === "cropImage") {
        const inputImageUrl = String(readEffective(node.id, "input-image", ""));
        return inputImageUrl.trim() ? null : "Input Image is required";
      }
      return null;
    };
    const runExecutableNode = async (node: Node): Promise<NodeRunResult> => {
      if (node.type === "geminiPreview") {
        const prompt = String(readEffective(node.id, "prompt", typeof node.data?.prompt === "string" ? node.data.prompt : ""));
        const systemPrompt = String(readEffective(node.id, "system-prompt", typeof node.data?.systemPrompt === "string" ? node.data.systemPrompt : ""));
        const imageUrls = [...readConnectedValues(node.id, "image"), ...valueToStringArray(readManual(node.id, "image"))];
        const videoUrls = [...readConnectedValues(node.id, "video"), ...valueToStringArray(readManual(node.id, "video"))];
        const audioUrls = [...readConnectedValues(node.id, "audio"), ...valueToStringArray(readManual(node.id, "audio"))];
        const fileUrls = [...readConnectedValues(node.id, "file"), ...valueToStringArray(readManual(node.id, "file"))];
        const inputs = { prompt, systemPrompt: systemPrompt || undefined, imageUrls, videoUrls, audioUrls, fileUrls, model: "gemini-3.1-pro" };
        const res = await fetchWithTimeout("/api/tasks/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(inputs),
        }, GEMINI_NODE_TIMEOUT_MS, `Gemini node ${nodeHistoryLabel(node)}`);
        const json = await res.json() as { output?: { response?: string }; error?: string; details?: { message?: string } | unknown };
        if (!res.ok) {
          const detailMessage = typeof json.details === "object" && json.details && "message" in json.details && typeof json.details.message === "string" ? json.details.message : undefined;
          throw new Error(detailMessage ?? json.error ?? `Gemini node ${node.id} failed`);
        }
        return { nodeId: node.id, values: { response: json.output?.response ?? "", result: json.output?.response ?? "" }, inputs };
      }
      const inputs = {
        inputImageUrl: String(readEffective(node.id, "input-image", "")),
        x: Number(readEffective(node.id, "x-position", node.data?.x || 0)),
        y: Number(readEffective(node.id, "y-position", node.data?.y || 0)),
        width: Number(readEffective(node.id, "width", node.data?.width || 100)),
        height: Number(readEffective(node.id, "height", node.data?.height || 100)),
      };
      const res = await fetchWithTimeout("/api/tasks/crop-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      }, CROP_NODE_TIMEOUT_MS, `Crop node ${nodeHistoryLabel(node)}`);
      const json = await res.json() as { output?: { outputImageUrl?: string }; error?: string; details?: { message?: string } | unknown };
      if (!res.ok) {
        const detailMessage = typeof json.details === "object" && json.details && "message" in json.details && typeof json.details.message === "string" ? json.details.message : undefined;
        throw new Error(detailMessage ?? json.error ?? `Crop node ${node.id} failed`);
      }
      return { nodeId: node.id, values: { "output-image": json.output?.outputImageUrl ?? "", outputImageUrl: json.output?.outputImageUrl ?? "" }, inputs };
    };
    const isReady = (node: Node) => {
      if (completed.has(node.id) || running.has(node.id)) return false;
      const directExecutableDeps = edges
        .filter((edge) => edge.target === node.id && executableIds.has(edge.source))
        .map((edge) => edge.source);
      return directExecutableDeps.every((sourceId) => completed.has(sourceId));
    };
    const commitResult = (result: NodeRunResult) => {
      outputs[result.nodeId] = { ...(outputs[result.nodeId] ?? {}), ...result.values };
      completed.add(result.nodeId);
      setNodeValues((current) => ({
        ...current,
        [result.nodeId]: { ...(current[result.nodeId] ?? {}), ...result.values },
      }));
      markWorkflowDirty();
    };
    setSelectionBoxNodeIds(new Set());
    setNodes((currentNodes) => currentNodes.some((node) => node.selected)
      ? currentNodes.map((node) => node.selected ? { ...node, selected: false } : node)
      : currentNodes);
    try {
      syncRunningNodes();
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        resolveActiveRunRef.current = () => {
          settled = true;
          resolve();
        };
        const fail = (error: unknown) => {
          if (settled) return;
          settled = true;
          reject(error);
        };
        const scheduleReadyNodes = () => {
          if (settled || runCancelTokenRef.current !== runToken) return;
          if (executable.every((node) => completed.has(node.id))) {
            settled = true;
            resolve();
            return;
          }
          const ready = executable.filter(isReady);
          if (ready.length === 0 && running.size === 0) {
            fail(new Error("No runnable nodes found. Check for cycles or missing inputs."));
            return;
          }
          for (const node of ready) {
            const validationError = validateExecutableNodeInputs(node);
            if (validationError) {
              const durationMs = Date.now() - runStartedAt;
              nodeDetails.push({ nodeId: node.id, label: nodeHistoryLabel(node), status: "failed", durationMs, inputs: buildExecutableInputs(node), error: validationError });
              fail(new Error(validationError));
              return;
            }
            running.add(node.id);
            syncRunningNodes();
            const nodeStartedAt = Date.now();
            void runExecutableNode(node)
              .then((result) => {
                if (runCancelTokenRef.current !== runToken) return;
                const durationMs = Date.now() - nodeStartedAt;
                running.delete(node.id);
                commitResult(result);
                nodeDetails.push({ nodeId: node.id, label: nodeHistoryLabel(node), status: "success", durationMs, inputs: result.inputs, output: result.values });
                syncRunningNodes();
                scheduleReadyNodes();
              })
              .catch((error: unknown) => {
                if (runCancelTokenRef.current !== runToken) return;
                const durationMs = Date.now() - nodeStartedAt;
                const message = getErrorMessage(error, "Node run failed");
                running.delete(node.id);
                nodeDetails.push({ nodeId: node.id, label: nodeHistoryLabel(node), status: "failed", durationMs, inputs: buildExecutableInputs(node), error: message });
                syncRunningNodes();
                fail(error);
              });
          }
        };
        scheduleReadyNodes();
      });
      if (runCancelTokenRef.current === runToken) {
        addHistoryEntry({ scope, status: "success", durationMs: Date.now() - runStartedAt, nodeDetails: composeHistoryDetails(true) });
        toast({ description: scope === "full" ? "Workflow run completed" : "Selected run completed" });
      }
    } catch (error) {
      if (runCancelTokenRef.current === runToken) {
        addHistoryEntry({ scope, status: "failed", durationMs: Date.now() - runStartedAt, nodeDetails: composeHistoryDetails(false) });
        const message = getErrorMessage(error, "Workflow run failed");
        toast({ description: message });
        runCancelTokenRef.current += 1;
        running.clear();
        setRunningNodeIds(new Set());
        setPendingNodeIds(new Set());
        setWorkflowRunning(false);
      }
    } finally {
      if (resolveActiveRunRef.current) resolveActiveRunRef.current = null;
      if (runCancelTokenRef.current === runToken) {
        running.clear();
        setRunningNodeIds(new Set());
        setPendingNodeIds(new Set());
        setWorkflowRunning(false);
      }
    }
  }, [addHistoryEntry, edges, markWorkflowDirty, nodeValues, nodes, setHistoryEntries, setNodeValues, setNodes, setPendingNodeIds, setRunningNodeIds, setSelectionBoxNodeIds, setWorkflowRunning, workflowId, workflowRunning]);
  const cancelWorkflow = useCallback(() => {
    runCancelTokenRef.current += 1;
    resolveActiveRunRef.current?.();
    resolveActiveRunRef.current = null;
    const runningRun = historyEntries.find((entry) => entry.status === "running");
    if (runningRun) {
      const durationMs = Date.now() - runningRun.timestamp;
      const nodeDetails = runningRun.nodeDetails.length > 0
        ? runningRun.nodeDetails
        : [{ nodeId: "workflow", label: "Workflow execution", status: "failed" as const, durationMs, error: "Run canceled by user" }];
      setHistoryEntries((current) => current.map((entry) => entry.id === runningRun.id ? { ...entry, status: "failed", durationMs, nodeDetails } : entry));
      void fetch(`/api/workflows/${workflowId}/history`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: runningRun.id, status: "failed", durationMs, nodeDetails }),
      }).catch(() => undefined);
    }
    setRunningNodeIds(new Set());
    setPendingNodeIds(new Set());
    setWorkflowRunning(false);
    toast({ description: "Workflow run canceled" });
  }, [historyEntries, setHistoryEntries, setPendingNodeIds, setRunningNodeIds, setWorkflowRunning, workflowId]);
  const runWorkflow = useCallback(async () => {
    await runExecutableScope(null, "full");
  }, [runExecutableScope]);
  const selectedExecutableNodes = nodes.filter((node) => node.selected && (node.type === "geminiPreview" || node.type === "cropImage"));
  const selectedExecutableCount = selectedExecutableNodes.length;
  const runSelectedNodes = useCallback(async (selectedIds?: string[]) => {
    const selectedIdSet = selectedIds?.length ? new Set(selectedIds) : null;
    const selected = nodes.filter((node) => (selectedIdSet ? selectedIdSet.has(node.id) : node.selected) && (node.type === "geminiPreview" || node.type === "cropImage"));
    setEdges((currentEdges) => currentEdges.some((edge) => edge.selected) ? currentEdges.map((edge) => edge.selected ? { ...edge, selected: false } : edge) : currentEdges);
    if (selected.length === 0) {
      toast({ description: "Select one or more executable nodes first" });
      return;
    }
    setSelectionBoxNodeIds(new Set());
    setNodes((currentNodes) => currentNodes.some((node) => node.selected)
      ? currentNodes.map((node) => node.selected ? { ...node, selected: false } : node)
      : currentNodes);
    await runExecutableScope(new Set(selected.map((node) => node.id)), selected.length === 1 ? "single" : "partial");
  }, [nodes, runExecutableScope, setEdges, setNodes, setSelectionBoxNodeIds]);
  return {
    runWorkflow,
    runSelectedNodes,
    cancelWorkflow,
    selectedExecutableCount,
  };
}
