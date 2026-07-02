import { spawn } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
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

type TransloaditFile = { ssl_url?: string; url?: string; original_name?: string; name?: string; mime?: string; size?: number };
type TransloaditAssembly = {
  ok?: string;
  error?: string;
  message?: string;
  assembly_id?: string;
  assembly_ssl_url?: string;
  assembly_url?: string;
  uploads?: TransloaditFile[];
  results?: Record<string, TransloaditFile[]>;
};

function findTransloaditFile(status: TransloaditAssembly): TransloaditFile | null {
  for (const group of Object.values(status.results ?? {})) {
    const file = group.find((item) => item.ssl_url || item.url);
    if (file) return file;
  }
  return status.uploads?.find((item) => item.ssl_url || item.url) ?? null;
}

async function uploadImageOutputToTransloadit(buffer: Buffer, filename: string) {
  const authKey = process.env.TRANSLOADIT_AUTH_KEY ?? process.env.TRANSLOADIT_KEY;
  const authSecret = process.env.TRANSLOADIT_AUTH_SECRET ?? process.env.TRANSLOADIT_SECRET;
  if (!authKey || !authSecret) {
    throw new Error("Missing TRANSLOADIT_AUTH_KEY/TRANSLOADIT_AUTH_SECRET for cropped image output upload");
  }

  const params = JSON.stringify({
    auth: {
      key: authKey,
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      nonce: randomUUID(),
    },
    steps: {
      uploaded: {
        robot: "/file/filter",
        use: ":original",
        result: true,
      },
    },
  });
  const signature = `sha384:${createHmac("sha384", authSecret).update(params).digest("hex")}`;
  const form = new FormData();
  form.append("params", params);
  form.append("signature", signature);
  form.append("file", new Blob([new Uint8Array(buffer)], { type: "image/png" }), filename);

  const response = await fetch("https://api2.transloadit.com/assemblies?wait=true", {
    method: "POST",
    body: form,
  });
  const status = await response.json() as TransloaditAssembly;
  if (!response.ok || status.error) {
    throw new Error(status.message ?? status.error ?? "Transloadit output upload failed");
  }

  const file = findTransloaditFile(status);
  const url = file?.ssl_url ?? file?.url;
  if (!url) throw new Error("Transloadit output upload completed without a URL");
  return { url, assemblyId: status.assembly_id, file };
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
      const uploaded = await uploadImageOutputToTransloadit(output, `crop-${runId}.png`);

      return {
        outputImageUrl: uploaded.url,
        outputAssemblyId: uploaded.assemblyId,
        durationMs: Date.now() - startedAt,
        crop: { x: payload.x, y: payload.y, width: payload.width, height: payload.height },
      };
    } finally {
      await rm(workdir, { recursive: true, force: true });
    }
  },
});
