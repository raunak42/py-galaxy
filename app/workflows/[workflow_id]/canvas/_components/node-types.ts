import React from "react";
import { type NodeTypes } from "@xyflow/react";
import { RequestInputsNode, ResponseNode } from "./request-response-nodes";
import { CropImageNode } from "./crop-node";
import { StickyNoteNode } from "./sticky-note";
import { GeminiPreviewNode } from "./gemini-node";
export const nodeTypes: NodeTypes = {
  request: React.memo(RequestInputsNode),
  response: React.memo(ResponseNode),
  geminiPreview: React.memo(GeminiPreviewNode),
  cropImage: React.memo(CropImageNode),
  stickyNote: React.memo(StickyNoteNode),
};
