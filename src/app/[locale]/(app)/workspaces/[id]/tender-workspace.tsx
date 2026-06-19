"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ViewsBar, ViewTab } from "@/components/views-bar";
import { TasksPanel } from "@/components/tasks-panel";
import { DocumentEditor } from "@/components/document-editor";

const TABS: ViewTab[] = [
  { key: "overview",     label: "OVERVIEW" },
  { key: "requirements", label: "REQUIREMENTS" },
  { key: "agents",       label: "AI AGENTS" },
  { key: "documents",    label: "DOCUMENTS" },
  { key: "compliance",   label: "COMPLIANCE" },
  { key: "commercial",   label: "COMMERCIAL" },
  { key: "tasks",        label: "TASKS" },
  { key: "submission",   label: "SUBMISSION PACKAGE" },
];

const AGENT_LABELS: Record<string, string> = {
  intelligence:    "Tender Intelligence",
  qualification:   "Qualification",
  compliance:      "Compliance",
  technical:       "Technical Proposal",
  commercial:      "Commercial",
  manpower:        "Manpower",
  ppm:             "PPM Schedule",
  risk:            "Risk",
  hse:             "HSE",
  presentation:    "Presentation",
  executive_review: "Executive Review",
};

const AGENT_ORDER = [
  "intelligence","qualification","compliance","technical","commercial",
  "manpower","ppm","risk","hse","presentation","executive_review",
];

const STATUS_STYLES: Record<string, string> = {
  waiting:   "bg-white/5 text-text-secondary",
  running:   "bg-[#00E5FF]/10 text-[#00E5FF]",
  completed: "bg-[#10B981]/10 text-[#10B981]",
  failed:    "bg-[#EF4444]/10 text-[#EF4444]",
};

interface AgentRun {
  agent_type: string;
  status: "waiting"|"running"|"completed"|"failed";
  progress: number;
  current_task?: string;
}

