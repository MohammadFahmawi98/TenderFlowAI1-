"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { parseAllTables, extractNumber } from "@/lib/parse-agent-table";

interface CompetitorRow { name: string; market: string; winRate: string; level: string }

function extractScore(content: string): number {
  return extractNumber(content, [
    /score[:\s]+(\d+)\s*\/\s*100/i,
    /qualification score[:\s]+(\d+)/i,
    /(\d+)\s*\/\s*100/,
  ]) ?? 0;
}

function extractPct(content: string, keywords: string[]): number | null {
  for (const kw of keywords) {
    const r = new RegExp(`${kw}[^\\d]*(\\d+)\\s*%`, "i");
    const m = content.match(r);
    if (m) return parseInt(m[1]);
  }
  return null;
}

function extractGoDecision(content: string): "go" | "no-go" | "conditional" | null {
  const lower = content.toLowerCase();
  if (lower.includes("no-go") || lower.includes("no go")) return "no-go";
  if (lower.includes("conditional go") || lower.includes("conditional")) return "conditional";
  if (lower.includes("go decision") || lower.includes("recommended: go") || lower.includes("approve go")) return "go";
  return null;
}

function buildCompetitors(tables: Record<string, string>[][]): CompetitorRow[] {
  for (const table of tables) {
    if (table.length === 0) continue;
    const keys = Object.keys(table[0]);
    if (keys.some((k) => k.includes("competitor") || k.includes("company") || k.includes("name"))) {
      return table.map((row) => ({
        name: row[keys[0]] ?? "—",
        market: row[keys[1]] ?? "—",
        winRate: row[keys[2]] ?? "—",
        level: row[keys[3]] ?? "—",
      }));
    }
  }
  return [];
}

const LEVEL_CFG: Record<string, string> = {
  critical: "text-danger bg-danger/10 border-danger/25",
  high:     "text-danger bg-danger/10 border-danger/25",
  medium:   "text-warning bg-warning/10 border-warning/25",
  low:      "text-success bg-success/10 border-success/25",
  moderate: "text-warning bg-warning/10 border-warning/25",
};

