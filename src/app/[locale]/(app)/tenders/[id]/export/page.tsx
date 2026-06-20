"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface AgentRun { agent_type: string; status: string; output_content?: string; }
interface Tender   { name?: string; readiness_score?: number; win_probability?: number; client?: string; submission_deadline?: string; }

const EXPORT_SECTIONS = [
  { key: "commercial",    label: "Commercial Proposal",    desc: "Cover page · BOQ · Staff rates · Consumables · Exclusions", icon: "receipt_long",      primary: true },
  { key: "technical",     label: "Technical Proposal",     desc: "Methodology · Systems · Implementation plan",               icon: "engineering",       primary: false },
  { key: "qualification", label: "Qualification Assessment", desc: "Company profile · Certifications · Track record",        icon: "verified",          primary: false },
  { key: "compliance",    label: "Compliance Matrix",      desc: "Requirement-by-requirement compliance table",               icon: "fact_check",        primary: false },
  { key: "manpower",      label: "Manpower Plan",          desc: "Organisation chart · Roles · Deployment schedule",         icon: "groups",            primary: false },
  { key: "ppm",           label: "PPM Schedule",           desc: "Planned preventive maintenance programme",                  icon: "build_circle",      primary: false },
  { key: "risk",          label: "Risk Register",          desc: "Risk matrix · Mitigation plans · Contingencies",            icon: "warning_amber",     primary: false },
  { key: "hse",           label: "HSE Plan",               desc: "Health, Safety & Environment management plan",              icon: "health_and_safety", primary: false },
  { key: "sla",           label: "SLA & KPI Framework",   desc: "Service levels · KPI definitions · Penalty regime",         icon: "speed",             primary: false },
  { key: "presentation",  label: "Executive Presentation", desc: "C-suite summary for client meetings",                      icon: "slideshow",         primary: false },
  { key: "all",           label: "Full Bid Package",       desc: "All sections combined in a single DOCX",                   icon: "folder_zip",        primary: false },
];

