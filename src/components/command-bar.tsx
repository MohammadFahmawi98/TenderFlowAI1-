"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  group: string;
  action: () => void;
  shortcut?: string;
}

export function CommandBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const router = useRouter();

  const commands: CommandItem[] = [
    {
      id: "workspaces",
      label: "Go to Workspaces",
      description: "View all tender workspaces",
      group: "Navigation",
      action: () => router.push("/workspaces"),
    },
    {
      id: "knowledge",
      label: "Go to Knowledge Hub",
      description: "Company intelligence library",
      group: "Navigation",
      action: () => router.push("/knowledge"),
    },
    {
      id: "documents",
      label: "Go to Documents",
      description: "All generated deliverables",
      group: "Navigation",
      action: () => router.push("/documents"),
    },
    {
      id: "organization",
      label: "Go to Organization",
      description: "Company profile and settings",
      group: "Navigation",
      action: () => router.push("/organization"),
    },
    {
      id: "settings",
      label: "Go to Settings",
      description: "Team, roles, and integrations",
      group: "Navigation",
      action: () => router.push("/settings"),
    },
    {
      id: "new-tender",
      label: "Upload New RFP",
      description: "Create a new tender workspace",
      group: "Actions",
      action: () => router.push("/workspaces"),
    },
    {
      id: "add-knowledge",
      label: "Add Knowledge Item",
      description: "Add to company knowledge base",
      group: "Actions",
      action: () => router.push("/knowledge"),
    },
  ];

  const filtered = query
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.description?.toLowerCase().includes(query.toLowerCase()),
      )
    : commands;

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = [];
    acc[cmd.group].push(cmd);
    return acc;
  }, {});

  const flat = Object.values(grouped).flat();

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
      }
      if (!open) return;
      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((v) => Math.min(v + 1, flat.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelected((v) => Math.max(v - 1, 0)); }
      if (e.key === "Enter" && flat[selected]) {
        flat[selected].action();
        setOpen(false);
      }
    },
    [open, flat, selected],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-[20vh] z-50 w-full max-w-xl -translate-x-1/2 rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <span className="text-[16px] text-text-secondary">⌘</span>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search or type a command…"
                className="flex-1 bg-transparent text-[15px] text-text placeholder:text-text-secondary outline-none"
              />
              <kbd className="rounded border border-border bg-white/5 px-2 py-0.5 text-[11px] text-text-secondary">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[360px] overflow-y-auto py-2">
              {flat.length === 0 ? (
                <p className="py-8 text-center text-[14px] text-text-secondary">No results</p>
              ) : (
                Object.entries(grouped).map(([group, items]) => (
                  <div key={group}>
                    <p className="px-5 py-2 text-[11px] uppercase tracking-widest text-text-secondary">
                      {group}
                    </p>
                    {items.map((item) => {
                      const idx = flat.indexOf(item);
                      return (
                        <button
                          key={item.id}
                          onClick={() => { item.action(); setOpen(false); }}
                          onMouseEnter={() => setSelected(idx)}
                          className={`flex w-full items-center gap-3 px-5 py-3 text-start transition-colors ${
                            selected === idx ? "bg-brand/10 text-text" : "text-text-secondary hover:text-text"
                          }`}
                        >
                          <span className="text-[14px] font-medium flex-1">{item.label}</span>
                          {item.description && (
                            <span className="text-[12px] text-text-secondary">{item.description}</span>
                          )}
                          {selected === idx && (
                            <kbd className="rounded border border-border bg-white/5 px-2 py-0.5 text-[10px] text-text-secondary">
                              ↵
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer hint */}
            <div className="border-t border-border px-5 py-2.5 flex items-center gap-3 text-[11px] text-text-secondary">
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span>ESC Close</span>
              <span className="flex-1" />
              <span>TenderFlow AI</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
