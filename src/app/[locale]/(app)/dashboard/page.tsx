"use client";

import { useState, useEffect, useRef } from "react";
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

const STATUS_META: Record<string, { label: string; cls: string; color: string }> = {
  draft:       { label: "Draft",       cls: "text-text-muted bg-surface-dim",  color: "#94A3B8" },
  analyzing:   { label: "Analyzing",   cls: "text-primary bg-primary-light",   color: "#2563EB" },
  in_progress: { label: "In Proposal", cls: "text-primary bg-primary-light",   color: "#2563EB" },
  in_review:   { label: "In Review",   cls: "text-warning bg-warning-bg",      color: "#D97706" },
  ready:       { label: "Ready",       cls: "text-success bg-success-bg",      color: "#16A34A" },
  submitted:   { label: "Submitted",   cls: "text-success bg-success-bg",      color: "#16A34A" },
  won:         { label: "Won",         cls: "text-success bg-success-bg",      color: "#8B3520" },
  lost:        { label: "Lost",        cls: "text-danger bg-danger-bg",        color: "#DC2626" },
  no_bid:      { label: "No Bid",      cls: "text-text-muted bg-surface-dim",  color: "#94A3B8" },
};

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}
function fmt(v: number) {
  return v >= 1_000_000 ? `AED ${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `AED ${(v / 1_000).toFixed(0)}K` : `AED ${v}`;
}
function relTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showNotif, setShowNotif] = useState(false);
  const [userName, setUserName] = useState("");
  const [userInitials, setUserInitials] = useState("—");
  const [aiSummary, setAiSummary] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    fetch("/api/tenders")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setTenders(d); })
      .catch(console.error);

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const meta = data.user.user_metadata as Record<string, string> | undefined;
        const fullName = meta?.full_name ?? meta?.name ?? data.user.email?.split("@")[0] ?? "";
        setUserName(fullName.split(" ")[0] || "");
        const parts = fullName.split(" ");
        setUserInitials(parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : fullName.slice(0, 2).toUpperCase() || "ME");
      }
    });
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

  // ── Computed stats ───────────────────────────────────────────────────────────
  const active = tenders.filter((t) => !["archived","submitted","won","lost","no_bid"].includes(t.status));
  const won = tenders.filter((t) => t.status === "won").length;
  const totalSubmitted = tenders.filter((t) => ["submitted","won","lost"].includes(t.status)).length;
  const winRate = totalSubmitted > 0 ? Math.round((won / totalSubmitted) * 100) : null;
  const pipelineVal = active.reduce((s, t) => s + (t.contract_value ?? 0), 0);
  const upcoming = tenders
    .filter((t) => t.submission_deadline && daysUntil(t.submission_deadline) >= 0 && daysUntil(t.submission_deadline) <= 30)
    .sort((a, b) => new Date(a.submission_deadline!).getTime() - new Date(b.submission_deadline!).getTime());
  const withWin = tenders.filter((t) => t.win_probability != null);
  const avgWin = withWin.length
    ? Math.round(withWin.reduce((s, t) => s + (t.win_probability ?? 0), 0) / withWin.length)
    : null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const displayWinRate = winRate != null ? `${winRate}%` : avgWin != null ? `~${avgWin}%` : "—";
  const winRateSub = winRate != null
    ? `${won} won of ${totalSubmitted} submitted`
    : avgWin != null ? "AI probability avg" : "No submissions yet";

  // Pipeline distribution for the status bar
  const PIPELINE_STAGES = [
    { key: "draft",       label: "Draft",      statuses: ["draft"] },
    { key: "in_progress", label: "In Proposal", statuses: ["analyzing","in_progress"] },
    { key: "in_review",   label: "In Review",   statuses: ["in_review","ready"] },
    { key: "submitted",   label: "Submitted",   statuses: ["submitted"] },
    { key: "won",         label: "Won",         statuses: ["won"] },
    { key: "lost",        label: "Lost",        statuses: ["lost","no_bid"] },
  ];
  const stageCounts = PIPELINE_STAGES.map((s) => ({
    ...s,
    count: tenders.filter((t) => s.statuses.includes(t.status)).length,
    color: STATUS_META[s.key]?.color ?? "#94A3B8",
  }));
  const total = tenders.length;

  // Recent tenders (sorted by created_at desc)
  const recent = [...tenders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Won/Lost for outcome history
  const wonTenders  = tenders.filter((t) => t.status === "won");
  const lostTenders = tenders.filter((t) => t.status === "lost");

  async function fetchAiSummary() {
    setLoadingSummary(true);
    setAiSummary("");
    const res = await fetch("/api/reports/summary", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setAiSummary(data.summary ?? "Unable to generate summary.");
    setLoadingSummary(false);
  }

  const KPI = [
    { label: "Active Tenders",     value: String(active.length),                   sub: `${tenders.length} total across all stages`, icon: "folder_open",  color: "text-primary" },
    { label: "Win Rate",           value: displayWinRate,                           sub: winRateSub,                                  icon: "emoji_events", color: "text-success" },
    { label: "Pipeline Value",     value: pipelineVal ? fmt(pipelineVal) : "—",    sub: "Active bids combined",                      icon: "payments",     color: "text-primary" },
    { label: "Upcoming Deadlines", value: String(upcoming.length),                  sub: upcoming.length > 0 ? `Next in ${daysUntil(upcoming[0].submission_deadline!)}d` : "None in 30 days",
                                                                                                                                      icon: "schedule",     color: upcoming.length > 0 ? "text-warning" : "text-text-muted" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border-light bg-surface">
        <div>
          <h1 className="text-[20px] font-semibold text-text">
            {userName ? `${greeting}, ${userName}` : "Dashboard"}
          </h1>
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
            {userInitials}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* KPI Cards */}
        <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {KPI.map((card) => (
            <div key={card.label} className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] uppercase tracking-wide font-medium text-text-secondary">{card.label}</p>
                <span className={`material-symbols-outlined text-[20px] ${card.color}`}>{card.icon}</span>
              </div>
              <p className={`text-[28px] font-bold leading-none ${card.color}`}>{card.value}</p>
              <p className="mt-1.5 text-[11px] text-text-muted">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Pipeline status distribution bar */}
        {total > 0 && (
          <div className="mb-6 rounded-lg border border-border bg-surface shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-semibold text-text">Pipeline Distribution</p>
              <p className="text-[11px] text-text-muted">{total} tender{total !== 1 ? "s" : ""} total</p>
            </div>
            {/* Stacked bar */}
            <div className="flex h-3 w-full overflow-hidden rounded-full mb-3 gap-0.5">
              {stageCounts.filter((s) => s.count > 0).map((s) => (
                <div
                  key={s.key}
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${(s.count / total) * 100}%`, background: s.color, minWidth: 4 }}
                  title={`${s.label}: ${s.count}`}
                />
              ))}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {stageCounts.map((s) => (
                <button
                  key={s.key}
                  onClick={() => router.push(`/tenders`)}
                  className="flex items-center gap-1.5 text-[11.5px] text-text-secondary hover:text-text transition-colors"
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                  {s.label}
                  <span className="font-bold text-text">{s.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Active Pipeline table */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-light">
                <h2 className="text-[14px] font-semibold text-text">Active Pipeline</h2>
                <button
                  onClick={() => router.push("/tenders")}
                  className="rounded border border-border px-3 py-1 text-[11px] text-text-secondary hover:bg-surface-dim transition-colors"
                >
                  View all →
                </button>
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
                      <th className="px-5 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Tender</th>
                      <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Value</th>
                      <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                      <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Deadline</th>
                      <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">AI Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.slice(0, 6).map((t) => {
                      const s = STATUS_META[t.status] ?? { label: t.status, cls: "text-text-muted bg-surface-dim" };
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
                          <td className="px-4 py-3.5 font-medium text-text">{t.contract_value ? fmt(t.contract_value) : "—"}</td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.cls}`}>{s.label}</span>
                          </td>
                          <td className={`px-4 py-3.5 text-[12px] ${d != null && d <= 7 ? "text-danger font-medium" : "text-text-secondary"}`}>
                            {d != null ? (d >= 0 ? `${d}d` : "Passed") : "—"}
                          </td>
                          <td className="px-4 py-3.5">
                            {t.win_probability != null ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-surface-mid max-w-[60px] overflow-hidden">
                                  <div className="h-full rounded-full bg-primary" style={{ width: `${t.win_probability}%` }} />
                                </div>
                                <span className="text-[12px] font-medium text-text">{t.win_probability}%</span>
                              </div>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {active.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-[12px] text-text-muted">
                          No active tenders — upload an RFP to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            {/* Priority Deadlines */}
            <div className="rounded-lg border border-border bg-surface shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border-light">
                <span className="material-symbols-outlined text-[15px] text-warning">schedule</span>
                <h2 className="text-[13px] font-semibold text-text">Priority Deadlines</h2>
              </div>
              <div className="p-4 flex flex-col gap-2.5">
                {upcoming.length === 0 ? (
                  <p className="text-[12px] text-text-muted text-center py-4">No deadlines in 30 days</p>
                ) : (
                  upcoming.slice(0, 5).map((t) => {
                    const d = daysUntil(t.submission_deadline!);
                    return (
                      <button
                        key={t.id}
                        onClick={() => router.push(`/tenders/${t.id}`)}
                        className="flex items-center gap-3 text-start w-full hover:bg-surface-dim rounded-lg px-2 py-2 transition-colors group"
                      >
                        {/* Urgency indicator */}
                        <div className={`h-8 w-1 rounded-full shrink-0 ${d <= 3 ? "bg-danger" : d <= 7 ? "bg-warning" : "bg-border"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-medium text-text truncate group-hover:text-primary transition-colors">{t.name}</p>
                          {t.client && <p className="text-[10.5px] text-text-muted">{t.client}</p>}
                        </div>
                        <span className={`ml-2 shrink-0 text-[11px] font-bold ${d <= 3 ? "text-danger" : d <= 7 ? "text-warning" : "text-text-secondary"}`}>
                          {d === 0 ? "Today!" : d === 1 ? "Tomorrow" : `${d}d`}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-lg border border-border bg-surface shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
                <h2 className="text-[13px] font-semibold text-text">Recent Activity</h2>
                <button onClick={() => router.push("/tenders")} className="text-[11px] text-primary hover:underline">All →</button>
              </div>
              <div className="p-3 flex flex-col gap-1">
                {recent.length === 0 ? (
                  <p className="text-[12px] text-text-muted text-center py-4">No activity yet</p>
                ) : (
                  recent.slice(0, 6).map((t) => {
                    const s = STATUS_META[t.status] ?? { label: t.status, cls: "text-text-muted bg-surface-dim", color: "#94A3B8" };
                    return (
                      <button
                        key={t.id}
                        onClick={() => router.push(`/tenders/${t.id}`)}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-dim transition-colors text-start group"
                      >
                        <div className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center" style={{ background: `${s.color}20` }}>
                          <span className="material-symbols-outlined text-[14px]" style={{ color: s.color }}>description</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-text truncate group-hover:text-primary transition-colors">{t.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`inline-flex rounded px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide ${s.cls}`}>{s.label}</span>
                            <span className="text-[10px] text-text-muted">{relTime(t.created_at)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Win / Loss Breakdown ───────────────────────────────────────────── */}
        {(wonTenders.length > 0 || lostTenders.length > 0) && (
          <div className="mt-5 rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-light">
              <h2 className="text-[14px] font-semibold text-text">Bid Outcomes</h2>
              <div className="flex items-center gap-3 text-[12px] text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  {wonTenders.length} Won
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-danger" />
                  {lostTenders.length} Lost
                </span>
              </div>
            </div>

            {/* Visual bar */}
            {(wonTenders.length + lostTenders.length) > 0 && (
              <div className="px-5 pt-4 pb-2">
                <div className="flex h-3 w-full rounded-full overflow-hidden gap-0.5">
                  {wonTenders.length > 0 && (
                    <div
                      className="h-full bg-success rounded-full transition-all"
                      style={{ width: `${(wonTenders.length / (wonTenders.length + lostTenders.length)) * 100}%` }}
                    />
                  )}
                  {lostTenders.length > 0 && (
                    <div
                      className="h-full bg-danger rounded-full transition-all"
                      style={{ width: `${(lostTenders.length / (wonTenders.length + lostTenders.length)) * 100}%` }}
                    />
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-text-muted">
                  {winRate != null ? `${winRate}% win rate from ${totalSubmitted} submitted tenders` : `${wonTenders.length + lostTenders.length} decided`}
                </p>
              </div>
            )}

            <div className="grid gap-0 sm:grid-cols-2 divide-x divide-border-light">
              {/* Won */}
              <div className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-success mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">emoji_events</span> Won
                </p>
                {wonTenders.length === 0 ? (
                  <p className="text-[12px] text-text-muted">No wins yet</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {wonTenders.slice(0, 4).map((t) => (
                      <button key={t.id} onClick={() => router.push(`/tenders/${t.id}`)} className="flex items-center justify-between text-start hover:bg-surface-dim rounded px-2 py-1.5 transition-colors group">
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-medium text-text truncate group-hover:text-success transition-colors">{t.name}</p>
                          {t.client && <p className="text-[10.5px] text-text-muted">{t.client}</p>}
                        </div>
                        {t.contract_value && (
                          <span className="ml-3 text-[11px] font-semibold text-success shrink-0">{fmt(t.contract_value)}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Lost */}
              <div className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-danger mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">sentiment_dissatisfied</span> Lost
                </p>
                {lostTenders.length === 0 ? (
                  <p className="text-[12px] text-text-muted">No losses recorded</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {lostTenders.slice(0, 4).map((t) => (
                      <button key={t.id} onClick={() => router.push(`/tenders/${t.id}`)} className="flex items-center justify-between text-start hover:bg-surface-dim rounded px-2 py-1.5 transition-colors group">
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-medium text-text truncate group-hover:text-danger transition-colors">{t.name}</p>
                          {t.client && <p className="text-[10.5px] text-text-muted">{t.client}</p>}
                        </div>
                        <span className="ml-3 material-symbols-outlined text-[14px] text-text-muted shrink-0">arrow_forward</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── AI Portfolio Intelligence ─────────────────────────────────────── */}
        <div className="mt-5 rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-light">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-primary">smart_toy</span>
              <h2 className="text-[14px] font-semibold text-text">AI Portfolio Intelligence</h2>
            </div>
            <button
              onClick={fetchAiSummary}
              disabled={loadingSummary || tenders.length === 0}
              className="flex items-center gap-1.5 rounded border border-border px-3.5 py-2 text-[12px] font-medium text-text-secondary hover:bg-surface-dim disabled:opacity-50 transition-colors"
            >
              {loadingSummary
                ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                : <span className="material-symbols-outlined text-[14px]">refresh</span>}
              {loadingSummary ? "Analysing…" : aiSummary ? "Refresh" : "Generate Report"}
            </button>
          </div>
          {aiSummary ? (
            <div className="p-5">
              <p className="text-[13px] leading-[1.75] text-text whitespace-pre-wrap">{aiSummary}</p>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-5">
              <span className="material-symbols-outlined text-[32px] text-text-muted shrink-0">insights</span>
              <div>
                <p className="text-[13px] font-medium text-text">Get a strategic overview of your bid portfolio</p>
                <p className="text-[12px] text-text-secondary mt-0.5">
                  AI analyses all active tenders, identifies risks, highlights opportunities, and gives 30-day recommendations.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Quick actions / New tender CTA */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {/* Upload CTA */}
          <div
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border-2 border-dashed border-border hover:border-primary/40 hover:bg-surface-dim/50 cursor-pointer transition-all p-5 flex items-center gap-4"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px] text-primary">upload_file</span>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-text">New Tender from RFP</p>
              <p className="text-[11.5px] text-text-secondary mt-0.5">Upload a PDF, DOCX, XLSX or ZIP — AI generates the full bid package automatically</p>
            </div>
            {uploading && <span className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />}
          </div>

          {/* AI banner */}
          <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
            <div className="flex items-start gap-4 p-5 h-full" style={{ borderLeft: "3px solid #C8A24A" }}>
              <span className="material-symbols-outlined text-[22px] text-primary shrink-0 mt-0.5">smart_toy</span>
              <div>
                <p className="text-[13px] font-semibold text-text">12 AI Agents per Tender</p>
                <p className="mt-1 text-[12px] text-text-secondary leading-relaxed">
                  Technical proposal · Compliance matrix · BOQ · Manpower plan · Risk register · SLA framework · Executive review — all generated automatically from your RFP files.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
    </div>
  );
}
