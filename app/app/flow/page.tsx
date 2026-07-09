"use client";

import {
  Copy,
  ExternalLink,
  FileJson,
  Upload,
  ImagePlus,
  Loader2,
  MoreHorizontal,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
  FileOutput,
} from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { toast, Toaster } from "@/lib/toast";
import { Sidebar } from "@/app/workflows/[workflow_id]/canvas/_components/sidebar";
import { sampleWorkflowNodes, sampleWorkflowEdges } from "@/app/workflows/[workflow_id]/canvas/_lib/initial-workflow";
import { normalizeWorkflowAssetUrl, TRIAL_WORKFLOW_IMAGE_SRC } from "@/app/workflows/[workflow_id]/canvas/_lib/assets";

type WorkflowListItem = {
  id: string;
  name: string;
  updatedAt: string;
  status: "DRAFT" | "READY" | "RUNNING";
  nodes?: unknown;
  edges?: unknown;
  nodeValues?: unknown;
  viewport?: unknown;
};

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(response.ok ? "Invalid server response" : `Request failed (${response.status})`);
  }
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs) || diffMs < 10_000) return "just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function workflowHref(id: string) {
  return `/app/flow/${id}/canvas`;
}

function getWorkflowCoverImage(workflow: WorkflowListItem) {
  const nodeValues = workflow.nodeValues as Record<string, unknown> | undefined;
  if (typeof nodeValues?.__cover__ === "string" && nodeValues.__cover__) return normalizeWorkflowAssetUrl(nodeValues.__cover__);

  const nodeValueImage = typeof (nodeValues as Record<string, Record<string, unknown>> | undefined)?.["request-inputs"]?.image_field === "string"
    ? (nodeValues as Record<string, Record<string, string>>)["request-inputs"].image_field
    : "";
  if (nodeValueImage) return normalizeWorkflowAssetUrl(nodeValueImage);

  const requestNode = Array.isArray(workflow.nodes)
    ? workflow.nodes.find((node): node is { data?: { fields?: Array<{ id?: string; value?: unknown }> } } => typeof node === "object" && node !== null && "data" in node)
    : undefined;
  const imageField = requestNode?.data?.fields?.find((field) => field.id === "image_field");
  return typeof imageField?.value === "string" ? normalizeWorkflowAssetUrl(imageField.value) : "";
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function WorkflowStatusBadge({ status, compact = false }: { status: WorkflowListItem["status"]; compact?: boolean }) {
  const label = status === "RUNNING" ? "Running" : status === "READY" ? "Workflow completed" : "Draft";
  const classes = status === "RUNNING"
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : status === "READY"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-gray-200 bg-gray-50 text-gray-600";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 ${compact ? "py-0.5 text-[10px]" : "py-1 text-[11px]"} font-medium ${classes}`}>
      {status === "RUNNING" ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className={`h-1.5 w-1.5 rounded-full ${status === "READY" ? "bg-emerald-500" : "bg-gray-400"}`} />}
      {label}
    </span>
  );
}

function WorkflowPreview({ large = false, coverUrl = "" }: { large?: boolean; coverUrl?: string }) {
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);
  const visibleCoverUrl = coverUrl && coverUrl !== failedCoverUrl ? coverUrl : "";

  if (visibleCoverUrl) {
    return <img src={visibleCoverUrl} alt="Workflow cover" className="h-full w-full object-cover" onError={() => setFailedCoverUrl(visibleCoverUrl)} />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f6f6f4]">
      <div className="absolute inset-0 opacity-[0.55]" style={{ backgroundImage: "radial-gradient(#d8d8dc 1px, transparent 1px)", backgroundSize: large ? "18px 18px" : "14px 14px" }} />
    </div>
  );
}

