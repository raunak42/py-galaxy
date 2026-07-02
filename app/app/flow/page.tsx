"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  FileJson,
  Upload,
  Loader2,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Workflow,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { toast, Toaster } from "@/lib/toast";
import { Sidebar } from "@/app/workflows/[workflow_id]/canvas/_components/sidebar";

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
  const nodeValueImage = typeof (workflow.nodeValues as Record<string, Record<string, unknown>> | undefined)?.["request-inputs"]?.image_field === "string"
    ? (workflow.nodeValues as Record<string, Record<string, string>>)["request-inputs"].image_field
    : "";
  if (nodeValueImage) return nodeValueImage;

  const requestNode = Array.isArray(workflow.nodes)
    ? workflow.nodes.find((node): node is { data?: { fields?: Array<{ id?: string; value?: unknown }> } } => typeof node === "object" && node !== null && "data" in node)
    : undefined;
  const imageField = requestNode?.data?.fields?.find((field) => field.id === "image_field");
  return typeof imageField?.value === "string" ? imageField.value : "";
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

function WorkflowPreview({ large = false, coverUrl = "" }: { large?: boolean; coverUrl?: string }) {
  if (coverUrl) {
    return <img src={coverUrl} alt="Workflow cover" className="h-full w-full object-cover" />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f6f6f4]">
      <div className="absolute inset-0 opacity-[0.55]" style={{ backgroundImage: "radial-gradient(#d8d8dc 1px, transparent 1px)", backgroundSize: large ? "18px 18px" : "14px 14px" }} />
      <div className="absolute left-[10%] top-[18%] h-10 w-24 rounded-[14px] border border-[#e0e0e2] bg-white shadow-sm" />
      <div className="absolute left-[39%] top-[15%] h-9 w-28 rounded-[14px] border border-[#e0e0e2] bg-white shadow-sm" />
      <div className="absolute left-[64%] top-[24%] h-10 w-24 rounded-[14px] border border-[#e0e0e2] bg-white shadow-sm" />
      <div className="absolute left-[25%] top-[52%] h-9 w-24 rounded-[14px] border border-[#e0e0e2] bg-white shadow-sm" />
      <div className="absolute left-[56%] top-[58%] h-10 w-28 rounded-[14px] border border-[#e0e0e2] bg-white shadow-sm" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 190" preserveAspectRatio="none" aria-hidden="true">
        <path d="M70 55 C130 45 140 50 190 52" fill="none" stroke="#8b5cf6" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M220 62 C252 74 250 84 278 88" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M112 110 C160 95 170 110 210 122" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <div className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-[#3d3d41] shadow-sm backdrop-blur">
        <Sparkles className="h-3 w-3 text-[#4f46e5]" /> Py Flow
      </div>
    </div>
  );
}

