"use client";

import React, { useEffect, useState } from "react";
import { Plus, Search, MessageSquareMore, FolderOpen, Library, Boxes, BookOpen, Settings, PanelLeftOpen, PanelLeftClose, Gift, ChevronDown, ChevronUp } from "lucide-react";
import { IconArrowsSplit } from "@tabler/icons-react";
import { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_EXPANDED_WIDTH } from "../_lib/constants";
import { HoverTooltip } from "./tooltips";
export const quickActions = [
  { icon: Plus, label: "New task", shortcut: "CtrlShift+O" },
  { icon: Search, label: "Search tasks", shortcut: "CtrlK" },
];

export const mainNavItems = [
  { icon: MessageSquareMore, label: "Tasks", href: "/app/chat/recent" },
  { icon: FolderOpen, label: "Projects", href: "/app/chat/projects" },
  { icon: Library, label: "Library", href: "/app/library" },
  { icon: IconArrowsSplit, label: "Flow", href: "/app/flow" },
  { icon: Boxes, label: "Tools", href: "/app/nodes" },
  { icon: BookOpen, label: "API and MCP", href: "https://magica.com/docs" },
];

export function Sidebar({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const [isMobileSidebar, setIsMobileSidebar] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
  const [footerDetailsOpen, setFooterDetailsOpen] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobileSidebar(event.matches);
      setOpen(false);
    };

    handleChange(media);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [setOpen]);

  const navIconClass = "h-5 w-5 shrink-0 text-[#3d3d41]";
  const navItemClass =
    "chat-sidebar-nav-item group flex w-full items-center gap-[9px] overflow-clip rounded-lg p-2 text-sm font-normal leading-5 tracking-normal text-[#3d3d41] transition-colors hover:bg-[#dadada]";
  const collapsedIconClass =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-[18px] text-sm font-medium leading-5 text-[#3d3d41] transition-colors hover:bg-[#f0f0f0]";

  return (
    <div
      className={`chat-sidebar-shell flex h-full flex-shrink-0 flex-col overflow-hidden transition-[width,min-width,max-width,opacity,transform] duration-200 ease-in-out ${
        isMobileSidebar ? "fixed inset-y-0 left-0 z-50" : "relative"
      }`}
      style={{
        width: isMobileSidebar ? 0.5 : open ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH,
        minWidth: isMobileSidebar ? 0 : undefined,
        backgroundColor: "rgb(240, 240, 240)",
        borderRight: "0.5px solid rgb(224, 224, 226)",
      }}
    >
      {/* 1. Shrunk state */}
      <div
        className={`group/sidebar h-full flex-col items-center ${open || isMobileSidebar ? "hidden" : "flex visible"}`}
        style={{ width: SIDEBAR_COLLAPSED_WIDTH }}
      >
        <HoverTooltip text="Open sidebar" shortcut="Ctrl." side="right" triggerClassName="inline-flex mb-6 mt-2">
          <button
            aria-label="Open sidebar"
            onClick={() => setOpen(true)}
            className="relative inline-flex h-9 w-9 items-center justify-center gap-2 rounded-[18px] text-sm font-medium leading-5 text-[#3d3d41] transition-colors hover:bg-[#f0f0f0]"
          >
            <img
              src="/favicon.ico"
              alt="Magica"
              className="h-5 w-5 object-contain transition-opacity group-hover/sidebar:opacity-0"
            />
            <PanelLeftOpen
              size={20}
              strokeWidth={2}
              className="absolute text-[#3d3d41] opacity-0 transition-opacity group-hover/sidebar:opacity-100"
            />
          </button>
        </HoverTooltip>

        <div className="flex flex-col items-center gap-1">
          {quickActions.map(({ icon: Icon, label, shortcut }) => (
            <HoverTooltip key={label} text={label} shortcut={shortcut} side="right" triggerClassName="inline-flex">
              <button aria-label={label} className={collapsedIconClass}>
                <Icon size={20} strokeWidth={2} className={navIconClass} />
              </button>
            </HoverTooltip>
          ))}
          {mainNavItems.map(({ icon: Icon, label, href }) => {
            const isTasks = label === "Tasks";
            return (
              <HoverTooltip key={label} text={label} side="right" triggerClassName="inline-flex">
                <a aria-label={label} href={href} className={collapsedIconClass}>
                  <Icon
                    size={isTasks ? 18 : 20}
                    strokeWidth={2}
                    className={isTasks ? "h-[18px] w-[18px] shrink-0 text-[#3d3d41]" : navIconClass}
                  />
                </a>
              </HoverTooltip>
            );
          })}
        </div>

        <div className="mt-auto pb-4">
          <HoverTooltip text="Settings" side="right" triggerClassName="inline-flex">
            <button aria-label="Settings" className="inline-flex h-8 w-8 shrink-0 items-center justify-center gap-2 rounded-[18px] text-sm font-medium leading-5 text-[#3d3d41] transition-colors hover:bg-[#f0f0f0]">
              <Settings size={16} strokeWidth={2} className="h-4 w-4 shrink-0 text-[#3d3d41]" />
            </button>
          </HoverTooltip>
        </div>
      </div>

      {/* 2. Expanded state */}
      <div
        className={`h-full flex-col ${open && !isMobileSidebar ? "flex visible" : "hidden"}`}
        style={{ width: SIDEBAR_EXPANDED_WIDTH }}
      >
        <div className="flex h-[52px] shrink-0 items-start justify-between px-4 pt-2">
          <a href="/app" className="flex h-9 w-[104px] items-center">
            <img
              src="/galaxy.webp"
              alt="Magica"
              className="block h-[26px] w-[104px] object-contain"
            />
          </a>
          <HoverTooltip text="Close sidebar" shortcut="Ctrl." side="bottom" triggerClassName="inline-flex">
            <button
              aria-label="Close sidebar"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center gap-2 rounded-[18px] text-sm font-medium leading-5 text-[#3d3d41] transition-colors hover:bg-[#f0f0f0]"
            >
              <PanelLeftClose size={20} strokeWidth={2} className="!h-5 !w-5" />
            </button>
          </HoverTooltip>
        </div>

        <div className="flex flex-col gap-1 px-2 pb-1">
          {quickActions.map(({ icon: Icon, label, shortcut }) => (
            <button key={label} className={navItemClass}>
              <span className="flex items-center gap-[9px]">
                <Icon size={20} strokeWidth={2} className={navIconClass} />
                <span className="truncate text-left">{label}</span>
              </span>
              <span className="text-[10px] font-normal leading-5 text-[#a3a3a7] opacity-0 transition-opacity group-hover:opacity-100">
                {shortcut}
              </span>
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 pb-2 [scrollbar-width:thin]">
          <div className="flex flex-col gap-1">
            {mainNavItems.map(({ icon: Icon, label, href }) => {
              const isTasks = label === "Tasks";
              return (
                <a key={label} href={href} className={navItemClass}>
                  <span className="flex items-center gap-[9px]">
                    <Icon
                      size={isTasks ? 18 : 20}
                      strokeWidth={2}
                      className={isTasks ? "h-[18px] w-[18px] shrink-0 text-[#3d3d41]" : navIconClass}
                    />
                    <span className="truncate">{label}</span>
                  </span>
                </a>
              );
            })}
          </div>
          <div className="px-3 py-8 text-center text-sm font-normal leading-5 text-[#a3a3a7]">No tasks yet</div>
        </div>

        <div className="relative z-10 flex-shrink-0 bg-[rgb(240,240,240)] px-2">
          <div
            data-testid="sidebar-footer"
            className={`overflow-hidden transition-all duration-300 ease-in-out ${footerDetailsOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}`}
          >
            <div className="space-y-3" data-testid="auth-section">
              <div className="relative w-full">
                <button className="inline-flex h-8 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-[18px] border border-gray-200 bg-white px-3 text-xs font-medium leading-4 text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
                  <Settings size={16} strokeWidth={2} className="h-3.5 w-3.5 shrink-0" />
                  <span>Settings</span>
                </button>
              </div>
              <button className="relative inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-[18px] bg-indigo-600/90 px-4 py-2 text-sm font-medium leading-5 text-white shadow-lg transition-all duration-300 before:absolute before:inset-0 before:translate-x-[-200%] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:transition-transform before:duration-1000 before:ease-in-out hover:bg-indigo-700 hover:shadow-xl hover:before:translate-x-[200%] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
                <Gift size={16} strokeWidth={2} className="h-4 w-4 shrink-0 text-[#3d3d41]" />
                <span>Claim Offer</span>
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200">
            <HoverTooltip text={footerDetailsOpen ? "Hide sidebar details" : "Show sidebar details"} side="top" triggerClassName="block">
              <button
                aria-label={footerDetailsOpen ? "Hide sidebar details" : "Show sidebar details"}
                onClick={() => setFooterDetailsOpen((open) => !open)}
                className="flex h-5 w-full items-center justify-center py-1 text-gray-400 transition-all hover:bg-gray-50 hover:text-gray-600"
              >
                {footerDetailsOpen ? (
                  <ChevronDown size={12} strokeWidth={2} className="h-3 w-3" />
                ) : (
                  <ChevronUp size={12} strokeWidth={2} className="h-3 w-3" />
                )}
              </button>
            </HoverTooltip>
            <div className="flex items-center justify-center px-4 py-2">
              <HoverTooltip text="Open user menu" side="top" triggerClassName="inline-flex">
                <button aria-label="Open user menu" className="cl-userButtonTrigger flex h-7 items-center justify-center rounded-md text-[13px] font-medium leading-[18px] text-[#212126]">
                  <span className="flex h-7 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-300 text-xs font-medium text-gray-600">
                      R
                    </span>
                    <span className="block truncate pl-2 text-[13px] font-medium leading-[18px] text-black">
                      Raunak Lanjewar
                    </span>
                  </span>
                </button>
              </HoverTooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

