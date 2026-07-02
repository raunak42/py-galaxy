import { NextResponse } from "next/server";
import { configure, runs, tasks } from "@trigger.dev/sdk";
import { z } from "zod";
import type { runGeminiTask } from "@/trigger/gemini";

export const runtime = "nodejs";
export const maxDuration = 300;

function configureTriggerForVercelProduction() {
  // Trigger.dev's SDK auto-uses VERCEL_GIT_COMMIT_REF as a preview branch.
  // Vercel sets that even for production deployments, which can make prod API
  // calls send x-trigger-branch: main and fail with "No matching branch env".
  // We deploy/call the prod Trigger environment, so explicitly disable branch targeting.
  configure({ accessToken: process.env.TRIGGER_SECRET_KEY, previewBranch: "" });
}

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
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().int().min(0).optional(),
  stopSequences: z.array(z.string()).optional(),
  responseMimeType: z.string().optional(),
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
    configureTriggerForVercelProduction();

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
