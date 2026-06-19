"use client";

import { useState, useEffect, useRef } from "react";

const KNOWLEDGE_TYPES = [
  { key: "",                   label: "All" },
  { key: "technical_proposal", label: "Technical Proposals" },
  { key: "method_statement",   label: "Method Statements" },
  { key: "sop",                label: "SOPs" },
  { key: "ppm_library",        label: "PPM Libraries" },
  { key: "sla_library",        label: "SLA Libraries" },
  { key: "kpi_library",        label: "KPI Libraries" },
  { key: "hse_plan",           label: "HSE Plans" },
  { key: "risk_register",      label: "Risk Registers" },
  { key: "mobilization_plan",  label: "Mobilization Plans" },
  { key: "certification",      label: "Certifications" },
  { key: "past_project",       label: "Past Projects" },
  { key: "reference",          label: "References" },
  { key: "case_study",         label: "Case Studies" },
  { key: "template",           label: "Templates" },
];

interface KnowledgeDoc {
  id: string;
  name: string;
  type: string;
  status: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
}

const REPO_CATEGORIES = [
  { icon: "verified",    label: "Company Certifications", color: "text-primary" },
  { icon: "emoji_events", label: "Past Wins",             color: "text-success" },
  { icon: "policy",      label: "Policy Documents",       color: "text-warning" },
  { icon: "engineering", label: "Technical Specs",        color: "text-secondary" },
];

const STATUS_STYLES: Record<string, string> = {
  indexed:    "text-success bg-success-bg",
  processing: "text-warning bg-warning-bg",
  failed:     "text-danger bg-danger-bg",
};

