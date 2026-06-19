"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";

interface Extraction {
  scope_of_work?: string;
  technical_requirements?: string[];
  commercial_requirements?: string[];
  evaluation_criteria?: string[];
  staffing_requirements?: string[];
  asset_information?: string[];
  boq_data?: Record<string, unknown>;
}

interface AgentRun {
  agent_type: string;
  status: string;
  progress: number;
  current_task?: string;
}

interface TenderData {
  executive_summary?: string;
  readiness_score?: number;
  win_probability?: number;
}

const AGENT_LABELS: Record<string, string> = {
  intelligence: "Tender Intelligence",
  qualification: "Qualification",
  compliance: "Compliance",
  technical: "Technical Proposal",
  commercial: "Commercial",
  manpower: "Manpower",
  ppm: "PPM Schedule",
  risk: "Risk",
  hse: "HSE",
  presentation: "Presentation",
  executive_review: "Executive Review",
};

const STATUS_STYLES: Record<string, string> = {
  waiting:   "text-text-muted bg-surface-dim",
  running:   "text-primary bg-primary-light",
  completed: "text-success bg-success-bg",
  failed:    "text-danger bg-danger-bg",
};

const RISK_ITEMS = [
  { icon: "gavel", label: "Regulatory Compliance", level: "Medium", color: "text-warning" },
  { icon: "account_balance_wallet", label: "Financial Exposure", level: "Low", color: "text-success" },
  { icon: "schedule", label: "Timeline Risk", level: "High", color: "text-danger" },
];

export default function TenderOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const [tender, setTender] = useState<TenderData | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [agents, setAgents] = useState<AgentRun[]>([]);

  useEffect(() => {
    let active = true;
    let timeout: ReturnType<typeof setTimeout>;

    async function load() {
      const [t, e, a] = await Promise.all([
        fetch(`/api/tenders/${id}`).then((r) => r.json()),
        fetch(`/api/tenders/${id}/extraction`).then((r) => r.ok ? r.json() : null),
        fetch(`/api/tenders/${id}/agents`).then((r) => r.json()),
      ]);
      if (!active) return;
      setTender(t);
      if (e) setExtraction(e);
      if (Array.isArray(a)) {
        setAgents(a);
        const busy = a.some((ag: AgentRun) => ag.status === "running" || ag.status === "waiting");
        if (busy) timeout = setTimeout(load, 3000);
      }
    }

    load().catch(console.error);
    return () => { active = false; clearTimeout(timeout); };
  }, [id]);

  const completedAgents = agents.filter((a) => a.status === "completed").length;
  const totalAgents = agents.length;

  return (
    <div className="flex flex-col gap-5">
      {/* AI Executive Summary */}
      <div
        className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden"
        style={{ borderLeft: "3px solid #C8A24A" }}
      >
        <div className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[18px] text-primary">smart_toy</span>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">AI Executive Summary</p>
          </div>
          <p className="text-[14px] leading-relaxed text-text whitespace-pre-wrap">
            {tender?.executive_summary ??
              "AI analysis in progress â€” the executive summary will appear once agents have run. Upload your RFP and click 'Run AI' to generate this section."}
          </p>
          {/* Key chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            {["Contract Duration: 3 Years", "Service Frequency: Daily", "Est. Value: Per BOQ"].map((chip) => (
              <span key={chip} className="rounded-full border border-border-light bg-surface-dim px-3 py-1 text-[11px] text-text-secondary">
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Risk Scorecard */}
        <div className="rounded-lg border border-border bg-surface shadow-sm p-5">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary mb-4">Risk Scorecard</p>
          <div className="flex flex-col gap-3">
            {RISK_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`material-symbols-outlined text-[18px] ${item.color}`}>{item.icon}</span>
                  <span className="text-[13px] text-text">{item.label}</span>
                </div>
                <span className={`text-[11px] font-semibold ${item.color}`}>{item.level}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Extracted Key Dates */}
        <div className="rounded-lg border border-border bg-surface shadow-sm p-5">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary mb-4">Extracted Key Dates</p>
          <div className="flex flex-col gap-3">
            {[
              { label: "Pre-Qual Deadline", date: "â€”" },
              { label: "Clarification Deadline", date: "â€”" },
              { label: "Submission Deadline", date: "â€”" },
            ].map((item, i) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-[10px] font-bold text-primary">
                  {i + 1}
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-text-muted">{item.label}</p>
                  <p className="text-[13px] font-medium text-text">{item.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Agent progress */}
      {agents.length > 0 && (
        <div className="rounded-lg border border-border bg-surface shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Module Status</p>
            <span className="text-[12px] text-text-secondary">{completedAgents}/{totalAgents} complete</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-mid mb-4">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${totalAgents ? (completedAgents / totalAgents) * 100 : 0}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => (
              <div
                key={a.agent_type}
                className="flex items-center justify-between rounded border border-border-light bg-surface-dim px-3 py-2"
              >
                <span className="text-[12px] text-text">{AGENT_LABELS[a.agent_type] ?? a.agent_type}</span>
                <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[a.status] ?? "text-text-muted bg-surface-dim"}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scope of work */}
      {extraction?.scope_of_work && (
        <div className="rounded-lg border border-border bg-surface shadow-sm p-5">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary mb-3">Scope of Work</p>
          <p className="text-[14px] leading-relaxed text-text">{extraction.scope_of_work}</p>
        </div>
      )}

      {/* Requirements grid */}
      {extraction && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "Technical Requirements", items: extraction.technical_requirements },
            { label: "Commercial Requirements", items: extraction.commercial_requirements },
            { label: "Evaluation Criteria", items: extraction.evaluation_criteria },
            { label: "Staffing Requirements", items: extraction.staffing_requirements },
          ].filter((s) => s.items?.length).map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-surface shadow-sm p-5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary mb-3">{s.label}</p>
              <ul className="flex flex-col gap-1.5">
                {s.items!.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-text">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

