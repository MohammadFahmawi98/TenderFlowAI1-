"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { DocumentEditor } from "@/components/document-editor";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentRun {
  agent_type: string;
  status: "waiting" | "running" | "completed" | "failed";
  output_content: string | null;
  output_doc_id: string | null;
  error_message?: string | null;
  updated_at: string | null;
  completed_at?: string | null;
}

interface FormalDoc {
  id: string;
  title: string;
  type: string;
  review_status: string;
  agent_type?: string;
  current_version_id?: string;
  document_versions?: Array<{ id: string; content_html?: string; version_no: number }>;
}

interface SourceFile {
  id: string;
  name: string;
  original_name: string;
  mime: string;
  size_bytes: number;
  extraction_status: string;
  created_at: string;
  label?: string;
  notes?: Comment[];
}

interface Comment {
  id: string;
  text: string;
  author: string;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_SLOTS = [
  { key: "intelligence",     label: "Tender Intelligence Briefing", icon: "travel_explore" },
  { key: "qualification",    label: "Qualification Assessment",      icon: "verified" },
  { key: "compliance",       label: "Compliance Matrix",             icon: "fact_check" },
  { key: "technical",        label: "Technical Proposal",            icon: "engineering" },
  { key: "commercial",       label: "Commercial Proposal",           icon: "receipt_long" },
  { key: "manpower",         label: "Manpower Plan",                 icon: "groups" },
  { key: "ppm",              label: "PPM Schedule",                  icon: "build_circle" },
  { key: "risk",             label: "Risk Register",                 icon: "warning_amber" },
  { key: "hse",              label: "HSE Plan",                      icon: "health_and_safety" },
  { key: "sla",              label: "SLA & KPI Framework",           icon: "speed" },
  { key: "presentation",     label: "Executive Presentation",        icon: "slideshow" },
  { key: "executive_review", label: "Executive Review Report",       icon: "rate_review" },
] as const;

const REVIEW_COLORS: Record<string, string> = {
  draft:             "text-text-secondary bg-surface-dim",
  ai_generated:      "text-primary bg-primary-light",
  in_review:         "text-warning bg-warning-bg",
  changes_requested: "text-danger bg-danger-bg",
  approved:          "text-success bg-success-bg",
  final:             "text-success bg-success-bg",
};

const EXTRACT_COLORS: Record<string, string> = {
  done:    "text-success bg-success-bg",
  running: "text-warning bg-warning-bg",
  failed:  "text-danger bg-danger-bg",
};

const FILE_LABELS = [
  { value: "rfp",      label: "RFP" },
  { value: "boq",      label: "BOQ / Costing Sheet" },
  { value: "drawings", label: "Drawings" },
  { value: "specs",    label: "Specifications" },
  { value: "contract", label: "Contract Draft" },
  { value: "hsedoc",   label: "HSE Requirements" },
  { value: "other",    label: "Other" },
];

function guessLabel(name: string): string {
  const n = name.toLowerCase();
  if (/boq|bill.of.quant|pricing|costing|rates|cost\s?sheet/.test(n)) return "boq";
  if (/drawing|dwg|layout|floor.?plan/.test(n))                        return "drawings";
  if (/spec|technical|requirement/.test(n))                            return "specs";
  if (/contract|agreement|tos|terms/.test(n))                          return "contract";
  if (/hse|safety|health|environment/.test(n))                         return "hsedoc";
  if (/rfp|rfq|itb|tender|bid|enquiry/.test(n))                        return "rfp";
  return "other";
}

function fileIcon(mime: string, label?: string) {
  if (label === "boq") return "calculate";
  if (label === "drawings") return "architecture";
  if (mime.includes("pdf")) return "picture_as_pdf";
  if (mime.includes("word") || mime.includes("docx")) return "description";
  if (mime.includes("sheet") || mime.includes("xlsx") || mime.includes("csv")) return "table_chart";
  if (mime.includes("presentation") || mime.includes("pptx")) return "slideshow";
  if (mime.includes("zip")) return "folder_zip";
  return "attach_file";
}

function fmtSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { id } = useParams<{ id: string }>();

  // Data
  const [agentRuns, setAgentRuns]   = useState<Record<string, AgentRun>>({});
  const [formalDocs, setFormalDocs] = useState<Record<string, FormalDoc>>({});
  const [sourceFiles, setFiles]     = useState<SourceFile[]>([]);
  const [loading, setLoading]       = useState(true);

