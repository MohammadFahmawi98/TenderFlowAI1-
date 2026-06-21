"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { parseAllTables, extractNumber } from "@/lib/parse-agent-table";
import { textToHtml } from "@/lib/utils/text-to-html";

interface RiskRow {
  id: string;
  description: string;
  category: string;
  likelihood: number;
  impact: number;
  score: number;
  owner: string;
  mitigation: string;
  residual: string;
}

function parseScore(val: string): number {
  const n = parseFloat(val.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : Math.min(5, n);
}

function buildRiskRows(tables: Record<string, string>[][]): RiskRow[] {
  for (const table of tables) {
    if (table.length === 0) continue;
    const keys = Object.keys(table[0]);
    const isRisk = keys.some((k) => k.includes("risk") || k.includes("likelihood") || k.includes("impact"));
    if (!isRisk) continue;
    return table.map((row, i) => {
      const vals = Object.values(row);
      const likelihood = parseScore(vals[3] ?? vals[1] ?? "");
      const impact = parseScore(vals[4] ?? vals[2] ?? "");
      const scoreParsed = parseScore(vals[5] ?? "");
      return {
        id: `RISK-${String(i + 1).padStart(2, "0")}`,
        description: vals[1] ?? vals[0] ?? "—",
        category: vals[2] ?? "—",
        likelihood,
        impact,
        score: scoreParsed || (likelihood && impact ? Math.round(likelihood * impact * 10) / 10 : 0),
        owner: vals[6] ?? "—",
        mitigation: vals[7] ?? "—",
        residual: vals[8] ?? "—",
      };
    }).filter((r) => r.description && r.description !== "—");
  }
  return [];
}

function riskLevel(score: number): { label: string; cls: string; dot: string } {
  if (score >= 16) return { label: "Critical", cls: "text-danger bg-danger/10 border-danger/25",  dot: "bg-danger" };
  if (score >= 9)  return { label: "High",     cls: "text-danger bg-danger/8 border-danger/20",   dot: "bg-danger/70" };
  if (score >= 4)  return { label: "Medium",   cls: "text-warning bg-warning/10 border-warning/25", dot: "bg-warning" };
  return { label: "Low", cls: "text-success bg-success/10 border-success/25", dot: "bg-success" };
}

// 5×5 Heatmap: likelihood(x) vs impact(y)
function buildHeatmap(rows: RiskRow[]): number[][] {
  const grid: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
  for (const r of rows) {
    const x = Math.min(4, Math.max(0, Math.round(r.likelihood) - 1));
    const y = Math.min(4, Math.max(0, Math.round(r.impact) - 1));
    grid[4 - y][x] += 1;
  }
  return grid;
}

function heatColor(val: number, likelihood: number, impact: number): string {
  const score = likelihood * impact;
  if (score >= 16) return val > 0 ? "bg-danger text-white" : "bg-danger/20";
  if (score >= 9)  return val > 0 ? "bg-orange-500 text-white" : "bg-orange-100";
  if (score >= 4)  return val > 0 ? "bg-warning text-white" : "bg-warning/20";
  return val > 0 ? "bg-success text-white" : "bg-success/10";
}

export default function RiskPage() {
  const { id } = useParams<{ id: string }>();
  const [content, setContent] = useState("");
  const [agentStatus, setAgentStatus] = useState("waiting");
  const [filterLevel, setFilterLevel] = useState("all");

  useEffect(() => {
    fetch(`/api/tenders/${id}/agents`).then((r) => r.json()).then((agents) => {
      const run = Array.isArray(agents) && agents.find((a: { agent_type: string }) => a.agent_type === "risk");
      if (run) { setAgentStatus(run.status); setContent(run.output_content ?? ""); }
    }).catch(console.error);
  }, [id]);

  const tables   = useMemo(() => parseAllTables(content), [content]);
  const allRisks = useMemo(() => buildRiskRows(tables), [tables]);
  const html     = useMemo(() => content ? textToHtml(content) : "", [content]);
  const filtered = useMemo(() => {
    if (filterLevel === "all") return allRisks;
    return allRisks.filter((r) => riskLevel(r.score).label.toLowerCase() === filterLevel);
  }, [allRisks, filterLevel]);

  const heatmap = useMemo(() => buildHeatmap(allRisks), [allRisks]);
  const critical = allRisks.filter((r) => r.score >= 16).length;
  const high = allRisks.filter((r) => r.score >= 9 && r.score < 16).length;
  const avgScore = allRisks.length
    ? (allRisks.reduce((s, r) => s + r.score, 0) / allRisks.length).toFixed(1)
    : "—";

  const mitScore = extractNumber(content, [/mitigation score[:\s]+([\d.]+)/i, /score[:\s]+([\d.]+)\s*\/\s*5/i]);

  if (agentStatus !== "completed" && !content) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <span className="material-symbols-outlined text-[44px] text-text-muted">warning_amber</span>
        <p className="text-[15px] font-semibold text-text">Risk Register Not Generated</p>
        <p className="text-[13px] text-text-secondary max-w-sm">
          Click <strong>Run AI</strong> in the workspace header to generate the risk register.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Risks Identified", value: String(allRisks.length || "—"), sub: "Total risks in register", color: "text-text" },
          { label: "Critical / High", value: allRisks.length ? `${critical + high}` : "—", sub: `${critical} critical · ${high} high`, color: critical > 0 ? "text-danger" : "text-warning" },
          { label: "Avg Risk Score", value: String(avgScore), sub: "Out of 25 (L×I)", color: "text-text" },
          { label: "Mitigation Score", value: mitScore != null ? `${mitScore}/5` : "—", sub: "AI assessment", color: "text-primary" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-[10.5px] uppercase tracking-wide text-text-secondary mb-1">{kpi.label}</p>
            <p className={`text-[28px] font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[11px] text-text-muted mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Heatmap + Register */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* Risk Heatmap */}
        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border-light px-5 py-3.5">
            <span className="material-symbols-outlined text-[16px] text-text-muted">grid_on</span>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Risk Heatmap</p>
          </div>
          <div className="p-5">
            <div className="flex gap-1 mb-1">
              <div className="w-8 shrink-0" />
              {[1, 2, 3, 4, 5].map((l) => (
                <div key={l} className="flex-1 text-center text-[9px] text-text-muted font-medium">{l}</div>
              ))}
            </div>
            {heatmap.map((row, ri) => (
              <div key={ri} className="flex gap-1 mb-1">
                <div className="w-8 shrink-0 flex items-center justify-end pr-1 text-[9px] text-text-muted font-medium">{5 - ri}</div>
                {row.map((val, ci) => (
                  <div key={ci} className={`flex-1 aspect-square flex items-center justify-center rounded text-[10px] font-bold transition-all ${heatColor(val, ci + 1, 5 - ri)}`}>
                    {val > 0 ? val : ""}
                  </div>
                ))}
              </div>
            ))}
            <div className="mt-3 flex items-center justify-between text-[9.5px] text-text-muted">
              <span>← Likelihood →</span>
            </div>
            <div className="mt-2 text-[9.5px] text-text-muted text-center">↑ Impact ↑</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { label: "Critical (16+)", cls: "bg-danger" },
                { label: "High (9-15)", cls: "bg-orange-500" },
                { label: "Medium (4-8)", cls: "bg-warning" },
                { label: "Low (<4)", cls: "bg-success" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-sm ${l.cls}`} />
                  <span className="text-[9.5px] text-text-muted">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Risk Register Table */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-light px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-text-muted">table_chart</span>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Risk Register</p>
            </div>
            <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}
              className="rounded border border-border bg-surface px-2 py-1 text-[11px] text-text-secondary outline-none">
              <option value="all">All Levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          {filtered.length === 0 ? (
            <p className="p-6 text-[12px] text-text-muted text-center">Risk data will appear here once AI agents complete.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-border-light bg-surface-dim">
                    {["ID", "Risk Description", "Category", "L", "I", "Score", "Mitigation"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((risk) => {
                    const level = riskLevel(risk.score);
                    return (
                      <tr key={risk.id} className="border-b border-border-light last:border-0 hover:bg-surface-dim/40 transition-colors">
                        <td className="px-3 py-3 font-mono text-[10.5px] font-semibold text-text-secondary whitespace-nowrap">{risk.id}</td>
                        <td className="px-3 py-3 text-[12px] text-text max-w-[180px]">
                          <p className="line-clamp-2">{risk.description}</p>
                          {risk.owner && risk.owner !== "—" && (
                            <p className="text-[10px] text-text-muted mt-0.5">Owner: {risk.owner}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-[11px] text-text-secondary whitespace-nowrap">{risk.category}</td>
                        <td className="px-3 py-3 text-center font-semibold text-text">{risk.likelihood || "—"}</td>
                        <td className="px-3 py-3 text-center font-semibold text-text">{risk.impact || "—"}</td>
                        <td className="px-3 py-3">
                          <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${level.cls}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${level.dot}`} />
                            {risk.score || "—"}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-text-secondary max-w-[160px]">
                          <p className="line-clamp-2">{risk.mitigation}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* AI Full Content — shown when table parsing found no rows */}
      {html && allRisks.length === 0 && (
        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border-light px-5 py-3.5">
            <span className="material-symbols-outlined text-[16px] text-primary">smart_toy</span>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">AI Risk Analysis</p>
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wide">AI Generated</span>
          </div>
          <div className="px-5 py-4 text-[13px] leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
    </div>
  );
}