export function KnowledgeHub() {
  const [docs, setDocs]         = useState<KnowledgeDoc[]>([]);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [synced, setSynced]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    const res = await fetch(`/api/knowledge?${params}`);
    if (res.ok) setDocs(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [search]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      await fetch("/api/knowledge/upload", { method: "POST", body: form });
      await load();
    } catch {
      // silently handled — record will show failed status
    } finally {
      setUploading(false);
      // Reset so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleResync() {
    setSyncing(true);
    setSynced(false);
    await load();
    setTimeout(() => { setSyncing(false); setSynced(true); }, 2000);
    setTimeout(() => setSynced(false), 5000);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Page header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border-light bg-surface">
        <div>
          <h1 className="text-[20px] font-semibold text-text">Bid Library</h1>
          <p className="text-[12px] text-text-secondary mt-0.5">Company intelligence library — AI agents draw from this automatically</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded bg-primary px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-primary-btn disabled:opacity-60 transition-colors"
          >
            {uploading
              ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              : <span className="material-symbols-outlined text-[16px]">upload_file</span>
            }
            {uploading ? "Uploading…" : "Upload Document"}
          </button>
          <button className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-surface-dim transition-colors text-text-secondary">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-[12px] font-semibold text-primary">
            AS
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Top row: AI Memory card + Ingestion Center */}
        <div className="mb-6 grid gap-5 lg:grid-cols-3">
          {/* AI Semantic Memory */}
          <div className="lg:col-span-2 rounded-lg border border-border bg-surface shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[20px] text-primary">hub</span>
              <p className="text-[13px] font-semibold text-text">AI Semantic Memory</p>
              <span className="ml-auto rounded-full bg-success-bg px-3 py-1 text-[11px] font-semibold text-success flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Synchronized
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Last Update", value: docs.length > 0 ? new Date(docs[0].created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—", icon: "schedule" },
                { label: "Knowledge Items", value: String(docs.filter((d) => d.status === "indexed").length), icon: "library_books" },
                { label: "Context Window",  value: "128K tokens", icon: "memory" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg bg-surface-dim p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-[14px] text-text-muted">{stat.icon}</span>
                    <span className="text-[10px] uppercase tracking-wide text-text-muted">{stat.label}</span>
                  </div>
                  <p className="text-[16px] font-semibold text-text">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Ingestion Center */}
          <div className="rounded-lg border border-border bg-surface shadow-sm p-5">
            <p className="text-[13px] font-semibold text-text mb-4">Ingestion Center</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 rounded border border-border px-3 py-2.5 text-[12px] font-medium text-text hover:bg-surface-dim disabled:opacity-60 transition-colors"
              >
                {uploading
                  ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  : <span className="material-symbols-outlined text-[16px] text-primary">upload_file</span>
                }
                {uploading ? "Uploading…" : "Upload Document"}
              </button>
              <button
                onClick={() => alert("External source integration coming soon. Contact your administrator.")}
                className="flex items-center gap-2 rounded border border-border px-3 py-2.5 text-[12px] font-medium text-text hover:bg-surface-dim transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">link</span>
                Connect External Source
              </button>
              <button
                onClick={handleResync}
                disabled={syncing}
                className="flex items-center gap-2 rounded border border-border px-3 py-2.5 text-[12px] font-medium text-text hover:bg-surface-dim disabled:opacity-60 transition-colors"
              >
                {syncing
                  ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  : <span className="material-symbols-outlined text-[16px] text-primary">manage_search</span>
                }
                {syncing ? "Syncing…" : synced ? "Synced ✓" : "Re-sync AI Index"}
              </button>
            </div>
          </div>
        </div>

        {/* Document Repositories */}
        <div className="mb-6">
          <p className="text-[13px] font-semibold text-text mb-3">Document Repositories</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {REPO_CATEGORIES.map((cat) => (
              <div key={cat.label} className="rounded-lg border border-border bg-surface shadow-sm p-4 cursor-pointer hover:bg-surface-dim transition-colors">
                <span className={`material-symbols-outlined text-[28px] mb-2 block ${cat.color}`}>{cat.icon}</span>
                <p className="text-[13px] font-medium text-text">{cat.label}</p>
                <p className="text-[11px] text-text-muted mt-1">{docs.length} items</p>
              </div>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-text-muted">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search knowledge base…"
              className="w-full rounded border border-border bg-surface pl-9 pr-3 py-2 text-[13px] text-text placeholder:text-text-muted outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        {/* Recent Uploads table */}
        <div className="mb-5 rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border-light flex items-center justify-between">
            <p className="text-[13px] font-semibold text-text">Recent Uploads &amp; Indexing</p>
            {uploading && (
              <span className="flex items-center gap-1.5 text-[11px] text-warning">
                <span className="h-2 w-2 animate-spin rounded-full border-2 border-warning border-t-transparent" />
                Processing upload…
              </span>
            )}
          </div>
          {loading ? (
            <div className="p-6 flex flex-col gap-3">
              {[1,2,3].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-surface-mid" />)}
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="material-symbols-outlined text-[40px] text-text-muted">library_books</span>
              <p className="text-[14px] font-medium text-text">No documents yet</p>
              <p className="text-[12px] text-text-secondary max-w-xs">
                Upload your company proposals, SOPs, certifications, and past projects. AI agents will automatically use this information.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 flex items-center gap-1.5 rounded bg-primary px-4 py-2 text-[12px] font-semibold text-white hover:bg-primary-btn transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                Upload First Document
              </button>
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border-light bg-surface-dim">
                  <th className="px-5 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Name</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Type</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Size</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Date Added</th>
                </tr>
              </thead>
              <tbody>
                {docs.slice(0, 20).map((doc) => (
                  <tr key={doc.id} className="border-b border-border-light last:border-0 hover:bg-surface-dim transition-colors">
                    <td className="px-5 py-3 font-medium text-text max-w-xs truncate">{doc.name}</td>
                    <td className="px-4 py-3 text-text-secondary capitalize">{(doc.mime_type ?? doc.type).split("/").pop()?.toUpperCase() ?? "—"}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[doc.status] ?? "text-text-muted bg-surface-dim"}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {new Date(doc.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