interface Document {
  id: string;
  title: string;
  type: string;
  review_status: string;
  current_version_id?: string;
  document_versions?: Array<{ id: string; content_html?: string; version_no: number }>;
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
    AGENT_ORDER.map((t) => ({ agent_type: t, status: "waiting", progress: 0 })),
  );
  const [documents, setDocuments] = useState<Document[]>([]);
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    const [tRes, eRes, aRes, dRes] = await Promise.all([
      fetch(`/api/tenders/${tenderId}`),
      fetch(`/api/tenders/${tenderId}/extraction`),
      fetch(`/api/tenders/${tenderId}/agents`),
      fetch(`/api/documents?tender_id=${tenderId}`),
    ]);
    if (tRes.ok) setTender(await tRes.json());
    if (eRes.ok) { const d = await eRes.json(); if (d) setExtraction(d); }
    if (aRes.ok) {
      const a = await aRes.json();
      if (Array.isArray(a) && a.length) {
        const ordered = AGENT_ORDER.map(
          (t) => a.find((r: AgentRun) => r.agent_type === t) ?? { agent_type: t, status: "waiting", progress: 0 },
        );
        setAgents(ordered);
      }
    }
    if (dRes.ok) setDocuments(await dRes.json());
    setLoading(false);
  }, [tenderId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Poll for agent progress while running
  useEffect(() => {
    if (running) {
      const iv = setInterval(loadData, 3000);
      setPollInterval(iv);
      return () => clearInterval(iv);
    } else if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
  }, [running]);

  // Auto-stop polling when all agents done
  useEffect(() => {
    const allDone = agents.every((a) => a.status === "completed" || a.status === "failed");
    if (allDone && running) setRunning(false);
  }, [agents, running]);

  async function runAgents() {
    setRunning(true);
    setActiveTab("agents");
    // Optimistic: set all to waiting
    setAgents(AGENT_ORDER.map((t) => ({ agent_type: t, status: "waiting", progress: 0 })));
    try {
      await fetch(`/api/tenders/${tenderId}/run-agents`, { method: "POST" });
    } catch {/* handled by polling */}
    setRunning(false);
    await loadData();
  }

  async function exportPackage() {
    const res = await fetch(`/api/tenders/${tenderId}/export`, { method: "POST" });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tender?.name ?? "submission"}_package.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const openDoc = documents.find((d) => d.id === openDocId);
  const openDocVersion = openDoc?.document_versions?.find(
    (v) => v.id === openDoc.current_version_id,
  ) ?? openDoc?.document_versions?.[openDoc.document_versions.length - 1];

  if (loading) return <WorkspaceSkeleton />;

  const hasAgentData = agents.some((a) => a.status !== "waiting");
  const allComplete  = agents.every((a) => a.status === "completed" || a.status === "failed");

  return (
    <div className="flex h-full flex-col">
      {/* Workspace header */}
      <header className="border-b border-border bg-surface px-8 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold text-text">{tender?.name ?? "Tender Workspace"}</h1>
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
          <div className="flex items-center gap-3">
            {tender?.readiness_score  !== undefined && <ScorePill label="Readiness" value={tender.readiness_score}  color="brand" />}
            {tender?.win_probability  !== undefined && <ScorePill label="Win Prob."  value={tender.win_probability}  color="ai" />}
            {/* Run Agents CTA */}
            {!hasAgentData && (
              <button
                onClick={runAgents}
                disabled={running}
                className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13px] font-semibold text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {running ? <Spinner /> : null}
                {running ? "Agents running…" : "Run AI Agents"}
              </button>
            )}
            {allComplete && documents.length > 0 && (
              <button
                onClick={exportPackage}
                className="rounded-lg border border-brand/40 px-5 py-2.5 text-[13px] font-semibold text-brand hover:bg-brand/10 transition-colors"
              >
                Export Package
              </button>
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
            {activeTab === "agents"       && <AgentsTab agents={agents} running={running} onRun={runAgents} hasData={hasAgentData} />}
            {activeTab === "documents"    && (
              openDocId ? (
                <DocumentDetail
                  doc={openDoc!}
                  version={openDocVersion}
                  onBack={() => setOpenDocId(null)}
                />
              ) : (
                <DocumentsTab documents={documents} onOpen={setOpenDocId} />
              )
            )}
            {activeTab === "compliance"   && <ComplianceTab documents={documents} onOpen={setOpenDocId} />}
            {activeTab === "commercial"   && <CommercialTab documents={documents} onOpen={setOpenDocId} />}
            {activeTab === "tasks"        && <TasksPanel tenderId={tenderId} />}
            {activeTab === "submission"   && <SubmissionTab tender={tender} documents={documents} onExport={exportPackage} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function Spinner() {
  return <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background border-t-transparent inline-block" />;
}

function ScorePill({ label, value, color }: { label: string; value: number; color: "brand"|"ai" }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-card px-4 py-2">
      <span className="text-[10px] uppercase tracking-wide text-text-secondary">{label}</span>
      <span className={`text-[22px] font-bold ${color === "brand" ? "text-brand" : "text-ai"}`}>{value}%</span>
    </div>
  );
}

function Card({ children, className="" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card p-6 ${className}`}>{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-5 text-[20px] font-semibold text-text">{children}</h2>;
}

function OverviewTab({ tender, extraction }: { tender: TenderData|null; extraction: Extraction|null }) {
  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>Overview</SectionTitle>
      <Card>
        <h3 className="mb-3 text-[13px] uppercase tracking-wide text-text-secondary">Executive Summary</h3>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-text">
          {tender?.executive_summary ?? "AI is analysing your RFP… The executive summary will appear shortly."}
        </p>
      </Card>
      {extraction?.scope_of_work && (
        <Card>
          <h3 className="mb-3 text-[13px] uppercase tracking-wide text-text-secondary">Scope of Work</h3>
          <p className="text-[15px] leading-relaxed text-text">{extraction.scope_of_work}</p>
        </Card>
      )}
    </div>
  );
}

function RequirementsTab({ extraction }: { extraction: Extraction|null }) {
  if (!extraction) return (
    <div className="flex flex-col gap-6"><SectionTitle>Requirements</SectionTitle>
      <Card><p className="text-text-secondary">Extracting requirements from your RFP…</p></Card>
    </div>
  );
  const sections = [
    { label: "Technical Requirements",  items: extraction.technical_requirements },
    { label: "Commercial Requirements", items: extraction.commercial_requirements },
    { label: "Evaluation Criteria",     items: extraction.evaluation_criteria },
    { label: "Staffing Requirements",   items: extraction.staffing_requirements },
    { label: "Asset Information",       items: extraction.asset_information },
  ].filter((s) => s.items?.length);
  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>Requirements</SectionTitle>
      {sections.map((s) => (
        <Card key={s.label}>
          <h3 className="mb-3 text-[13px] uppercase tracking-wide text-text-secondary">{s.label}</h3>
          <ul className="flex flex-col gap-2">
            {s.items!.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[14px] text-text">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{item}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function AgentsTab({ agents, running, onRun, hasData }: { agents: AgentRun[]; running: boolean; onRun: () => void; hasData: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SectionTitle>AI Agents</SectionTitle>
        {!hasData && (
          <button
            onClick={onRun}
            disabled={running}
            className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13px] font-semibold text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {running && <Spinner />}
            {running ? "Running…" : "Run All Agents"}
          </button>
        )}
      </div>
      <motion.div
        initial="hidden" animate="show"
        variants={{ show: { transition: { staggerChildren: 0.04 } } }}
        className="grid gap-4 sm:grid-cols-2"
      >
        {agents.map((agent) => (
          <motion.div
            key={agent.agent_type}
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } }}
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
                  transition={{ duration: 0.6 }}
                />
              </div>
            )}
            {agent.status === "waiting" && running && (
              <div className="mt-3 h-1 w-full rounded-full bg-white/5">
                <div className="h-full w-0 rounded-full bg-white/10" />
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

const REVIEW_COLORS: Record<string, string> = {
  draft:             "text-text-secondary bg-white/5",
  ai_generated:      "text-[#00E5FF] bg-[#00E5FF]/10",
  in_review:         "text-[#F59E0B] bg-[#F59E0B]/10",
  changes_requested: "text-[#EF4444] bg-[#EF4444]/10",
  approved:          "text-[#10B981] bg-[#10B981]/10",
  final:             "text-brand bg-brand/10",
};

function DocumentsTab({ documents, onOpen }: { documents: Document[]; onOpen: (id: string) => void }) {
  const showDocs = documents.length > 0 ? documents : Array.from({ length: 8 }, (_, i) => ({
    id: `placeholder-${i}`,
    title: ["Technical Proposal","Commercial Proposal","Compliance Matrix","PPM Schedule","Manpower Plan","Risk Register","HSE Plan","Executive Presentation"][i],
    type: "other",
    review_status: "draft",
  }));

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Documents</SectionTitle>
      <motion.div
        initial="hidden" animate="show"
        variants={{ show: { transition: { staggerChildren: 0.04 } } }}
        className="flex flex-col gap-2"
      >
        {showDocs.map((doc) => (
          <motion.div
            key={doc.id}
            variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.18 } } }}
            className={`flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 ${documents.length > 0 ? "cursor-pointer hover:border-brand/30 transition-colors" : "opacity-40"}`}
            onClick={() => documents.length > 0 && onOpen(doc.id)}
          >
            <span className="text-[14px] font-medium text-text">{doc.title}</span>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${REVIEW_COLORS[doc.review_status] ?? "text-text-secondary bg-white/5"}`}>
                {doc.review_status.replace("_", " ")}
              </span>
              {documents.length > 0 && (
                <span className="text-[12px] text-text-secondary">Open →</span>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function DocumentDetail({ doc, version, onBack }: { doc: Document; version: { content_html?: string } | undefined; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="text-[13px] text-text-secondary hover:text-text transition-colors">
        ← Back to documents
      </button>
      <h2 className="text-[22px] font-bold text-text">{doc.title}</h2>
      <DocumentEditor
        documentId={doc.id}
        initialHtml={version?.content_html ?? ""}
        reviewStatus={doc.review_status}
      />
    </div>
  );
}

function ComplianceTab({ documents, onOpen }: { documents: Document[]; onOpen: (id: string) => void }) {
  const compDocs = documents.filter((d) => d.type === "compliance_matrix");
  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>Compliance</SectionTitle>
      {compDocs.length ? (
        <DocumentsTab documents={compDocs} onOpen={onOpen} />
      ) : (
        <Card><p className="text-text-secondary">Compliance matrix will be generated by the Compliance Agent.</p></Card>
      )}
    </div>
  );
}

function CommercialTab({ documents, onOpen }: { documents: Document[]; onOpen: (id: string) => void }) {
  const commDocs = documents.filter((d) => d.type === "commercial_proposal" || d.type === "cost_sheet");
  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>Commercial</SectionTitle>
      {commDocs.length ? (
        <DocumentsTab documents={commDocs} onOpen={onOpen} />
      ) : (
        <Card><p className="text-text-secondary">Pricing model and commercial submission will be generated by the Commercial Agent.</p></Card>
      )}
    </div>
  );
}

function SubmissionTab({ tender, documents, onExport }: { tender: TenderData|null; documents: Document[]; onExport: () => void }) {
  const approved = documents.filter((d) => d.review_status === "approved" || d.review_status === "final");
  const readiness = tender?.readiness_score ?? 0;
  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>Submission Package</SectionTitle>
      <Card>
        <h3 className="mb-4 text-[13px] uppercase tracking-wide text-text-secondary">Readiness Check</h3>
        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between text-[13px]">
            <span className="text-text-secondary">Overall Readiness</span>
            <span className={`font-semibold ${readiness >= 80 ? "text-[#10B981]" : readiness >= 50 ? "text-[#F59E0B]" : "text-[#EF4444]"}`}>{readiness}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${readiness >= 80 ? "bg-[#10B981]" : readiness >= 50 ? "bg-[#F59E0B]" : "bg-[#EF4444]"}`}
              initial={{ width: 0 }}
              animate={{ width: `${readiness}%` }}
              transition={{ duration: 0.8, ease: [0.16,1,0.3,1] }}
            />
          </div>
        </div>
        <p className="mb-6 text-[14px] text-text-secondary">
          {approved.length} of {documents.length} documents approved.
        </p>
        <button
          onClick={onExport}
          disabled={documents.length === 0}
          className="flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-[14px] font-semibold text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          Export Submission Package (.docx)
        </button>
      </Card>

      <Card>
        <h3 className="mb-3 text-[13px] uppercase tracking-wide text-text-secondary">Package Contents</h3>
        <ul className="flex flex-col gap-2">
          {[
            "Technical Proposal","Commercial Proposal","Compliance Matrix",
            "PPM Schedule","Manpower Plan","Risk Register","HSE Plan","Executive Presentation",
          ].map((item) => {
            const found = documents.find((d) => d.title === item);
            return (
              <li key={item} className="flex items-center gap-2 text-[14px]">
                <span className={`h-1.5 w-1.5 rounded-full ${found ? "bg-[#10B981]" : "bg-white/20"}`} />
                <span className={found ? "text-text" : "text-text-secondary"}>{item}</span>
                {found && <span className={`ml-auto text-[11px] uppercase ${REVIEW_COLORS[found.review_status]?.split(" ")[0]}`}>{found.review_status.replace("_"," ")}</span>}
              </li>
            );
          })}
        </ul>
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
        <div className="mt-5 flex gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
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
