"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "@/i18n/navigation";

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
  analyzing:   { label: "Analyzing",    cls: "text-primary bg-primary-light" },
  in_progress: { label: "In Proposal",  cls: "text-primary bg-primary-light" },
  in_review:   { label: "Review Req.",  cls: "text-warning bg-warning-bg" },
  ready:       { label: "Ready",        cls: "text-success bg-success-bg" },
  submitted:   { label: "Submitted",    cls: "text-success bg-success-bg" },
  archived:    { label: "Archived",     cls: "text-text-muted bg-surface-dim" },
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

export default function TendersPage() {
  const router = useRouter();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/tenders")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setTenders(d); })
      .catch(console.error);
  }, []);

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

  const filtered = tenders.filter((t) => {
    const matchFilter = filter === "all" || t.status === filter;
    const matchSearch = !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.client ?? "").toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const active = tenders.filter((t) => !["archived", "submitted"].includes(t.status));
  const pipelineVal = tenders.reduce((s, t) => s + (t.contract_value ?? 0), 0);
  const upcoming = tenders.filter((t) => t.submission_deadline && daysUntil(t.submission_deadline) >= 0 && daysUntil(t.submission_deadline) <= 30);
  const withWin = tenders.filter((t) => t.win_probability != null);
  const avgWin = withWin.length
    ? Math.round(withWin.reduce((s, t) => s + (t.win_probability ?? 0), 0) / withWin.length)
    : null;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
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
            AS
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* KPI chips */}
        <div className="mb-5 flex flex-wrap gap-3">
          {[
            { label: "Active Tenders", value: String(active.length), cls: "border-primary text-primary bg-primary-light/30" },
            { label: "Pipeline Value", value: pipelineVal ? fmt(pipelineVal) : "AED 0", cls: "border-border text-text-secondary bg-surface" },
            { label: "Win Rate", value: avgWin != null ? `${avgWin}%` : "—", cls: "border-border text-text-secondary bg-surface" },
            { label: "Deadlines", value: String(upcoming.length).padStart(2, "0"), cls: "border-warning text-warning bg-warning-bg" },
          ].map((kpi) => (
            <div key={kpi.label} className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-[12px] font-medium ${kpi.cls}`}>
              <span className="font-bold">{kpi.value}</span>
              <span>{kpi.label}</span>
            </div>
          ))}
        </div>

        {/* Filters + Search */}
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
            <option value="analyzing">Analyzing</option>
            <option value="in_progress">In Proposal</option>
            <option value="in_review">In Review</option>
            <option value="ready">Ready</option>
            <option value="submitted">Submitted</option>
            <option value="archived">Archived</option>
          </select>
          <button className="rounded border border-border bg-surface px-3 py-2 text-[13px] text-text-secondary hover:bg-surface-dim transition-colors flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">tune</span>
            More Filters
          </button>
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
                    <input type="checkbox" className="h-3.5 w-3.5 rounded border-border accent-primary" />
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
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-border-light last:border-0 hover:bg-surface-dim transition-colors"
                    >
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(t.id)}
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
                            <div className="w-16 h-1.5 rounded-full bg-surface-mid">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${t.win_probability}%` }} />
                            </div>
                            <span className="text-[12px] font-medium text-text">{t.win_probability}%</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex gap-1">
                          <button
                            onClick={() => router.push(`/tenders/${t.id}`)}
                            className="rounded px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary-light transition-colors"
                          >
                            Open
                          </button>
                          <button className="rounded px-2 py-1 text-text-muted hover:bg-surface-dim transition-colors">
                            <span className="material-symbols-outlined text-[16px]">more_vert</span>
                          </button>
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

        {/* Bottom row */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* AI Insight */}
          <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
            <div className="flex items-start gap-3 p-4" style={{ borderLeft: "3px solid #C8A24A" }}>
              <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5">smart_toy</span>
              <div>
                <p className="text-[12px] font-semibold text-text">AI Bid Intelligence</p>
                <p className="mt-1 text-[11px] text-text-secondary leading-relaxed">
                  Upload an RFP and click Run AI to generate a complete bid package — technical proposal, compliance, manpower, BOQ, risk register, SLA framework and executive review.
                </p>
              </div>
            </div>
          </div>

          {/* Upcoming deadline */}
          {upcoming.length > 0 && (
            <div className="rounded-lg border border-warning bg-warning-bg shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[18px] text-warning">schedule</span>
                <p className="text-[12px] font-semibold text-warning">Upcoming Deadline</p>
              </div>
              <p className="text-[13px] font-medium text-text">{upcoming[0].name}</p>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Due in {daysUntil(upcoming[0].submission_deadline!)} days &middot;{" "}
                {new Date(upcoming[0].submission_deadline!).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          )}
        </div>
      </div>

      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
    </div>
  );
}

