"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";

interface TenderFull {
  id: string;
  name: string;
  client?: string;
  submission_deadline?: string;
  contract_value?: number;
  contract_duration?: string;
  status: string;
  readiness_score?: number;
  win_probability?: number;
  executive_summary?: string;
}

interface Extraction {
  scope_of_work?: string;
  technical_requirements?: string[];
  commercial_requirements?: string[];
  evaluation_criteria?: string[];
  staffing_requirements?: string[];
  asset_information?: string[];
  deadline?: string;
  contract_duration?: string;
  client_name?: string;
}

interface AgentRun {
  agent_type: string;
  status: string;
  progress: number;
  current_task?: string;
  output_content?: string;
}

// ── Config ───────────────────────────────────────────────────────────────────

const MODULES = [
  { type: "intelligence",     label: "Tender Intelligence", icon: "lightbulb",        path: "" },
  { type: "qualification",    label: "Qualification",       icon: "verified",          path: "/qualification" },
  { type: "compliance",       label: "Compliance Matrix",   icon: "fact_check",        path: "/compliance" },
  { type: "technical",        label: "Technical Proposal",  icon: "engineering",       path: "/estimation" },
  { type: "commercial",       label: "Commercial / BOQ",    icon: "receipt_long",      path: "/estimation" },
  { type: "manpower",         label: "Manpower Plan",       icon: "groups",            path: "/manpower" },
  { type: "ppm",              label: "Assets & PPM",        icon: "build_circle",      path: "/assets" },
  { type: "risk",             label: "Risk Register",       icon: "warning_amber",     path: "/risk" },
  { type: "hse",              label: "HSE Plan",            icon: "health_and_safety", path: "/risk" },
  { type: "sla",              label: "SLA & KPI",           icon: "speed",             path: "/sla" },
  { type: "presentation",     label: "Presentation",        icon: "slideshow",         path: "/export" },
  { type: "executive_review", label: "Executive Review",    icon: "summarize",         path: "" },
] as const;

