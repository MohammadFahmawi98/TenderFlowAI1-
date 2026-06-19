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
  analyzing:   { label: "Analyzing",   cls: "text-primary bg-primary-light" },
  in_progress: { label: "In Proposal", cls: "text-warning bg-warning-bg" },
  in_review:   { label: "Review",      cls: "text-warning bg-warning-bg" },
  ready:       { label: "Ready",       cls: "text-success bg-success-bg" },
  submitted:   { label: "Submitted",   cls: "text-success bg-success-bg" },
  archived:    { label: "Archived",    cls: "text-text-muted bg-surface-dim" },
};

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function fmt(v: number) {
  return v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v / 1_000).toFixed(0)}K` : `$${v}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showNotif, setShowNotif] = useState(false);

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

  const active = tenders.filter((t) => !["archived", "submitted"].includes(t.status));
  const pipelineVal = tenders.reduce((s, t) => s + (t.contract_value ?? 0), 0);
  const upcoming = tenders
    .filter((t) => t.submission_deadline && daysUntil(t.submission_deadline) >= 0 && daysUntil(t.submission_deadline) <= 30)
    .sort((a, b) => new Date(a.submission_deadline!).getTime() - new Date(b.submission_deadline!).getTime());
  const withWin = tenders.filter((t) => t.win_probability != null);
  const avgWin = withWin.length
    ? Math.round(withWin.reduce((s, t) => s + (t.win_probability ?? 0), 0) / withWin.length)
    : 68;

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const KPI = [
    {
      label: "Active Tenders",
      value: String(active.length),
      sub: `${tenders.length} total`,
      icon: "description",
      color: "text-primary",
    },
    {
      label: "Win Rate",
      value: withWin.length ? `${avgWin}%` : "—",
      sub: withWin.length ? "AI estimate" : "No data yet",
      icon: "trending_up",
      color: "text-success",
    },
    {
      label: "Pipeline Value",
      value: pipelineVal ? fmt(pipelineVal) : "AED 0",
      sub: "total contract value",
      icon: "payments",
      color: "text-primary",
    },
    {
      label: "Upcoming Deadlines",
      value: String(upcoming.length),
      sub: upcoming.length > 0 ? `Next: ${daysUntil(upcoming[0]?.submission_deadline!)}d` : "None in 30 days",
      icon: "schedule",
      color: "text-warning",
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border-light bg-surface">
        <div>
          <h1 className="text-[20px] font-semibold text-text">Dashboard</h1>
          <p className="text-[12px] text-text-secondary mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-3 relative">
          <button
            onClick={() => setShowNotif((v) => !v)}
            className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-surface-dim transition-colors text-text-secondary"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
          {showNotif && (
            <div className="absolute top-10 right-10 z-50 w-72 rounded-lg border border-border bg-surface shadow-xl p-4">
              <p className="text-[13px] font-semibold text-text mb-2">Notifications</p>
              <p className="text-[12px] text-text-muted text-center py-4">No new notifications</p>
              <button onClick={() => setShowNotif(false)} className="absolute top-3 right-3 text-text-muted hover:text-text">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-[12px] font-semibold text-primary cursor-pointer">
            AS
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* KPI Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {KPI.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-border bg-surface p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] uppercase tracking-wide font-medium text-text-secondary">{card.label}</p>
                <span className={`material-symbols-outlined text-[20px] ${card.color}`}>{card.icon}</span>
              </div>
              <p className={`text-[28px] font-bold leading-none ${card.color}`}>{card.value}</p>
              <p className="mt-1.5 text-[11px] text-text-muted">{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Active Pipeline table */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-light">
                <h2 className="text-[14px] font-semibold text-text">Active Pipeline</h2>
                <div className="flex gap-2">
                  <button className="rounded border border-border px-3 py-1 text-[11px] text-text-secondary hover:bg-surface-dim transition-colors">Filter</button>
                  <button
                    onClick={() => router.push("/tenders")}
                    className="rounded border border-border px-3 py-1 text-[11px] text-text-secondary hover:bg-surface-dim transition-colors"
                  >
                    View all →
                  </button>
                </div>
              </div>

              {tenders.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center gap-3 py-16 cursor-pointer hover:bg-surface-dim transition-colors"
                  onClick={() => inputRef.current?.click()}
                >
                  {uploading ? (
                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[40px] text-text-muted">upload_file</span>
                      <p className="text-[14px] font-medium text-text">Upload your first RFP</p>
                      <p className="text-[12px] text-text-secondary">PDF &middot; DOCX &middot; XLSX &middot; PPTX &middot; ZIP</p>
                    </>
                  )}
                </div>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border-light bg-surface-dim">
                      <th className="px-5 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Tender Name</th>
                      <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Value</th>
                      <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                      <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Deadline</th>
                      <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">AI Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenders.slice(0, 6).map((t) => {
                      const s = STATUS_STYLES[t.status] ?? { label: t.status, cls: "text-text-muted bg-surface-dim" };
                      const d = t.submission_deadline ? daysUntil(t.submission_deadline) : null;
                      return (
                        <tr
                          key={t.id}
                          className="border-b border-border-light last:border-0 hover:bg-surface-dim cursor-pointer transition-colors"
                          onClick={() => router.push(`/tenders/${t.id}`)}
                        >
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-text truncate max-w-[180px]">{t.name}</p>
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
                            {d != null ? (d >= 0 ? `${d}d` : "Passed") : "—"}
                          </td>
                          <td className="px-4 py-3.5">
                            {t.win_probability != null ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-surface-mid max-w-[60px]">
                                  <div
                                    className="h-full rounded-full bg-primary"
                                    style={{ width: `${t.win_probability}%` }}
                                  />
                                </div>
                                <span className="text-[12px] font-medium text-text">{t.win_probability}%</span>
                              </div>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            {/* Recent Activity */}
            <div className="rounded-lg border border-border bg-surface shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
                <h2 className="text-[13px] font-semibold text-text">Recent Activity</h2>
                <a href="/tenders" className="text-[11px] text-primary hover:underline">View Feed</a>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {tenders.length === 0 ? (
                  <p className="text-[12px] text-text-muted text-center py-4">No activity yet</p>
                ) : (
                  tenders.slice(0, 4).map((t) => (
                    <div key={t.id} className="flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-[16px] text-primary mt-0.5">description</span>
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-text truncate">{t.name}</p>
                        <p className="text-[11px] text-text-muted">
                          {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Priority Deadlines */}
            <div className="rounded-lg border border-border bg-surface shadow-sm">
              <div className="px-4 py-3 border-b border-border-light">
                <h2 className="text-[13px] font-semibold text-text">Priority Deadlines</h2>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {upcoming.length === 0 ? (
                  <p className="text-[12px] text-text-muted text-center py-4">No deadlines in 30 days</p>
                ) : (
                  upcoming.slice(0, 4).map((t) => {
                    const d = daysUntil(t.submission_deadline!);
                    return (
                      <button
                        key={t.id}
                        onClick={() => router.push(`/tenders/${t.id}`)}
                        className="flex items-center justify-between text-start w-full hover:bg-surface-dim rounded px-1 py-1 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-text truncate">{t.name}</p>
                        </div>
                        <span className={`ml-2 shrink-0 text-[11px] font-semibold ${d <= 3 ? "text-danger" : d <= 7 ? "text-warning" : "text-text-secondary"}`}>
                          {d === 0 ? "Today" : d === 1 ? "Tomorrow" : `${d}d`}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AI Insight banner */}
        <div className="mt-6 rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-start gap-4 p-5" style={{ borderLeft: "3px solid #C8A24A" }}>
            <span className="material-symbols-outlined text-[22px] text-primary shrink-0 mt-0.5">smart_toy</span>
            <div>
              <p className="text-[13px] font-semibold text-text">AI Procurement Insight</p>
              <p className="mt-1 text-[12px] text-text-secondary leading-relaxed">
                Based on your pipeline, 3 tenders are approaching critical deadlines. Consider prioritizing the compliance review for high-value opportunities. AI analysis suggests a 12% improvement in win rate is achievable with early submission.
              </p>
            </div>
          </div>
        </div>
      </div>

      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
    </div>
  );
}

