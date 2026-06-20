"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface AgentRun {
  agent_type: string;
  status: string;
  output_content?: string;
}

interface Tender {
  name?: string;
  readiness_score?: number;
  win_probability?: number;
  client?: string;
  submission_deadline?: string;
}

const AGENT_ORDER = [
  { key: "qualification",    label: "Qualification Assessment",  icon: "verified" },
  { key: "compliance",       label: "Compliance Matrix",         icon: "fact_check" },
  { key: "technical",        label: "Technical Proposal",        icon: "engineering" },
  { key: "commercial",       label: "Commercial / BOQ",          icon: "receipt_long" },
  { key: "manpower",         label: "Manpower Plan",             icon: "groups" },
  { key: "ppm",              label: "Assets & PPM Schedule",     icon: "build_circle" },
  { key: "risk",             label: "Risk Register",             icon: "warning_amber" },
  { key: "hse",              label: "HSE Plan",                  icon: "health_and_safety" },
  { key: "sla",              label: "SLA & KPI Framework",       icon: "speed" },
  { key: "presentation",     label: "Executive Presentation",    icon: "slideshow" },
  { key: "executive_review", label: "Executive Review Report",   icon: "summarize" },
];

const AUDIT_LOG = [
  { version: "v2.1", date: "Pending export", by: "System", status: "pending" },
];