  // UI state
  const [openDocId, setOpenDocId]       = useState<string | null>(null);
  const [openDocData, setOpenDocData]   = useState<FormalDoc | null>(null);
  const [materializing, setMat]         = useState<string | null>(null);
  const [expandedFileId, setExpanded]   = useState<string | null>(null);
  const [running, setRunning]           = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [retrying, setRetrying]         = useState(false);
  const [commentDraft, setDraft]        = useState<Record<string, string>>({});
  const [localLabels, setLabels]        = useState<Record<string, string>>({});
  const [localComments, setLocalComments] = useState<Record<string, Comment[]>>({});
  const [savingNote, setSavingNote]     = useState<string | null>(null);
  const [runError, setRunError]         = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load ───────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const [runsRes, docsRes, filesRes] = await Promise.all([
      fetch(`/api/tenders/${id}/agents`),
      fetch(`/api/documents?tender_id=${id}`),
      fetch(`/api/tenders/${id}/files`),
    ]);

    if (runsRes.ok) {
      const runs = await runsRes.json() as AgentRun[];
      const map: Record<string, AgentRun> = {};
      runs.forEach((r) => { map[r.agent_type] = r; });
      setAgentRuns(map);
    }

    if (docsRes.ok) {
      const docs = await docsRes.json() as FormalDoc[];
      const map: Record<string, FormalDoc> = {};
      docs.forEach((d) => {
        // key by agent_type if present, else by doc id
        const key = d.agent_type ?? d.id;
        map[key] = d;
      });
      setFormalDocs(map);
    }

