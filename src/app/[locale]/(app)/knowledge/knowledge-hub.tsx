"use client";

import { useState, useEffect, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  certification:      "Certification",
  past_project:       "Past Project",
  sop:                "SOP / Policy",
  hse_plan:           "HSE Plan",
  ppm_library:        "PPM Library",
  sla_library:        "SLA Library",
  kpi_library:        "KPI Library",
  technical_proposal: "Technical Proposal",
  method_statement:   "Method Statement",
  risk_register:      "Risk Register",
  reference:          "Reference",
  mobilization_plan:  "Mobilization Plan",
  template:           "Template",
  document:           "Document",
};

const REPO_CATEGORIES = [
  {
    icon: "verified",     label: "Company Certifications", color: "text-primary",
    keys: ["certification"],
  },
  {
    icon: "emoji_events", label: "Past Wins",              color: "text-success",
    keys: ["past_project", "case_study"],
  },
  {
    icon: "policy",       label: "Policy Documents",       color: "text-warning",
    keys: ["sop", "hse_plan", "risk_register"],
  },
  {
    icon: "engineering",  label: "Technical Specs",        color: "text-secondary",
    keys: ["technical_proposal", "method_statement", "ppm_library", "sla_library", "kpi_library", "mobilization_plan"],
  },
];

