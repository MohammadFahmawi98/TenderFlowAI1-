"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const KNOWLEDGE_TYPES = [
  { key: "",                  label: "All" },
  { key: "technical_proposal", label: "Technical Proposals" },
  { key: "method_statement",  label: "Method Statements" },
  { key: "sop",               label: "SOPs" },
  { key: "ppm_library",       label: "PPM Libraries" },
  { key: "sla_library",       label: "SLA Libraries" },
  { key: "kpi_library",       label: "KPI Libraries" },
  { key: "hse_plan",          label: "HSE Plans" },
  { key: "risk_register",     label: "Risk Registers" },
  { key: "mobilization_plan", label: "Mobilization Plans" },
  { key: "certification",     label: "Certifications" },
  { key: "past_project",      label: "Past Projects" },
  { key: "reference",         label: "References" },
  { key: "case_study",        label: "Case Studies" },
  { key: "template",          label: "Templates" },
];

interface KnowledgeItem {
  id: string;
  type: string;
  title: string;
  content?: string;
  tags?: string[];
  created_at: string;
}

export function KnowledgeHub() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [activeType, setActiveType] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ type: "sop", title: "", content: "" });
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeType) params.set("type", activeType);
    if (search)     params.set("q", search);
    const res = await fetch(`/api/knowledge?${params}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [activeType, search]);

  async function addItem() {
    if (!newItem.title.trim()) return;
    setAdding(true);
    await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newItem),
    });
    setAdding(false);
    setShowAdd(false);
    setNewItem({ type: "sop", title: "", content: "" });
    load();
  }

  const typeLabel = (key: string) =>
    KNOWLEDGE_TYPES.find((t) => t.key === key)?.label ?? key.replace(/_/g, " ");

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-12">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-[40px] font-bold text-text">KNOWLEDGE</h1>
          <p className="mt-1 text-[16px] text-text-secondary">
            Company intelligence library — AI agents draw from this automatically.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-lg bg-brand px-5 py-2.5 text-[14px] font-semibold text-background hover:opacity-90 transition-opacity"
        >
          + Add Knowledge
        </button>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search knowledge base…"
        className="mb-6 w-full rounded-xl border border-border bg-card px-5 py-3 text-[15px] text-text placeholder:text-text-secondary outline-none focus:border-brand/40 transition-colors"
      />

      {/* Type filter pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        {KNOWLEDGE_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveType(t.key)}
            className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
              activeType === t.key
                ? "bg-brand text-background"
                : "border border-border text-text-secondary hover:text-text hover:border-brand/30"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Items grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <p className="text-[18px] font-medium text-text">No knowledge items yet</p>
          <p className="text-[14px] text-text-secondary max-w-md">
            Add your company&apos;s proposals, SOPs, certifications, and past projects.
            AI agents will automatically use this information when generating tender documents.
          </p>
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.05 } } }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {items.map((item) => (
            <motion.div
              key={item.id}
              variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.16,1,0.3,1] } } }}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 hover:border-brand/30 transition-colors cursor-default"
            >
              <span className="text-[10px] uppercase tracking-wider text-text-secondary font-medium">
                {typeLabel(item.type)}
              </span>
              <h3 className="text-[15px] font-semibold leading-snug text-text">{item.title}</h3>
              {item.content && (
                <p className="text-[13px] text-text-secondary line-clamp-2">{item.content}</p>
              )}
              {item.tags?.length ? (
                <div className="flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-text-secondary">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="text-[11px] text-text-secondary">
                {new Date(item.created_at).toLocaleDateString()}
              </p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-2xl border border-border bg-surface p-8 shadow-2xl"
          >
            <h2 className="mb-6 text-[22px] font-bold text-text">Add Knowledge Item</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-[13px] text-text-secondary">Type</label>
                <select
                  value={newItem.type}
                  onChange={(e) => setNewItem((p) => ({ ...p, type: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-[14px] text-text outline-none"
                >
                  {KNOWLEDGE_TYPES.filter((t) => t.key).map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] text-text-secondary">Title</label>
                <input
                  value={newItem.title}
                  onChange={(e) => setNewItem((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. HVAC Maintenance SOP v2"
                  className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-[14px] text-text placeholder:text-text-secondary outline-none focus:border-brand/50 transition-colors"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] text-text-secondary">Content</label>
                <textarea
                  value={newItem.content}
                  onChange={(e) => setNewItem((p) => ({ ...p, content: e.target.value }))}
                  placeholder="Paste document content or summary…"
                  rows={5}
                  className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-[14px] text-text placeholder:text-text-secondary outline-none focus:border-brand/50 transition-colors resize-none"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowAdd(false)}
                className="rounded-lg px-5 py-2.5 text-[14px] text-text-secondary hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addItem}
                disabled={adding || !newItem.title.trim()}
                className="rounded-lg bg-brand px-6 py-2.5 text-[14px] font-semibold text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {adding ? "Adding…" : "Add"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
