import { runs, task, tasks } from "@trigger.dev/sdk";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { CROP_NODE_TIMEOUT_MS, GEMINI_NODE_TIMEOUT_MS, formatTimeout } from "@/lib/fetch-timeout";
import { toAbsoluteWorkflowAssetUrl } from "@/app/workflows/[workflow_id]/canvas/_lib/assets";
import { displayConnectedValue, nodeHistoryLabel, valueToStringArray } from "@/app/workflows/[workflow_id]/canvas/_lib/utils";
import type { cropImageTask } from "./crop-image";
import type { runGeminiTask } from "./gemini";

type WorkflowNode = {
  id: string;
  type?: string;
  data?: Record<string, unknown>;
};

type WorkflowEdge = {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

type NodeOutputValues = Record<string, Record<string, unknown>>;

type HistoryNodeDetail = {
  nodeId: string;
  label: string;
  status: "success" | "failed";
  durationMs: number;
  inputs?: unknown;
  output?: unknown;
  error?: string;
};

const workflowRunPayloadSchema = z.object({
  runId: z.string().min(1),
  workflowId: z.string().min(1),
  ownerId: z.string().min(1),
  scope: z.enum(["full", "partial", "single"]),
  selectedNodeIds: z.array(z.string()).optional(),
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
  nodeValues: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  baseUrl: z.string().url(),
});

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asNodes(value: unknown[]): WorkflowNode[] {
  return value.filter((item): item is WorkflowNode => typeof item === "object" && item !== null && "id" in item);
}

function asEdges(value: unknown[]): WorkflowEdge[] {
  return value.filter((item): item is WorkflowEdge => typeof item === "object" && item !== null && "source" in item && "target" in item);
}

function isExecutable(node: WorkflowNode) {
  return node.type === "geminiPreview" || node.type === "cropImage";
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : typeof error === "string" ? error : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${label} timed out after ${formatTimeout(timeoutMs)}.`)), timeoutMs);
    promise.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

async function waitForRunOutput<TOutput>(runId: string, label: string): Promise<TOutput> {
  while (true) {
    const run = await runs.retrieve(runId) as { status: string; output?: TOutput; error?: unknown; isSuccess?: boolean; isFailed?: boolean; isCancelled?: boolean };
    if (run.isSuccess || run.status === "COMPLETED") return run.output as TOutput;
    if (run.isFailed || run.isCancelled || ["FAILED", "CRASHED", "SYSTEM_FAILURE", "CANCELED", "EXPIRED", "TIMED_OUT"].includes(run.status)) {
      throw new Error(errorMessage(run.error, `${label} task failed with status ${run.status}`));
    }
    await sleep(1000);
  }
}

export const runWorkflowTask = task({
  id: "py-run-workflow",
  run: async (rawPayload: z.infer<typeof workflowRunPayloadSchema>) => {
    const payload = workflowRunPayloadSchema.parse(rawPayload);
    const nodes = asNodes(payload.nodes);
    const edges = asEdges(payload.edges);
    const targetIds = payload.selectedNodeIds?.length ? new Set(payload.selectedNodeIds) : null;
    const allExecutable = nodes.filter(isExecutable);
    const executable = targetIds ? allExecutable.filter((node) => targetIds.has(node.id)) : allExecutable;
    const executableIds = new Set(executable.map((node) => node.id));
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const outputs: NodeOutputValues = Object.fromEntries(Object.entries(payload.nodeValues).map(([nodeId, values]) => [nodeId, { ...values }]));
    const completed = new Set(nodes.filter((node) => !executableIds.has(node.id)).map((node) => node.id));
    const running = new Set<string>();
    const nodeDetails: HistoryNodeDetail[] = [];
    const runStartedAt = Date.now();

    const persistProgress = async (status: "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL" = "RUNNING") => {
      await prisma.workflowRun.update({
        where: { id: payload.runId },
        data: {
          status,
          durationMs: Date.now() - runStartedAt,
          nodeDetails: toJson(nodeDetails),
        },
      });
    };

    for (const node of nodes) {
      if (node.type !== "request") continue;
      const fields = Array.isArray(node.data?.fields) ? node.data.fields as Array<{ id?: string; label?: string; value?: unknown }> : [];
      for (const field of fields) {
        const fieldId = field.id ?? field.label;
        if (!fieldId || field.value === undefined) continue;
        outputs[node.id] = { ...(outputs[node.id] ?? {}), [fieldId]: outputs[node.id]?.[fieldId] ?? field.value };
      }
    }

    for (const node of executable) outputs[node.id] = {};

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

    const readConnectedValues = (targetNodeId: string, targetHandle: string) => edges
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

    const readManual = (targetNodeId: string, targetHandle: string) => outputs[targetNodeId]?.[targetHandle];
    const readEffective = (targetNodeId: string, targetHandle: string, fallback: unknown = "") => {
      const connected = readConnected(targetNodeId, targetHandle);
      if (connected) return connected;
      const manualText = displayConnectedValue(readManual(targetNodeId, targetHandle));
      return manualText || fallback;
    };

    const buildRequestDetail = (node: WorkflowNode): HistoryNodeDetail => {
      const fields = Array.isArray(node.data?.fields) ? node.data.fields as Array<{ id?: string; label?: string; value?: unknown }> : [];
      const output = Object.fromEntries(fields.map((field) => {
        const id = field.id ?? field.label ?? "field";
        return [field.label ?? id, outputs[node.id]?.[id] ?? field.value ?? ""];
      }));
      return { nodeId: node.id, label: nodeHistoryLabel(node as never), status: "success", durationMs: 100, inputs: output, output };
    };

    const buildResponseDetail = (node: WorkflowNode): HistoryNodeDetail => {
      const connectedValues = readConnectedValues(node.id, "result");
      const value = connectedValues.length <= 1 ? connectedValues[0] ?? "" : connectedValues;
      return { nodeId: node.id, label: nodeHistoryLabel(node as never), status: "success", durationMs: 100, inputs: { result: value }, output: value };
    };

    const buildExecutableInputs = (node: WorkflowNode): Record<string, unknown> => {
      if (node.type === "geminiPreview") {
        return {
          prompt: String(readEffective(node.id, "prompt", typeof node.data?.prompt === "string" ? node.data.prompt : "")),
          systemPrompt: String(readEffective(node.id, "system-prompt", typeof node.data?.systemPrompt === "string" ? node.data.systemPrompt : "")) || undefined,
          imageUrls: [...readConnectedValues(node.id, "image"), ...valueToStringArray(readManual(node.id, "image"))].map((url) => toAbsoluteWorkflowAssetUrl(url, payload.baseUrl)),
          videoUrls: [...readConnectedValues(node.id, "video"), ...valueToStringArray(readManual(node.id, "video"))].map((url) => toAbsoluteWorkflowAssetUrl(url, payload.baseUrl)),
          audioUrls: [...readConnectedValues(node.id, "audio"), ...valueToStringArray(readManual(node.id, "audio"))].map((url) => toAbsoluteWorkflowAssetUrl(url, payload.baseUrl)),
          fileUrls: [...readConnectedValues(node.id, "file"), ...valueToStringArray(readManual(node.id, "file"))].map((url) => toAbsoluteWorkflowAssetUrl(url, payload.baseUrl)),
          model: "gemini-3.1-pro",
        };
      }
      return {
        inputImageUrl: toAbsoluteWorkflowAssetUrl(String(readEffective(node.id, "input-image", "")), payload.baseUrl),
        x: Number(readEffective(node.id, "x-position", node.data?.x || 0)),
        y: Number(readEffective(node.id, "y-position", node.data?.y || 0)),
        width: Number(readEffective(node.id, "width", node.data?.width || 100)),
        height: Number(readEffective(node.id, "height", node.data?.height || 100)),
      };
    };

    const composeHistoryDetails = (includeResponse: boolean) => {
      if (payload.scope !== "full") return nodeDetails;
      const byNodeId = new Map(nodeDetails.map((detail) => [detail.nodeId, detail]));
      return nodes.flatMap((node): HistoryNodeDetail[] => {
        if (node.type === "request") return [buildRequestDetail(node)];
        if (node.type === "response") return includeResponse ? [buildResponseDetail(node)] : [];
        const detail = byNodeId.get(node.id);
        return detail ? [detail] : [];
      });
    };

    const runExecutableNode = async (node: WorkflowNode) => {
      const inputs = buildExecutableInputs(node);
      if (node.type === "geminiPreview") {
        if (!String(inputs.prompt ?? "").trim()) throw new Error("Prompt is required");
        const handle = await tasks.trigger<typeof runGeminiTask>("py-gemini-3-1-pro", inputs as never, { ttl: "1h" });
        const output = await withTimeout(waitForRunOutput<{ response?: string }>(handle.id, nodeHistoryLabel(node as never)), GEMINI_NODE_TIMEOUT_MS, nodeHistoryLabel(node as never));
        return { response: output.response ?? "", result: output.response ?? "" };
      }
      if (!String(inputs.inputImageUrl ?? "").trim()) throw new Error("Input Image is required");
      const handle = await tasks.trigger<typeof cropImageTask>("py-crop-image", inputs as never, { ttl: "1h" });
      const output = await withTimeout(waitForRunOutput<{ outputImageUrl?: string }>(handle.id, nodeHistoryLabel(node as never)), CROP_NODE_TIMEOUT_MS, nodeHistoryLabel(node as never));
      return { "output-image": output.outputImageUrl ?? "", outputImageUrl: output.outputImageUrl ?? "" };
    };

    const isReady = (node: WorkflowNode) => {
      if (completed.has(node.id) || running.has(node.id)) return false;
      const directExecutableDeps = edges
        .filter((edge) => edge.target === node.id && executableIds.has(edge.source))
        .map((edge) => edge.source);
      return directExecutableDeps.every((sourceId) => completed.has(sourceId));
    };

    try {
      if (executable.length === 0) throw new Error("Select at least one executable node");
      nodeDetails.push({
        nodeId: "workflow-start",
        label: "Workflow execution started",
        status: "success",
        durationMs: 0,
        output: "Trigger.dev orchestrator started",
      });
      await persistProgress("RUNNING");

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const fail = (error: unknown) => {
          if (settled) return;
          settled = true;
          reject(error);
        };
        const schedule = () => {
          if (settled) return;
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
            running.add(node.id);
            const nodeStartedAt = Date.now();
            void runExecutableNode(node)
              .then(async (values) => {
                if (settled) return;
                running.delete(node.id);
                outputs[node.id] = { ...(outputs[node.id] ?? {}), ...values };
                completed.add(node.id);
                nodeDetails.push({ nodeId: node.id, label: nodeHistoryLabel(node as never), status: "success", durationMs: Date.now() - nodeStartedAt, inputs: buildExecutableInputs(node), output: values });
                await prisma.workflow.update({ where: { id: payload.workflowId }, data: { nodeValues: toJson(outputs) } });
                await persistProgress("RUNNING");
                schedule();
              })
              .catch(async (error: unknown) => {
                if (settled) return;
                running.delete(node.id);
                const message = error instanceof Error ? error.message : "Node run failed";
                nodeDetails.push({ nodeId: node.id, label: nodeHistoryLabel(node as never), status: "failed", durationMs: Date.now() - nodeStartedAt, inputs: buildExecutableInputs(node), error: message });
                await persistProgress("FAILED").catch(() => undefined);
                fail(error);
              });
          }
        };
        schedule();
      });

      const finalDetails = composeHistoryDetails(true);
      await prisma.workflowRun.update({
        where: { id: payload.runId },
        data: { status: "SUCCESS", durationMs: Date.now() - runStartedAt, nodeDetails: toJson(finalDetails) },
      });
      await prisma.workflow.update({ where: { id: payload.workflowId }, data: { status: "READY", nodeValues: toJson(outputs) } });
      return { status: "success", durationMs: Date.now() - runStartedAt };
    } catch (error) {
      const finalDetails = composeHistoryDetails(false);
      await prisma.workflowRun.update({
        where: { id: payload.runId },
        data: { status: "FAILED", durationMs: Date.now() - runStartedAt, nodeDetails: toJson(finalDetails.length ? finalDetails : nodeDetails) },
      }).catch(() => undefined);
      await prisma.workflow.update({ where: { id: payload.workflowId }, data: { status: "DRAFT" } }).catch(() => undefined);
      throw error;
    }
  },
});
