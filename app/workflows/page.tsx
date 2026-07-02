"use client";

import Link from "next/link";
import { ArrowRight, Clock, Copy, Edit3, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

type DemoWorkflow = {
  id: string;
  name: string;
  updatedAt: string;
  status: string;
};

const initialWorkflows: DemoWorkflow[] = [
  { id: "trial-task-workflow", name: "Trial Task Workflow", updatedAt: "Just now", status: "Ready" },
  { id: "sample-product-post", name: "Product Marketing Post", updatedAt: "12 min ago", status: "Draft" },
];

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<DemoWorkflow[]>(initialWorkflows);

  const createWorkflow = () => {
    const id = `workflow-${Date.now().toString(36)}`;
    setWorkflows((current) => [{ id, name: "Untitled Workflow", updatedAt: "Just now", status: "Draft" }, ...current]);
  };

  const renameWorkflow = (id: string, currentName: string) => {
    const next = window.prompt("Rename workflow", currentName)?.trim();
    if (!next) return;
    setWorkflows((current) => current.map((workflow) => workflow.id === id ? { ...workflow, name: next, updatedAt: "Just now" } : workflow));
  };

  const duplicateWorkflow = (workflow: DemoWorkflow) => {
    setWorkflows((current) => [{ ...workflow, id: `workflow-${Date.now().toString(36)}`, name: `${workflow.name} Copy`, updatedAt: "Just now", status: "Draft" }, ...current]);
  };

  const deleteWorkflow = (id: string) => {
    setWorkflows((current) => current.filter((workflow) => workflow.id !== id));
  };

  return (
    <main className="min-h-screen bg-[#f4f4f4] text-[#1b1b18]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[252px] border-r border-gray-200 bg-white/80 p-4 backdrop-blur md:block">
          <div className="mb-8 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6366f1] text-sm font-semibold text-white">Py</div>
            <div>
              <div className="text-sm font-semibold">Py Workflows</div>
              <div className="text-xs text-gray-400">Galaxy-style builder</div>
            </div>
          </div>
          <nav className="space-y-1 text-sm">
            <div className="rounded-xl bg-gray-100 px-3 py-2 font-medium text-gray-900">Workflows</div>
            <div className="px-3 py-2 text-gray-500">History</div>
            <div className="px-3 py-2 text-gray-500">Settings</div>
          </nav>
        </aside>

        <section className="flex-1 p-6 md:p-10">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-950">Workflows</h1>
                <p className="mt-1 text-sm text-gray-500">Create, open, rename, and delete workflows for this local demo.</p>
              </div>
              <button type="button" onClick={createWorkflow} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#4f46e5]">
                <Plus size={16} strokeWidth={2} className="h-4 w-4" />
                Create New Workflow
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4">
                <div className="text-sm font-semibold text-gray-900">Your workflows</div>
              </div>

              {workflows.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
                    <Plus size={20} strokeWidth={2} />
                  </div>
                  <div className="text-sm font-medium text-gray-900">No workflows yet</div>
                  <p className="mt-1 text-sm text-gray-500">Create your first workflow to open the canvas.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {workflows.map((workflow) => (
                    <div key={workflow.id} className="flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-gray-50 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link href={`/workflows/${workflow.id}/canvas`} className="truncate text-sm font-medium text-gray-950 hover:text-[#6366f1]">
                            {workflow.name}
                          </Link>
                          <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">{workflow.status}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                          <Clock size={12} strokeWidth={2} className="h-3 w-3" />
                          Last edited {workflow.updatedAt}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/workflows/${workflow.id}/canvas`} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-100">
                          Open <ArrowRight size={13} strokeWidth={2} className="h-3.5 w-3.5" />
                        </Link>
                        <button type="button" onClick={() => renameWorkflow(workflow.id, workflow.name)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-100">
                          <Edit3 size={13} strokeWidth={2} className="h-3.5 w-3.5" /> Rename
                        </button>
                        <button type="button" onClick={() => duplicateWorkflow(workflow)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-100">
                          <Copy size={13} strokeWidth={2} className="h-3.5 w-3.5" /> Duplicate
                        </button>
                        <button type="button" onClick={() => deleteWorkflow(workflow.id)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50">
                          <Trash2 size={13} strokeWidth={2} className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
