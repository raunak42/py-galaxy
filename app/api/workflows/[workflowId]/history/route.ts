import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

const createRunSchema = z.object({
  scope: z.enum(["full", "partial", "single"]),
  status: z.enum(["running", "success", "failed", "partial"]),
  durationMs: z.number().int().min(0),
  nodeDetails: z.array(z.unknown()),
  timestamp: z.number().int().optional(),
});

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toDbScope(scope: "full" | "partial" | "single") {
  return scope.toUpperCase() as "FULL" | "PARTIAL" | "SINGLE";
}

function toDbStatus(status: "running" | "success" | "failed" | "partial") {
  return status.toUpperCase() as "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL";
}

async function findWorkflowForOwner(workflowId: string, ownerId: string) {
  const existing = await prisma.workflow.findFirst({ where: { id: workflowId, ownerId, deletedAt: null } });
  if (existing) return existing;
  if (workflowId !== "trial-task-workflow") return null;
  return prisma.workflow.findFirst({ where: { ownerId, name: "Trial Task Workflow", deletedAt: null } });
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

export async function GET(_request: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const user = await getCurrentUser();
  const { workflowId } = await params;
  const workflow = await findWorkflowForOwner(workflowId, user.id);

  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  const runs = await prisma.workflowRun.findMany({
    where: { workflowId: workflow.id, ownerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ runs: runs.map(fromDbRun) });
}

export async function POST(request: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const user = await getCurrentUser();
  const { workflowId } = await params;
  const json = await request.json().catch(() => ({}));
  const parsed = createRunSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid run payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const workflow = await findWorkflowForOwner(workflowId, user.id);
  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  const run = await prisma.workflowRun.create({
    data: {
      workflowId: workflow.id,
      ownerId: user.id,
      scope: toDbScope(parsed.data.scope),
      status: toDbStatus(parsed.data.status),
      durationMs: parsed.data.durationMs,
      nodeDetails: toJson(parsed.data.nodeDetails),
      createdAt: parsed.data.timestamp ? new Date(parsed.data.timestamp) : undefined,
    },
  });

  await prisma.workflow.update({
    where: { id: workflow.id },
    data: { status: parsed.data.status === "running" ? "RUNNING" : parsed.data.status === "failed" ? "DRAFT" : "READY" },
  });

  return NextResponse.json({ run: fromDbRun(run) }, { status: 201 });
}
