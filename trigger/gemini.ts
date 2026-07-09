import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { task, wait } from "@trigger.dev/sdk";
import { z } from "zod";

const geminiPayloadSchema = z.object({
  prompt: z.string().min(1),
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

export type GeminiTaskPayload = z.infer<typeof geminiPayloadSchema>;

function resolveGeminiModel(label: string) {
  // The UI label can differ from the runtime model. Keep this overridable via
  // Trigger.dev env, but default 3.1 labels to the cheaper/lighter runtime model.
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  if (label.toLowerCase().includes("3.1")) return "gemini-3.1-flash-lite";
  return label;
}

function mimeFromUrl(url: string, fallback = "application/octet-stream") {
  if (url.startsWith("data:")) return url.slice(5, url.indexOf(";") > -1 ? url.indexOf(";") : url.indexOf(",")) || fallback;
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".gif")) return "image/gif";
  if (pathname.endsWith(".mp4")) return "video/mp4";
  if (pathname.endsWith(".mov")) return "video/quicktime";
  if (pathname.endsWith(".mp3")) return "audio/mpeg";
  if (pathname.endsWith(".wav")) return "audio/wav";
  if (pathname.endsWith(".pdf")) return "application/pdf";
  return fallback;
}

function isRetryableGeminiDemandError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("503 Service Unavailable") || message.toLowerCase().includes("high demand");
}

async function retryGeminiRequest<T>(operation: () => Promise<T>) {
  // Keep demo UX predictable: retry high-demand Gemini failures with a short,
  // fixed delay instead of exponential backoff. This avoids multi-minute waits.
  const delays = [3, 3];
  let lastError: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiDemandError(error) || attempt === delays.length) break;
      await wait.for({ seconds: delays[attempt] });
    }
  }
  throw lastError;
}

async function urlToInlinePart(url: string, fallbackMime: string): Promise<Part> {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
    if (!match) throw new Error("Invalid data URL Gemini input asset");
    const [, mimeType, isBase64, data] = match;
    const buffer = Buffer.from(decodeURIComponent(data), isBase64 ? "base64" : "utf8");
    return { inlineData: { mimeType: mimeType || fallbackMime, data: buffer.toString("base64") } };
  }
  if (url.startsWith("blob:")) {
    throw new Error("Browser blob: asset URLs cannot be fetched by Trigger.dev. Please upload as a data URL or remote URL.");
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch Gemini input asset (${response.status}): ${url}`);
  const contentType = response.headers.get("content-type")?.split(";")[0] ?? mimeFromUrl(url, fallbackMime);
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    inlineData: {
      mimeType: contentType,
      data: buffer.toString("base64"),
    },
  };
}

export const runGeminiTask = task({
  id: "py-gemini-3-1-pro",
  retry: {
    // We already retry transient Gemini demand errors inside the task with
    // fixed delays. Avoid a second task-level retry that can double runtime.
    maxAttempts: 1,
  },
  run: async (rawPayload: GeminiTaskPayload) => {
    const payload = geminiPayloadSchema.parse(rawPayload);
    const apiKey = process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GOOGLE_AI_API_KEY or GEMINI_API_KEY");

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = resolveGeminiModel(payload.model);
    const directOutputInstruction = "Return only the requested deliverable. Do not include praise, analysis, explanations, labels, markdown preambles, or commentary about the task. Start directly with the content the user can copy/paste.";
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: payload.systemPrompt
        ? `${payload.systemPrompt}\n\n${directOutputInstruction}`
        : directOutputInstruction,
    });

    const parts: Part[] = [{ text: payload.prompt }];
    for (const url of payload.imageUrls) parts.push(await urlToInlinePart(url, "image/png"));
    for (const url of payload.videoUrls) parts.push(await urlToInlinePart(url, "video/mp4"));
    for (const url of payload.audioUrls) parts.push(await urlToInlinePart(url, "audio/mpeg"));
    for (const url of payload.fileUrls) parts.push(await urlToInlinePart(url, "application/octet-stream"));

    const startedAt = Date.now();
    const result = await retryGeminiRequest(() => model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
        ...(payload.temperature === undefined ? {} : { temperature: payload.temperature }),
        ...(payload.maxOutputTokens === undefined ? {} : { maxOutputTokens: payload.maxOutputTokens }),
        ...(payload.topP === undefined ? {} : { topP: payload.topP }),
        ...(payload.topK === undefined ? {} : { topK: payload.topK }),
        ...(payload.stopSequences === undefined ? {} : { stopSequences: payload.stopSequences }),
        ...(payload.responseMimeType === undefined ? {} : { responseMimeType: payload.responseMimeType }),
      },
    }));

    return {
      model: modelName,
      response: result.response.text(),
      durationMs: Date.now() - startedAt,
    };
  },
});