export default function QualificationPage() {
  const { id } = useParams<{ id: string }>();
  const [content, setContent] = useState("");
  const [agentStatus, setAgentStatus] = useState("waiting");
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    fetch(`/api/tenders/${id}/agents`).then((r) => r.json()).then((agents) => {
      const run = Array.isArray(agents) && agents.find((a: { agent_type: string }) => a.agent_type === "qualification");
      if (run) { setAgentStatus(run.status); setContent(run.output_content ?? ""); }
    }).catch(console.error);
  }, [id]);

  const score = useMemo(() => extractScore(content), [content]);
  const capability = useMemo(() => extractPct(content, ["capability", "staff", "personnel"]), [content]);
  const financial = useMemo(() => extractPct(content, ["financial", "budget", "liquidity"]), [content]);
  const strategic = useMemo(() => extractPct(content, ["strategic", "alignment", "market"]), [content]);
  const goDecision = useMemo(() => extractGoDecision(content), [content]);
  const tables = useMemo(() => parseAllTables(content), [content]);
  const competitors = useMemo(() => buildCompetitors(tables), [tables]);

  const scoreColor = score >= 75 ? "text-success" : score >= 50 ? "text-warning" : score > 0 ? "text-danger" : "text-text-muted";
  const scoreRing = score >= 75 ? "#10B981" : score >= 50 ? "#F59E0B" : score > 0 ? "#EF4444" : "#94A3B8";

  if (agentStatus !== "completed" && !content) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <span className="material-symbols-outlined text-[44px] text-text-muted">verified</span>
        <p className="text-[15px] font-semibold text-text">Qualification Assessment Not Generated</p>
        <p className="text-[13px] text-text-secondary max-w-sm">
          Click <strong>Run AI</strong> in the workspace header to generate the qualification assessment.
        </p>
      </div>
    );
  }

  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="flex flex-col gap-5">

      {/* Score + Assessment Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">

        {/* Score Ring */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm flex flex-col items-center gap-3">
          <p className="text-[11px] uppercase tracking-wide text-text-secondary font-medium">Qualification Score</p>
          <div className="relative flex items-center justify-center" style={{ width: 88, height: 88 }}>
            <svg width="88" height="88" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="44" cy="44" r={r} fill="none" stroke="var(--color-surface-mid)" strokeWidth="8" />
              <circle cx="44" cy="44" r={r} fill="none" stroke={scoreRing} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={circ - dash} style={{ transition: "stroke-dashoffset 1s ease" }} />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className={`text-[20px] font-bold ${scoreColor}`}>{score || "—"}</span>
              <span className="text-[9px] text-text-muted">/100</span>
            </div>
          </div>
          <p className={`text-[13px] font-semibold ${scoreColor}`}>
            {score >= 75 ? "STRONG GO" : score >= 50 ? "CONDITIONAL" : score > 0 ? "REVIEW" : "Pending"}
          </p>
          <p className="text-[11px] text-text-muted text-center">
            {score >= 75 ? "Qualifies for this tender" : score >= 50 ? "Proceed with caution" : score > 0 ? "Address gaps before bidding" : "Run AI agents to assess"}
          </p>
        </div>

        {/* Capability Match */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[18px] text-primary">engineering</span>
            <p className="text-[12px] font-semibold text-text">Capability Match</p>
          </div>
          <p className={`text-[28px] font-bold ${capability ? (capability >= 80 ? "text-success" : "text-warning") : "text-text-muted"}`}>
            {capability != null ? `${capability}%` : "—"}
          </p>
          <p className="text-[11px] text-text-muted mt-1">Technical & staff qualifications alignment</p>
          {capability != null && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-mid">
              <div className={`h-full rounded-full ${capability >= 80 ? "bg-success" : "bg-warning"}`} style={{ width: `${capability}%` }} />
            </div>
          )}
        </div>

        {/* Financial Feasibility */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[18px] text-primary">account_balance</span>
            <p className="text-[12px] font-semibold text-text">Financial Feasibility</p>
          </div>
          <p className={`text-[28px] font-bold ${financial ? (financial >= 70 ? "text-success" : "text-warning") : "text-text-muted"}`}>
            {financial != null ? `${financial}%` : "—"}
          </p>
          <p className="text-[11px] text-text-muted mt-1">Budget, bonding & liquidity requirements</p>
          {financial != null && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-mid">
              <div className={`h-full rounded-full ${financial >= 70 ? "bg-success" : "bg-warning"}`} style={{ width: `${financial}%` }} />
            </div>
          )}
        </div>

        {/* Strategic Alignment */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[18px] text-primary">target</span>
            <p className="text-[12px] font-semibold text-text">Strategic Alignment</p>
          </div>
          <p className={`text-[28px] font-bold ${strategic ? (strategic >= 70 ? "text-success" : "text-warning") : "text-text-muted"}`}>
            {strategic != null ? `${strategic}%` : "—"}
          </p>
          <p className="text-[11px] text-text-muted mt-1">Market position & growth objectives</p>
          {strategic != null && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-mid">
              <div className={`h-full rounded-full ${strategic >= 70 ? "bg-success" : "bg-warning"}`} style={{ width: `${strategic}%` }} />
            </div>
          )}
        </div>
      </div>

      {/* Competitor Analysis + Go/No-Go */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* Competitor Matrix */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border-light px-5 py-3.5">
            <span className="material-symbols-outlined text-[16px] text-text-muted">groups</span>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Competitor Analysis Matrix</p>
          </div>
          {competitors.length === 0 ? (
            <p className="p-6 text-[12px] text-text-muted text-center">No competitor data extracted — the AI agent will populate this when complete.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border-light bg-surface-dim">
                  {["Competitor Name", "Market Share", "Win Rate", "Aggression Level"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-start text-[10.5px] font-semibold uppercase tracking-wide text-text-secondary">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {competitors.map((c, i) => {
                  const level = c.level.toLowerCase();
                  const cls = Object.entries(LEVEL_CFG).find(([k]) => level.includes(k))?.[1] ?? "text-text-muted bg-surface-dim border-border-light";
                  return (
                    <tr key={i} className="border-b border-border-light last:border-0 hover:bg-surface-dim/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-text">{c.name}</td>
                      <td className="px-4 py-3 text-text-secondary">{c.market}</td>
                      <td className="px-4 py-3 font-semibold text-text">{c.winRate}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>{c.level}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Go/No-Go Decision */}
        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border-light px-5 py-3.5" style={{ background: "linear-gradient(135deg,#8B352008,#C8A24A08)" }}>
            <span className="material-symbols-outlined text-[16px] text-primary">gavel</span>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Go / No-Go Decision</p>
          </div>
          <div className="p-5 flex flex-col gap-4">
            {goDecision ? (
              <div className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-center ${
                goDecision === "go" ? "border-success/30 bg-success/5"
                : goDecision === "no-go" ? "border-danger/30 bg-danger/5"
                : "border-warning/30 bg-warning/5"
              }`}>
                <span className={`material-symbols-outlined text-[32px] ${goDecision === "go" ? "text-success" : goDecision === "no-go" ? "text-danger" : "text-warning"}`}>
                  {goDecision === "go" ? "check_circle" : goDecision === "no-go" ? "cancel" : "help"}
                </span>
                <p className={`text-[16px] font-bold uppercase tracking-wide ${goDecision === "go" ? "text-success" : goDecision === "no-go" ? "text-danger" : "text-warning"}`}>
                  {goDecision === "go" ? "GO" : goDecision === "no-go" ? "NO GO" : "CONDITIONAL GO"}
                </p>
                <p className="text-[11.5px] text-text-secondary leading-relaxed">
                  {goDecision === "go" ? "AI recommends pursuing this tender based on qualification score and market analysis."
                  : goDecision === "no-go" ? "AI does not recommend bidding on this tender at this time."
                  : "Proceed with conditions — address identified gaps before submitting."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center text-text-muted">
                <span className="material-symbols-outlined text-[28px]">pending</span>
                <p className="text-[12px]">AI decision pending — run agents to get Go/No-Go recommendation.</p>
              </div>
            )}

            {!approved && goDecision === "go" && (
              <button
                onClick={() => setApproved(true)}
                className="w-full rounded-lg px-4 py-3 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#10B981,#059669)" }}
              >
                <span className="material-symbols-outlined text-[16px] align-middle mr-1">check</span>
                Approve GO Decision
              </button>
            )}
            {approved && (
              <div className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-center text-[12px] font-semibold text-success">
                ✓ GO Decision Approved
              </div>
            )}

            <div className="rounded-lg border border-border-light bg-surface-dim p-3">
              <p className="text-[10px] uppercase tracking-wide text-text-muted mb-1.5">Qualification Score</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 overflow-hidden rounded-full bg-surface-mid">
                  <div className={`h-full rounded-full ${scoreColor === "text-success" ? "bg-success" : scoreColor === "text-warning" ? "bg-warning" : "bg-danger"}`}
                    style={{ width: `${score}%` }} />
                </div>
                <span className={`text-[13px] font-bold ${scoreColor}`}>{score || "—"}/100</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Raw Content */}
      {content && (
        <details className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <summary className="flex cursor-pointer items-center gap-2 px-5 py-3 text-[12px] font-medium text-text-secondary hover:bg-surface-dim transition-colors list-none">
            <span className="material-symbols-outlined text-[16px]">smart_toy</span>
            View Full AI Analysis
            <span className="material-symbols-outlined text-[14px] ml-auto">expand_more</span>
          </summary>
          <div className="border-t border-border-light px-5 py-4 text-[13px] leading-relaxed text-text whitespace-pre-wrap font-mono">
            {content}
          </div>
        </details>
      )}
    </div>
  );
}
