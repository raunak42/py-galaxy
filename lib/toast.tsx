"use client";

import { useEffect, useState } from "react";

interface Toast {
  id: string;
  message: string;
}

type Listener = (state: ToastState) => void;

interface ToastState {
  toasts: Toast[];
}

interface CreateToastParams {
  message?: string;
  description?: string;
  duration?: number;
}

let toastIdCounter = 0;
function genId(): string {
  return `toast-${++toastIdCounter}`;
}

let state: ToastState = { toasts: [] };
const listeners = new Set<Listener>();

function dispatch(action: { type: string; toast?: Toast; toastId?: string }) {
  switch (action.type) {
    case "ADD_TOAST": {
      if (!action.toast) return;
      state = {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, 1),
      };
      break;
    }
    case "REMOVE_TOAST": {
      if (!action.toastId) {
        state = { ...state, toasts: [] };
      } else {
        state = {
          ...state,
          toasts: state.toasts.filter((t) => t.id !== action.toastId),
        };
      }
      break;
    }
  }
  listeners.forEach((fn) => fn(state));
}

export function toast(params: CreateToastParams | string) {
  const p: CreateToastParams =
    typeof params === "string" ? { message: params } : params;
  const id = genId();
  const message = p.message || p.description || "";
  const duration = p.duration ?? 3000;

  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  const dismiss = () => {
    if (dismissTimer) clearTimeout(dismissTimer);
    dispatch({ type: "REMOVE_TOAST", toastId: id });
  };

  const t: Toast = { id, message };

  dispatch({ type: "ADD_TOAST", toast: t });

  if (duration > 0) {
    dismissTimer = setTimeout(() => {
      dismiss();
    }, duration);
  }

  return { id, dismiss };
}

export function useToast() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener: Listener = () => forceUpdate((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (id: string) =>
      dispatch({ type: "REMOVE_TOAST", toastId: id }),
  };
}

export function Toaster() {
  const { toasts: items } = useToast();

  return (
    <div className="fixed inset-x-0 bottom-20 z-[10050] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {items.map((item) => (
        <div
          key={item.id}
          className="animate-fade-in w-fit whitespace-pre-line rounded-lg border border-gray-200 bg-white px-4 py-2 text-center text-sm text-[#3d3d41] shadow-xl pointer-events-auto"
          style={{ maxWidth: "min(560px, calc(100vw - 32px))" }}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
