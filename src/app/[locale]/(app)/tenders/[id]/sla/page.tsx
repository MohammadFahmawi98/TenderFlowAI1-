"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { parseAllTables, extractNumber } from "@/lib/parse-agent-table";
import { textToHtml } from "@/lib/utils/text-to-html";

interface SLARow {
  id: string;
  service: string;
  category: string;
  target: string;
  measurement: string;
  penalty: string;
  priority: string;
}

interface KPIRow {
  id: string;
  kpi: string;
  unit: string;
  target: string;
  frequency: string;
  weight: string;
}

function buildSLARows(tables: Record<string, string>[][]): SLARow[] {
  for (const table of tables) {
    if (table.length === 0) continue;
    const keys = Object.keys(table[0]);
    const isSLA = keys.some((k) =>
      k.includes("sla") || k.includes("service level") || k.includes("response") || k.includes("availability") || k.includes("penalty")
    );
    if (!isSLA) continue;
    return table.map((row, i) => {
      const vals = Object.values(row);
      return {
        id: `SLA-${String(i + 1).padStart(2, "0")}`,
        service: vals[0] ?? "—",
        category: vals[1] ?? "General",
        target: vals[2] ?? "—",
        measurement: vals[3] ?? "—",
        penalty: vals[4] ?? "—",
        priority: vals[5] ?? "Medium",
      };
    }).filter((r) => r.service && r.service !== "—");
  }
  return [];
}

function buildKPIRows(tables: Record<string, string>[][]): KPIRow[] {
  for (const table of tables) {
    if (table.length === 0) continue;
    const keys = Object.keys(table[0]);
    const isKPI = keys.some((k) => k.includes("kpi") || k.includes("indicator") || k.includes("frequency") || k.includes("weight"));
    if (!isKPI) continue;
    return table.map((row, i) => {
      const vals = Object.values(row);
      return {
        id: `KPI-${String(i + 1).padStart(2, "0")}`,
        kpi: vals[0] ?? "—",
        unit: vals[1] ?? "%",
        target: vals[2] ?? "—",
        frequency: vals[3] ?? "Monthly",
        weight: vals[4] ?? "—",
      };
    }).filter((r) => r.kpi && r.kpi !== "—");
  }
  return [];
}

function priorityStyle(p: string): string {
  const lower = p.toLowerCase();
  if (lower.includes("critical") || lower.includes("high")) return "text-danger bg-danger/10 border-danger/25";
  if (lower.includes("medium")) return "text-warning bg-warning/10 border-warning/25";
  return "text-success bg-success/10 border-success/25";
}

function categoryColor(cat: string): string {
  const lower = cat.toLowerCase();
  if (lower.includes("hvac") || lower.includes("mechan")) return "bg-warning/10 text-warning";
  if (lower.includes("clean") || lower.includes("soft")) return "bg-success/10 text-success";
  if (lower.includes("secur")) return "bg-danger/10 text-danger";
  if (lower.includes("electr")) return "bg-warning/10 text-warning";
  return "bg-primary-light text-primary";
}

