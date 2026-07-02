import type { Edge, Node } from "@xyflow/react";
import { HANDLE_COLORS } from "./constants";

export const initialNodes: Node[] = [
  {
    id: "request-inputs",
    type: "request",
    position: { x: 70, y: 210 },
    deletable: false,
    data: {
      fields: [
        {
          type: "text_field",
          id: "text_field",
          label: "text_field",
          value: "",
        },
      ],
    },
  },
  {
    id: "response",
    type: "response",
    position: { x: 1980, y: 330 },
    deletable: false,
    data: {},
  },
];

export const initialEdges: Edge[] = [];

export const sampleWorkflowNodes: Node[] = [
  {
    id: "request-inputs",
    type: "request",
    position: { x: 70, y: 210 },
    deletable: false,
    data: {
      fields: [
        {
          type: "text_field",
          id: "text_field",
          label: "text_field",
          value: "Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design.",
        },
        {
          type: "image_field",
          id: "image_field",
          label: "image_field",
          value: "https://pub-e8fef8c0e03b44acb340577811800829.r2.dev/0c89d91b6bb0447bae12f04a394a5c7a/3dec2c395e5343c2ac16621ba924929f/da26c20cafb648bda1a4a08bbceb6adb.jpg",
        },
      ],
    },
  },
  {
    id: "crop-1",
    type: "cropImage",
    position: { x: 520, y: 520 },
    data: { x: "20", y: "20", width: "60", height: "60" },
  },
  {
    id: "crop-2",
    type: "cropImage",
    position: { x: 520, y: 850 },
    data: { x: "0", y: "0", width: "100", height: "50" },
  },
  {
    id: "gemini-1",
    type: "geminiPreview",
    position: { x: 520, y: 60 },
    data: {
      systemPrompt: "You are a marketing copywriter. Write a one-paragraph product description.",
    },
  },
  {
    id: "gemini-2",
    type: "geminiPreview",
    position: { x: 1010, y: 90 },
    data: {
      systemPrompt: "Condense the following product description into a tweet-length hook (under 240 characters)."
    },
  },
  {
    id: "gemini-final",
    type: "geminiPreview",
    position: { x: 1480, y: 250 },
    data: {
      systemPrompt: "You are a social media manager. Combine the tweet hook and the two product crops into a final marketing post."
    },
  },
  {
    id: "response",
    type: "response",
    position: { x: 1980, y: 330 },
    deletable: false,
    data: {},
  },
];

export const sampleWorkflowEdges: Edge[] = [
  {
    id: "e-request-text-gemini-1-prompt",
    source: "request-inputs",
    sourceHandle: "text_field",
    target: "gemini-1",
    targetHandle: "prompt",
    type: "removable",
    animated: false,
    style: { stroke: HANDLE_COLORS.text, strokeWidth: 2 },
  },
  {
    id: "e-request-image-crop-1",
    source: "request-inputs",
    sourceHandle: "image_field",
    target: "crop-1",
    targetHandle: "input-image",
    type: "removable",
    animated: false,
    style: { stroke: HANDLE_COLORS.image, strokeWidth: 2 },
  },
  {
    id: "e-request-image-crop-2",
    source: "request-inputs",
    sourceHandle: "image_field",
    target: "crop-2",
    targetHandle: "input-image",
    type: "removable",
    animated: false,
    style: { stroke: HANDLE_COLORS.image, strokeWidth: 2 },
  },
  {
    id: "e-gemini-1-gemini-2",
    source: "gemini-1",
    sourceHandle: "response",
    target: "gemini-2",
    targetHandle: "prompt",
    type: "removable",
    animated: false,
    style: { stroke: HANDLE_COLORS.text, strokeWidth: 2 },
  },
  {
    id: "e-gemini-2-final",
    source: "gemini-2",
    sourceHandle: "response",
    target: "gemini-final",
    targetHandle: "prompt",
    type: "removable",
    animated: false,
    style: { stroke: HANDLE_COLORS.text, strokeWidth: 2 },
  },
  {
    id: "e-crop-1-final-image",
    source: "crop-1",
    sourceHandle: "output-image",
    target: "gemini-final",
    targetHandle: "image",
    type: "removable",
    animated: false,
    style: { stroke: HANDLE_COLORS.image, strokeWidth: 2 },
  },
  {
    id: "e-crop-2-final-image",
    source: "crop-2",
    sourceHandle: "output-image",
    target: "gemini-final",
    targetHandle: "image",
    type: "removable",
    animated: false,
    style: { stroke: HANDLE_COLORS.image, strokeWidth: 2 },
  },
  {
    id: "e-final-response",
    source: "gemini-final",
    sourceHandle: "response",
    target: "response",
    targetHandle: "result",
    type: "removable",
    animated: false,
    style: { stroke: HANDLE_COLORS.text, strokeWidth: 2 },
  },
  {
    id: "e-crop-2-response",
    source: "crop-2",
    sourceHandle: "output-image",
    target: "response",
    targetHandle: "result",
    type: "removable",
    animated: false,
    style: { stroke: HANDLE_COLORS.image, strokeWidth: 2 },
  },
];
