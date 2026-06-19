"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ViewsBar, ViewTab } from "@/components/views-bar";

const TABS: ViewTab[] = [
  { key: "overview",   label: "OVERVIEW" },
  { key: "requirements", label: "REQUIREMENTS" },
  { key: "agents",     label: "AI AGENTS" },
  { key: "documents",  label: "DOCUMENTS" },
  { key: "compliance", label: "COMPLIANCE" },
  { key: "commercial", label: "COMMERCIAL" },
  { key: "submission", label: "SUBMISSION PACKAGE" },
];

const AGENT_TYPES = [
  "intelligence","qualification","compliance","technical","commercial",
  "manpower","ppm","risk","hse","presentation","executive_review",
] as const;

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

const STATUS_STYLES = {
  waiting:   "bg-white/5 text-text-secondary",
  running:   "bg-[#00E5FF]/10 text-[#00E5FF]",
  completed: "bg-[#10B981]/10 text-[#10B981]",
  failed:    "bg-[#EF4444]/10 text-[#EF4444]",
};

interface AgentRun {
  agent_type: string;
  status: "waiting" | "running" | "completed" | "failed";
  progress: number;
  current_task?: string;
}

interface TenderData {
  id: string;
  name: string;
  client?: string;
  submission_deadline?: string;
  contract_value?: number;
  readiness_score?: number;
  win_probability?: number;
  executive_summary?: string;
  status: string;
}

interface Extraction {
  scope_of_work?: string;
  technical_requirements?: string[];
  commercial_requirements?: string[];
  evaluation_criteria?: string[];
  staffing_requirements?: string[];
  asset_information?: string[];
}