function WorkflowCard({ workflow, onRename, onDuplicate, onDelete, onExport, onCoverUpdate, onNavigate, renamingWorkflowId, onConfirmRename }: {
  workflow: WorkflowListItem;
  onRename: (workflow: WorkflowListItem) => void;
  onDuplicate: (workflow: WorkflowListItem) => void;
  onDelete: (workflow: WorkflowListItem) => void;
  onExport: (workflow: WorkflowListItem) => void;
  onCoverUpdate: (workflowId: string, url: string) => void;
  onNavigate: (href: string) => void;
  renamingWorkflowId: string | null;
  onConfirmRename: (workflowId: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const coverUrl = getWorkflowCoverImage(workflow);
  const isRenaming = renamingWorkflowId === workflow.id;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleCoverUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const { uploadImageWithTransloadit } = await import("@/app/workflows/[workflow_id]/canvas/_components/request-fields");
      const url = await uploadImageWithTransloadit(file);
      onCoverUpdate(workflow.id, url);
    } catch {
      toast({ description: "Failed to upload cover image" });
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  return (
    <div ref={cardRef} className="group/card relative w-full max-sm:max-w-full">
      <div className="relative aspect-[250/162] overflow-hidden rounded-[16px] border-[0.5px] border-[#e0e0e2] bg-white transition-colors group-hover/card:border-[#cfcfd3]">
        <button type="button" onClick={() => onNavigate(workflowHref(workflow.id))} className="block h-full w-full cursor-pointer text-left" aria-label={`Open ${workflow.name}`}>
          <WorkflowPreview coverUrl={coverUrl} />
        </button>
        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
        {uploadingCover && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        )}
        <button
          type="button"
          disabled={uploadingCover}
          onClick={() => coverInputRef.current?.click()}
          className="absolute left-2 top-2 rounded-md bg-white/80 p-1 text-[#737373] opacity-0 transition-all hover:bg-white hover:text-[#1b1b18] focus:opacity-100 group-hover/card:opacity-100"
          aria-label={`Change cover for ${workflow.name}`}
        >
          <ImagePlus className="h-4 w-4" />
        </button>
        <span className="absolute bottom-2 right-2">
          <WorkflowStatusBadge status={workflow.status} />
        </span>
      </div>

      <div className="absolute right-2 top-2 z-50">
        <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-md bg-white/80 p-1 text-[#737373] opacity-0 transition-all hover:bg-white hover:text-[#1b1b18] focus:opacity-100 group-hover/card:opacity-100" aria-label={`Actions for ${workflow.name}`}>
          <MoreHorizontal className="h-4 w-4 rotate-90" />
        </button>
        {open ? (
          <div className="absolute right-0 w-40 overflow-hidden rounded-[18px] border border-[#e5e5e533] bg-[#f6f6f4] p-1 text-[#1b1b18] shadow-lg" style={{ bottom: "calc(100% + 4px)" }}>
            <button type="button" onClick={() => onNavigate(workflowHref(workflow.id))} className="flex h-9 w-full items-center gap-2 rounded-[14px] px-3 text-left text-sm hover:bg-[#eeeeec]"><ExternalLink className="h-4 w-4" /> Open</button>
            <button type="button" onClick={() => { setOpen(false); onRename(workflow); }} className="flex h-9 w-full items-center gap-2 rounded-[14px] px-3 text-left text-sm hover:bg-[#eeeeec]"><Pencil className="h-4 w-4" /> Rename</button>
            <button type="button" onClick={() => { setOpen(false); onDuplicate(workflow); }} className="flex h-9 w-full items-center gap-2 rounded-[14px] px-3 text-left text-sm hover:bg-[#eeeeec]"><Copy className="h-4 w-4" /> Duplicate</button>
            <button type="button" onClick={() => { setOpen(false); onExport(workflow); }} className="flex h-9 w-full items-center gap-2 rounded-[14px] px-3 text-left text-sm hover:bg-[#eeeeec]"><FileJson className="h-4 w-4" /> Export JSON</button>
            <div className="my-1 h-px bg-[#e0e0e2]" />
            <button type="button" onClick={() => { setOpen(false); onDelete(workflow); }} className="flex h-9 w-full items-center gap-2 rounded-[14px] px-3 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</button>
          </div>
        ) : null}
      </div>

      <div className="mt-2 px-1">
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            defaultValue={workflow.name}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onConfirmRename(workflow.id, e.currentTarget.value);
              } else if (e.key === "Escape") {
                onConfirmRename(workflow.id, workflow.name);
              }
              e.stopPropagation();
            }}
            style={{
              height: "auto",
              width: "100%",
              padding: "2px 8px",
              margin: 0,
              display: "block",
              boxSizing: "border-box",
              fontSize: 14,
              fontWeight: 500,
              fontFamily: '"Google Sans Flex", Inter, sans-serif',
              color: "rgb(61, 61, 65)",
              textAlign: "left",
              lineHeight: "normal",
              backgroundColor: "rgb(244, 244, 244)",
              border: "1px solid rgb(0, 0, 0)",
              borderRadius: 6,
              outline: "none",
              boxShadow: "none",
              transition: "all 0.15s ease-in-out",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgb(99, 102, 241)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgb(27, 27, 24)";
              onConfirmRename(workflow.id, e.currentTarget.value);
            }}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <button type="button" onClick={() => onNavigate(workflowHref(workflow.id))} className="block truncate text-sm font-medium leading-5 text-[#1b1b18] hover:text-[#4f46e5]">
            {workflow.name}
          </button>
        )}
        <div className="mt-0.5 text-xs leading-4 text-[#737373]">Edited {formatRelativeTime(workflow.updatedAt)}</div>
      </div>

    </div>
  );
}