const STATUS_STYLES: Record<string, string> = {
  indexed:    "text-success bg-success-bg",
  processing: "text-warning bg-warning-bg",
  failed:     "text-danger bg-danger-bg",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface KnowledgeDoc {
  id: string;
  name: string;
  type: string;
  doc_category?: string;
  status: string;
  file_size?: number;
  mime_type?: string;
  expires_at?: string | null;
  expiry_notified?: boolean;
  created_at: string;
}

// ─── Expiry helpers ───────────────────────────────────────────────────────────

function expiryStatus(expiresAt: string | null | undefined): "expired" | "soon" | "valid" | "none" {
  if (!expiresAt) return "none";
  const exp = new Date(expiresAt).getTime();
  const now = Date.now();
  if (exp < now) return "expired";
  if (exp < now + 90 * 24 * 60 * 60 * 1000) return "soon";
  return "valid";
}

function ExpiryBadge({ expiresAt }: { expiresAt: string | null | undefined }) {
  const status = expiryStatus(expiresAt);
  if (status === "none") return <span className="text-text-muted text-[11px]">—</span>;
  const date = new Date(expiresAt!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const styles = {
    expired: "text-danger bg-danger/10 border border-danger/20",
    soon:    "text-warning bg-warning/10 border border-warning/20",
    valid:   "text-success bg-success-bg border border-success/20",
  }[status];
  const label = {
    expired: "EXPIRED",
    soon:    "EXPIRING SOON",
    valid:   "VALID",
  }[status];
  return (
    <span className={`inline-flex flex-col rounded px-2 py-0.5 text-[10px] font-semibold ${styles}`}>
      <span>{label}</span>
      <span className="font-normal opacity-80">{date}</span>
    </span>
  );
}

// ─── Expiry date editor (inline) ──────────────────────────────────────────────

function ExpiryEditor({
  doc, onUpdated,
}: { doc: KnowledgeDoc; onUpdated: (d: KnowledgeDoc) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(doc.expires_at ? doc.expires_at.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/knowledge/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expires_at: val ? new Date(val).toISOString() : null }),
    });
    if (res.ok) {
      const updated = await res.json() as KnowledgeDoc;
      onUpdated(updated);
    }
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="border border-border rounded px-1.5 py-0.5 text-[11px] text-text bg-surface focus:outline-none focus:border-primary"
        />
        <button onClick={save} disabled={saving}
                className="text-success hover:text-success/70 disabled:opacity-50">
          <span className="material-symbols-outlined text-[14px]">check</span>
        </button>
        <button onClick={() => setEditing(false)} className="text-text-muted hover:text-danger">
          <span className="material-symbols-outlined text-[14px]">close</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 group">
      <ExpiryBadge expiresAt={doc.expires_at} />
      <button
        onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-primary"
        title="Set expiry date"
      >
        <span className="material-symbols-outlined text-[13px]">edit</span>
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function KnowledgeHub() {
  const [docs, setDocs]             = useState<KnowledgeDoc[]>([]);
  const [search, setSearch]         = useState("");
  const [filterCat, setFilterCat]   = useState("");
  const [loading, setLoading]       = useState(true);
  const [syncing, setSyncing]       = useState(false);
  const [synced, setSynced]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    const res = await fetch(`/api/knowledge?${params}`);
    if (res.ok) setDocs(await res.json() as KnowledgeDoc[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      await fetch("/api/knowledge/upload", { method: "POST", body: form });
      await load();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleResync() {
    setSyncing(true); setSynced(false);
    await load();
    setTimeout(() => { setSyncing(false); setSynced(true); }, 1200);
    setTimeout(() => setSynced(false), 5000);
  }

  function updateDoc(updated: KnowledgeDoc) {
    setDocs((prev) => prev.map((d) => d.id === updated.id ? updated : d));
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const indexed      = docs.filter((d) => d.status === "indexed");
  const lastUpdated  = docs[0]
    ? new Date(docs[0].created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : "—";
  const expired      = docs.filter((d) => expiryStatus(d.expires_at) === "expired");
  const expiringSoon = docs.filter((d) => expiryStatus(d.expires_at) === "soon");

  // Per-repo counts (indexed docs only)
  const repoCounts = Object.fromEntries(
    REPO_CATEGORIES.map((r) => [
      r.label,
      indexed.filter((d) => r.keys.includes(d.doc_category ?? "")).length,
    ])
  );

  // Filtered table rows
  const visibleDocs = docs.filter((d) => {
    if (filterCat) {
      const repo = REPO_CATEGORIES.find((r) => r.label === filterCat);
      if (repo && !repo.keys.includes(d.doc_category ?? "")) return false;
    }
    return true;
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
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
          <p className="text-[12px] text-text-secondary mt-0.5">
            Company intelligence library — AI agents draw from this automatically
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded bg-primary px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-primary-btn disabled:opacity-60 transition-colors"
        >
          {uploading
            ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            : <span className="material-symbols-outlined text-[16px]">upload_file</span>}
          {uploading ? "Uploading…" : "Upload Document"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

        {/* ── Expiry alerts ── */}
        {(expired.length > 0 || expiringSoon.length > 0) && (
          <div className="space-y-2">
            {expired.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                <span className="material-symbols-outlined text-danger text-[18px] mt-0.5 flex-shrink-0">error</span>
                <div>
                  <p className="text-[13px] font-semibold text-danger">
                    {expired.length} document{expired.length > 1 ? "s" : ""} expired
                  </p>
                  <p className="text-[11px] text-danger/80 mt-0.5">
                    {expired.map((d) => d.name).join(" · ")}
                  </p>
                  <p className="text-[11px] text-danger/70 mt-1">
                    AI agents will still use these documents but clients may reject expired certificates. Update them to stay compliant.
                  </p>
                </div>
              </div>
            )}
            {expiringSoon.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
                <span className="material-symbols-outlined text-warning text-[18px] mt-0.5 flex-shrink-0">schedule</span>
                <div>
                  <p className="text-[13px] font-semibold text-warning">
                    {expiringSoon.length} document{expiringSoon.length > 1 ? "s" : ""} expiring within 90 days
                  </p>
                  <p className="text-[11px] text-warning/80 mt-0.5">
                    {expiringSoon.map((d) => d.name).join(" · ")}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Top row: AI Semantic Memory + Ingestion Center ── */}
        <div className="grid gap-5 lg:grid-cols-3">
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
              <div className="rounded-lg bg-surface-dim p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="material-symbols-outlined text-[14px] text-text-muted">schedule</span>
                  <span className="text-[10px] uppercase tracking-wide text-text-muted">Last Update</span>
                </div>
                <p className="text-[16px] font-semibold text-text">{lastUpdated}</p>
              </div>
              <div className="rounded-lg bg-surface-dim p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="material-symbols-outlined text-[14px] text-text-muted">library_books</span>
                  <span className="text-[10px] uppercase tracking-wide text-text-muted">Indexed Documents</span>
                </div>
                <p className="text-[16px] font-semibold text-text">{indexed.length}</p>
              </div>
              <div className={`rounded-lg p-3 ${expired.length > 0 ? "bg-danger/5 border border-danger/20" : expiringSoon.length > 0 ? "bg-warning/5 border border-warning/20" : "bg-surface-dim"}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`material-symbols-outlined text-[14px] ${expired.length > 0 ? "text-danger" : expiringSoon.length > 0 ? "text-warning" : "text-text-muted"}`}>
                    verified_user
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-text-muted">Expiring / Expired</span>
                </div>
                <p className={`text-[16px] font-semibold ${expired.length > 0 ? "text-danger" : expiringSoon.length > 0 ? "text-warning" : "text-text"}`}>
                  {expired.length + expiringSoon.length === 0 ? "All Valid" : `${expired.length + expiringSoon.length} issues`}
                </p>
              </div>
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
                  : <span className="material-symbols-outlined text-[16px] text-primary">upload_file</span>}
                {uploading ? "Uploading…" : "Upload Document"}
              </button>
              <button
                onClick={() => alert("External source integration — contact your administrator.")}
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
                  : <span className="material-symbols-outlined text-[16px] text-primary">manage_search</span>}
                {syncing ? "Syncing…" : synced ? "Synced ✓" : "Re-sync AI Index"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Document Repositories ── */}
        <div>
          <p className="text-[13px] font-semibold text-text mb-3">Document Repositories</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {REPO_CATEGORIES.map((cat) => {
              const count  = repoCounts[cat.label] ?? 0;
              const active = activeRepo === cat.label;
              return (
                <button
                  key={cat.label}
                  onClick={() => {
                    setActiveRepo(active ? null : cat.label);
                    setFilterCat(active ? "" : cat.label);
                  }}
                  className={`rounded-lg border text-left p-4 cursor-pointer transition-colors ${
                    active
                      ? "border-primary bg-primary-light"
                      : "border-border bg-surface hover:bg-surface-dim"
                  } shadow-sm`}
                >
                  <span className={`material-symbols-outlined text-[28px] mb-2 block ${cat.color}`}>
                    {cat.icon}
                  </span>
                  <p className="text-[13px] font-medium text-text">{cat.label}</p>
                  <p className="text-[11px] text-text-muted mt-1">
                    {count} indexed item{count !== 1 ? "s" : ""}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Search + filter ── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-text-muted">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search knowledge base…"
              className="w-full rounded border border-border bg-surface pl-9 pr-3 py-2 text-[13px] text-text placeholder:text-text-muted outline-none focus:border-primary transition-colors"
            />
          </div>
          {filterCat && (
            <button
              onClick={() => { setFilterCat(""); setActiveRepo(null); }}
              className="flex items-center gap-1 text-[12px] text-primary border border-primary/30 rounded-full px-3 py-1 hover:bg-primary-light transition-colors"
            >
              {filterCat} <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
          <span className="ml-auto text-[11px] text-text-muted">
            {visibleDocs.length} document{visibleDocs.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ── Documents table ── */}
        <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border-light flex items-center justify-between">
            <p className="text-[13px] font-semibold text-text">
              {filterCat ? filterCat : "All Documents"}
            </p>
            {uploading && (
              <span className="flex items-center gap-1.5 text-[11px] text-warning">
                <span className="h-2 w-2 animate-spin rounded-full border-2 border-warning border-t-transparent" />
                Processing upload…
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-6 flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-surface-mid" />
              ))}
            </div>
          ) : visibleDocs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="material-symbols-outlined text-[40px] text-text-muted">library_books</span>
              <p className="text-[14px] font-medium text-text">No documents yet</p>
              <p className="text-[12px] text-text-secondary max-w-xs">
                Upload your company proposals, SOPs, certifications and past projects.
                AI agents will draw from them automatically.
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
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Category</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Size</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">AI Status</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Expiry</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Added</th>
                </tr>
              </thead>
              <tbody>
                {visibleDocs.map((doc) => {
                  const expSt = expiryStatus(doc.expires_at);
                  return (
                    <tr
                      key={doc.id}
                      className={`border-b border-border-light last:border-0 transition-colors ${
                        expSt === "expired" ? "bg-danger/3 hover:bg-danger/5" :
                        expSt === "soon"    ? "bg-warning/3 hover:bg-warning/5" :
                                              "hover:bg-surface-dim"
                      }`}
                    >
                      <td className="px-5 py-3 max-w-[280px]">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-text-muted flex-shrink-0">
                            {(doc.mime_type ?? "").includes("pdf") ? "picture_as_pdf" :
                             (doc.mime_type ?? "").includes("sheet") || (doc.mime_type ?? "").includes("excel") ? "table_chart" :
                             "description"}
                          </span>
                          <span className="font-medium text-text truncate" title={doc.name}>
                            {doc.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] text-text-secondary bg-surface-dim rounded px-2 py-0.5">
                          {CATEGORY_LABELS[doc.doc_category ?? ""] ?? "Document"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary text-[12px]">
                        {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[doc.status] ?? "text-text-muted bg-surface-dim"}`}>
                          {doc.status === "indexed" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-success" />
                          )}
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ExpiryEditor doc={doc} onUpdated={updateDoc} />
                      </td>
                      <td className="px-4 py-3 text-text-secondary text-[12px]">
                        {new Date(doc.created_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Tip footer ── */}
        <div className="rounded-lg border border-border-light bg-surface-dim px-5 py-3.5 flex items-start gap-3">
          <span className="material-symbols-outlined text-[18px] text-primary mt-0.5 flex-shrink-0">tips_and_updates</span>
          <div>
            <p className="text-[12px] font-semibold text-text">How AI agents use this library</p>
            <p className="text-[11px] text-text-secondary mt-0.5">
              When you run agents on a tender, the system automatically searches for the top 3 most relevant
              documents from this library using keyword matching and injects their content into each agent&apos;s prompt.
              Keep documents up to date and indexed to ensure accurate AI output.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
