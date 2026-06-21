"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { parseAllTables, extractNumber } from "@/lib/parse-agent-table";
import { textToHtml } from "@/lib/utils/text-to-html";

interface StaffRow {
  role: string;
  department: string;
  count: number;
  salary: number;
  total: number;
  qualifications: string;
}

const DEPT_COLORS: Record<string, string> = {
  admin:       "bg-primary-light text-primary",
  technical:   "bg-warning/10 text-warning",
  security:    "bg-danger/10 text-danger",
  soft:        "bg-success/10 text-success",
  hvac:        "bg-warning/10 text-warning",
  mechanical:  "bg-warning/10 text-warning",
  electrical:  "bg-warning/10 text-warning",
  cleaning:    "bg-success/10 text-success",
  management:  "bg-primary-light text-primary",
  operations:  "bg-surface-mid text-text-secondary",
};

function deptColor(dept: string): string {
  const lower = dept.toLowerCase();
  return Object.entries(DEPT_COLORS).find(([k]) => lower.includes(k))?.[1] ?? "bg-surface-dim text-text-secondary";
}

function parseSalary(val: string): number {
  const num = val.replace(/[^0-9.]/g, "");
  return parseFloat(num) || 0;
}

function buildStaffRows(tables: Record<string, string>[][]): StaffRow[] {
  for (const table of tables) {
    if (table.length === 0) continue;
    const keys = Object.keys(table[0]);
    const isStaff = keys.some((k) => k.includes("role") || k.includes("headcount") || k.includes("position"));
    if (!isStaff) continue;
    return table.map((row) => {
      const countVal = parseInt(Object.values(row)[1] ?? "0") || 1;
      const salaryVal = parseSalary(Object.values(row)[3] ?? Object.values(row)[2] ?? "0");
      return {
        role: row[keys[0]] ?? "—",
        department: row[keys[1]] ?? "",
        count: countVal,
        salary: salaryVal,
        total: countVal * salaryVal,
        qualifications: row[keys[2]] ?? "",
      };
    }).filter((r) => r.role && r.role !== "—");
  }
  return [];
}

function fmtAED(v: number) {
  if (!v) return "—";
  return v >= 1_000_000 ? `AED ${(v / 1_000_000).toFixed(2)}M` : `AED ${v.toLocaleString()}`;
}