function WorkflowCard({ workflow, onRename, onDuplicate, onDelete, onExport }: {
  workflow: WorkflowListItem;
  onRename: (workflow: WorkflowListItem) => void;
  onDuplicate: (workflow: WorkflowListItem) => void;
  onDelete: (workflow: WorkflowListItem) => void;
  onExport: (workflow: WorkflowListItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const coverUrl = getWorkflowCoverImage(workflow);

  return (
    <div className="group/card relative w-full max-w-[250px]">
      <div className="relative aspect-[250/162] overflow-hidden rounded-[16px] border-[0.5px] border-[#e0e0e2] bg-white transition-colors group-hover/card:border-[#cfcfd3]">
        <Link href={workflowHref(workflow.id)} className="block h-full w-full" aria-label={`Open ${workflow.name}`}>
          <WorkflowPreview coverUrl={coverUrl} />
        </Link>
        <Link href={workflowHref(workflow.id)} className="absolute left-2 top-2 rounded-md bg-white/80 p-1 text-[#737373] opacity-0 transition-all hover:bg-white hover:text-[#1b1b18] focus:opacity-100 group-hover/card:opacity-100" aria-label={`Open ${workflow.name}`}>
          <Workflow className="h-4 w-4" />
        </Link>
        <button type="button" onClick={() => setOpen((value) => !value)} className="absolute right-2 top-2 rounded-md bg-white/80 p-1 text-[#737373] opacity-0 transition-all hover:bg-white hover:text-[#1b1b18] focus:opacity-100 group-hover/card:opacity-100" aria-label={`Actions for ${workflow.name}`}>
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {workflow.status === "RUNNING" ? (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
            <Loader2 className="h-3 w-3 animate-spin" /> Running
          </span>
        ) : null}
      </div>

      <div className="mt-2 px-1">
        <Link href={workflowHref(workflow.id)} className="block truncate text-sm font-medium leading-5 text-[#1b1b18] hover:text-[#4f46e5]">
          {workflow.name}
        </Link>
        <div className="mt-0.5 text-xs leading-4 text-[#737373]">Edited {formatRelativeTime(workflow.updatedAt)}</div>
      </div>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-40 overflow-hidden rounded-[18px] border border-[#e5e5e533] bg-[#f6f6f4] p-1 text-[#1b1b18] shadow-lg">
          <Link href={workflowHref(workflow.id)} className="flex h-9 items-center gap-2 rounded-[14px] px-3 text-sm hover:bg-[#eeeeec]">Open</Link>
          <button type="button" onClick={() => { setOpen(false); onRename(workflow); }} className="flex h-9 w-full items-center gap-2 rounded-[14px] px-3 text-left text-sm hover:bg-[#eeeeec]"><Pencil className="h-4 w-4" /> Rename</button>
          <button type="button" onClick={() => { setOpen(false); onDuplicate(workflow); }} className="flex h-9 w-full items-center gap-2 rounded-[14px] px-3 text-left text-sm hover:bg-[#eeeeec]"><Copy className="h-4 w-4" /> Duplicate</button>
          <button type="button" onClick={() => { setOpen(false); onExport(workflow); }} className="flex h-9 w-full items-center gap-2 rounded-[14px] px-3 text-left text-sm hover:bg-[#eeeeec]"><FileJson className="h-4 w-4" /> Export JSON</button>
          <div className="my-1 h-px bg-[#e0e0e2]" />
          <button type="button" onClick={() => { setOpen(false); onDelete(workflow); }} className="flex h-9 w-full items-center gap-2 rounded-[14px] px-3 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</button>
        </div>
      ) : null}
    </div>
  );
}

export default function FlowPage() {
  const router = useRouter();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/workflows", { cache: "no-store" });
      const json = await readJsonResponse<{ workflows?: WorkflowListItem[]; error?: string }>(response);
      if (!response.ok) throw new Error(json.error ?? "Failed to load workflows");
      setWorkflows(json.workflows ?? []);
    } catch (error) {
      toast({ description: error instanceof Error ? error.message : "Failed to load workflows" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("[Py] Candidate LinkedIn: https://www.linkedin.com/in/raunak-lanjewar/");
    const frame = requestAnimationFrame(() => {
      void loadWorkflows();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const filteredWorkflows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return workflows;
    return workflows.filter((workflow) => workflow.name.toLowerCase().includes(normalized));
  }, [query, workflows]);

  const createWorkflow = async (name = "Untitled Workflow") => {
    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await readJsonResponse<{ workflow?: WorkflowListItem; error?: string }>(response);
      if (!response.ok || !json.workflow) throw new Error(json.error ?? "Failed to create workflow");
      router.push(workflowHref(json.workflow.id));
    } catch (error) {
      toast({ description: error instanceof Error ? error.message : "Failed to create workflow" });
    }
  };

  const renameWorkflow = async (workflow: WorkflowListItem) => {
    const next = window.prompt("Rename workflow", workflow.name)?.trim();
    if (!next) return;
    try {
      const response = await fetch(`/api/workflows/${workflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      const json = await readJsonResponse<{ workflow?: WorkflowListItem; error?: string }>(response);
      if (!response.ok || !json.workflow) throw new Error(json.error ?? "Failed to rename workflow");
      setWorkflows((current) => current.map((item) => item.id === workflow.id ? { ...item, name: json.workflow!.name, updatedAt: json.workflow!.updatedAt } : item));
    } catch (error) {
      toast({ description: error instanceof Error ? error.message : "Failed to rename workflow" });
    }
  };

  const duplicateWorkflow = async (workflow: WorkflowListItem) => {
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
    }
  };

  const deleteWorkflow = async (workflow: WorkflowListItem) => {
    if (!window.confirm(`Delete “${workflow.name}”?`)) return;
    try {
      const response = await fetch(`/api/workflows/${workflow.id}`, { method: "DELETE" });
      const json = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(json.error ?? "Failed to delete workflow");
      setWorkflows((current) => current.filter((item) => item.id !== workflow.id));
    } catch (error) {
      toast({ description: error instanceof Error ? error.message : "Failed to delete workflow" });
    }
  };

  const exportWorkflow = (workflow: WorkflowListItem) => {
    downloadJson(`${workflow.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "workflow"}.json`, workflow);
  };

  const importWorkflow = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { name?: string };
      await createWorkflow(parsed.name ? `${parsed.name} Import` : "Imported Workflow");
    } catch {
      toast({ description: "Choose a valid workflow JSON file." });
    }
  };

  return (
    <ReactFlowProvider>
      <main className="h-screen bg-white text-[#1b1b18]">
        <Toaster />
        <div className="flex h-screen w-full overflow-hidden">
          <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

          <section className="flex min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#f9f9f9]">
          <div className="min-h-full w-full bg-[#f9f9f9] pb-8 pl-[60px] pr-[60px] pt-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2">
                <button type="button" onClick={() => setSidebarOpen(true)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#737373] transition-colors hover:bg-[#eeeeec] hover:text-[#1b1b18] md:hidden" aria-label="Open sidebar">
                  <PanelLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.02em] text-[#3d3d41]">Flow</h1>
                  <p className="text-sm font-normal leading-5 text-[#737373]">Build workflows or run models directly</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={importWorkflow} />
                <button type="button" onClick={() => importInputRef.current?.click()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#f5f5f5] px-3 text-sm font-semibold leading-5 text-[#3d3d41] transition-colors hover:bg-[#eeeeec] disabled:opacity-40" title="Import workflow JSON">
                  <Upload className="h-4 w-4" /> Import
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
              <div className="mt-6 flex gap-7 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button type="button" onClick={() => void createWorkflow("Trial Task Workflow")} className="group w-[80vw] max-w-xs flex-none overflow-hidden rounded-[16px] border-[0.5px] border-[#e0e0e2] bg-[#f4f4f4] text-left transition-colors hover:border-[#c9c9cd] sm:w-72 lg:w-80">
                  <div className="aspect-[320/217] w-full overflow-hidden">
                    <WorkflowPreview large coverUrl={getWorkflowCoverImage(workflows.find((workflow) => workflow.name === "Trial Task Workflow") ?? workflows[0] ?? { id: "", name: "", updatedAt: "", status: "READY" })} />
                  </div>
                  <div className="px-4 py-3 text-sm font-medium leading-5 text-[#1b1b18]">Trial Task Workflow</div>
                </button>
              </div>
            </section>

            <section className="mt-10">
              <div className="flex items-start justify-between gap-3 sm:items-center">
                <div>
                  <h2 className="text-base font-medium leading-6 text-[#3d3d41]">Your Workflows</h2>
                  <p className="text-sm leading-5 text-[#737373]">Open one to edit, run, and review history.</p>
                </div>
                <div className="relative w-full max-w-[264px] shrink-0">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8e8e93]" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workflows..." className="h-10 w-full rounded-xl border-[0.5px] border-[#e0e0e2] bg-[#f4f4f4] pl-11 pr-3 text-base font-medium leading-6 text-[#3d3d41] outline-none transition-colors placeholder:text-[#a1a1aa] focus:border-[#c9c9cd]" />
                </div>
              </div>

              {loading ? (
                <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(250px,250px))] gap-x-[69px] gap-y-8">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="w-full max-w-[250px] animate-pulse">
                      <div className="aspect-[250/162] rounded-[16px] bg-[#eeeeec]" />
                      <div className="mt-2 h-4 w-3/4 rounded bg-[#eeeeec]" />
                      <div className="mt-1 h-3 w-1/3 rounded bg-[#eeeeec]" />
                    </div>
                  ))}
                </div>
              ) : workflows.length === 0 ? (
                <div className="mt-12 rounded-[16px] border-[0.5px] border-[#e0e0e2] bg-[#f4f4f4] px-6 py-8 text-left">
                  <h3 className="text-xl font-medium leading-7 text-[#1f2933]">No workflows yet</h3>
                  <p className="mt-2 text-base leading-6 text-[#6b7280]">Create your first workflow to start building.</p>
                  <button type="button" onClick={() => void createWorkflow()} className="mt-6 inline-flex h-12 items-center justify-center rounded-[12px] bg-[#444444] px-6 text-base font-semibold text-white transition-colors hover:bg-[#333333]">
                    Create workflow
                  </button>
                </div>
              ) : filteredWorkflows.length === 0 ? (
                <div className="mt-12 rounded-[16px] border-[0.5px] border-[#e0e0e2] bg-[#f4f4f4] px-6 py-8 text-left">
                  <h3 className="text-xl font-medium leading-7 text-[#1f2933]">No workflows found</h3>
                  <p className="mt-2 text-base leading-6 text-[#6b7280]">Try a different search term.</p>
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(250px,250px))] gap-x-[69px] gap-y-9 max-[700px]:grid-cols-1 max-[700px]:gap-y-7">
                  {filteredWorkflows.map((workflow) => (
                    <WorkflowCard key={workflow.id} workflow={workflow} onRename={renameWorkflow} onDuplicate={duplicateWorkflow} onDelete={deleteWorkflow} onExport={exportWorkflow} />
                  ))}
                </div>
              )}
            </section>
          </div>
          </section>
        </div>
      </main>
    </ReactFlowProvider>
  );
}
