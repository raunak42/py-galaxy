import { NextResponse } from "next/server";
import { runs, tasks } from "@trigger.dev/sdk";
import { z } from "zod";
import type { runGeminiTask } from "@/trigger/gemini";

export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  systemPrompt: z.string().optional(),
  model: z.string().default("gemini-3.1-pro"),
  imageUrls: z.array(z.string().min(1)).default([]),
  videoUrls: z.array(z.string().min(1)).default([]),
  audioUrls: z.array(z.string().min(1)).default([]),
  fileUrls: z.array(z.string().min(1)).default([]),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid Gemini payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    // triggerAndWait is only legal inside task.run(). From a Next route we trigger
    // the task, then poll Trigger.dev for completion.
    const handle = await tasks.trigger<typeof runGeminiTask>("py-gemini-3-1-pro", parsed.data);
    const run = await runs.poll<typeof runGeminiTask>(handle.id, { pollIntervalMs: 1000 });

    if (!run.isSuccess || !run.output) {
      return NextResponse.json(
        { error: "Gemini Trigger.dev task failed", details: run.error, runId: run.id, status: run.status },
        { status: 500 },
      );
    }

    return NextResponse.json({ runId: run.id, output: run.output });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to trigger Gemini task" },
      { status: 500 },
    );
  }
}
