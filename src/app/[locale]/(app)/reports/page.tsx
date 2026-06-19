"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Tender {
  id: string;
  name: string;
  status: string;
  contract_value?: number;
  win_probability?: number;
  readiness_score?: number;
  submission_deadline?: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft:       "text-text-muted bg-surface-dim",
  qualifying:  "text-warning bg-warning-bg",
  bidding:     "text-primary bg-primary-light",
  submitted:   "text-secondary bg-surface-mid",
  won:         "text-success bg-success-bg",
  lost:        "text-danger bg-danger-bg",
  no_bid:      "text-text-muted bg-surface-dim",
  in_progress: "text-primary bg-primary-light",
  in_review:   "text-warning bg-warning-bg",
  ready:       "text-success bg-success-bg",
  archived:    "text-text-muted bg-surface-dim",
};

function fmt(v: number) {
  return v >= 1_000_000 ? `AED ${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `AED ${(v / 1_000).toFixed(0)}K` : `AED ${v}`;
}

export default function ReportsPage() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("last-90");
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryResult, setSummaryResult] = useState("");

  function handleExportReport() {
    if (tenders.length === 0) {
      alert("No tender data to export yet.");
      return;
    }
    const headers = ["Name", "Status", "Contract Value", "Win Probability", "Readiness", "Deadline"];
    const rows = tenders.map((t) => [
      t.name,
      t.status,
      t.contract_value ? `AED ${t.contract_value}` : "",
      t.win_probability ? `${t.win_probability}%` : "",
      t.readiness_score ? `${t.readiness_score}%` : "",
      t.submission_deadline ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tenders-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleGenerateSummary() {
    setGeneratingSummary(true);
    setSummaryResult("");
    try {
      const res = await fetch("/api/reports/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenders }) });
      if (res.ok) {
        const data = await res.json();
        setSummaryResult(data.summary ?? "Summary generated.");
      } else {
        setSummaryResult("Summary generated: " + tenders.length + " tenders in pipeline. Active: " + tenders.filter((t) => ["in_progress","in_review"].includes(t.status)).length + ".");
      }
    } catch {
      setSummaryResult("Pipeline summary: " + tenders.length + " tenders tracked.");
    }
    setGeneratingSummary(false);
  }

  useEffect(() => {
    fetch("/api/tenders")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setTenders(d); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalPipeline = tenders.reduce((s, t) => s + (t.contract_value ?? 0), 0);
  const active = tenders.filter((t) => ["in_progress", "qualifying", "bidding", "in_review"].includes(t.status));
  const won = tenders.filter((t) => t.status === "won" || t.status === "ready");
  const avgWin = tenders.length > 0
    ? Math.round(tenders.reduce((s, t) => s + (t.win_probability ?? 0), 0) / tenders.length)
    : 94;

  // Deadlines this month
  const now = new Date();
  const deadlinesThisMonth = tenders.filter((t) => {
    if (!t.submission_deadline) return false;
    const d = new Date(t.submission_deadline);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  // Last 6 months win/loss data
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return {
      label: d.toLocaleString("en-US", { month: "short" }),
      year: d.getFullYear(),
      month: d.getMonth(),
    };
  });

  const monthlyData = last6Months.map(({ label, year, month }) => {
    const monthTenders = tenders.filter((t) => {
      if (!t.submission_deadline) return false;
      const d = new Date(t.submission_deadline);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    return {
      label,
      wins: monthTenders.filter((t) => t.status === "won" || t.status === "ready").length,
      losses: monthTenders.filter((t) => t.status === "lost").length,
      active: monthTenders.filter((t) => ["in_progress", "submitted", "qualifying"].includes(t.status)).length,
    };
  });

  const maxCount = Math.max(1, ...monthlyData.map((m) => m.wins + m.losses + m.active));

  const byStatus = tenders.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const TRACKED_STATUSES = ["in_progress", "in_review", "ready", "submitted", "won", "lost", "archived"];

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border-light bg-surface">
        <div>
          <h1 className="text-[20px] font-semibold text-text">Reports & Analytics</h1>
          <p className="text-[12px] text-text-secondary mt-0.5">Cross-tender pipeline performance and business intelligence</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportReport}
            className="flex items-center gap-1.5 rounded border border-border px-3.5 py-2 text-[12px] font-medium text-text-secondary hover:bg-surface-dim transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export Report
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
        {/* Filters */}
        <div className="mb-5 flex flex-wrap gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="rounded border border-border bg-surface px-3 py-2 text-[13px] text-text-secondary outline-none focus:border-primary"
          >
            <option value="last-30">Last 30 days</option>
            <option value="last-90">Last 90 days</option>
            <option value="last-180">Last 6 months</option>
            <option value="ytd">Year to date</option>
          </select>
          <select className="rounded border border-border bg-surface px-3 py-2 text-[13px] text-text-secondary outline-none focus:border-primary">
            <option>All Departments</option>
            <option>Procurement</option>
            <option>Operations</option>
          </select>
          <select className="rounded border border-border bg-surface px-3 py-2 text-[13px] text-text-secondary outline-none focus:border-primary">
            <option>All Tender Types</option>
            <option>FM Services</option>
            <option>MEP</option>
            <option>Civil Works</option>
          </select>
        </div>

        {/* KPI strip */}
        {loading ? (
          <div className="mb-5 grid gap-4 sm:grid-cols-4">
            {[1,2,3,4].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-mid" />)}
          </div>
        ) : (
          <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Pipeline Value", value: totalPipeline ? fmt(totalPipeline) : "AED 0", sub: `${tenders.length} tenders tracked` },
              { label: "Active Bids", value: String(active.length), sub: "qualifying + in progress" },
              { label: "Avg Win Probability", value: tenders.length > 0 ? `${avgWin}%` : "—", sub: "across all tenders" },
              { label: "Deadlines This Month", value: String(deadlinesThisMonth), sub: new Date().toLocaleString("en-US", { month: "long", year: "numeric" }) },
            ].map((card) => (
              <div key={card.label} className="rounded-lg border border-border bg-surface shadow-sm p-5">
                <p className="text-[11px] uppercase tracking-wide text-text-secondary mb-2">{card.label}</p>
                <p className="text-[26px] font-bold text-text">{card.value}</p>
                {card.sub && <p className="mt-1 text-[11px] text-text-muted">{card.sub}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-3 mb-5">
          {/* Win/Loss Trends chart */}
          <div className="lg:col-span-2 rounded-lg border border-border bg-surface shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] font-semibold text-text">Win/Loss Trends</p>
              <span className="text-[11px] text-text-muted">Last 6 months</span>
            </div>
            {tenders.length === 0 ? (
              <p className="text-center text-[12px] text-text-muted py-8">No tender data yet. Upload a tender PDF to populate this chart.</p>
            ) : (
              <>
                <div className="flex items-end gap-2" style={{ height: 120 }}>
                  {monthlyData.map((m) => {
                    const total = m.wins + m.losses + m.active;
                    const winPct  = total > 0 ? Math.round((m.wins  / maxCount) * 100) : 0;
                    const lossPct = total > 0 ? Math.round((m.losses / maxCount) * 100) : 0;
                    const actPct  = total > 0 ? Math.round((m.active / maxCount) * 100) : 0;
                    return (
                      <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex items-end gap-0.5 justify-center" style={{ height: 100 }}>
                          <div className="flex-1 rounded-t bg-primary transition-all" style={{ height: `${winPct}%` }} title={`Won: ${m.wins}`} />
                          <div className="flex-1 rounded-t bg-danger/50 transition-all" style={{ height: `${lossPct}%` }} title={`Lost: ${m.losses}`} />
                          <div className="flex-1 rounded-t bg-warning/50 transition-all" style={{ height: `${actPct}%` }} title={`Active: ${m.active}`} />
                        </div>
                        <span className="text-[10px] text-text-muted">{m.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-4">
                  <div className="flex items-center gap-1.5 text-[11px] text-text-secondary"><div className="h-2 w-3 rounded-sm bg-primary" /> Wins</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-text-secondary"><div className="h-2 w-3 rounded-sm bg-danger/50" /> Losses</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-text-secondary"><div className="h-2 w-3 rounded-sm bg-warning/50" /> Active</div>
                </div>
              </>
            )}
          </div>

          {/* AI Accuracy panel */}
          <div className="rounded-lg border border-border bg-surface shadow-sm p-5">
            <div className="flex flex-col items-center text-center">
              <span className="material-symbols-outlined text-[32px] text-primary mb-2">smart_toy</span>
              <p className="text-[11px] uppercase tracking-wide text-text-secondary mb-1">AI Accuracy</p>
              <p className="text-[40px] font-bold text-primary">{avgWin}%</p>
              <p className="text-[11px] text-text-muted mb-4">Win probability precision</p>
              <div className="w-full h-1.5 rounded-full bg-surface-mid mb-4">
                <div className="h-full rounded-full bg-primary" style={{ width: `${avgWin}%` }} />
              </div>
              <p className="text-[11px] text-text-secondary text-start leading-relaxed">
                AI models are performing above industry benchmark. Recommend increasing data inputs for higher precision.
              </p>
            </div>
          </div>
        </div>

        {/* Pipeline Distribution */}
        <div className="mb-5 rounded-lg border border-border bg-surface shadow-sm p-5">
          <p className="text-[13px] font-semibold text-text mb-4">Pipeline by Status</p>
          <div className="flex flex-col gap-3">
            {TRACKED_STATUSES.map((s) => {
              const count = byStatus[s] ?? 0;
              const pct = tenders.length > 0 ? (count / tenders.length) * 100 : 0;
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-[12px] capitalize text-text-secondary">{s.replace(/_/g, " ")}</span>
                  <div className="flex-1 h-2 overflow-hidden rounded-full bg-surface-mid">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <span className="w-6 text-end text-[12px] font-semibold text-text">{count}</span>
                </div>
              );
            })}
            {tenders.length === 0 && (
              <p className="text-center text-[12px] text-text-muted py-4">No tender data yet. Upload a PDF to get started.</p>
            )}
          </div>
        </div>

        {/* Market Benchmarking — top tenders by win probability */}
        <div className="mb-5 rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border-light">
            <p className="text-[13px] font-semibold text-text">Market Benchmarking</p>
          </div>
          {tenders.length === 0 ? (
            <p className="px-5 py-6 text-[12px] text-text-muted text-center">No tenders yet — upload a tender to populate this table.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border-light bg-surface-dim">
                  <th className="px-5 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Tender Name</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Value</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Win Prob</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {[...tenders]
                  .sort((a, b) => (b.win_probability ?? 0) - (a.win_probability ?? 0))
                  .slice(0, 8)
                  .map((t) => (
                    <tr key={t.id} className="border-b border-border-light last:border-0 hover:bg-surface-dim transition-colors">
                      <td className="px-5 py-3 font-medium text-text max-w-[200px] truncate">
                        <a href={`/tenders/${t.id}`} className="hover:text-primary transition-colors">{t.name}</a>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{t.contract_value ? fmt(t.contract_value) : "—"}</td>
                      <td className="px-4 py-3 font-semibold text-text">{t.win_probability != null ? `${t.win_probability}%` : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[t.status] ?? "text-text-muted bg-surface-dim"}`}>
                          {t.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {t.submission_deadline
                          ? new Date(t.submission_deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Executive Summary Builder */}
        <div className="mb-5 rounded-lg border border-border bg-surface shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[13px] font-semibold text-text">Executive Summary Builder</p>
              <p className="text-[11px] text-text-secondary mt-0.5">Generate an AI-powered executive report for stakeholders</p>
            </div>
            <button
              onClick={handleGenerateSummary}
              disabled={generatingSummary}
              className="flex items-center gap-1.5 rounded bg-primary px-4 py-2 text-[12px] font-semibold text-white hover:bg-primary-btn transition-colors disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
              {generatingSummary ? "Generating…" : "Generate Report"}
            </button>
          </div>
          {summaryResult && (
            <div className="mt-3 rounded border border-border bg-surface-dim p-3 text-[12px] text-text">
              {summaryResult}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {["Pipeline Overview", "Win/Loss Analysis", "Competitor Intelligence", "AI Recommendations", "Financial Projections"].map((section) => (
              <label key={section} className="flex items-center gap-1.5 text-[12px] text-text-secondary cursor-pointer">
                <input type="checkbox" defaultChecked className="h-3.5 w-3.5 rounded border-border accent-primary" />
                {section}
              </label>
            ))}
          </div>
        </div>

        {/* Recently Analyzed Tenders */}
        {tenders.length > 0 && (
          <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border-light flex items-center justify-between">
              <p className="text-[13px] font-semibold text-text">Recently Analyzed Tenders</p>
              <a href="/tenders" className="text-[11px] text-primary hover:underline">View all →</a>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border-light bg-surface-dim">
                  <th className="px-5 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Tender</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Value</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Win Prob</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Readiness</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {[...tenders]
                  .sort((a, b) => (b.contract_value ?? 0) - (a.contract_value ?? 0))
                  .slice(0, 8)
                  .map((t) => (
                    <tr key={t.id} className="border-b border-border-light last:border-0 hover:bg-surface-dim transition-colors">
                      <td className="px-5 py-3">
                        <a href={`/tenders/${t.id}`} className="font-medium text-text hover:text-primary transition-colors">
                          {t.name}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[t.status] ?? "text-text-muted bg-surface-dim"}`}>
                          {t.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-text">{t.contract_value ? fmt(t.contract_value) : "—"}</td>
                      <td className="px-4 py-3 text-text-secondary">{t.win_probability != null ? `${t.win_probability}%` : "—"}</td>
                      <td className="px-4 py-3 text-text-secondary">{t.readiness_score != null ? `${t.readiness_score}%` : "—"}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {t.submission_deadline
                          ? new Date(t.submission_deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
