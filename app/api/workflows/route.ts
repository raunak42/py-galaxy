import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { initialEdges, initialNodes } from "@/app/workflows/[workflow_id]/canvas/_lib/initial-workflow";

const createWorkflowSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  sourceWorkflowId: z.string().trim().min(1).optional(),
  nodes: z.array(z.record(z.string(), z.unknown())).optional(),
  edges: z.array(z.record(z.string(), z.unknown())).optional(),
  nodeValues: z.record(z.string(), z.unknown()).optional(),
});

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

export async function GET() {
  try {
    const user = await getCurrentUser();
    const workflows = await prisma.workflow.findMany({
      where: { ownerId: user.id, deletedAt: null },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ workflows: workflows.map(serializeWorkflow) });
  } catch (error) {
    console.error("Failed to load workflows", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load workflows" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const json = await request.json().catch(() => ({}));
  const parsed = createWorkflowSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workflow payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const source = parsed.data.sourceWorkflowId
    ? await prisma.workflow.findFirst({ where: { id: parsed.data.sourceWorkflowId, ownerId: user.id, deletedAt: null } })
    : null;

  if (parsed.data.sourceWorkflowId && !source) {
    return NextResponse.json({ error: "Source workflow not found" }, { status: 404 });
  }

  const templateNamePattern = "Trial Task Workflow Copy";
  const rawName = parsed.data.name ?? (source ? `${source.name} Copy` : "Untitled Workflow");
  let finalName = rawName;

  if (rawName.startsWith("Trial Task Workflow Copy")) {
    const existing = await prisma.workflow.findMany({
      where: { ownerId: user.id, name: { startsWith: templateNamePattern }, deletedAt: null },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((w) => w.name));
    if (!existingNames.has("Trial Task Workflow Copy")) {
      finalName = "Trial Task Workflow Copy";
    } else {
      let idx = 1;
      while (existingNames.has(`Trial Task Workflow Copy ${idx}`)) {
        idx++;
      }
      finalName = `Trial Task Workflow Copy ${idx}`;
    }
  }

  const workflow = await prisma.workflow.create({
    data: {
      ownerId: user.id,
      name: finalName,
      status: "DRAFT",
      nodes: toJson(source?.nodes ?? parsed.data.nodes ?? initialNodes),
      edges: toJson(source?.edges ?? parsed.data.edges ?? initialEdges),
      nodeValues: toJson(source?.nodeValues ?? parsed.data.nodeValues ?? {}),
      viewport: toJson(source?.viewport ?? { x: 0, y: 0, zoom: 0.5 }),
      undoStack: toJson([]),
      redoStack: toJson([]),
    },
  });

  return NextResponse.json({ workflow: serializeWorkflow(workflow) }, { status: 201 });
}
