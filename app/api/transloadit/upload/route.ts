import { createHmac, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const TRANSLOADIT_ASSEMBLIES_URL = "https://api2.transloadit.com/assemblies";
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

type TransloaditFile = {
  ssl_url?: string;
  url?: string;
  original_name?: string;
  name?: string;
  mime?: string;
  size?: number;
};

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

function signParams(params: string, secret: string) {
  const signature = createHmac("sha384", secret).update(params).digest("hex");
  return `sha384:${signature}`;
}

function findUploadedFile(status: TransloaditAssembly): TransloaditFile | null {
  const resultGroups = Object.values(status.results ?? {});
  for (const group of resultGroups) {
    const file = group.find((item) => item.ssl_url || item.url);
    if (file) return file;
  }

  return status.uploads?.find((item) => item.ssl_url || item.url) ?? null;
}

async function pollAssembly(url: string) {
  let latest: TransloaditAssembly | null = null;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(url, { cache: "no-store" });
    const json = await response.json() as TransloaditAssembly;
    latest = json;

    if (json.ok === "ASSEMBLY_COMPLETED" || json.ok === "ASSEMBLY_EXECUTING" && findUploadedFile(json)) {
      return json;
    }

    if (json.error) {
      throw new Error(json.message ?? json.error);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return latest;
}

export async function POST(request: Request) {
  const authKey = process.env.TRANSLOADIT_AUTH_KEY ?? process.env.TRANSLOADIT_KEY;
  const authSecret = process.env.TRANSLOADIT_AUTH_SECRET ?? process.env.TRANSLOADIT_SECRET;

  if (!authKey || !authSecret) {
    return NextResponse.json(
      { error: "Missing TRANSLOADIT_AUTH_KEY/TRANSLOADIT_AUTH_SECRET" },
      { status: 500 },
    );
  }

  const incoming = await request.formData();
  const file = incoming.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing upload file" }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported image type. Use jpg, jpeg, png, webp, or gif." },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Image is too large. Maximum upload size is 25MB." },
      { status: 400 },
    );
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

  const form = new FormData();
  form.append("params", params);
  form.append("signature", signParams(params, authSecret));
  form.append("file", file, file.name);

  const assemblyResponse = await fetch(`${TRANSLOADIT_ASSEMBLIES_URL}?wait=true`, {
    method: "POST",
    body: form,
  });

  const status = await assemblyResponse.json() as TransloaditAssembly;

  if (!assemblyResponse.ok || status.error) {
    return NextResponse.json(
      { error: status.message ?? status.error ?? "Transloadit upload failed", status },
      { status: assemblyResponse.ok ? 500 : assemblyResponse.status },
    );
  }

  const finalStatus = findUploadedFile(status)
    ? status
    : status.assembly_ssl_url || status.assembly_url
      ? await pollAssembly(status.assembly_ssl_url ?? status.assembly_url!)
      : status;
  const uploadedFile = finalStatus ? findUploadedFile(finalStatus) : null;
  const url = uploadedFile?.ssl_url ?? uploadedFile?.url;

  if (!url) {
    return NextResponse.json(
      { error: "Transloadit upload completed without a usable file URL", status: finalStatus ?? status },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url,
    assemblyId: finalStatus?.assembly_id ?? status.assembly_id,
    file: {
      name: uploadedFile?.original_name ?? uploadedFile?.name ?? file.name,
      mime: uploadedFile?.mime ?? file.type,
      size: uploadedFile?.size ?? file.size,
    },
  });
}
