import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { initialEdges, initialNodes } from "@/app/workflows/[workflow_id]/canvas/_lib/initial-workflow";

const workflowStateSchema = z.object({
  nodes: z.array(z.unknown()).optional(),
  edges: z.array(z.unknown()).optional(),
  nodeValues: z.record(z.string(), z.unknown()).optional(),
  viewport: z.unknown().optional(),
  undoStack: z.array(z.unknown()).optional(),
  redoStack: z.array(z.unknown()).optional(),
});

const updateWorkflowSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  status: z.enum(["DRAFT", "READY", "RUNNING"]).optional(),
}).merge(workflowStateSchema);

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function serializeWorkflow(workflow: {
  id: string;
  name: string;
  status: string;
  nodes: unknown;
  edges: unknown;
  nodeValues: unknown;
  viewport: unknown;
  undoStack: unknown;
  redoStack: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: workflow.id,
    name: workflow.name,
    status: workflow.status,
    nodes: workflow.nodes,
    edges: workflow.edges,
    nodeValues: workflow.nodeValues,
    viewport: workflow.viewport,
    undoStack: workflow.undoStack,
    redoStack: workflow.redoStack,
    createdAt: workflow.createdAt.toISOString(),
    updatedAt: workflow.updatedAt.toISOString(),
  };
}

async function findWorkflowForOwner(workflowId: string, ownerId: string) {
  return prisma.workflow.findFirst({
    where: { id: workflowId, ownerId, deletedAt: null },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const user = await getCurrentUser();
  const { workflowId } = await params;
  const workflow = await findWorkflowForOwner(workflowId, user.id);

  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  return NextResponse.json({ workflow: serializeWorkflow(workflow) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const user = await getCurrentUser();
  const { workflowId } = await params;
  const json = await request.json().catch(() => ({}));
  const parsed = updateWorkflowSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workflow payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const current = await findWorkflowForOwner(workflowId, user.id);
  if (!current) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  const data: Prisma.WorkflowUpdateInput = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.nodes !== undefined) data.nodes = toJson(parsed.data.nodes);
  if (parsed.data.edges !== undefined) data.edges = toJson(parsed.data.edges);
  if (parsed.data.nodeValues !== undefined) data.nodeValues = toJson(parsed.data.nodeValues);
  if (parsed.data.viewport !== undefined) data.viewport = toJson(parsed.data.viewport);
  if (parsed.data.undoStack !== undefined) data.undoStack = toJson(parsed.data.undoStack);
  if (parsed.data.redoStack !== undefined) data.redoStack = toJson(parsed.data.redoStack);

  const workflow = await prisma.workflow.update({
    where: { id: current.id },
    data,
  });

  return NextResponse.json({ workflow: serializeWorkflow(workflow) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const user = await getCurrentUser();
  const { workflowId } = await params;
  const workflow = await findWorkflowForOwner(workflowId, user.id);
  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  await prisma.workflow.update({
    where: { id: workflow.id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
