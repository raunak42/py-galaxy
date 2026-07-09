export const GEMINI_NODE_TIMEOUT_MS = 120_000;
export const CROP_NODE_TIMEOUT_MS = 180_000;

export function formatTimeout(secondsMs: number) {
  return `${Math.round(secondsMs / 1000)}s`;
}

export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit | undefined, timeoutMs: number, label: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${label} timed out after ${formatTimeout(timeoutMs)}. Please retry.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