export default function ManpowerPage() {
  const { id } = useParams<{ id: string }>();
  const [content, setContent] = useState("");
  const [agentStatus, setAgentStatus] = useState("waiting");

  useEffect(() => {
    fetch(`/api/tenders/${id}/agents`).then((r) => r.json()).then((agents) => {
      const run = Array.isArray(agents) && agents.find((a: { agent_type: string }) => a.agent_type === "manpower");
      if (run) { setAgentStatus(run.status); setContent(run.output_content ?? ""); }
    }).catch(console.error);
  }, [id]);

  const tables    = useMemo(() => parseAllTables(content), [content]);
  const staffRows = useMemo(() => buildStaffRows(tables), [tables]);
  const html      = useMemo(() => content ? textToHtml(content) : "", [content]);

  const totalHeadcount = staffRows.reduce((s, r) => s + r.count, 0);
  const totalBudget = staffRows.reduce((s, r) => s + r.total, 0);
  const winProb = useMemo(() => extractNumber(content, [/win probability[:\s]+(\d+)%/i, /(\d+)%\s*win/i]), [content]);

  const aiRecommendation = useMemo(() => {
    const m = content.match(/AI?\s*RECOMMENDATION[:\s]+([^\n]+)/i) ?? content.match(/recommend[^\n]{0,200}/i);
    return m?.[0]?.replace(/AI?\s*RECOMMENDATION[:\s]*/i, "").trim().slice(0, 200) ?? null;
  }, [content]);

  // Department distribution for chart
  const deptGroups = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of staffRows) {
      const d = r.department || "Other";
      map[d] = (map[d] ?? 0) + r.count;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [staffRows]);
  const maxDept = Math.max(1, ...deptGroups.map((d) => d[1]));

  if (agentStatus !== "completed" && !content) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <span className="material-symbols-outlined text-[44px] text-text-muted">groups</span>
        <p className="text-[15px] font-semibold text-text">Manpower Plan Not Generated</p>
        <p className="text-[13px] text-text-secondary max-w-sm">
          Click <strong>Run AI</strong> in the workspace header to generate the manpower plan.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-[10.5px] uppercase tracking-wide text-text-secondary mb-1">Total Headcount</p>
          <p className="text-[30px] font-bold text-text">{totalHeadcount || "—"}</p>
          <p className="text-[11px] text-text-muted mt-0.5">Staff required</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-[10.5px] uppercase tracking-wide text-text-secondary mb-1">Annual Budget</p>
          <p className="text-[22px] font-bold text-text leading-tight">{totalBudget ? fmtAED(totalBudget) : "—"}</p>
          <p className="text-[11px] text-text-muted mt-0.5">Within budget range</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-[10.5px] uppercase tracking-wide text-text-secondary mb-1">Win Probability</p>
          <p className="text-[30px] font-bold text-success">{winProb != null ? `${winProb}%` : "—"}</p>
          <p className="text-[11px] text-text-muted mt-0.5">Based on staffing plan</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-[10.5px] uppercase tracking-wide text-text-secondary mb-1">Departments</p>
          <p className="text-[30px] font-bold text-text">{deptGroups.length || "—"}</p>
          <p className="text-[11px] text-text-muted mt-0.5">Service categories</p>
        </div>
      </div>

      {/* AI Recommendation banner */}
      {aiRecommendation && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-light/30 px-4 py-3.5">
          <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5">smart_toy</span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-0.5">AI Recommendation</p>
            <p className="text-[12.5px] text-text leading-relaxed">{aiRecommendation}</p>
          </div>
        </div>
      )}

      {/* Staffing Table + Distribution */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* Staffing Schedule */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-light px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-text-muted">table_view</span>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Staffing Schedule</p>
            </div>
            <span className="text-[11px] text-text-muted">{staffRows.length} roles</span>
          </div>
          {staffRows.length === 0 ? (
            <p className="p-6 text-[12px] text-text-muted text-center">Staffing table will appear here once AI agents complete.</p>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-border-light bg-surface-dim">
                  {["Role Name", "Dept", "Count", "Avg Salary", "Total Annual"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-start text-[10.5px] font-semibold uppercase tracking-wide text-text-secondary">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staffRows.map((row, i) => (
                  <tr key={i} className="border-b border-border-light last:border-0 hover:bg-surface-dim/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-text">{row.role}</td>
                    <td className="px-4 py-3">
                      {row.department ? (
                        <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${deptColor(row.department)}`}>
                          {row.department}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-text text-center">{row.count}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-text-secondary">
                      {row.salary ? `AED ${row.salary.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] font-semibold text-text">
                      {row.total ? `AED ${row.total.toLocaleString()}` : "—"}
                    </td>
                  </tr>
                ))}
                {staffRows.length > 0 && (
                  <tr className="border-t-2 border-border bg-surface-dim">
                    <td className="px-4 py-3 font-bold text-text" colSpan={2}>TOTAL</td>
                    <td className="px-4 py-3 font-bold text-text text-center">{totalHeadcount}</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 font-mono text-[13px] font-bold text-text">{fmtAED(totalBudget)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Resource Distribution */}
        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border-light px-5 py-3.5">
            <span className="material-symbols-outlined text-[16px] text-text-muted">bar_chart</span>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Resource Distribution</p>
          </div>
          <div className="p-5 flex flex-col gap-3">
            {deptGroups.length === 0 ? (
              <p className="text-[12px] text-text-muted text-center py-4">No distribution data yet</p>
            ) : (
              deptGroups.map(([dept, count]) => (
                <div key={dept}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-text-secondary truncate max-w-[120px]">{dept}</span>
                    <span className="text-[12px] font-semibold text-text ml-2">{count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-mid">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(count / maxDept) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Budget breakdown */}
          {totalBudget > 0 && (
            <div className="border-t border-border-light p-4">
              <p className="text-[10.5px] uppercase tracking-wide text-text-secondary mb-3">Budget Breakdown</p>
              <div className="flex flex-col gap-2">
                {[
                  { label: "Direct Labour", pct: 65 },
                  { label: "Overheads", pct: 20 },
                  { label: "Benefits", pct: 10 },
                  { label: "Training", pct: 5 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className="w-24 text-[11px] text-text-secondary shrink-0">{item.label}</span>
                    <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-surface-mid">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${item.pct}%` }} />
                    </div>
                    <span className="text-[11px] font-semibold text-text w-8 text-right">{item.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Full Content — shown when table parsing found no rows */}
      {html && staffRows.length === 0 && (
        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border-light px-5 py-3.5">
            <span className="material-symbols-outlined text-[16px] text-primary">smart_toy</span>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">AI Manpower Analysis</p>
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wide">AI Generated</span>
          </div>
          <div className="px-5 py-4 text-[13px] leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
    </div>
  );
}