export function TenderWorkspace({ tenderId }: { tenderId: string }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [tender, setTender] = useState<TenderData | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [agents, setAgents] = useState<AgentRun[]>(
    AGENT_TYPES.map((t) => ({ agent_type: t, status: "waiting", progress: 0 })),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [tRes, eRes, aRes] = await Promise.all([
          fetch(`/api/tenders/${tenderId}`),
          fetch(`/api/tenders/${tenderId}/extraction`),
          fetch(`/api/tenders/${tenderId}/agents`),
        ]);
        if (tRes.ok) setTender(await tRes.json());
        if (eRes.ok) setExtraction(await eRes.json());
        if (aRes.ok) setAgents(await aRes.json());
      } catch {/* handled gracefully */}
      setLoading(false);
    }
    load();
  }, [tenderId]);

  if (loading) return <WorkspaceSkeleton />;

  return (
    <div className="flex h-full flex-col">
      {/* Workspace header */}
      <header className="border-b border-border bg-surface px-8 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold text-text">
              {tender?.name ?? "Tender Workspace"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px] text-text-secondary">
              {tender?.client && <span>Client: <span className="text-text">{tender.client}</span></span>}
              {tender?.submission_deadline && (
                <span>Deadline: <span className="text-text">{new Date(tender.submission_deadline).toLocaleDateString()}</span></span>
              )}
              {tender?.contract_value && (
                <span>Value: <span className="text-text">{tender.contract_value.toLocaleString()} AED</span></span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {tender?.readiness_score !== undefined && (
              <ScorePill label="Readiness" value={tender.readiness_score} color="brand" />
            )}
            {tender?.win_probability !== undefined && (
              <ScorePill label="Win Prob." value={tender.win_probability} color="ai" />
            )}
          </div>
        </div>
        <div className="mt-4">
          <ViewsBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
        </div>
      </header>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto w-full max-w-5xl px-8 py-8"
          >
            {activeTab === "overview"     && <OverviewTab tender={tender} extraction={extraction} />}
            {activeTab === "requirements" && <RequirementsTab extraction={extraction} />}
            {activeTab === "agents"       && <AgentsTab agents={agents} />}
            {activeTab === "documents"    && <DocumentsTab />}
            {activeTab === "compliance"   && <ComplianceTab />}
            {activeTab === "commercial"   && <CommercialTab />}
            {activeTab === "submission"   && <SubmissionTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function ScorePill({ label, value, color }: { label: string; value: number; color: "brand" | "ai" }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-card px-4 py-2">
      <span className="text-[10px] uppercase tracking-wide text-text-secondary">{label}</span>
      <span className={`text-[22px] font-bold ${color === "brand" ? "text-brand" : "text-ai"}`}>
        {value}%
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-[20px] font-semibold text-text">{children}</h2>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-6 ${className}`}>
      {children}
    </div>
  );
}

function OverviewTab({ tender, extraction }: { tender: TenderData | null; extraction: Extraction | null }) {
  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>Overview</SectionTitle>
      {tender?.executive_summary ? (
        <Card>
          <h3 className="mb-3 text-[14px] uppercase tracking-wide text-text-secondary">Executive Summary</h3>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-text">
            {tender.executive_summary}
          </p>
        </Card>
      ) : (
        <Card>
          <p className="text-[14px] text-text-secondary">
            AI is analysing your RFP… The executive summary will appear here shortly.
          </p>
        </Card>
      )}
      {extraction?.scope_of_work && (
        <Card>
          <h3 className="mb-3 text-[14px] uppercase tracking-wide text-text-secondary">Scope of Work</h3>
          <p className="text-[15px] leading-relaxed text-text">{extraction.scope_of_work}</p>
        </Card>
      )}
    </div>
  );
}

function RequirementsTab({ extraction }: { extraction: Extraction | null }) {
  if (!extraction) {
    return (
      <div className="flex flex-col gap-6">
        <SectionTitle>Requirements</SectionTitle>
        <Card><p className="text-text-secondary">Extracting requirements from your RFP…</p></Card>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>Requirements</SectionTitle>
      {[
        { label: "Technical Requirements", items: extraction.technical_requirements },
        { label: "Commercial Requirements", items: extraction.commercial_requirements },
        { label: "Evaluation Criteria",    items: extraction.evaluation_criteria },
        { label: "Staffing Requirements",  items: extraction.staffing_requirements },
        { label: "Asset Information",      items: extraction.asset_information },
      ].filter((s) => s.items?.length).map((section) => (
        <Card key={section.label}>
          <h3 className="mb-3 text-[14px] uppercase tracking-wide text-text-secondary">{section.label}</h3>
          <ul className="flex flex-col gap-2">
            {section.items!.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[14px] text-text">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function AgentsTab({ agents }: { agents: AgentRun[] }) {
  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>AI Agents</SectionTitle>
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.04 } } }}
        className="grid gap-4 sm:grid-cols-2"
      >
        {agents.map((agent) => (
          <motion.div
            key={agent.agent_type}
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.2 }}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-medium text-text">
                {AGENT_LABELS[agent.agent_type] ?? agent.agent_type}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${STATUS_STYLES[agent.status]}`}>
                {agent.status}
              </span>
            </div>
            {agent.current_task && (
              <p className="mt-2 text-[13px] text-text-secondary">{agent.current_task}</p>
            )}
            {agent.status === "running" && (
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/5">
                <motion.div
                  className="h-full rounded-full bg-ai"
                  animate={{ width: `${agent.progress}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function DocumentsTab() {
  const DOC_TYPES = [
    "Technical Proposal", "Commercial Proposal", "Compliance Matrix",
    "PPM Schedule", "Manpower Plan", "Risk Register",
    "HSE Plan", "Executive Presentation",
  ];
  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>Documents</SectionTitle>
      <div className="flex flex-col gap-2">
        {DOC_TYPES.map((doc) => (
          <div key={doc} className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4">
            <span className="text-[14px] text-text">{doc}</span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-text-secondary">
              Pending
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComplianceTab() {
  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>Compliance</SectionTitle>
      <Card><p className="text-text-secondary">Compliance matrix and submission checklist will be generated by the Compliance Agent.</p></Card>
    </div>
  );
}

function CommercialTab() {
  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>Commercial</SectionTitle>
      <Card><p className="text-text-secondary">Pricing model, BOQ analysis, and commercial submission will be generated by the Commercial Agent.</p></Card>
    </div>
  );
}

function SubmissionTab() {
  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>Submission Package</SectionTitle>
      <Card>
        <p className="mb-4 text-[14px] text-text-secondary">
          Export a complete submission package once all documents are approved.
        </p>
        <button className="rounded-lg border border-brand/40 px-5 py-2.5 text-[14px] font-medium text-brand opacity-50 cursor-not-allowed">
          Export ZIP Package
        </button>
      </Card>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-5">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-white/5" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-white/5" />
        <div className="mt-5 flex gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-8 w-24 animate-pulse rounded bg-white/5" />
          ))}
        </div>
      </div>
      <div className="flex-1 px-8 py-8">
        <div className="mx-auto max-w-5xl flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      </div>
    </div>
  );
}
