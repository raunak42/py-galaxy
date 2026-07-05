export const TRIAL_WORKFLOW_IMAGE_SRC = "/workflow-covers/trial-task-workflow.jpg";

const LEGACY_TRIAL_WORKFLOW_IMAGE_SRCS = new Set([
  "https://pub-e8fef8c0e03b44acb340577811800829.r2.dev/0c89d91b6bb0447bae12f04a394a5c7a/3dec2c395e5343c2ac16621ba924929f/da26c20cafb648bda1a4a08bbceb6adb.jpg",
]);

export function normalizeWorkflowAssetUrl(value: string) {
  return LEGACY_TRIAL_WORKFLOW_IMAGE_SRCS.has(value) ? TRIAL_WORKFLOW_IMAGE_SRC : value;
}

export function toAbsoluteWorkflowAssetUrl(value: string, baseUrl: string) {
  const normalized = normalizeWorkflowAssetUrl(value);
  return normalized.startsWith("/") ? new URL(normalized, baseUrl).toString() : normalized;
}