export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const [tender, setTender]     = useState<Tender | null>(null);
  const [agents, setAgents]     = useState<AgentRun[]>([]);
  const [downloading, setDl]    = useState<string | null>(null);
  const [exported, setExported] = useState<string[]>([]);
  const [error, setError]       = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      fetch(`/api/tenders/${id}`).then((r) => r.json()),
      fetch(`/api/tenders/${id}/agents`).then((r) => r.json()),
    ]).then(([t, a]) => {
      setTender(t);
      if (Array.isArray(a)) setAgents(a);
    }).catch(console.error);
  }, [id]);

  const agentMap = Object.fromEntries(agents.map((a) => [a.agent_type, a]));
  const isReady  = (key: string) => key === "all" || key === "commercial" || agentMap[key]?.status === "completed";

  async function download(type: string) {
    setDl(type);
    setError((prev) => ({ ...prev, [type]: "" }));
    try {
      const res = await fetch(`/api/tenders/${id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Export failed");
      }
      const blob = await res.blob();
      const section = EXPORT_SECTIONS.find((s) => s.key === type);
      const safeName = (tender?.name ?? "tender").replace(/[^a-z0-9]/gi, "_");
      const safeLabel = (section?.label ?? type).replace(/[^a-z0-9]/gi, "_");
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: `EIH_${safeName}_${safeLabel}.docx`,
      });
      a.click();
      setExported((prev) => [...new Set([...prev, type])]);
    } catch (e) {
      setError((prev) => ({ ...prev, [type]: e instanceof Error ? e.message : "Export failed" }));
    } finally {
      setDl(null);
    }
  }

  const completedCount = agents.filter((a) => a.status === "completed").length;
  const winProb  = tender?.win_probability  ?? 0;
  const readiness = tender?.readiness_score ?? 0;

  return (
    <div className="flex flex-col gap-6">

      {/* Readiness bar */}
      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-border-light">
          {[
            { label: "Sections Ready",     value: `${completedCount} / 11`,     sub: "AI agents completed",       good: completedCount >= 8 },
            { label: "Readiness Score",    value: readiness ? `${readiness}%` : "—", sub: "Overall bid quality",  good: readiness >= 70 },
            { label: "Win Probability",    value: winProb ? `${winProb}%` : "—",    sub: "AI strategic estimate", good: winProb >= 50 },
          ].map((kpi) => (
            <div key={kpi.label} className="flex flex-col items-center py-5 gap-1">
              <p className={`text-[24px] font-bold ${kpi.good ? "text-success" : "text-warning"}`}>{kpi.value}</p>
              <p className="text-[12px] font-semibold text-text">{kpi.label}</p>
              <p className="text-[11px] text-text-muted">{kpi.sub}</p>
            </div>
          ))}
        </div>
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between text-[11px] text-text-secondary mb-1.5">
            <span>AI completion</span>
            <span className="font-semibold text-text">{Math.round((completedCount / 11) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-mid">
            <div className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${(completedCount / 11) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Export grid */}
      <div>
        <p className="text-[11px] uppercase font-semibold tracking-wide text-text-muted mb-3">Export Documents</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {EXPORT_SECTIONS.map((section) => {
            const ready   = isReady(section.key);
            const loading = downloading === section.key;
            const done    = exported.includes(section.key);
            const err     = error[section.key];

            return (
              <div
                key={section.key}
                className={`flex items-start gap-4 rounded-xl border bg-surface p-4 shadow-sm transition-colors ${
                  section.primary
                    ? "border-[#8B3520]/30 bg-gradient-to-br from-[#8B3520]/5 to-surface"
                    : "border-border"
                }`}
              >
                {/* Icon */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  section.primary ? "bg-[#8B3520]" : "bg-surface-dim"
                }`}>
                  <span className={`material-symbols-outlined text-[20px] ${section.primary ? "text-white" : "text-text-secondary"}`}>
                    {section.icon}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-[13px] font-semibold text-text ${section.primary ? "text-[#8B3520]" : ""}`}>
                      {section.label}
                    </p>
                    {section.primary && (
                      <span className="rounded-full bg-[#8B3520]/10 border border-[#8B3520]/20 px-2 py-0.5 text-[9px] font-bold uppercase text-[#8B3520]">
                        EIH Format
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-text-secondary">{section.desc}</p>
                  {err && <p className="text-[11px] text-danger mt-1">{err}</p>}
                  {done && !loading && (
                    <p className="text-[11px] text-success font-medium mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">check_circle</span>
                      Downloaded
                    </p>
                  )}
                </div>

                {/* Button */}
                <button
                  onClick={() => download(section.key)}
                  disabled={!ready || loading}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-[12px] font-semibold transition-all disabled:opacity-50 ${
                    section.primary
                      ? "bg-[#8B3520] text-white hover:bg-[#7a2d1a]"
                      : ready
                      ? "bg-surface-dim text-text hover:bg-border border border-border"
                      : "bg-surface-dim text-text-muted border border-border cursor-not-allowed"
                  }`}
                >
                  {loading ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">
                      {!ready ? "lock" : done ? "download_done" : "download"}
                    </span>
                  )}
                  {loading ? "Generating…" : !ready ? "Not ready" : "Download"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tip */}
      <div className="flex items-start gap-3 rounded-xl border border-[#C8A24A]/30 bg-[#C8A24A]/5 px-4 py-3">
        <span className="material-symbols-outlined text-[18px] text-[#C8A24A] mt-0.5 shrink-0">lightbulb</span>
        <div>
          <p className="text-[12.5px] font-semibold text-text">Commercial Proposal requires a saved BOQ</p>
          <p className="text-[12px] text-text-secondary mt-0.5">
            Go to the <strong>Estimation</strong> tab → fill in the BOQ monthly rates and staff → Save → then come back here to export. The Commercial Proposal will include your exact figures formatted exactly like EIH&apos;s standard proposal.
          </p>
        </div>
      </div>

      {/* Audit log */}
      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border-light px-5 py-3.5">
          <span className="material-symbols-outlined text-[16px] text-text-muted">history</span>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Export History (this session)</p>
        </div>
        {exported.length === 0 ? (
          <p className="px-5 py-6 text-[12px] text-text-muted text-center">No exports yet — click Download on any document above.</p>
        ) : (
          <div className="divide-y divide-border-light">
            {exported.map((key) => {
              const s = EXPORT_SECTIONS.find((x) => x.key === key);
              return (
                <div key={key} className="flex items-center gap-3 px-5 py-3">
                  <span className="material-symbols-outlined text-[16px] text-success">check_circle</span>
                  <div className="flex-1">
                    <p className="text-[12.5px] font-medium text-text">{s?.label ?? key}</p>
                    <p className="text-[11px] text-text-muted">{new Date().toLocaleTimeString("en-GB")}</p>
                  </div>
                  <button
                    onClick={() => download(key)}
                    disabled={downloading === key}
                    className="text-[11.5px] text-primary hover:underline"
                  >
                    Re-download
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
