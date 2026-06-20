"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

interface Tender {
  id: string;
  name: string;
  client?: string;
  submission_deadline?: string;
  contract_value?: number;
  status: string;
  readiness_score?: number;
  win_probability?: number;
  created_at: string;
}

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  draft:       { label: "Draft",       cls: "text-text-muted bg-surface-dim" },
  analyzing:   { label: "Analyzing",   cls: "text-primary bg-primary-light" },
  in_progress: { label: "In Proposal", cls: "text-primary bg-primary-light" },
  in_review:   { label: "Review Req.", cls: "text-warning bg-warning-bg" },
  ready:       { label: "Ready",       cls: "text-success bg-success-bg" },
  submitted:   { label: "Submitted",   cls: "text-success bg-success-bg" },
  won:         { label: "Won",         cls: "text-success bg-success-bg border border-success/30" },
  lost:        { label: "Lost",        cls: "text-danger bg-danger-bg" },
  no_bid:      { label: "No Bid",      cls: "text-text-muted bg-surface-dim" },
  archived:    { label: "Archived",    cls: "text-text-muted bg-surface-dim" },
};

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}
function fmt(v: number) {
  return v >= 1_000_000
    ? `AED ${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000
    ? `AED ${(v / 1_000).toFixed(0)}K`
    : `AED ${v}`;
}

// ── Row action menu ───────────────────────────────────────────────────────────

function RowMenu({
  tender,
  onDelete,
}: {
  tender: Tender;
  onDelete: (t: Tender) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="rounded p-1.5 text-text-muted hover:bg-surface-dim hover:text-text transition-colors"
        title="More actions"
      >
        <span className="material-symbols-outlined text-[18px]">more_vert</span>
      </button>

      {open && (
        <div className="absolute end-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); router.push(`/tenders/${tender.id}`); }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[12.5px] text-text hover:bg-surface-dim transition-colors"
          >
            <span className="material-symbols-outlined text-[15px] text-text-secondary">open_in_new</span>
            Open workspace
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); router.push(`/tenders/${tender.id}/export`); }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[12.5px] text-text hover:bg-surface-dim transition-colors"
          >
            <span className="material-symbols-outlined text-[15px] text-text-secondary">download</span>
            Export package
          </button>
          <div className="border-t border-border-light my-0.5" />
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(tender); }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[12.5px] text-danger hover:bg-danger-bg transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">delete</span>
            Delete tender
          </button>
        </div>
      )}
    </div>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────────────

function DeleteModal({
  targets,
  onConfirm,
  onCancel,
  loading,
}: {
  targets: Tender[];
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const isBulk = targets.length > 1;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-bg">
            <span className="material-symbols-outlined text-[20px] text-danger">delete_forever</span>
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-text">
              {isBulk ? `Delete ${targets.length} tenders?` : "Delete tender?"}
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">This cannot be undone</p>
          </div>
        </div>

        <div className="mb-5 rounded-lg border border-danger/20 bg-danger-bg/40 px-4 py-3">
          {isBulk ? (
            <ul className="flex flex-col gap-1">
              {targets.map((t) => (
                <li key={t.id} className="text-[12.5px] text-text flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-danger shrink-0" />
                  {t.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-text font-medium">{targets[0]?.name}</p>
          )}
          <p className="mt-2 text-[11px] text-text-secondary">
            All documents, AI outputs, files and agent data will be permanently deleted.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded bg-danger px-4 py-2.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            {loading ? "Deleting…" : isBulk ? `Delete ${targets.length} Tenders` : "Yes, Delete"}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded border border-border px-4 py-2.5 text-[13px] font-medium text-text-secondary hover:bg-surface-dim transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TendersPage() {
  const router = useRouter();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTargets, setDeleteTargets] = useState<Tender[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [userInitials, setUserInitials] = useState("—");
  const inputRef = useRef<HTMLInputElement>(null);

  const loadTenders = useCallback(() => {
    fetch("/api/tenders")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setTenders(d); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadTenders();
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const meta = data.user.user_metadata as Record<string, string> | undefined;
        const fullName = meta?.full_name ?? meta?.name ?? data.user.email?.split("@")[0] ?? "";
        const parts = fullName.split(" ");
        setUserInitials(parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : fullName.slice(0, 2).toUpperCase() || "ME");
      }
    });
  }, [loadTenders]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      Array.from(files).forEach((f) => form.append("files", f));
      const res = await fetch("/api/tenders", { method: "POST", body: form });
      const data = await res.json();
      if (data.tenderId) router.push(`/tenders/${data.tenderId}`);
    } catch (e) { console.error(e); }
    finally { setUploading(false); }
  }

  async function confirmDelete() {
    setDeleting(true);
    await Promise.all(
      deleteTargets.map((t) => fetch(`/api/tenders/${t.id}`, { method: "DELETE" })),
    );
    setDeleting(false);
    setDeleteTargets([]);
    setSelected(new Set());
    loadTenders();
  }

  const filtered = tenders.filter((t) => {
    const matchFilter = filter === "all" || t.status === filter;
    const matchSearch = !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.client ?? "").toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const active = tenders.filter((t) => !["archived", "submitted", "won", "lost", "no_bid"].includes(t.status));
  const won = tenders.filter((t) => t.status === "won").length;
  const pipelineVal = active.reduce((s, t) => s + (t.contract_value ?? 0), 0);
  const upcoming = tenders.filter((t) => t.submission_deadline && daysUntil(t.submission_deadline) >= 0 && daysUntil(t.submission_deadline) <= 14);
  const withWin = tenders.filter((t) => t.win_probability != null);
  const avgWin = withWin.length
    ? Math.round(withWin.reduce((s, t) => s + (t.win_probability ?? 0), 0) / withWin.length)
    : null;
  const totalSubmitted = tenders.filter((t) => ["submitted", "won", "lost"].includes(t.status)).length;
  const winRate = totalSubmitted > 0 ? Math.round((won / totalSubmitted) * 100) : null;

  const allSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach((t) => next.delete(t.id));
      else filtered.forEach((t) => next.add(t.id));
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border-light bg-surface">
        <div>
          <h1 className="text-[20px] font-semibold text-text">Tenders</h1>
          <p className="text-[12px] text-text-secondary mt-0.5">
            {tenders.length} tender{tenders.length !== 1 ? "s" : ""} &middot; Each becomes a dedicated AI workspace
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-surface-dim transition-colors text-text-secondary">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-[12px] font-semibold text-primary">
            {userInitials}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* KPI cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10.5px] uppercase tracking-wide text-text-secondary font-medium">Active Tenders</p>
              <span className="material-symbols-outlined text-[16px] text-primary">folder_open</span>
            </div>
            <p className="text-[28px] font-bold text-text leading-none">{active.length}</p>
            <p className="text-[11px] text-text-muted mt-1">In progress or review</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10.5px] uppercase tracking-wide text-text-secondary font-medium">Pipeline Value</p>
              <span className="material-symbols-outlined text-[16px] text-primary">payments</span>
            </div>
            <p className="text-[22px] font-bold text-text leading-none">{pipelineVal ? fmt(pipelineVal) : "—"}</p>
            <p className="text-[11px] text-text-muted mt-1">Active bids combined</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10.5px] uppercase tracking-wide text-text-secondary font-medium">Win Rate</p>
              <span className="material-symbols-outlined text-[16px] text-success">emoji_events</span>
            </div>
            <p className={`text-[28px] font-bold leading-none ${winRate != null ? (winRate >= 50 ? "text-success" : "text-warning") : "text-text"}`}>
              {winRate != null ? `${winRate}%` : avgWin != null ? `~${avgWin}%` : "—"}
            </p>
            <p className="text-[11px] text-text-muted mt-1">{totalSubmitted > 0 ? `${won} of ${totalSubmitted} submitted` : "Avg AI probability"}</p>
          </div>
          <div className={`rounded-xl border p-5 shadow-sm ${upcoming.length > 0 ? "border-warning/40 bg-warning/5" : "border-border bg-surface"}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10.5px] uppercase tracking-wide text-text-secondary font-medium">Due in 14 Days</p>
              <span className={`material-symbols-outlined text-[16px] ${upcoming.length > 0 ? "text-warning" : "text-text-muted"}`}>schedule</span>
            </div>
            <p className={`text-[28px] font-bold leading-none ${upcoming.length > 0 ? "text-warning" : "text-text"}`}>{upcoming.length}</p>
            <p className="text-[11px] text-text-muted mt-1">
              {upcoming.length > 0 ? `Next: ${upcoming[0].name.slice(0, 22)}…` : "No urgent deadlines"}
            </p>
          </div>
        </div>

        {/* Filters + bulk actions */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-text-muted">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tenders…"
              className="w-full rounded border border-border bg-surface pl-9 pr-3 py-2 text-[13px] text-text placeholder:text-text-muted outline-none focus:border-primary transition-colors"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded border border-border bg-surface px-3 py-2 text-[13px] text-text-secondary outline-none focus:border-primary"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="analyzing">Analyzing</option>
            <option value="in_progress">In Proposal</option>
            <option value="in_review">In Review</option>
            <option value="ready">Ready</option>
            <option value="submitted">Submitted</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="no_bid">No Bid</option>
            <option value="archived">Archived</option>
          </select>

          {/* Bulk delete bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-bg/60 px-3 py-1.5">
              <span className="text-[12.5px] font-medium text-danger">{selected.size} selected</span>
              <button
                onClick={() => {
                  const targets = tenders.filter((t) => selected.has(t.id));
                  setDeleteTargets(targets);
                }}
                className="flex items-center gap-1.5 rounded border border-danger/40 bg-danger px-3 py-1 text-[11.5px] font-semibold text-white hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-[13px]">delete</span>
                Delete selected
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-[11px] text-text-muted hover:text-text transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden mb-5">
          {tenders.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-3 py-20 cursor-pointer hover:bg-surface-dim transition-colors"
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <span className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <>
                  <span className="material-symbols-outlined text-[48px] text-text-muted">upload_file</span>
                  <p className="text-[16px] font-semibold text-text">Upload an RFP to create your first workspace</p>
                  <p className="text-[13px] text-text-secondary">PDF &middot; DOCX &middot; XLSX &middot; PPTX &middot; ZIP &middot; BOQ</p>
                  <button className="mt-2 rounded bg-primary px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-primary-btn transition-colors">
                    Select RFP Files
                  </button>
                </>
              )}
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border-light bg-surface-dim">
                  <th className="px-5 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-3.5 w-3.5 rounded border-border accent-primary"
                    />
                  </th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Tender Name & Client</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Value</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Deadline</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Win Prob</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const s = STATUS_STYLES[t.status] ?? { label: t.status, cls: "text-text-muted bg-surface-dim" };
                  const d = t.submission_deadline ? daysUntil(t.submission_deadline) : null;
                  const isSelected = selected.has(t.id);
                  return (
                    <tr
                      key={t.id}
                      className={`border-b border-border-light last:border-0 transition-colors ${isSelected ? "bg-primary-light/20" : "hover:bg-surface-dim"}`}
                    >
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(t.id)}
                          className="h-3.5 w-3.5 rounded border-border accent-primary"
                        />
                      </td>
                      <td className="px-4 py-3.5 cursor-pointer" onClick={() => router.push(`/tenders/${t.id}`)}>
                        <p className="font-medium text-text">{t.name}</p>
                        {t.client && <p className="text-[11px] text-text-muted mt-0.5">{t.client}</p>}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-text">
                        {t.contract_value ? fmt(t.contract_value) : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.cls}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3.5 text-[12px] ${d != null && d <= 7 ? "text-danger font-medium" : "text-text-secondary"}`}>
                        {d != null
                          ? (d >= 0
                            ? new Date(t.submission_deadline!).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                            : "Passed")
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        {t.win_probability != null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-surface-mid overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${t.win_probability}%` }} />
                            </div>
                            <span className="text-[12px] font-medium text-text">{t.win_probability}%</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => router.push(`/tenders/${t.id}`)}
                            className="rounded px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary-light transition-colors"
                          >
                            Open
                          </button>
                          <RowMenu
                            tender={t}
                            onDelete={(target) => setDeleteTargets([target])}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {tenders.length > 0 && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-[13px] text-text-muted">
                      No tenders match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Bottom info strip */}
        {tenders.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
              <div className="flex items-start gap-3 p-4" style={{ borderLeft: "3px solid #C8A24A" }}>
                <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5">smart_toy</span>
                <div>
                  <p className="text-[12px] font-semibold text-text">AI Bid Intelligence</p>
                  <p className="mt-1 text-[11px] text-text-secondary leading-relaxed">
                    Open any tender workspace and click <strong>Run AI</strong> to generate a complete bid package — compliance, manpower, BOQ, risk register, SLA framework and executive review.
                  </p>
                </div>
              </div>
            </div>
            {upcoming.length > 0 && (
              <div className="rounded-lg border border-warning/40 bg-warning/5 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[18px] text-warning">schedule</span>
                  <p className="text-[12px] font-semibold text-warning">Deadlines Within 14 Days</p>
                </div>
                <div className="flex flex-col gap-2">
                  {upcoming.slice(0, 3).map((t) => (
                    <div key={t.id} className="flex items-center justify-between">
                      <p className="text-[12.5px] font-medium text-text truncate max-w-[200px]">{t.name}</p>
                      <span className={`text-[11px] font-semibold ${daysUntil(t.submission_deadline!) <= 3 ? "text-danger" : "text-warning"}`}>
                        {daysUntil(t.submission_deadline!)}d left
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />

      {/* Delete confirmation modal */}
      {deleteTargets.length > 0 && (
        <DeleteModal
          targets={deleteTargets}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTargets([])}
          loading={deleting}
        />
      )}
    </div>
  );
}