export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const [tender, setTender] = useState<Tender | null>(null);
  const [agents, setAgents] = useState<AgentRun[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/tenders/${id}`).then((r) => r.json()),
      fetch(`/api/tenders/${id}/agents`).then((r) => r.json()),
    ]).then(([t, a]) => {
      setTender(t);
      if (Array.isArray(a)) setAgents(a);
    }).catch(console.error);
  }, [id]);

  async function exportPackage() {
    setExporting(true);
    setError("");
    try {
      const res = await fetch(`/api/tenders/${id}/export`, { method: "POST" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: `${(tender?.name ?? "submission").replace(/[^a-z0-9]/gi, "_")}_package.docx`,
      });
      a.click();
      setExported(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  const agentMap = Object.fromEntries(agents.map((a) => [a.agent_type, a]));
  const completed = AGENT_ORDER.filter((item) => agentMap[item.key]?.status === "completed");
  const hasContent = (key: string) => !!agentMap[key]?.output_content;
  const readiness = tender?.readiness_score ?? 0;
  const winProb = tender?.win_probability ?? 0;
  const isReady = completed.length >= 6;

  const checklist = AGENT_ORDER.map((item) => {
    const run = agentMap[item.key];
    const done = run?.status === "completed" && hasContent(item.key);
    const running = run?.status === "running";
    return { ...item, done, running };
  });

  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div className="flex flex-col gap-5">

      {/* Header + Readiness */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Readiness Checklist */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-light px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-text-muted">checklist</span>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Readiness Checklist</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${isReady ? "bg-success/10 text-success border border-success/25" : "bg-warning/10 text-warning border border-warning/25"}`}>
              {doneCount}/{AGENT_ORDER.length} Ready
            </span>
          </div>
          <div className="divide-y divide-border-light">
            {checklist.map((item) => (
              <div key={item.key} className="flex items-center gap-3 px-5 py-2.5">
                <span className={`material-symbols-outlined text-[18px] shrink-0 ${item.done ? "text-success" : item.running ? "text-primary animate-pulse" : "text-text-muted"}`}>
                  {item.done ? "check_circle" : item.running ? "pending" : "radio_button_unchecked"}
                </span>
                <span className={`material-symbols-outlined text-[15px] shrink-0 ${item.done ? "text-text-secondary" : "text-text-muted"}`}>{item.icon}</span>
                <span className={`flex-1 text-[13px] ${item.done ? "text-text font-medium" : "text-text-secondary"}`}>{item.label}</span>
                {item.done && (
                  <span className="text-[10.5px] text-success font-medium">Verified by AI</span>
                )}
                {item.running && (
                  <span className="text-[10.5px] text-primary font-medium">Running…</span>
                )}
                {!item.done && !item.running && (
                  <span className="text-[10.5px] text-text-muted">Pending</span>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-border-light px-5 py-3">
            <div className="flex items-center justify-between text-[12px] text-text-secondary mb-1.5">
              <span>Overall completion</span>
              <span className="font-semibold text-text">{Math.round((doneCount / AGENT_ORDER.length) * 100)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-mid">
              <div className={`h-full rounded-full transition-all duration-700 ${isReady ? "bg-success" : "bg-primary"}`}
                style={{ width: `${(doneCount / AGENT_ORDER.length) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Export Panel */}
        <div className="flex flex-col gap-4">

          {/* AI Forecast */}
          {winProb > 0 && (
            <div className="rounded-xl border border-border bg-surface shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[16px] text-primary">auto_awesome</span>
                <p className="text-[11.5px] font-semibold text-text">AI Strategic Forecast</p>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[12px] text-text-secondary">Win Probability:</span>
                <span className={`text-[16px] font-bold ${winProb >= 65 ? "text-success" : winProb >= 40 ? "text-warning" : "text-danger"}`}>{winProb}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-mid mb-2">
                <div className={`h-full rounded-full ${winProb >= 65 ? "bg-success" : winProb >= 40 ? "bg-warning" : "bg-danger"}`} style={{ width: `${winProb}%` }} />
              </div>
              <p className="text-[11.5px] text-text-secondary leading-relaxed">
                {winProb >= 65
                  ? "Your proposal ranks in the top percentile. Strong competitive position."
                  : winProb >= 40
                  ? "Competitive proposal. Address identified gaps to improve probability."
                  : "Consider strengthening key sections before final submission."}
              </p>
            </div>
          )}

          {/* Ready for Export card */}
          <div className={`rounded-xl border shadow-sm p-5 flex flex-col items-center gap-3 text-center ${isReady ? "border-success/30 bg-success/5" : "border-border bg-surface"}`}>
            <span className={`material-symbols-outlined text-[36px] ${isReady ? "text-success" : "text-text-muted"}`}>
              {isReady ? "task_alt" : "pending"}
            </span>
            <p className="text-[13px] font-semibold text-text">
              {isReady ? "Ready for Export" : "Not Yet Ready"}
            </p>
            <p className="text-[11.5px] text-text-secondary leading-relaxed">
              {isReady
                ? "All mandatory sections verified. Generate your secure DOCX submission package."
                : `Complete ${AGENT_ORDER.length - doneCount} more section${AGENT_ORDER.length - doneCount > 1 ? "s" : ""} before export.`}
            </p>

            <button onClick={exportPackage} disabled={exporting || !isReady}
              className="w-full rounded-lg px-4 py-3 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: isReady ? "linear-gradient(135deg,#8B3520,#C8A24A)" : undefined, backgroundColor: isReady ? undefined : "var(--color-surface-mid)" }}>
              {exporting ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Generating…</>
              ) : (
                <><span className="material-symbols-outlined text-[18px]">download</span> Generate &amp; Export DOCX</>
              )}
            </button>

            {exported && (
              <p className="text-[11.5px] text-success font-medium">✓ Package exported successfully</p>
            )}
            {error && (
              <p className="text-[11.5px] text-danger">{error}</p>
            )}
          </div>
        </div>
      </div>

      {/* Generated Sections Preview */}
      {doneCount > 0 && (
        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-light px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-text-muted">folder</span>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Generated Sections</p>
              <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary">{doneCount} files</span>
            </div>
          </div>
          <div className="divide-y divide-border-light">
            {checklist.filter((c) => c.done).map((item) => {
              const bytes = Math.round((agentMap[item.key]?.output_content?.length ?? 0) * 1.5);
              const kb = bytes > 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${bytes} B`;
              return (
                <div key={item.key} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="material-symbols-outlined text-[18px] text-primary">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium text-text">{item.label}</p>
                    <p className="text-[11px] text-text-muted">Microsoft Word · {kb}</p>
                  </div>
                  <span className="text-[10px] text-success font-semibold bg-success/10 border border-success/25 rounded px-2 py-0.5">Ready</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Export Audit History */}
      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border-light px-5 py-3.5">
          <span className="material-symbols-outlined text-[16px] text-text-muted">history</span>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Export Audit History</p>
        </div>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-border-light bg-surface-dim">
              {["Version", "Date & Time", "Generated By", "Status", "Action"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-start text-[10.5px] font-semibold uppercase tracking-wide text-text-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exported ? (
              <tr className="border-b border-border-light">
                <td className="px-4 py-3 font-mono text-[11px]">v1.0</td>
                <td className="px-4 py-3 text-text-secondary">{new Date().toLocaleString("en-GB")}</td>
                <td className="px-4 py-3 text-text-secondary">System (Auto)</td>
                <td className="px-4 py-3"><span className="rounded bg-success/10 border border-success/25 px-2 py-0.5 text-[10px] font-bold text-success uppercase">Success</span></td>
                <td className="px-4 py-3">
                  <button onClick={exportPackage} className="text-[11.5px] text-primary hover:underline">Re-download</button>
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[12px] text-text-muted">
                  No exports yet — generate your first package above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
