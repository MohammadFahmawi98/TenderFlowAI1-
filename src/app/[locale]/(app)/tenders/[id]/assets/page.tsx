"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { parseAllTables, extractNumber } from "@/lib/parse-agent-table";

interface AssetRow {
  id: string;
  name: string;
  category: string;
  quantity: number;
  condition: string;
  frequency: string;
  riskLevel: string;
  estimatedCost: number;
}

const CONDITION_CFG: Record<string, { label: string; cls: string }> = {
  excellent: { label: "Excellent", cls: "text-success bg-success/10 border-success/25" },
  good:      { label: "Good",      cls: "text-success bg-success/8 border-success/20" },
  fair:      { label: "Fair",      cls: "text-warning bg-warning/10 border-warning/25" },
  poor:      { label: "Poor",      cls: "text-danger bg-danger/10 border-danger/25" },
  critical:  { label: "Critical",  cls: "text-danger bg-danger/15 border-danger/30" },
};

const RISK_CFG: Record<string, { cls: string }> = {
  high:     { cls: "text-danger bg-danger/10 border-danger/25" },
  medium:   { cls: "text-warning bg-warning/10 border-warning/25" },
  low:      { cls: "text-success bg-success/10 border-success/25" },
  critical: { cls: "text-danger bg-danger/15 border-danger/30" },
};

function conditionCfg(val: string) {
  const lower = val.toLowerCase();
  return Object.entries(CONDITION_CFG).find(([k]) => lower.includes(k))?.[1] ?? { label: val, cls: "text-text-muted bg-surface-dim border-border" };
}
function riskCfg(val: string) {
  const lower = val.toLowerCase();
  return Object.entries(RISK_CFG).find(([k]) => lower.includes(k))?.[1] ?? { cls: "text-text-muted bg-surface-dim border-border" };
}

function buildAssets(tables: Record<string, string>[][]): AssetRow[] {
  for (const table of tables) {
    if (table.length === 0) continue;
    const keys = Object.keys(table[0]);
    const isAsset = keys.some((k) => k.includes("asset") || k.includes("equipment") || k.includes("condition") || k.includes("frequency"));
    if (!isAsset) continue;
    let idx = 0;
    return table.map((row) => {
      const vals = Object.values(row);
      idx++;
      const cost = parseFloat((vals[6] ?? vals[5] ?? "").replace(/[^0-9.]/g, "")) || 0;
      return {
        id: `AST-${String(idx).padStart(3, "0")}`,
        name: vals[0] ?? "—",
        category: vals[1] ?? "General",
        quantity: parseInt(vals[2] ?? "1") || 1,
        condition: vals[3] ?? "Fair",
        frequency: vals[4] ?? "—",
        riskLevel: vals[5] ?? "Medium",
        estimatedCost: cost,
      };
    }).filter((r) => r.name && r.name !== "—");
  }
  return [];
}

function fmtAED(v: number) {
  return v >= 1000 ? `AED ${v.toLocaleString()}` : v > 0 ? `AED ${v}` : "—";
}

