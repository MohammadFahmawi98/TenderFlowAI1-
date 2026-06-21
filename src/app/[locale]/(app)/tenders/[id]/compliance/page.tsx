"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { parseAllTables } from "@/lib/parse-agent-table";
import { textToHtml } from "@/lib/utils/text-to-html";

interface ComplianceRow {
  id: string;
  requirement: string;
  response: string;
  status: "compliant" | "non-compliant" | "partial" | "pending";
  priority: "mandatory" | "optional";
  reference: string;
}

function deriveStatus(row: Record<string, string>): ComplianceRow["status"] {
  const val = Object.values(row).join(" ").toLowerCase();
  if (val.includes("non-compliant") || val.includes("non compliant") || val.includes("❌")) return "non-compliant";
  if (val.includes("partial")) return "partial";
  if (val.includes("compliant") || val.includes("✓") || val.includes("yes")) return "compliant";
  return "pending";
}

function derivePriority(row: Record<string, string>): ComplianceRow["priority"] {
  const val = Object.values(row).join(" ").toLowerCase();
  return val.includes("optional") ? "optional" : "mandatory";
}

function buildRows(tables: Record<string, string>[][]): ComplianceRow[] {
  const rows: ComplianceRow[] = [];
  let idx = 0;
  for (const table of tables) {
    for (const row of table) {
      const keys = Object.keys(row);
      const req = row[keys[0]] ?? "";
      if (!req || req.toLowerCase().includes("requirement") || req.startsWith("-")) continue;
      idx++;
      rows.push({
        id: `REQ-${String(idx).padStart(3, "0")}`,
        requirement: req,
        response: row[keys[1]] ?? "",
        status: deriveStatus(row),
        priority: derivePriority(row),
        reference: row[keys[keys.length - 1]] ?? "",
      });
    }
  }
  return rows;
}

const STATUS_CFG: Record<string, { label: string; cls: string; dot: string }> = {
  compliant:       { label: "Compliant",     cls: "text-success bg-success/10 border-success/20",      dot: "bg-success" },
  "non-compliant": { label: "Non-Compliant", cls: "text-danger bg-danger/10 border-danger/20",         dot: "bg-danger" },
  partial:         { label: "Partial",       cls: "text-warning bg-warning/10 border-warning/20",      dot: "bg-warning" },
  pending:         { label: "Pending",       cls: "text-text-muted bg-surface-dim border-border-light", dot: "bg-text-muted" },
};

function downloadCSV(rows: ComplianceRow[], name: string) {
  const header = ["REQ ID", "Requirement", "Our Response", "Status", "Priority", "Reference"];
  const lines = [header, ...rows.map((r) => [r.id, r.requirement, r.response, r.status, r.priority, r.reference])];
  const csv = lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
    download: `compliance_${name || "tender"}.csv`,
  });
  a.click();
}

