import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { task, wait } from "@trigger.dev/sdk";
import { z } from "zod";

const cropPayloadSchema = z.object({
  // Accept remote URLs and browser-produced data URLs. Browser blob: URLs are
  // intentionally not supported because Trigger.dev runs outside the browser.
  inputImageUrl: z.string().min(1),
  x: z.number().min(0).max(100).default(0),
  y: z.number().min(0).max(100).default(0),
  width: z.number().min(1).max(100).default(100),
  height: z.number().min(1).max(100).default(100),
});

export type CropImageTaskPayload = z.infer<typeof cropPayloadSchema>;

function imageInputToBuffer(input: string) {
  if (input.startsWith("data:")) {
    const match = input.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
    if (!match) throw new Error("Invalid data URL image input");
    const [, , isBase64, data] = match;
    return Buffer.from(decodeURIComponent(data), isBase64 ? "base64" : "utf8");
  }
  if (input.startsWith("blob:")) {
    throw new Error("Browser blob: image URLs cannot be fetched by Trigger.dev. Please upload as a data URL or remote URL.");
  }
  return null;
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}: ${stderr}`));
    });
  });
}

export const cropImageTask = task({
  id: "py-crop-image",
  run: async (rawPayload: CropImageTaskPayload) => {
    const payload = cropPayloadSchema.parse(rawPayload);
    const startedAt = Date.now();

    // Mandatory product requirement: Crop Image must always take at least 30s.
    await wait.for({ seconds: 30 });

    const inlineInput = imageInputToBuffer(payload.inputImageUrl);
    const remoteInput = inlineInput
      ? null
      : await fetch(payload.inputImageUrl).catch((error: unknown) => {
          throw new Error(`Failed to fetch input image: ${error instanceof Error ? error.message : "unknown fetch error"}`);
        });
    if (remoteInput && !remoteInput.ok) throw new Error(`Failed to fetch input image (${remoteInput.status})`);

    const runId = randomUUID();
    const workdir = path.join("/tmp", `py-crop-${runId}`);
    await mkdir(workdir, { recursive: true });

    const inputPath = path.join(workdir, "input");
    const outputPath = path.join(workdir, "output.png");

    try {
      await writeFile(inputPath, inlineInput ?? Buffer.from(await remoteInput!.arrayBuffer()));

      const x = payload.x / 100;
      const y = payload.y / 100;
      const width = payload.width / 100;
      const height = payload.height / 100;
      const filter = `crop=w=iw*${width}:h=ih*${height}:x=iw*${x}:y=ih*${y}`;

      await runCommand("ffmpeg", ["-y", "-i", inputPath, "-vf", filter, "-frames:v", "1", outputPath]);
      const output = await readFile(outputPath);

      return {
        outputImageUrl: `data:image/png;base64,${output.toString("base64")}`,
        durationMs: Date.now() - startedAt,
        crop: { x: payload.x, y: payload.y, width: payload.width, height: payload.height },
      };
    } finally {
      await rm(workdir, { recursive: true, force: true });
    }
  },
});