export default function FlowPage() {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<WorkflowListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const [navigating, setNavigating] = useState(false);
  const [trialPickerOpen, setTrialPickerOpen] = useState(false);
  const [cloningTrial, setCloningTrial] = useState(false);
  const [renamingWorkflowId, setRenamingWorkflowId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const navOverlayRef = useRef<HTMLDivElement>(null);

  const loadWorkflows = useCallback(async ({ background = false }: { background?: boolean } = {}) => {
    if (!background) setLoading(true);
    let lastError: unknown;
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await fetch("/api/workflows", { cache: "no-store" });
          const json = await readJsonResponse<{ workflows?: WorkflowListItem[]; error?: string }>(response);
          if (!response.ok) throw new Error(json.error ?? `Failed to load workflows (${response.status})`);
          setWorkflows(json.workflows ?? []);
          return;
        } catch (error) {
          lastError = error;
          if (attempt < 2) await wait(500 * (attempt + 1));
        }
      }
      throw lastError;
    } catch (error) {
      if (!background) toast({ description: error instanceof Error ? error.message : "Failed to load workflows" });
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageLoading(false);
    img.onerror = () => setImageLoading(false);
    img.src = TRIAL_WORKFLOW_IMAGE_SRC;
    return () => { img.onload = null; img.onerror = null; };
  }, []);

  useEffect(() => {
    console.log("[Py] Candidate LinkedIn: https://www.linkedin.com/in/raunak-lanjewar/");
    const frame = requestAnimationFrame(() => {
      void loadWorkflows();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadWorkflows]);

  useEffect(() => {
    if (!workflows.some((workflow) => workflow.status === "RUNNING")) return;
    const interval = window.setInterval(() => {
      void loadWorkflows({ background: true });
    }, 2500);
    return () => window.clearInterval(interval);
  }, [loadWorkflows, workflows]);

  useEffect(() => {
    if (!deleteTarget) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDeleteTarget(null);
      if (e.key === "Enter" && deleteTarget && !deletingRef.current) confirmDelete();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [deleteTarget]);

  const navigateTo = (href: string) => {
    setNavigating(true);
    navOverlayRef.current?.classList.remove("hidden");
    requestAnimationFrame(() => {
      window.location.href = href;
    });
  };

  const cloneTrialWorkflow = async () => {
    setCloningTrial(true);
    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Trial Task Workflow Copy",
          nodes: sampleWorkflowNodes,
          edges: sampleWorkflowEdges,
        }),
      });
      const json = await readJsonResponse<{ workflow?: WorkflowListItem; error?: string }>(response);
      if (!response.ok || !json.workflow) throw new Error(json.error ?? "Failed to create workflow");
      setTrialPickerOpen(false);
      navigateTo(workflowHref(json.workflow.id));
    } catch (error) {
      toast({ description: error instanceof Error ? error.message : "Failed to create workflow" });
      setCloningTrial(false);
    }
  };

  const filteredWorkflows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return workflows;
    return workflows.filter((workflow) => workflow.name.toLowerCase().includes(normalized));
  }, [query, workflows]);

  const createWorkflow = async (name = "Untitled Workflow", nodes?: unknown, edges?: unknown, nodeValues?: unknown) => {
    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, nodes, edges, nodeValues }),
      });
      const json = await readJsonResponse<{ workflow?: WorkflowListItem; error?: string }>(response);
      if (!response.ok || !json.workflow) throw new Error(json.error ?? "Failed to create workflow");
      navigateTo(workflowHref(json.workflow.id));
    } catch (error) {
      toast({ description: error instanceof Error ? error.message : "Failed to create workflow" });
    }
  };

  const renameWorkflow = (workflow: WorkflowListItem) => {
    setRenamingWorkflowId(workflow.id);
  };

  const confirmRename = async (workflowId: string, name: string) => {
    setRenamingWorkflowId(null);
    if (!name.trim()) return;
    try {
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await readJsonResponse<{ workflow?: WorkflowListItem; error?: string }>(response);
      if (!response.ok || !json.workflow) throw new Error(json.error ?? "Failed to rename workflow");
      setWorkflows((current) => current.map((item) => item.id === workflowId ? { ...item, name: json.workflow!.name, updatedAt: json.workflow!.updatedAt } : item));
    } catch (error) {
      toast({ description: error instanceof Error ? error.message : "Failed to rename workflow" });
    }
  };

  const duplicateWorkflow = async (workflow: WorkflowListItem) => {
    setDuplicating(true);
    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceWorkflowId: workflow.id }),
      });
      const json = await readJsonResponse<{ workflow?: WorkflowListItem; error?: string }>(response);
      if (!response.ok || !json.workflow) throw new Error(json.error ?? "Failed to duplicate workflow");
      setWorkflows((current) => [json.workflow!, ...current]);
    } catch (error) {
      toast({ description: error instanceof Error ? error.message : "Failed to duplicate workflow" });
    } finally {
      setDuplicating(false);
    }
  };

  const deleteWorkflow = (workflow: WorkflowListItem) => {
    setDeleteTarget(workflow);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    try {
      const response = await fetch(`/api/workflows/${deleteTarget.id}`, { method: "DELETE" });
      const json = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(json.error ?? "Failed to delete workflow");
      setWorkflows((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      toast({ description: error instanceof Error ? error.message : "Failed to delete workflow" });
      setDeleteTarget(null);
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  const exportWorkflow = (workflow: WorkflowListItem) => {
    downloadJson(`${workflow.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "workflow"}.json`, workflow);
  };

  const handleCoverUpdate = async (workflowId: string, url: string) => {
    try {
      await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeValues: { __cover__: url } }),
      });
      setWorkflows((current) => current.map((item) =>
        item.id === workflowId ? { ...item, nodeValues: { ...(item.nodeValues as Record<string, unknown>), __cover__: url } } : item,
      ));
    } catch {
      toast({ description: "Failed to save cover image" });
    }
  };

  const importWorkflow = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { name?: string; nodes?: unknown; edges?: unknown; nodeValues?: unknown; viewport?: unknown };
      console.log("[Py] Import workflow data:", { name: parsed.name, hasNodes: Array.isArray(parsed.nodes), nodeCount: Array.isArray(parsed.nodes) ? parsed.nodes.length : 0, hasEdges: Array.isArray(parsed.edges) });
      await createWorkflow(
        parsed.name ? `${parsed.name} Import` : "Imported Workflow",
        parsed.nodes,
        parsed.edges,
        parsed.nodeValues,
      );
    } catch {
      toast({ description: "Choose a valid workflow JSON file." });
    }
  };

  return (
    <>
      <ReactFlowProvider>
        <main className="h-screen bg-white text-[#1b1b18]">
          <Toaster />
          <div className={`flex h-screen w-full overflow-hidden ${loading || imageLoading || navigating ? "blur-sm" : ""}`}>
          <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

          <section className="flex min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#f9f9f9]">
          <div className="min-h-full w-full bg-[#f9f9f9] px-4 pt-4 sm:px-6 sm:pt-6 md:pl-[60px] md:pr-[60px] md:pt-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2">
                <button type="button" onClick={() => setSidebarOpen(true)} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#737373] transition-colors hover:bg-[#eeeeec] hover:text-[#1b1b18] md:hidden ${sidebarOpen ? "hidden" : ""}`} aria-label="Open sidebar">
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.02em] text-[#3d3d41]">Flow</h1>
                  <p className="text-sm font-normal leading-5 text-[#737373]">Build workflows or run models directly</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={importWorkflow} />
                <button type="button" onClick={() => importInputRef.current?.click()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#f5f5f5] px-3 text-sm font-semibold leading-5 text-[#3d3d41] transition-colors hover:bg-[#eeeeec] disabled:opacity-40 sm:px-3" title="Import workflow JSON">
                  <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Import</span>
                </button>
                <button type="button" onClick={() => void createWorkflow()} className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#444444] text-white transition-colors hover:opacity-90 disabled:opacity-40" title="Create a new workflow">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <section className="mt-10">
              <div className="flex items-start justify-between gap-2 sm:items-center">
                <div>
                  <h2 className="text-base font-medium leading-6 text-[#3d3d41]">System Workflows</h2>
                  <p className="text-sm leading-5 text-[#737373]">Prebuilt workflow templates - click to open and start using.</p>
                </div>
              </div>
              <div className="mt-6 flex gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-7">
                <button type="button" onClick={() => setTrialPickerOpen(true)} className="group w-[75vw] flex-none overflow-hidden rounded-[16px] border-[0.5px] border-[#e0e0e2] bg-[#f4f4f4] text-left transition-colors hover:border-[#c9c9cd] sm:w-72 lg:w-80">
                  <div className="aspect-[320/217] w-full overflow-hidden">
                    <WorkflowPreview large coverUrl={TRIAL_WORKFLOW_IMAGE_SRC} />
                  </div>
                  <div className="px-3 py-2.5 text-sm font-medium leading-5 text-[#1b1b18] sm:px-4 sm:py-3">Trial Task Workflow</div>
                </button>
              </div>
            </section>

            <section className="mt-10">
              <div className="flex items-start justify-between gap-3 sm:items-center">
                <div>
                  <h2 className="text-base font-medium leading-6 text-[#3d3d41]">Your Workflows</h2>
                  <p className="text-sm leading-5 text-[#737373]">Open one to edit, run, and review history.</p>
                </div>
                <div className="relative w-full sm:max-w-[264px]">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8e8e93]" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workflows..." className="h-10 w-full rounded-xl border-[0.5px] border-[#e0e0e2] bg-[#f4f4f4] pl-11 pr-3 text-base font-medium leading-6 text-[#3d3d41] outline-none transition-colors placeholder:text-[#a1a1aa] focus:border-[#c9c9cd]" />
                </div>
              </div>

              {loading ? (
                <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(250px,250px))] gap-x-[69px] gap-y-8">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="w-full animate-pulse max-sm:max-w-full">
                      <div className="aspect-[250/162] rounded-[16px] bg-[#eeeeec]" />
                      <div className="mt-2 h-4 w-3/4 rounded bg-[#eeeeec]" />
                      <div className="mt-1 h-3 w-1/3 rounded bg-[#eeeeec]" />
                    </div>
                  ))}
                </div>
              ) : workflows.length === 0 ? (
                <div className="mt-12 flex flex-col items-center justify-center text-center">
                  <div className="text-base font-medium leading-6 text-[#3d3d41]">No workflows yet</div>
                  <div className="mt-1 text-sm font-medium leading-5 text-[#858589]">Create your first workflow to start building.</div>
                  <button type="button" onClick={() => void createWorkflow()} className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-[#444444] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#333333]">
                    Create workflow
                  </button>
                </div>
              ) : filteredWorkflows.length === 0 ? (
                <div className="mt-12 rounded-[16px] border-[0.5px] border-[#e0e0e2] bg-[#f4f4f4] px-6 py-8 text-left">
                  <h3 className="text-xl font-medium leading-7 text-[#1f2933]">No workflows found</h3>
                  <p className="mt-2 text-base leading-6 text-[#6b7280]">Try a different search term.</p>
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(250px,250px))] gap-x-[69px] gap-y-9 max-lg:gap-x-10 max-md:gap-x-6 max-sm:grid-cols-1 max-sm:gap-y-7">
                  {filteredWorkflows.map((workflow) => (
                    <WorkflowCard key={workflow.id} workflow={workflow} onRename={renameWorkflow} onDuplicate={duplicateWorkflow} onDelete={deleteWorkflow} onExport={exportWorkflow} onCoverUpdate={handleCoverUpdate} onNavigate={navigateTo} renamingWorkflowId={renamingWorkflowId} onConfirmRename={confirmRename} />
                  ))}
                </div>
              )}
            </section>
            <div className="h-16" />
          </div>
          </section>
        </div>
      </main>
    </ReactFlowProvider>
      <div ref={navOverlayRef} className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md ${loading || imageLoading || navigating || duplicating ? "" : "hidden"}`}>
        <Loader2 className="h-8 w-8 animate-spin text-[#444444]" style={{ animationDuration: "0.5s" }} />
      </div>

      {trialPickerOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/80" onClick={() => { if (!cloningTrial) setTrialPickerOpen(false); }} />
          <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-[#e5e5e5] bg-[#fafaf9] p-6 shadow-lg sm:rounded-[18px]">
            <h2 className="text-lg font-semibold text-[#1b1b18]">Trial Task Workflow</h2>
            <p className="text-sm leading-5 text-[#737373]">This is a read-only template. Create your own copy to edit and run.</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void cloneTrialWorkflow()}
                disabled={cloningTrial}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[18px] bg-[#444444] px-4 text-sm font-medium text-white transition-colors hover:bg-[#333333] disabled:opacity-70"
              >
                {cloningTrial ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileOutput className="h-4 w-4" />
                )}
                Open a clone
              </button>
              <button
                type="button"
                onClick={() => setTrialPickerOpen(false)}
                disabled={cloningTrial}
                className="h-10 flex-1 rounded-[18px] border border-[#e5e7eb] bg-[#fafaf9] px-4 text-sm font-medium text-[#1b1b18] transition-colors hover:bg-[#eeeeec] disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {deleteTarget && (
        <>
          <div className="fixed inset-0 z-50 bg-black/80" onClick={() => setDeleteTarget(null)} />
          <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-[#e5e5e5] bg-[#fafaf9] p-6 shadow-lg sm:rounded-[18px]">
            <h2 className="text-lg font-semibold text-[#1b1b18]">Delete Workflow</h2>
            <p className="text-sm text-[#737373]">
              Are you sure you want to delete &ldquo;{deleteTarget.name}&rdquo;? This action cannot be undone.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-9 rounded-[18px] border border-[#e5e7eb] bg-[#fafaf9] px-4 text-sm font-medium text-[#1b1b18]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="ml-2 inline-flex h-9 items-center gap-1.5 rounded-[18px] bg-red-600 px-4 text-sm font-medium text-white disabled:opacity-70"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
