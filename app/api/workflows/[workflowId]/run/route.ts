import { NextResponse } from "next/server";
import { configure, tasks } from "@trigger.dev/sdk";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import type { runWorkflowTask } from "@/trigger/workflow-runner";

export const runtime = "nodejs";

const runWorkflowSchema = z.object({
  scope: z.enum(["full", "partial", "single"]),
  selectedNodeIds: z.array(z.string()).optional(),
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
  nodeValues: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
});

function configureTriggerForVercelProduction() {
  configure({ accessToken: process.env.TRIGGER_SECRET_KEY, previewBranch: "" });
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function fromDbRun(run: {
  id: string;
  scope: string;
  status: string;
  durationMs: number;
  nodeDetails: unknown;
  createdAt: Date;
}) {
  return {
    id: run.id,
    scope: run.scope.toLowerCase(),
    status: run.status.toLowerCase(),
    durationMs: run.durationMs,
    nodeDetails: run.nodeDetails,
    timestamp: run.createdAt.getTime(),
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const user = await getCurrentUser();
  const { workflowId } = await params;
  const json = await request.json().catch(() => ({}));
  const parsed = runWorkflowSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid run payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const workflow = await prisma.workflow.findFirst({ where: { id: workflowId, ownerId: user.id, deletedAt: null } });
  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  let createdRunId: string | null = null;

  try {
    configureTriggerForVercelProduction();

    const run = await prisma.$transaction(async (tx) => {
      await tx.workflowRun.updateMany({
        where: { workflowId: workflow.id, ownerId: user.id, status: "RUNNING" },
        data: {
          status: "FAILED",
          nodeDetails: toJson([{ nodeId: "workflow", label: "Workflow execution", status: "failed", durationMs: 0, error: "Run superseded by a newer run" }]),
        },
      });

      const createdRun = await tx.workflowRun.create({
        data: {
          workflowId: workflow.id,
          ownerId: user.id,
          scope: parsed.data.scope.toUpperCase() as "FULL" | "PARTIAL" | "SINGLE",
          status: "RUNNING",
          durationMs: 0,
          nodeDetails: [],
        },
      });

      await tx.workflow.update({
        where: { id: workflow.id },
        data: {
          status: "RUNNING",
          nodes: toJson(parsed.data.nodes),
          edges: toJson(parsed.data.edges),
          nodeValues: toJson(parsed.data.nodeValues),
        },
      });

      return createdRun;
    });

    createdRunId = run.id;

    await tasks.trigger<typeof runWorkflowTask>("py-run-workflow", {
      runId: run.id,
      workflowId: workflow.id,
      ownerId: user.id,
      scope: parsed.data.scope,
      selectedNodeIds: parsed.data.selectedNodeIds,
      nodes: parsed.data.nodes,
      edges: parsed.data.edges,
      nodeValues: parsed.data.nodeValues,
      baseUrl: request.url,
    }, {
      ttl: "1h",
      tags: [workflow.id, user.id, run.id],
      metadata: { workflowId: workflow.id, ownerId: user.id, runId: run.id, scope: parsed.data.scope },
    });

    return NextResponse.json({ run: fromDbRun(run) }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow run";
    if (createdRunId) {
      await prisma.workflowRun.update({
        where: { id: createdRunId },
        data: {
          status: "FAILED",
          durationMs: 0,
          nodeDetails: toJson([{ nodeId: "workflow", label: "Workflow execution", status: "failed", durationMs: 0, error: message }]),
        },
      }).catch(() => undefined);
    }
    await prisma.workflow.update({ where: { id: workflow.id }, data: { status: "DRAFT" } }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