const STATUS_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  waiting:   { label: "Pending",   cls: "text-text-muted bg-surface-dim",  dot: "bg-text-muted" },
  running:   { label: "Running",   cls: "text-primary bg-primary-light",   dot: "bg-primary animate-pulse" },
  completed: { label: "Complete",  cls: "text-success bg-success-bg",      dot: "bg-success" },
  failed:    { label: "Failed",    cls: "text-danger bg-danger-bg",        dot: "bg-danger" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function fmtValue(v: number) {
  return v >= 1_000_000 ? `AED ${(v / 1_000_000).toFixed(1)}M`
       : v >= 1_000     ? `AED ${(v / 1_000).toFixed(0)}K`
       :                   `AED ${v}`;
}

function scoreColor(v: number) {
  if (v >= 75) return { text: "text-success", bg: "bg-success", ring: "#10B981" };
  if (v >= 50) return { text: "text-warning", bg: "bg-warning", ring: "#F59E0B" };
  return { text: "text-danger", bg: "bg-danger", ring: "#EF4444" };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, accent,
}: {
  icon: string; label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm flex items-center gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light">
        <span className="material-symbols-outlined text-[20px] text-primary">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-text-muted uppercase tracking-wide font-medium">{label}</p>
        <p className={`text-[20px] font-bold leading-tight mt-0.5 ${accent ?? "text-text"}`}>{value}</p>
        {sub && <p className="text-[11px] text-text-secondary mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ScoreRing({ value, size = 88 }: { value: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  const col = scoreColor(value);
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-mid)" strokeWidth={8} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={col.ring} strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-[22px] font-bold ${col.text}`}>{value}</span>
        <span className="text-[9px] text-text-muted uppercase tracking-wide">/ 100</span>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TenderOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tender, setTender] = useState<TenderFull | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [agents, setAgents] = useState<AgentRun[]>([]);

  useEffect(() => {
    let active = true;
    let t: ReturnType<typeof setTimeout>;

    async function load() {
      const [td, ex, ag] = await Promise.all([
        fetch(`/api/tenders/${id}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/tenders/${id}/extraction`).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/tenders/${id}/agents`).then((r) => r.json()).catch(() => []),
      ]);
      if (!active) return;
      if (td) setTender(td);
      if (ex) setExtraction(ex);
      if (Array.isArray(ag)) {
        setAgents(ag);
        if (ag.some((a: AgentRun) => a.status === "running" || a.status === "waiting")) {
          t = setTimeout(load, 3000);
        }
      }
    }

    load();
    return () => { active = false; clearTimeout(t); };
  }, [id]);

  const completedCount = agents.filter((a) => a.status === "completed").length;
  const totalCount = agents.length || 12;
  const overallProgress = Math.round((completedCount / totalCount) * 100);

  const readiness = tender?.readiness_score ?? 0;
  const winProb = tender?.win_probability ?? 0;

  const deadline = tender?.submission_deadline;
  const dLeft = deadline ? daysUntil(deadline) : null;
  const deadlineStr = deadline
    ? new Date(deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";
  const dLeftStr = dLeft != null
    ? dLeft > 0 ? `${dLeft} days remaining` : dLeft === 0 ? "Due today" : "Deadline passed"
    : undefined;

  const agentMap = Object.fromEntries(agents.map((a) => [a.agent_type, a]));

  // Derive recommendation from executive_review output if available
  const execRun = agentMap["executive_review"];
  let recommendation: string | null = null;
  if (execRun?.output_content) {
    const m = execRun.output_content.match(/"recommendation"\s*:\s*"([^"]+)"/);
    if (m) recommendation = m[1];
  }

  const recLabel = recommendation === "go" ? { label: "GO", cls: "text-success bg-success-bg border-success/30" }
    : recommendation === "no-go" ? { label: "NO GO", cls: "text-danger bg-danger-bg border-danger/30" }
    : recommendation === "conditional" ? { label: "CONDITIONAL GO", cls: "text-warning bg-warning-bg border-warning/30" }
    : null;

  return (
    <div className="flex flex-col gap-5">

      {/* ── KPI Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon="donut_large"
          label="Bid Readiness"
          value={readiness ? `${readiness}%` : "—"}
          sub={readiness ? (readiness >= 75 ? "Ready to submit" : readiness >= 50 ? "Needs review" : "Work in progress") : "Run AI agents first"}
          accent={readiness ? scoreColor(readiness).text : undefined}
        />
        <KpiCard
          icon="trending_up"
          label="Win Probability"
          value={winProb ? `${winProb}%` : "—"}
          sub={winProb ? (winProb >= 70 ? "Strong position" : winProb >= 40 ? "Competitive" : "Needs strengthening") : "Awaiting analysis"}
          accent={winProb ? scoreColor(winProb).text : undefined}
        />
        <KpiCard
          icon="event"
          label="Submission Deadline"
          value={deadlineStr}
          sub={dLeftStr}
          accent={dLeft != null && dLeft <= 7 ? "text-danger" : dLeft != null && dLeft <= 14 ? "text-warning" : undefined}
        />
        <KpiCard
          icon="payments"
          label="Contract Value"
          value={tender?.contract_value ? fmtValue(tender.contract_value) : "Per BOQ"}
          sub={tender?.contract_duration ? `Duration: ${tender.contract_duration}` : undefined}
        />
      </div>

      {/* ── Executive Summary + Bid Scorecard ───────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Summary — 2/3 width */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border-light px-5 py-3.5" style={{ background: "linear-gradient(135deg, #8B352008 0%, #C8A24A08 100%)" }}>
            <span className="material-symbols-outlined text-[18px] text-primary">smart_toy</span>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">AI Executive Summary</p>
            {recLabel && (
              <span className={`ms-auto rounded border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${recLabel.cls}`}>
                {recLabel.label}
              </span>
            )}
          </div>
          <div className="p-5">
            <p className="text-[13.5px] leading-[1.75] text-text">
              {tender?.executive_summary ?? "AI analysis not yet available. Upload your RFP documents and click 'Run AI' to generate the executive summary, readiness score, win probability, and all 12 bid modules automatically."}
            </p>
            {/* Tender detail chips */}
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                tender?.client && { icon: "business", text: tender.client },
                (tender?.contract_duration ?? extraction?.contract_duration) && { icon: "calendar_month", text: `Duration: ${tender?.contract_duration ?? extraction?.contract_duration}` },
                tender?.status && { icon: "flag", text: tender.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) },
              ].filter(Boolean).map((chip, i) => chip && (
                <span key={i} className="flex items-center gap-1.5 rounded-full border border-border-light bg-surface-dim px-3 py-1 text-[11px] text-text-secondary">
                  <span className="material-symbols-outlined text-[12px]">{chip.icon}</span>
                  {chip.text}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Scorecard — 1/3 width */}
        <div className="rounded-xl border border-border bg-surface shadow-sm p-5 flex flex-col gap-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Bid Scorecard</p>

          {/* Readiness ring */}
          <div className="flex items-center gap-4">
            <ScoreRing value={readiness || 0} size={80} />
            <div>
              <p className="text-[11px] text-text-muted">Bid Readiness</p>
              <p className={`text-[13px] font-semibold mt-0.5 ${readiness ? scoreColor(readiness).text : "text-text-secondary"}`}>
                {readiness ? (readiness >= 75 ? "Submission Ready" : readiness >= 50 ? "Needs Review" : "In Progress") : "Not assessed"}
              </p>
            </div>
          </div>

          {/* Win probability bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] text-text-muted">Win Probability</p>
              <span className={`text-[13px] font-bold ${winProb ? scoreColor(winProb).text : "text-text-secondary"}`}>
                {winProb ? `${winProb}%` : "—"}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-mid">
              <motion.div
                className={`h-full rounded-full ${winProb ? scoreColor(winProb).bg : "bg-surface-mid"}`}
                initial={{ width: 0 }}
                animate={{ width: `${winProb}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>

          {/* Module completion */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] text-text-muted">AI Modules Complete</p>
              <span className="text-[12px] font-semibold text-text">{completedCount}/{totalCount}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-mid">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${overallProgress}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>

          {/* Risk summary — derived from risk agent */}
          <div className="rounded-lg border border-border-light bg-surface-dim p-3">
            <p className="text-[10px] uppercase tracking-wide text-text-muted mb-2 font-medium">Risk Summary</p>
            {[
              { label: "Regulatory", level: "Medium", color: "text-warning", bg: "bg-warning" },
              { label: "Financial",  level: "Low",    color: "text-success", bg: "bg-success" },
              { label: "Timeline",   level: dLeft != null && dLeft < 14 ? "High" : "Medium",
                color: dLeft != null && dLeft < 14 ? "text-danger" : "text-warning",
                bg: dLeft != null && dLeft < 14 ? "bg-danger" : "bg-warning" },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between py-1">
                <span className="text-[11.5px] text-text-secondary">{r.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${r.bg}`} />
                  <span className={`text-[11px] font-semibold ${r.color}`}>{r.level}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 12 Module Status Cards ───────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-border-light px-5 py-3.5">
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">AI Module Status</p>
            <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary">{completedCount}/{totalCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Complete
            <span className="ms-2 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Running
            <span className="ms-2 h-1.5 w-1.5 rounded-full bg-text-muted" /> Pending
          </div>
        </div>

        <div className="grid grid-cols-2 gap-0 sm:grid-cols-3 lg:grid-cols-4">
          {MODULES.map((mod, i) => {
            const run = agentMap[mod.type];
            const s = STATUS_CONFIG[run?.status ?? "waiting"] ?? STATUS_CONFIG.waiting;
            const progress = run?.progress ?? 0;
            const hasTab = mod.path !== "";
            const isLast = i === MODULES.length - 1;
            const isRunning = run?.status === "running";

            return (
              <div
                key={mod.type}
                onClick={() => hasTab && router.push(`/tenders/${id}${mod.path}`)}
                className={[
                  "group border-b border-e border-border-light p-4 transition-colors",
                  hasTab ? "cursor-pointer hover:bg-surface-dim" : "",
                  isLast ? "border-e-0" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${run?.status === "completed" ? "bg-success/10" : "bg-primary-light"}`}>
                      <span className={`material-symbols-outlined text-[15px] ${run?.status === "completed" ? "text-success" : "text-primary"}`}>
                        {mod.icon}
                      </span>
                    </div>
                    <p className="text-[12px] font-medium text-text leading-tight">{mod.label}</p>
                  </div>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${s.cls}`}>
                    {s.label}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1 w-full overflow-hidden rounded-full bg-surface-mid">
                  <motion.div
                    className={`h-full rounded-full ${run?.status === "completed" ? "bg-success" : "bg-primary"}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${run?.status === "completed" ? 100 : progress}%` }}
                    transition={{ duration: 0.7 }}
                  />
                </div>

                {isRunning && run?.current_task && (
                  <p className="mt-1.5 text-[10px] text-text-muted truncate">{run.current_task}</p>
                )}

                {hasTab && (
                  <p className="mt-1.5 text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    View section <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Scope of Work ───────────────────────────────────────────────── */}
      {extraction?.scope_of_work && (
        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border-light px-5 py-3">
            <span className="material-symbols-outlined text-[16px] text-text-muted">description</span>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Scope of Work</p>
          </div>
          <p className="p-5 text-[13.5px] leading-[1.75] text-text">{extraction.scope_of_work}</p>
        </div>
      )}

      {/* ── Extracted Requirements ──────────────────────────────────────── */}
      {extraction && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "Technical Requirements", icon: "engineering",   items: extraction.technical_requirements },
            { label: "Commercial Requirements",icon: "receipt_long",  items: extraction.commercial_requirements },
            { label: "Evaluation Criteria",    icon: "checklist",     items: extraction.evaluation_criteria },
            { label: "Staffing Requirements",  icon: "groups",        items: extraction.staffing_requirements },
          ].filter((s) => s.items?.length).map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border-light px-5 py-3">
                <span className="material-symbols-outlined text-[16px] text-text-muted">{s.icon}</span>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">{s.label}</p>
                <span className="ms-auto text-[10px] text-text-muted">{s.items!.length} items</span>
              </div>
              <ul className="flex flex-col divide-y divide-border-light">
                {s.items!.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 px-5 py-2.5 text-[12.5px] text-text">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state when no data yet ────────────────────────────────── */}
      {!extraction && agents.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <span className="material-symbols-outlined text-[40px] text-text-muted">upload_file</span>
          <p className="mt-3 text-[14px] font-semibold text-text">Upload documents to get started</p>
          <p className="mt-1 text-[12px] text-text-secondary">
            Go to the <strong>Documents</strong> tab to upload your RFP files, then click <strong>Run AI</strong> to generate all 12 bid modules automatically.
          </p>
        </div>
      )}
    </div>
  );
}