export default function AssetsPage() {
  const { id } = useParams<{ id: string }>();
  const [content, setContent] = useState("");
  const [agentStatus, setAgentStatus] = useState("waiting");
  const [filterCondition, setFilterCondition] = useState("all");
  const [filterRisk, setFilterRisk] = useState("all");

  useEffect(() => {
    fetch(`/api/tenders/${id}/agents`).then((r) => r.json()).then((agents) => {
      const run = Array.isArray(agents) && agents.find((a: { agent_type: string }) => a.agent_type === "ppm");
      if (run) { setAgentStatus(run.status); setContent(run.output_content ?? ""); }
    }).catch(console.error);
  }, [id]);

  const tables = useMemo(() => parseAllTables(content), [content]);
  const allAssets = useMemo(() => buildAssets(tables), [tables]);
  const filtered = useMemo(() => allAssets.filter((a) => {
    if (filterCondition !== "all" && !a.condition.toLowerCase().includes(filterCondition)) return false;
    if (filterRisk !== "all" && !a.riskLevel.toLowerCase().includes(filterRisk)) return false;
    return true;
  }), [allAssets, filterCondition, filterRisk]);

  const integrityScore = useMemo(() => extractNumber(content, [
    /integrity score[:\s]+([\d.]+)/i,
    /asset integrity[:\s]+([\d.]+)/i,
  ]) ?? 75, [content]);

  const totalCost = allAssets.reduce((s, a) => s + a.estimatedCost, 0);
  const highRisk = allAssets.filter((a) => a.riskLevel.toLowerCase().includes("high") || a.riskLevel.toLowerCase().includes("critical")).length;

  const aiSummary = useMemo(() => {
    const m = content.match(/AI analysed[\s\S]{0,300}/i) ?? content.match(/lifecycle[\s\S]{0,200}/i);
    return m?.[0]?.trim().slice(0, 250) ?? null;
  }, [content]);

  // PPM frequencies for timeline bar
  const freqGroups = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of allAssets) {
      const f = a.frequency || "Other";
      map[f] = (map[f] ?? 0) + 1;
    }
    return Object.entries(map).sort((x, y) => y[1] - x[1]).slice(0, 5);
  }, [allAssets]);
  const maxFreq = Math.max(1, ...freqGroups.map((f) => f[1]));

  if (agentStatus !== "completed" && !content) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <span className="material-symbols-outlined text-[44px] text-text-muted">build_circle</span>
        <p className="text-[15px] font-semibold text-text">Assets & PPM Not Generated</p>
        <p className="text-[13px] text-text-secondary max-w-sm">
          Click <strong>Run AI</strong> in the workspace header to generate the asset register and PPM schedule.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* AI Lifecycle Intelligence Banner */}
      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ background: "linear-gradient(135deg,#8B352008,#C8A24A08)" }}>
          <div className="flex items-start gap-3 flex-1">
            <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5">auto_awesome</span>
            <div>
              <p className="text-[12px] font-semibold text-text">Lifecycle Intelligence</p>
              <p className="text-[12.5px] text-text-secondary leading-relaxed mt-0.5">
                {aiSummary ?? `AI analysed ${allAssets.length} asset entries. Conducting lifecycle cost analysis and PPM scheduling.`}
              </p>
              {highRisk > 0 && (
                <p className="text-[11px] text-danger font-medium mt-1">
                  ⚠ {highRisk} High Risk asset{highRisk > 1 ? "s" : ""} flagged for priority attention
                </p>
              )}
            </div>
          </div>
          <div className="shrink-0 ml-4 flex flex-col items-center gap-1">
            <div className="relative flex items-center justify-center" style={{ width: 64, height: 64 }}>
              <svg width="64" height="64" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="32" cy="32" r="26" fill="none" stroke="var(--color-surface-mid)" strokeWidth="6" />
                <circle cx="32" cy="32" r="26" fill="none" stroke={integrityScore >= 75 ? "#10B981" : "#F59E0B"} strokeWidth="6"
                  strokeLinecap="round" strokeDasharray={163.4} strokeDashoffset={163.4 - (integrityScore / 100) * 163.4}
                  style={{ transition: "stroke-dashoffset 1s ease" }} />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className={`text-[16px] font-bold ${integrityScore >= 75 ? "text-success" : "text-warning"}`}>{integrityScore}</span>
              </div>
            </div>
            <p className="text-[9.5px] text-text-muted text-center">Asset Integrity Score</p>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-[10.5px] uppercase tracking-wide text-text-secondary mb-1">Assets Registered</p>
          <p className="text-[26px] font-bold text-text">{allAssets.length || "—"}</p>
          <p className="text-[11px] text-text-muted">Extracted from RFP</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-[10.5px] uppercase tracking-wide text-text-secondary mb-1">High Risk Assets</p>
          <p className={`text-[26px] font-bold ${highRisk > 0 ? "text-danger" : "text-success"}`}>{allAssets.length ? highRisk : "—"}</p>
          <p className="text-[11px] text-text-muted">Need priority attention</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-[10.5px] uppercase tracking-wide text-text-secondary mb-1">Est. Annual Cost</p>
          <p className="text-[20px] font-bold text-text leading-tight">{totalCost ? fmtAED(totalCost) : "—"}</p>
          <p className="text-[11px] text-text-muted">Maintenance & PPM</p>
        </div>
      </div>

      {/* Asset Register + PPM Frequency */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* Asset Table */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-light px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-text-muted">inventory_2</span>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Asset Register</p>
            </div>
            <div className="flex items-center gap-2">
              <select value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)}
                className="rounded border border-border bg-surface px-2 py-1 text-[11px] text-text-secondary outline-none">
                <option value="all">All Conditions</option>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
              <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)}
                className="rounded border border-border bg-surface px-2 py-1 text-[11px] text-text-secondary outline-none">
                <option value="all">All Risk</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          {allAssets.length === 0 ? (
            <p className="p-6 text-[12px] text-text-muted text-center">Asset register will appear here once AI agents complete.</p>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-border-light bg-surface-dim">
                  {["Asset Name", "Category", "Qty", "Condition", "Frequency", "Risk", "Est. Cost/yr"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((asset, i) => {
                  const cond = conditionCfg(asset.condition);
                  const risk = riskCfg(asset.riskLevel);
                  return (
                    <tr key={asset.id} className={`border-b border-border-light last:border-0 transition-colors ${i % 2 === 1 ? "bg-surface-dim/20" : ""} hover:bg-primary-light/10`}>
                      <td className="px-3 py-3 font-medium text-text max-w-[150px]">
                        <p className="line-clamp-1">{asset.name}</p>
                        <p className="text-[10px] text-text-muted font-mono">{asset.id}</p>
                      </td>
                      <td className="px-3 py-3 text-[11.5px] text-text-secondary">{asset.category}</td>
                      <td className="px-3 py-3 text-center font-semibold text-text">{asset.quantity}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold ${cond.cls}`}>{cond.label}</span>
                      </td>
                      <td className="px-3 py-3 text-[11.5px] text-text-secondary whitespace-nowrap">{asset.frequency}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold ${risk.cls}`}>{asset.riskLevel}</span>
                      </td>
                      <td className="px-3 py-3 font-mono text-[11.5px] text-text">{fmtAED(asset.estimatedCost)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* PPM Frequency Chart */}
        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border-light px-5 py-3.5">
            <span className="material-symbols-outlined text-[16px] text-text-muted">calendar_month</span>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">PPM Frequency</p>
          </div>
          <div className="p-5 flex flex-col gap-3">
            {freqGroups.length === 0 ? (
              <p className="text-[12px] text-text-muted text-center py-4">No PPM data yet</p>
            ) : (
              freqGroups.map(([freq, count]) => (
                <div key={freq}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-text-secondary truncate max-w-[120px]">{freq}</span>
                    <span className="text-[12px] font-semibold text-text">{count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-mid">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(count / maxFreq) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Condition Summary */}
          {allAssets.length > 0 && (
            <div className="border-t border-border-light p-4">
              <p className="text-[10.5px] uppercase tracking-wide text-text-secondary mb-3">Condition Summary</p>
              {Object.entries(CONDITION_CFG).map(([key, cfg]) => {
                const count = allAssets.filter((a) => a.condition.toLowerCase().includes(key)).length;
                return count > 0 ? (
                  <div key={key} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${cfg.cls.includes("success") ? "bg-success" : cfg.cls.includes("warning") ? "bg-warning" : "bg-danger"}`} />
                      <span className="text-[11.5px] text-text-secondary">{cfg.label}</span>
                    </div>
                    <span className="text-[12px] font-semibold text-text">{count}</span>
                  </div>
                ) : null;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