export default function CompliancePage() {
  const { id } = useParams<{ id: string }>();
  const [content, setContent] = useState("");
  const [agentStatus, setAgentStatus] = useState("waiting");
  const [tenderName, setTenderName] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/tenders/${id}/agents`).then((r) => r.json()),
      fetch(`/api/tenders/${id}`).then((r) => r.json()),
    ]).then(([agents, tender]) => {
      setTenderName(tender?.name ?? "");
      const run = Array.isArray(agents) && agents.find((a: { agent_type: string }) => a.agent_type === "compliance");
      if (run) { setAgentStatus(run.status); setContent(run.output_content ?? ""); }
    }).catch(console.error);
  }, [id]);

  const allRows = useMemo(() => buildRows(parseAllTables(content)), [content]);
  const html    = useMemo(() => content ? textToHtml(content) : "", [content]);
  const filtered = useMemo(() => allRows.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterPriority !== "all" && r.priority !== filterPriority) return false;
    if (search && !r.requirement.toLowerCase().includes(search.toLowerCase()) && !r.id.includes(search.toUpperCase())) return false;
    return true;
  }), [allRows, filterStatus, filterPriority, search]);

  const total = allRows.length;
  const compliant = allRows.filter((r) => r.status === "compliant").length;
  const nonCompliant = allRows.filter((r) => r.status === "non-compliant");
  const mandatoryGaps = allRows.filter((r) => r.priority === "mandatory" && r.status === "non-compliant").length;
  const pct = total > 0 ? Math.round((compliant / total) * 100) : 0;

  if (agentStatus !== "completed" && !content) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <span className="material-symbols-outlined text-[44px] text-text-muted">fact_check</span>
        <p className="text-[15px] font-semibold text-text">Compliance Matrix Not Generated</p>
        <p className="text-[13px] text-text-secondary max-w-sm">
          Click <strong>Run AI</strong> in the workspace header to generate the full compliance matrix for this tender.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Critical Gaps Alert */}
      {nonCompliant.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
          <span className="material-symbols-outlined text-[18px] text-danger shrink-0">warning</span>
          <p className="text-[13px] font-semibold text-danger">
            {nonCompliant.length} Critical Compliance Gap{nonCompliant.length !== 1 ? "s" : ""} Found
          </p>
          <span className="ml-auto rounded border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] font-bold text-danger uppercase tracking-wide">
            Action Required
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[14px] text-text-muted">search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requirements…"
            className="w-full rounded-lg border border-border bg-surface pl-8 pr-3 py-1.5 text-[12.5px] text-text placeholder:text-text-muted focus:border-primary focus:outline-none" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[12.5px] text-text-secondary outline-none focus:border-primary">
          <option value="all">All Statuses</option>
          <option value="compliant">Compliant</option>
          <option value="partial">Partial</option>
          <option value="non-compliant">Non-Compliant</option>
          <option value="pending">Pending</option>
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[12.5px] text-text-secondary outline-none focus:border-primary">
          <option value="all">All Priorities</option>
          <option value="mandatory">Mandatory</option>
          <option value="optional">Optional</option>
        </select>
        <button onClick={() => downloadCSV(filtered, tenderName)}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-surface-dim transition-colors">
          <span className="material-symbols-outlined text-[14px]">download</span>
          Export Matrix
        </button>
        <span className="text-[11px] text-text-muted whitespace-nowrap">
          {filtered.length} of {total} requirements
        </span>
      </div>

      {/* Requirements Table */}
      {allRows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-[13px] text-text-secondary">
            Compliance matrix is being generated. The AI agent output will appear here once complete.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border-light bg-surface-dim">
                {["REQ ID", "Extracted Requirement", "Priority", "Compliance Status", "Our Response / Reference"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-start text-[10.5px] font-semibold uppercase tracking-wide text-text-secondary">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const s = STATUS_CFG[row.status] ?? STATUS_CFG.pending;
                return (
                  <tr key={row.id} className={`border-b border-border-light last:border-0 transition-colors ${i % 2 === 1 ? "bg-surface-dim/30" : ""} hover:bg-primary-light/10`}>
                    <td className="px-4 py-3 font-mono text-[11px] font-semibold text-text-secondary whitespace-nowrap">{row.id}</td>
                    <td className="px-4 py-3 text-[12.5px] text-text max-w-[240px]">
                      <p className="line-clamp-3 leading-snug">{row.requirement}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${
                        row.priority === "mandatory"
                          ? "bg-danger/8 text-danger border-danger/25"
                          : "bg-surface-dim text-text-muted border-border-light"
                      }`}>{row.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${s.dot}`} />
                        {s.label}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-text-secondary max-w-[200px]">
                      <p className="line-clamp-2">{row.response || row.reference || "—"}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* AI Full Content — shown when table parsing found no rows */}
      {html && allRows.length === 0 && (
        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border-light px-5 py-3.5">
            <span className="material-symbols-outlined text-[16px] text-primary">smart_toy</span>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">AI Compliance Analysis</p>
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wide">AI Generated</span>
          </div>
          <div className="px-5 py-4 text-[13px] leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}

      {/* KPI Footer */}
      <div className="grid grid-cols-3 gap-4 mt-1">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-[10.5px] uppercase tracking-wide text-text-secondary mb-1">Overall Compliance</p>
          <p className={`text-[28px] font-bold ${pct >= 80 ? "text-success" : pct >= 60 ? "text-warning" : total > 0 ? "text-danger" : "text-text-muted"}`}>
            {total > 0 ? `${pct}%` : "—"}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">{compliant} of {total} requirements met</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-mid">
            <div className={`h-full rounded-full ${pct >= 80 ? "bg-success" : pct >= 60 ? "bg-warning" : "bg-danger"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-[10.5px] uppercase tracking-wide text-text-secondary mb-1">Mandatory Gaps</p>
          <p className={`text-[28px] font-bold ${mandatoryGaps > 0 ? "text-danger" : "text-success"}`}>{mandatoryGaps}</p>
          <p className="text-[11px] text-text-muted mt-0.5">{mandatoryGaps > 0 ? "Action Required" : "All mandatory items addressed"}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-[10.5px] uppercase tracking-wide text-text-secondary mb-1">Compliance Status</p>
          <p className="text-[28px] font-bold text-text">{total > 0 ? `${compliant}/${total}` : "—"}</p>
          <p className="text-[11px] text-text-muted mt-0.5">Requirements Met</p>
        </div>
      </div>
    </div>
  );
}
