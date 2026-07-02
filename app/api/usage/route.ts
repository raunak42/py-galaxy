import { NextResponse } from "next/server";

function readNumberEnv(...keys: string[]) {
  for (const key of keys) {
    const raw = process.env[key];
    if (!raw) continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export async function GET() {
  const balanceMillions = readNumberEnv(
    "GOOGLE_AI_TOKEN_BALANCE_MILLIONS",
    "TOKEN_BALANCE_MILLIONS",
    "NEXT_PUBLIC_TOKEN_BALANCE_MILLIONS",
  );

  return NextResponse.json({
    // Google AI Studio / Gemini API does not expose a balance endpoint. If a real
    // token budget is known, set one of the env vars above and the UI will show it.
    balanceMillions,
  });
}
