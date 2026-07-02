export type NodeOutputValues = Record<string, Record<string, unknown>>;

export type NodeValueContextValue = {
  values: NodeOutputValues;
  setNodeHandleValue: (nodeId: string, handleId: string, value: unknown) => void;
};

export type HistoryNodeDetail = {
  nodeId: string;
  label: string;
  status: "success" | "failed";
  durationMs: number;
  inputs?: unknown;
  output?: unknown;
  error?: string;
};

export type HistoryRunEntry = {
  id: string;
  timestamp: number;
  status: "success" | "failed" | "partial";
  durationMs: number;
  scope: "full" | "partial" | "single";
  nodeDetails: HistoryNodeDetail[];
};

export type WorkflowEditContextValue = {
  undo: () => void;
  redo: () => void;
  recordSnapshot: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export type WorkflowRunContextValue = {
  runningNodeIds: Set<string>;
  pendingNodeIds: Set<string>;
  runWorkflow: () => Promise<void>;
  runSelectedNodes: (selectedIds?: string[]) => Promise<void>;
  cancelWorkflow: () => void;
  workflowRunning: boolean;
  selectedExecutableCount: number;
  addHistoryEntry: (entry: Omit<HistoryRunEntry, "id" | "timestamp">) => void;
  historyEntries: HistoryRunEntry[];
  historyOpen: boolean;
  setHistoryOpen: (open: boolean) => void;
};
