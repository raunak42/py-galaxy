"use client";

import React, { useContext, useState } from "react";
import { Handle, Position, EdgeLabelRenderer, useReactFlow, type EdgeProps } from "@xyflow/react";
import { getBezierPath } from "@xyflow/react";
import type { ConnectionLineComponentProps } from "@xyflow/react";
import { HANDLE_COLORS, handleTypeFromId } from "../_lib/constants";
import { SelectionBoxNodeContext, useWorkflowEditContext } from "../_lib/contexts";
export const FieldHandle = React.memo(function FieldHandle({
  id,
  color = "#f59e0b",
  top = 14,
}: {
  id: string;
  color?: string;
  top?: number;
}) {
  return (
    <div
      className="absolute left-[-23px] z-50 flex h-3.5 w-3.5 -translate-y-1/2 items-center"
      style={{ top }}
    >
      <Handle
        id={id}
        type="target"
        position={Position.Left}
        className="!relative !left-auto !top-auto !translate-x-0 !translate-y-0 !rounded-full !border-2"
        style={{
          position: "relative",
          left: "auto",
          top: "auto",
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: color,
          borderColor: `${color}80`,
          boxShadow: `${color}50 0px 0px 8px`,
          cursor: "crosshair",
          ['--handle-color' as string]: color,
        }}
      />
    </div>
  );
});

export const SourceFieldHandle = React.memo(function SourceFieldHandle({
  id,
  color = "#f59e0b",
  top = 31,
}: {
  id: string;
  color?: string;
  top?: number;
}) {
  return (
    <div
      className="absolute right-[-23px] z-50 flex h-3.5 w-3.5 -translate-y-1/2 items-center"
      style={{ top }}
    >
      <Handle
        id={id}
        type="source"
        position={Position.Right}
        className="!relative !right-auto !top-auto !translate-x-0 !translate-y-0 !rounded-full !border-2"
        style={{
          position: "relative",
          right: "auto",
          top: "auto",
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: color,
          borderColor: `${color}80`,
          boxShadow: `${color}50 0px 0px 8px`,
          cursor: "crosshair",
          ['--handle-color' as string]: color,
        }}
      />
    </div>
  );
});

export const RemovableEdge = React.memo(function RemovableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
  source,
  target,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const { setEdges } = useReactFlow();
  const { recordSnapshot } = useWorkflowEditContext();
  const selectionBoxNodeIds = useContext(SelectionBoxNodeContext);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const stroke = typeof style?.stroke === "string" ? style.stroke : "#f59e0b";
  const isConnectedToSelectionBoxNode = selectionBoxNodeIds.has(source) || selectionBoxNodeIds.has(target);
  const shouldAnimate = Boolean(selected || isConnectedToSelectionBoxNode);
  const strokeWidth = typeof style?.strokeWidth === "number" ? style.strokeWidth : 2;

  return (
    <>
      <g
        className="react-flow__edge-interaction"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <path d={edgePath} fill="none" stroke="transparent" strokeWidth={20} style={{ cursor: "pointer" }} />
        <path
          d={edgePath}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          markerEnd={markerEnd}
          style={{ opacity: shouldAnimate ? 0.18 : 0.8, pointerEvents: "none" }}
        />
        {shouldAnimate ? (
          <path
            d={edgePath}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            markerEnd={markerEnd}
            strokeDasharray="10 3"
            strokeDashoffset="0"
            style={{ pointerEvents: "none" }}
          >
            <animate attributeName="stroke-dashoffset" from="0" to="-32" dur="0.8s" repeatCount="indefinite" />
          </path>
        ) : null}
      </g>
      {hovered && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
              zIndex: 1000,
            }}
          >
            <button
              title="Delete connection"
              onClick={(event) => {
                event.stopPropagation();
                recordSnapshot();
                setEdges((edges) => edges.filter((edge) => edge.id !== id));
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-red-400 bg-red-500 text-xs font-bold text-white shadow-lg transition-colors hover:bg-red-600"
            >
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

export const edgeTypes = {
  removable: RemovableEdge,
};
export const CustomConnectionLine = React.memo(function CustomConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  connectionStatus,
  fromHandle,
  toNode,
}: ConnectionLineComponentProps) {
  const handleId = fromHandle?.id;
  const sourceType = handleTypeFromId(handleId);
  const color = HANDLE_COLORS[sourceType] ?? "#f59e0b";
  const [edgePath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });
  const invalid = connectionStatus === "invalid";
  return (
    <g>
      <path
        fill="none"
        stroke={invalid ? "#ef4444" : color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={invalid ? "5,5" : "none"}
        d={edgePath}
        style={{ opacity: 0.9 }}
      />
      {toNode !== null && (
        <circle
          cx={toX}
          cy={toY}
          r={6}
          fill={invalid ? "#ef4444" : color}
          fillOpacity={0.3}
          stroke={invalid ? "#ef4444" : color}
          strokeWidth={2}
        >
          <animate attributeName="r" values="4;8;4" dur="1s" repeatCount="indefinite" />
          <animate attributeName="fillOpacity" values="0.5;0.2;0.5" dur="1s" repeatCount="indefinite" />
        </circle>
      )}
    </g>
  );
});

export { AddToRequestButton } from "./tooltips";
