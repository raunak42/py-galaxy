import { NextResponse } from "next/server";
import { runs, tasks } from "@trigger.dev/sdk";
import { z } from "zod";
import type { cropImageTask } from "@/trigger/crop-image";

export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z.object({
  inputImageUrl: z.string().min(1),
  x: z.number().min(0).max(100).default(0),
  y: z.number().min(0).max(100).default(0),
  width: z.number().min(1).max(100).default(100),
  height: z.number().min(1).max(100).default(100),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid Crop Image payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    // triggerAndWait is only legal inside task.run(). From a Next route we trigger
    // the task, then poll Trigger.dev for completion.
    const handle = await tasks.trigger<typeof cropImageTask>("py-crop-image", parsed.data);
    const run = await runs.poll<typeof cropImageTask>(handle.id, { pollIntervalMs: 1000 });

    if (!run.isSuccess || !run.output) {
      return NextResponse.json(
        { error: "Crop Image Trigger.dev task failed", details: run.error, runId: run.id, status: run.status },
        { status: 500 },
      );
    }

    return NextResponse.json({ runId: run.id, output: run.output });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to trigger Crop Image task" },
      { status: 500 },
    );
  }
}