    if (filesRes.ok) {
      const files = await filesRes.json() as SourceFile[];
      setFiles(files);
      const auto: Record<string, string> = {};
      const notesMap: Record<string, Comment[]> = {};
      files.forEach((f) => {
        auto[f.id] = guessLabel(f.original_name ?? f.name);
        if (Array.isArray(f.notes)) notesMap[f.id] = f.notes;
      });
      setLabels((prev) => ({ ...auto, ...prev }));
      setLocalComments((prev) => ({ ...notesMap, ...prev }));
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadData]);

  // ── Run agents ─────────────────────────────────────────────────────────────

  async function runAgents() {
    setRunning(true);
    setRunError(null);
    try {
      const res = await fetch(`/api/tenders/${id}/run-agents`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setRunError(body.error ?? "Run failed");
        setRunning(false);
        return;
      }
    } catch {
      setRunError("Network error — try again");
      setRunning(false);
      return;
    }

    // Poll until all agents settle
    let tries = 0;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      await loadData();
      const runsRes = await fetch(`/api/tenders/${id}/agents`);
      if (runsRes.ok) {
        const runs = await runsRes.json() as AgentRun[];
        const allSettled = runs.length > 0 && runs.every(
          (r) => r.status === "completed" || r.status === "failed",
        );
        if (allSettled || ++tries > 60) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setRunning(false);
          await loadData();
        }
      }
    }, 3000);
  }

  // ── Open a document (materialize if needed) ────────────────────────────────

  async function openAgent(agentKey: string) {
    // Already has a formal doc
    const formal = formalDocs[agentKey];
    if (formal && !formal.id.startsWith("agent:")) {
      setOpenDocData(formal);
      setOpenDocId(formal.id);
      return;
    }

    const run = agentRuns[agentKey];
    if (!run || run.status !== "completed" || !run.output_content) return;

    // Virtual doc already in formalDocs
    if (formal?.id.startsWith("agent:")) {
      setOpenDocData(formal);
      setOpenDocId(formal.id);
      return;
    }

    // Materialize
    setMat(agentKey);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tender_id: id, agent_type: agentKey }),
      });
      if (res.ok) {
        const doc = await res.json() as FormalDoc;
        setFormalDocs((prev) => ({ ...prev, [agentKey]: doc }));
        setOpenDocData(doc);
        setOpenDocId(doc.id);
      } else {
        // Fallback: build a temporary doc from agent output
        const slot = AGENT_SLOTS.find((s) => s.key === agentKey);
        const tmpDoc: FormalDoc = {
          id: `agent:${agentKey}`,
          title: slot?.label ?? agentKey,
          type: "other",
          review_status: "ai_generated",
          agent_type: agentKey,
          current_version_id: `vv:${agentKey}`,
          document_versions: [{
            id: `vv:${agentKey}`,
            version_no: 1,
            content_html: `<div style="font-family:Arial,sans-serif;color:#333;line-height:1.6">${run.output_content.replace(/\n/g, "<br>")}</div>`,
          }],
        };
        setFormalDocs((prev) => ({ ...prev, [agentKey]: tmpDoc }));
        setOpenDocData(tmpDoc);
        setOpenDocId(tmpDoc.id);
      }
    } finally {
      setMat(null);
    }
  }

  // ── File handlers ──────────────────────────────────────────────────────────

  async function handleFilesAdded(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    try {
      await fetch(`/api/tenders/${id}/files`, { method: "POST", body: form });
      await loadData();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function retryFailed() {
    const failedIds = sourceFiles.filter((f) => f.extraction_status === "failed").map((f) => f.id);
    if (!failedIds.length) return;
    setRetrying(true);
    try {
      await fetch(`/api/tenders/${id}/extraction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: failedIds }),
      });
      await loadData();
    } finally {
      setRetrying(false);
    }
  }

  async function addComment(fileId: string) {
    const text = commentDraft[fileId]?.trim();
    if (!text) return;
    const newComment: Comment = {
      id: Math.random().toString(36).slice(2),
      text, author: "You", created_at: new Date().toISOString(),
    };
    const updated = [...(localComments[fileId] ?? []), newComment];
    setLocalComments((prev) => ({ ...prev, [fileId]: updated }));
    setDraft((prev) => ({ ...prev, [fileId]: "" }));
    setSavingNote(fileId);
    try {
      await fetch(`/api/tenders/${id}/files/${fileId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: updated }),
      });
    } finally { setSavingNote(null); }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const failedCount   = sourceFiles.filter((f) => f.extraction_status === "failed").length;
  const completedCount = Object.values(agentRuns).filter((r) => r.status === "completed").length;
  const totalAgents    = AGENT_SLOTS.length;
  const anyRunning     = Object.values(agentRuns).some((r) => r.status === "running" || r.status === "waiting");

  // ── Document editor view ──────────────────────────────────────────────────

  if (openDocId && openDocData) {
    const version = openDocData.document_versions?.find((v) => v.id === openDocData.current_version_id)
      ?? openDocData.document_versions?.[0];
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setOpenDocId(null); setOpenDocData(null); loadData(); }}
            className="flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-text transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">arrow_back</span>
            Back to documents
          </button>
          <span className={`rounded px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${REVIEW_COLORS[openDocData.review_status] ?? "text-text-muted bg-surface-dim"}`}>
            {openDocData.review_status.replace(/_/g, " ")}
          </span>
        </div>
        <h2 className="text-[22px] font-bold text-text">{openDocData.title}</h2>
        <DocumentEditor
          documentId={openDocData.id}
          initialHtml={version?.content_html ?? ""}
          reviewStatus={openDocData.review_status}
        />
      </div>
    );
  }

  // ── Main list view ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.pptx,.zip"
        className="hidden"
        onChange={handleFilesAdded}
      />

      {/* ── Source Files ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[16px] font-semibold text-text">Source Files</h2>
            <p className="text-[12px] text-text-secondary mt-0.5">RFP documents, BOQs, drawings — files AI agents read to prepare the bid</p>
          </div>
          <div className="flex items-center gap-2">
            {failedCount > 0 && (
              <button onClick={retryFailed} disabled={retrying}
                      className="flex items-center gap-1.5 rounded border border-danger px-3 py-2 text-[12px] font-medium text-danger hover:bg-danger-bg disabled:opacity-60 transition-colors">
                {retrying ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-danger border-t-transparent" /> : <span className="material-symbols-outlined text-[16px]">refresh</span>}
                {retrying ? "Re-processing…" : `Retry ${failedCount} failed`}
              </button>
            )}
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className="flex items-center gap-1.5 rounded border border-border px-3 py-2 text-[12px] font-medium text-text hover:bg-surface-dim disabled:opacity-60 transition-colors">
              {uploading ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <span className="material-symbols-outlined text-[16px] text-primary">upload_file</span>}
              {uploading ? "Uploading…" : "Add Files"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="h-20 animate-pulse rounded-lg bg-surface-mid" />
        ) : sourceFiles.length === 0 ? (
          <div onClick={() => fileInputRef.current?.click()}
               className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border py-8 cursor-pointer hover:bg-surface-dim transition-colors">
            <span className="material-symbols-outlined text-[32px] text-text-muted">upload_file</span>
            <p className="text-[13px] text-text-secondary">Drop files here or click to upload</p>
            <p className="text-[11px] text-text-muted">PDF · DOCX · XLSX · PPTX · ZIP · CSV</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            {sourceFiles.map((f) => {
              const label    = localLabels[f.id] ?? guessLabel(f.original_name ?? f.name);
              const comments = localComments[f.id] ?? [];
              const isExpanded = expandedFileId === f.id;
              return (
                <div key={f.id} className="border-b border-border-light last:border-0">
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-surface-dim cursor-pointer transition-colors"
                       onClick={() => setExpanded(isExpanded ? null : f.id)}>
                    <span className="material-symbols-outlined text-[18px] text-primary shrink-0">{fileIcon(f.mime ?? "", label)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-[13px] text-text">{f.original_name ?? f.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${EXTRACT_COLORS[f.extraction_status] ?? "text-text-muted bg-surface-dim"}`}>
                          {f.extraction_status}
                        </span>
                        <span className="text-[11px] text-text-muted">{fmtSize(f.size_bytes)}</span>
                        {comments.length > 0 && (
                          <span className="text-[11px] text-text-muted flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[12px]">comment</span>{comments.length}
                          </span>
                        )}
                      </div>
                    </div>
                    <select value={label} onClick={(e) => e.stopPropagation()}
                            onChange={(e) => { e.stopPropagation(); setLabels((prev) => ({ ...prev, [f.id]: e.target.value })); }}
                            className="text-[11px] rounded border border-border bg-surface-dim px-2 py-1 text-text-secondary shrink-0">
                      {FILE_LABELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                    <span className="material-symbols-outlined text-[16px] text-text-muted shrink-0 transition-transform duration-200"
                          style={{ transform: isExpanded ? "rotate(180deg)" : "none" }}>expand_more</span>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                        <div className="px-4 pb-4 pt-1 bg-surface-dim border-t border-border-light">
                          <div className="flex items-center gap-4 mb-3 text-[11px] text-text-muted">
                            <span>Added {new Date(f.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                            <span>{fmtSize(f.size_bytes)}</span>
                            {f.extraction_status === "failed" && (
                              <button onClick={() => { setRetrying(true); fetch(`/api/tenders/${id}/extraction`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileIds: [f.id] }) }).then(() => loadData()).finally(() => setRetrying(false)); }}
                                      className="text-danger font-medium flex items-center gap-0.5 hover:underline">
                                <span className="material-symbols-outlined text-[13px]">refresh</span>Retry extraction
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Notes &amp; Comments</p>
                            {savingNote === f.id && <span className="text-[10px] text-text-muted flex items-center gap-1"><span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-text-muted border-t-transparent" />Saving…</span>}
                          </div>
                          {comments.length === 0
                            ? <p className="text-[12px] text-text-muted mb-2">No notes yet.</p>
                            : <div className="flex flex-col gap-2 mb-3">
                                {comments.map((c) => (
                                  <div key={c.id} className="rounded bg-surface px-3 py-2 border border-border-light">
                                    <p className="text-[12px] text-text">{c.text}</p>
                                    <p className="text-[10px] text-text-muted mt-1">{c.author} · {new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                                  </div>
                                ))}
                              </div>
                          }
                          <div className="flex gap-2">
                            <input value={commentDraft[f.id] ?? ""} onChange={(e) => setDraft((prev) => ({ ...prev, [f.id]: e.target.value }))}
                                   onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(f.id); } }}
                                   placeholder="Add a note about this file…"
                                   className="flex-1 rounded border border-border bg-surface px-3 py-1.5 text-[12px] text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
                            <button onClick={() => addComment(f.id)} disabled={!commentDraft[f.id]?.trim()}
                                    className="rounded bg-primary px-3 py-1.5 text-[12px] font-medium text-white hover:bg-primary-btn disabled:opacity-40 transition-colors">
                              Add
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className="flex w-full items-center gap-2 border-t border-border-light px-4 py-2.5 text-[12px] text-primary hover:bg-surface-dim disabled:opacity-60 transition-colors">
              {uploading ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <span className="material-symbols-outlined text-[15px]">add</span>}
              {uploading ? "Uploading…" : "Add more files"}
            </button>
          </div>
        )}
      </div>

      {/* BOQ hint */}
      {sourceFiles.some((f) => (localLabels[f.id] ?? guessLabel(f.original_name ?? f.name)) === "boq") && (
        <div className="flex items-start gap-3 rounded-lg border border-[#C8A24A]/40 bg-[#C8A24A]/5 px-4 py-3">
          <span className="material-symbols-outlined text-[18px] text-[#C8A24A] shrink-0 mt-0.5">calculate</span>
          <div>
            <p className="text-[13px] font-medium text-text">BOQ / Costing Sheet detected</p>
            <p className="text-[12px] text-text-secondary mt-0.5">Make sure extraction shows <strong>DONE</strong> before running agents.</p>
          </div>
        </div>
      )}

      {/* ── Generated Documents ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[16px] font-semibold text-text">Generated Documents</h2>
            <p className="text-[12px] text-text-secondary mt-0.5">Click any completed document to view and edit</p>
          </div>
          <div className="flex items-center gap-3">
            {completedCount > 0 && (
              <span className="text-[12px] text-text-secondary">
                {completedCount}/{totalAgents} generated
              </span>
            )}
            {runError && (
              <span className="text-[12px] text-danger">{runError}</span>
            )}
            <button
              onClick={runAgents}
              disabled={running || anyRunning}
              className="flex items-center gap-1.5 rounded bg-primary px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-primary-btn disabled:opacity-50 transition-colors"
            >
              {(running || anyRunning) && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              <span className="material-symbols-outlined text-[15px]">smart_toy</span>
              {(running || anyRunning) ? "Generating…" : completedCount > 0 ? "Regenerate All" : "Run AI Agents"}
            </button>
          </div>
        </div>

        {/* Progress bar when running */}
        {(running || anyRunning) && (
          <div className="mb-4 rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-primary font-medium">AI agents working…</span>
              <span className="text-[12px] text-text-muted">{completedCount}/{totalAgents}</span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500"
                   style={{ width: `${(completedCount / totalAgents) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Document slots — always show all 12 */}
        <div className="flex flex-col gap-2">
          {AGENT_SLOTS.map((slot) => {
            const run    = agentRuns[slot.key];
            const formal = formalDocs[slot.key];
            const isMat  = materializing === slot.key;
            const hasContent = run?.status === "completed" && run.output_content && run.output_content.length > 10;
            const hasFormal  = formal && !formal.id.startsWith("agent:");

            // Determine slot state
            let state: "ready" | "virtual" | "running" | "failed" | "pending" = "pending";
            if (hasFormal) state = "ready";
            else if (hasContent) state = "virtual";
            else if (run?.status === "running" || run?.status === "waiting") state = "running";
            else if (run?.status === "failed") state = "failed";

            const isClickable = state === "ready" || state === "virtual";

            return (
              <motion.div
                key={slot.key}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  onClick={() => isClickable ? openAgent(slot.key) : undefined}
                  disabled={!isClickable || isMat}
                  className={`w-full flex items-center justify-between rounded-lg border px-5 py-3.5 text-start transition-colors ${
                    isClickable
                      ? "border-border bg-surface hover:bg-surface-dim cursor-pointer"
                      : "border-border/50 bg-surface/50 cursor-default"
                  } ${isMat ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-[18px] ${
                      state === "ready"   ? "text-primary" :
                      state === "virtual" ? "text-primary/80" :
                      state === "running" ? "text-warning" :
                      state === "failed"  ? "text-danger" :
                      "text-text-muted/40"
                    }`}>
                      {state === "running" ? "hourglass_empty" : slot.icon}
                    </span>
                    <div>
                      <p className={`text-[13px] font-medium ${isClickable ? "text-text" : "text-text-muted/60"}`}>
                        {slot.label}
                      </p>
                      {state === "running" && (
                        <p className="text-[11px] text-warning mt-0.5">Generating…</p>
                      )}
                      {state === "failed" && run?.error_message && (
                        <p className="text-[11px] text-danger mt-0.5 truncate max-w-xs">{run.error_message}</p>
                      )}
                      {(state === "ready" || state === "virtual") && formal?.review_status && (
                        <p className="text-[11px] text-primary/70 mt-0.5">AI generated · click to review &amp; edit</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Status badge */}
                    {state === "ready" && (
                      <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${REVIEW_COLORS[formal?.review_status ?? "ai_generated"] ?? "text-text-muted bg-surface-dim"}`}>
                        {(formal?.review_status ?? "ai_generated").replace(/_/g, " ")}
                      </span>
                    )}
                    {state === "virtual" && (
                      <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary-light">
                        AI GENERATED
                      </span>
                    )}
                    {state === "running" && (
                      <span className="flex items-center gap-1.5 text-[11px] text-warning">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-warning border-t-transparent" />
                        Working
                      </span>
                    )}
                    {state === "failed" && (
                      <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger bg-danger/10">
                        FAILED
                      </span>
                    )}
                    {state === "pending" && (
                      <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted/50 bg-surface-dim/50">
                        PENDING
                      </span>
                    )}

                    {/* Action indicator */}
                    {isMat ? (
                      <span className="flex items-center gap-1.5 text-[12px] text-text-muted">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-text-muted border-t-transparent" />
                        Loading…
                      </span>
                    ) : isClickable ? (
                      <span className="text-[12px] text-primary font-medium flex items-center gap-0.5">
                        Open <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                      </span>
                    ) : null}
                  </div>
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
