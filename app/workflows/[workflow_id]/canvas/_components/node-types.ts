import { type NodeTypes } from "@xyflow/react";
import { RequestInputsNode, ResponseNode } from "./request-response-nodes";
import { CropImageNode } from "./crop-node";
import { StickyNoteNode } from "./sticky-note";
import { GeminiPreviewNode } from "./gemini-node";
export const nodeTypes: NodeTypes = {
  request: RequestInputsNode,
  response: ResponseNode,
  geminiPreview: GeminiPreviewNode,
  cropImage: CropImageNode,
  stickyNote: StickyNoteNode,
};