export default function SlaPage() {
  const { id } = useParams<{ id: string }>();
  const [content, setContent] = useState("");
  const [agentStatus, setAgentStatus] = useState("waiting");
  const [activeTab, setActiveTab] = useState<"sla" | "kpi">("sla");

  useEffect(() => {
    fetch(`/api/tenders/${id}/agents`).then((r) => r.json()).then((agents) => {
      const run = Array.isArray(agents) && agents.find((a: { agent_type: string }) => a.agent_type === "sla");
      if (run) { setAgentStatus(run.status); setContent(run.output_content ?? ""); }
    }).catch(console.error);
  }, [id]);

  const tables   = useMemo(() => parseAllTables(content), [content]);
  const slaRows  = useMemo(() => buildSLARows(tables), [tables]);
  const kpiRows  = useMemo(() => buildKPIRows(tables), [tables]);
  const html     = useMemo(() => content ? textToHtml(content) : "", [content]);

  const overallScore = useMemo(() => extractNumber(content, [
    /overall sla score[:\s]+([\d.]+)/i,
    /compliance score[:\s]+([\d.]+)/i,
    /sla score[:\s]+([\d.]+)/i,
  ]) ?? 0, [content]);

  const penaltyRate = useMemo(() => extractNumber(content, [
    /penalty[:\s]+([\d.]+)%/i,
    /(\d+)%\s*penalty/i,
  ]) ?? 0, [content]);

  const responseTime = useMemo(() => {
    const m = content.match(/response time[:\s]+([^\n.]{0,40})/i);
    return m?.[1]?.trim() ?? null;
  }, [content]);

  const aiSummary = useMemo(() => {
    const m = content.match(/executive summary[:\s]+([\s\S]{0,300})/i)
      ?? content.match(/AI? recommendation[:\s]+([\s\S]{0,250})/i)
      ?? content.match(/framework[:\s]+([\s\S]{0,200})/i);
    return m?.[1]?.trim().replace(/\n+/g, " ").slice(0, 250) ?? null;
  }, [content]);

  const criticalSLAs = slaRows.filter((r) =>
    r.priority.toLowerCase().includes("critical") || r.priority.toLowerCase().includes("high")
  ).length;

  if (agentStatus !== "completed" && !content) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <span className="material-symbols-outlined text-[44px] text-text-muted">speed</span>
        <p className="text-[15px] font-semibold text-text">SLA & KPI Framework Not Generated</p>
        <p className="text-[13px] text-text-secondary max-w-sm">
          Click <strong>Run AI</strong> in the workspace header to generate the service level agreements and KPI framework.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* AI Summary Banner */}
      {aiSummary && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-light/20 px-5 py-4">
          <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5">auto_awesome</span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-1">AI Framework Analysis</p>
            <p className="text-[12.5px] text-text leading-relaxed">{aiSummary}</p>
          </div>
          {overallScore > 0 && (
            <div className="shrink-0 ml-4 text-center">
              <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>
                <svg width="56" height="56" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="28" cy="28" r="22" fill="none" stroke="var(--color-surface-mid)" strokeWidth="5" />
                  <circle cx="28" cy="28" r="22" fill="none"
                    stroke={overallScore >= 80 ? "#10B981" : overallScore >= 60 ? "#F59E0B" : "#EF4444"}
                    strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={138.2}
                    strokeDashoffset={138.2 - (overallScore / 100) * 138.2}
                    style={{ transition: "stroke-dashoffset 1s ease" }} />
                </svg>
                <div className="absolute text-[13px] font-bold text-text">{overallScore}</div>
              </div>
              <p className="text-[9.5px] text-text-muted mt-0.5">SLA Score</p>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "SLA Requirements", value: slaRows.length || "—", sub: "Service level agreements", color: "text-text" },
          { label: "Critical / High", value: slaRows.length ? criticalSLAs : "—", sub: "Priority SLAs", color: criticalSLAs > 0 ? "text-danger" : "text-text" },
          { label: "KPIs Defined", value: kpiRows.length || "—", sub: "Performance indicators", color: "text-primary" },
          { label: "Penalty Rate", value: penaltyRate ? `${penaltyRate}%` : responseTime ? responseTime : "—", sub: penaltyRate ? "Of contract value" : "Response time target", color: "text-warning" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-[10.5px] uppercase tracking-wide text-text-secondary mb-1">{kpi.label}</p>
            <p className={`text-[26px] font-bold leading-tight ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[11px] text-text-muted mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-border-light">
        {(["sla", "kpi"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              "px-4 py-2.5 text-[12.5px] font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text",
            ].join(" ")}
          >
            {tab === "sla" ? `SLA Matrix (${slaRows.length})` : `KPI Dashboard (${kpiRows.length})`}
          </button>
        ))}
      </div>

      {/* SLA Matrix */}
      {activeTab === "sla" && (
        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border-light px-5 py-3.5">
            <span className="material-symbols-outlined text-[16px] text-text-muted">checklist_rtl</span>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Service Level Agreement Matrix</p>
            <span className="ml-auto text-[11px] text-text-muted">{slaRows.length} requirements</span>
          </div>
          {slaRows.length === 0 ? (
            <p className="p-6 text-[12px] text-text-muted text-center">SLA matrix will appear here once AI agents complete.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-border-light bg-surface-dim">
                    {["ID", "Service Description", "Category", "SLA Target", "Measurement", "Penalty", "Priority"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slaRows.map((row) => (
                    <tr key={row.id} className="border-b border-border-light last:border-0 hover:bg-surface-dim/30 transition-colors">
                      <td className="px-3 py-3 font-mono text-[10.5px] font-semibold text-text-secondary whitespace-nowrap">{row.id}</td>
                      <td className="px-3 py-3 text-[12px] text-text max-w-[200px]">
                        <p className="line-clamp-2">{row.service}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${categoryColor(row.category)}`}>
                          {row.category.slice(0, 12)}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-text whitespace-nowrap">{row.target}</td>
                      <td className="px-3 py-3 text-[11.5px] text-text-secondary max-w-[140px]">
                        <p className="line-clamp-2">{row.measurement}</p>
                      </td>
                      <td className="px-3 py-3 text-[11.5px] text-danger font-medium whitespace-nowrap">{row.penalty}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold ${priorityStyle(row.priority)}`}>
                          {row.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* KPI Dashboard */}
      {activeTab === "kpi" && (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* KPI Table */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border-light px-5 py-3.5">
              <span className="material-symbols-outlined text-[16px] text-text-muted">bar_chart_4_bars</span>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Key Performance Indicators</p>
            </div>
            {kpiRows.length === 0 ? (
              <p className="p-6 text-[12px] text-text-muted text-center">KPI dashboard will appear here once AI agents complete.</p>
            ) : (
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-border-light bg-surface-dim">
                    {["ID", "KPI", "Unit", "Target", "Frequency", "Weight"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wide text-text-secondary">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kpiRows.map((row) => (
                    <tr key={row.id} className="border-b border-border-light last:border-0 hover:bg-surface-dim/30 transition-colors">
                      <td className="px-3 py-3 font-mono text-[10.5px] text-text-secondary">{row.id}</td>
                      <td className="px-3 py-3 font-medium text-text max-w-[180px]">
                        <p className="line-clamp-2">{row.kpi}</p>
                      </td>
                      <td className="px-3 py-3 text-[11.5px] text-text-secondary">{row.unit}</td>
                      <td className="px-3 py-3 font-semibold text-primary">{row.target}</td>
                      <td className="px-3 py-3 text-[11.5px] text-text-secondary">{row.frequency}</td>
                      <td className="px-3 py-3">
                        {row.weight && row.weight !== "—" ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-surface-mid overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: row.weight.replace(/[^0-9]/g, "") + "%" }} />
                            </div>
                            <span className="text-[11px] text-text">{row.weight}</span>
                          </div>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Measurement & Review */}
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border-light px-5 py-3.5">
                <span className="material-symbols-outlined text-[16px] text-text-muted">calendar_month</span>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Review Cadence</p>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {[
                  { freq: "Daily", icon: "today", desc: "Operational KPIs, incident tracking" },
                  { freq: "Weekly", icon: "date_range", desc: "SLA performance report" },
                  { freq: "Monthly", icon: "calendar_month", desc: "Management review, penalty calc" },
                  { freq: "Quarterly", icon: "event_repeat", desc: "Strategic review, target revision" },
                ].map((item) => (
                  <div key={item.freq} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light shrink-0">
                      <span className="material-symbols-outlined text-[15px] text-primary">{item.icon}</span>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-text">{item.freq}</p>
                      <p className="text-[11px] text-text-muted">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Penalty regime */}
            <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border-light px-5 py-3.5">
                <span className="material-symbols-outlined text-[16px] text-text-muted">gavel</span>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Penalty Regime</p>
              </div>
              <div className="p-4 flex flex-col gap-2.5 text-[12px]">
                {[
                  { label: "Minor breach", pct: "0.5%", color: "text-success" },
                  { label: "Moderate breach", pct: "1–2%", color: "text-warning" },
                  { label: "Critical breach", pct: "3–5%", color: "text-danger" },
                  { label: "Repeated breach", pct: "Up to 10%", color: "text-danger" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-1 border-b border-border-light last:border-0">
                    <span className="text-text-secondary">{item.label}</span>
                    <span className={`font-semibold ${item.color}`}>{item.pct}</span>
                  </div>
                ))}
                <p className="text-[10.5px] text-text-muted mt-1">% of monthly contract value</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Full Content — shown when table parsing found no rows */}
      {html && slaRows.length === 0 && kpiRows.length === 0 && (
        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border-light px-5 py-3.5">
            <span className="material-symbols-outlined text-[16px] text-primary">smart_toy</span>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">AI SLA & KPI Analysis</p>
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wide">AI Generated</span>
          </div>
          <div className="px-5 py-4 text-[13px] leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
    </div>
  );
}
