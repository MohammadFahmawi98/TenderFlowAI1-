"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { DocumentEditor } from "@/components/document-editor";

interface Doc {
  id: string;
  title: string;
  type: string;
  review_status: string;
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
  { value: "rfp",        label: "RFP" },
  { value: "boq",        label: "BOQ / Costing Sheet" },
  { value: "drawings",   label: "Drawings" },
  { value: "specs",      label: "Specifications" },
  { value: "contract",   label: "Contract Draft" },
  { value: "hsedoc",     label: "HSE Requirements" },
  { value: "other",      label: "Other" },
];

function guessLabel(name: string): string {
  const n = name.toLowerCase();
  if (/boq|bill.of.quant|pricing|costing|rates|cost\s?sheet/.test(n)) return "boq";
  if (/drawing|dwg|layout|floor.?plan/.test(n)) return "drawings";
  if (/spec|technical|requirement/.test(n)) return "specs";
  if (/contract|agreement|tos|terms/.test(n)) return "contract";
  if (/hse|safety|health|environment/.test(n)) return "hsedoc";
  if (/rfp|rfq|itb|tender|bid|enquiry/.test(n)) return "rfp";
  return "other";
}

function fileIcon(mime: string, label?: string) {
  if (label === "boq") return "calculate";
  if (label === "drawings") return "architecture";
  if (mime.includes("pdf"))   return "picture_as_pdf";
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

const PLACEHOLDER_DOCS = [
  "Technical Proposal", "Commercial Proposal", "Compliance Matrix",
  "Manpower Plan", "PPM Schedule", "Risk Register", "HSE Plan", "Executive Presentation",
];

export default function DocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const [docs, setDocs]             = useState<Doc[]>([]);
  const [sourceFiles, setFiles]     = useState<SourceFile[]>([]);
  const [openId, setOpenId]         = useState<string | null>(null);
  const [expandedFileId, setExpanded] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [running, setRunning]       = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [retrying, setRetrying]     = useState(false);
  const [commentDraft, setDraft]    = useState<Record<string, string>>({});
  const [localLabels, setLabels]    = useState<Record<string, string>>({});
  const [localComments, setLocalComments] = useState<Record<string, Comment[]>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const fileInputRef                = useRef<HTMLInputElement>(null);

  async function loadDocs() {
    const [docsRes, filesRes] = await Promise.all([
      fetch(`/api/documents?tender_id=${id}`),
      fetch(`/api/tenders/${id}/files`),
    ]);
    if (docsRes.ok)  setDocs(await docsRes.json());
    if (filesRes.ok) {
      const files: SourceFile[] = await filesRes.json();
      setFiles(files);
      // Auto-assign labels based on filename
      const auto: Record<string, string> = {};
      const notesMap: Record<string, Comment[]> = {};
      files.forEach((f) => {
        if (!localLabels[f.id]) auto[f.id] = guessLabel(f.original_name ?? f.name);
        if (Array.isArray(f.notes)) notesMap[f.id] = f.notes;
      });
      setLabels((prev) => ({ ...auto, ...prev }));
      setLocalComments((prev) => ({ ...notesMap, ...prev }));
    }
    setLoading(false);
  }

  useEffect(() => { loadDocs(); }, [id]);

  async function handleFilesAdded(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    try {
      await fetch(`/api/tenders/${id}/files`, { method: "POST", body: form });
      await loadDocs();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function retryFailed() {
    const failedIds = sourceFiles
      .filter((f) => f.extraction_status === "failed")
      .map((f) => f.id);
    if (!failedIds.length) return;
    setRetrying(true);
    try {
      await fetch(`/api/tenders/${id}/extraction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: failedIds }),
      });
      await loadDocs();
    } finally {
      setRetrying(false);
    }
  }

  async function runAgents() {
    setRunning(true);
    const res = await fetch(`/api/tenders/${id}/run-agents`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("Run agents failed:", body);
    }
    let tries = 0;
    const iv = setInterval(async () => {
      await loadDocs();
      const r = await fetch(`/api/tenders/${id}/agents`);
      const agents = await r.json();
      const allDone = Array.isArray(agents) &&
        agents.every((a: { status: string }) => a.status === "completed" || a.status === "failed");
      if (allDone || ++tries > 30) { clearInterval(iv); setRunning(false); }
    }, 3000);
  }

  async function addComment(fileId: string) {
    const text = commentDraft[fileId]?.trim();
    if (!text) return;
    const newComment: Comment = {
      id: Math.random().toString(36).slice(2),
      text,
      author: "You",
      created_at: new Date().toISOString(),
    };
    const updated = [...(localComments[fileId] ?? []), newComment];
    setLocalComments((prev) => ({ ...prev, [fileId]: updated }));
    setDraft((prev) => ({ ...prev, [fileId]: "" }));
    // Persist to DB
    setSavingNote(fileId);
    try {
      await fetch(`/api/tenders/${id}/files/${fileId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: updated }),
      });
    } finally {
      setSavingNote(null);
    }
  }

  const openDoc = docs.find((d) => d.id === openId);
  const openVersion = openDoc?.document_versions?.find((v) => v.id === openDoc.current_version_id)
    ?? openDoc?.document_versions?.[0];

  const failedCount = sourceFiles.filter((f) => f.extraction_status === "failed").length;

  if (openId && openDoc) {
    return (
      <div className="flex flex-col gap-4">
        <button onClick={() => setOpenId(null)} className="text-[13px] text-text-secondary hover:text-text transition-colors">← Back to documents</button>
        <h2 className="text-[22px] font-bold text-text">{openDoc.title}</h2>
        <DocumentEditor documentId={openDoc.id} initialHtml={openVersion?.content_html ?? ""} reviewStatus={openDoc.review_status} />
      </div>
    );
  }

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

      {/* Source files section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[16px] font-semibold text-text">Source Files</h2>
            <p className="text-[12px] text-text-secondary mt-0.5">RFP documents, BOQs, drawings — all files AI agents read to prepare the bid</p>
          </div>
          <div className="flex items-center gap-2">
            {failedCount > 0 && (
              <button
                onClick={retryFailed}
                disabled={retrying}
                className="flex items-center gap-1.5 rounded border border-danger px-3 py-2 text-[12px] font-medium text-danger hover:bg-danger-bg disabled:opacity-60 transition-colors"
              >
                {retrying
                  ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-danger border-t-transparent" />
                  : <span className="material-symbols-outlined text-[16px]">refresh</span>
                }
                {retrying ? "Re-processing…" : `Retry ${failedCount} failed`}
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded border border-border px-3 py-2 text-[12px] font-medium text-text hover:bg-surface-dim disabled:opacity-60 transition-colors"
            >
              {uploading
                ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                : <span className="material-symbols-outlined text-[16px] text-primary">upload_file</span>
              }
              {uploading ? "Uploading…" : "Add Files"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="h-20 animate-pulse rounded-lg bg-surface-mid" />
        ) : sourceFiles.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border py-8 cursor-pointer hover:bg-surface-dim transition-colors"
          >
            <span className="material-symbols-outlined text-[32px] text-text-muted">upload_file</span>
            <p className="text-[13px] text-text-secondary">Drop files here or click to upload</p>
            <p className="text-[11px] text-text-muted">PDF · DOCX · XLSX · PPTX · ZIP · CSV</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            {sourceFiles.map((f) => {
              const label = localLabels[f.id] ?? guessLabel(f.original_name ?? f.name);
              const comments = localComments[f.id] ?? [];
              const isExpanded = expandedFileId === f.id;

              return (
                <div key={f.id} className="border-b border-border-light last:border-0">
                  {/* Main row */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-dim cursor-pointer transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : f.id)}
                  >
                    <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                      {fileIcon(f.mime ?? "", label)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-[13px] text-text">{f.original_name ?? f.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${EXTRACT_COLORS[f.extraction_status] ?? "text-text-muted bg-surface-dim"}`}>
                          {f.extraction_status}
                        </span>
                        <span className="text-[11px] text-text-muted">{fmtSize(f.size_bytes)}</span>
                        {comments.length > 0 && (
                          <span className="text-[11px] text-text-muted flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[12px]">comment</span>
                            {comments.length}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Label selector */}
                    <select
                      value={label}
                      onChange={(e) => {
                        e.stopPropagation();
                        setLabels((prev) => ({ ...prev, [f.id]: e.target.value }));
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] rounded border border-border bg-surface-dim px-2 py-1 text-text-secondary shrink-0"
                    >
                      {FILE_LABELS.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>

                    <span className="material-symbols-outlined text-[16px] text-text-muted shrink-0 transition-transform duration-200"
                      style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                      expand_more
                    </span>
                  </div>

                  {/* Expanded panel — comments */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-1 bg-surface-dim border-t border-border-light">
                          {/* File info */}
                          <div className="flex items-center gap-4 mb-3 text-[11px] text-text-muted">
                            <span>Added {new Date(f.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                            <span>{fmtSize(f.size_bytes)}</span>
                            {f.extraction_status === "failed" && (
                              <button
                                onClick={() => {
                                  setRetrying(true);
                                  fetch(`/api/tenders/${id}/extraction`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ fileIds: [f.id] }),
                                  }).then(() => loadDocs()).finally(() => setRetrying(false));
                                }}
                                className="text-danger font-medium flex items-center gap-0.5 hover:underline"
                              >
                                <span className="material-symbols-outlined text-[13px]">refresh</span>
                                Retry extraction
                              </button>
                            )}
                          </div>

                          {/* Comments */}
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Notes &amp; Comments</p>
                            {savingNote === f.id && (
                              <span className="text-[10px] text-text-muted flex items-center gap-1">
                                <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-text-muted border-t-transparent" />
                                Saving…
                              </span>
                            )}
                          </div>
                          {comments.length === 0 ? (
                            <p className="text-[12px] text-text-muted mb-2">No notes yet — add context about this file.</p>
                          ) : (
                            <div className="flex flex-col gap-2 mb-3">
                              {comments.map((c) => (
                                <div key={c.id} className="rounded bg-surface px-3 py-2 border border-border-light">
                                  <p className="text-[12px] text-text">{c.text}</p>
                                  <p className="text-[10px] text-text-muted mt-1">
                                    {c.author} · {new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <input
                              value={commentDraft[f.id] ?? ""}
                              onChange={(e) => setDraft((prev) => ({ ...prev, [f.id]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(f.id); } }}
                              placeholder="Add a note about this file…"
                              className="flex-1 rounded border border-border bg-surface px-3 py-1.5 text-[12px] text-text placeholder:text-text-muted focus:outline-none focus:border-primary"
                            />
                            <button
                              onClick={() => addComment(f.id)}
                              disabled={!commentDraft[f.id]?.trim()}
                              className="rounded bg-primary px-3 py-1.5 text-[12px] font-medium text-white hover:bg-primary-btn disabled:opacity-40 transition-colors"
                            >
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

            {/* Add more row */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex w-full items-center gap-2 border-t border-border-light px-4 py-2.5 text-[12px] text-primary hover:bg-surface-dim disabled:opacity-60 transition-colors"
            >
              {uploading
                ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                : <span className="material-symbols-outlined text-[15px]">add</span>
              }
              {uploading ? "Uploading…" : "Add more files"}
            </button>
          </div>
        )}
      </div>

      {/* BOQ/Costing hint */}
      {sourceFiles.some((f) => (localLabels[f.id] ?? guessLabel(f.original_name ?? f.name)) === "boq") && (
        <div className="flex items-start gap-3 rounded-lg border border-[#C8A24A]/40 bg-[#C8A24A]/5 px-4 py-3">
          <span className="material-symbols-outlined text-[18px] text-[#C8A24A] shrink-0 mt-0.5">calculate</span>
          <div>
            <p className="text-[13px] font-medium text-text">BOQ / Costing Sheet detected</p>
            <p className="text-[12px] text-text-secondary mt-0.5">
              The AI agents will read your costing sheet to populate the Estimation and Commercial tabs.
              Make sure the file status shows <strong>DONE</strong> before running agents.
            </p>
          </div>
        </div>
      )}

      {/* AI-generated documents section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[16px] font-semibold text-text">Generated Documents</h2>
            <p className="text-[12px] text-text-secondary mt-0.5">AI-generated bid package documents — click to edit</p>
          </div>
          <div className="flex items-center gap-3">
            {docs.length > 0 && (
              <span className="text-[12px] text-text-secondary">
                {docs.filter((d) => d.review_status === "approved" || d.review_status === "final").length}/{docs.length} approved
              </span>
            )}
            <button
              onClick={runAgents}
              disabled={running || loading}
              className="flex items-center gap-1.5 rounded bg-primary px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-primary-btn disabled:opacity-50 transition-colors"
            >
              {running && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              <span className="material-symbols-outlined text-[15px]">smart_toy</span>
              {running ? "Generating…" : "Run AI Agents"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {[1,2,3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-mid" />)}
          </div>
        ) : docs.length > 0 ? (
          <AnimatePresence>
            <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }} className="flex flex-col gap-2">
              {docs.map((doc) => (
                <motion.button
                  key={doc.id}
                  variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                  onClick={() => setOpenId(doc.id)}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-5 py-3.5 text-start hover:bg-surface-dim transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[18px] text-primary">description</span>
                    <div>
                      <p className="text-[13px] font-medium text-text">{doc.title}</p>
                      <p className="mt-0.5 text-[11px] capitalize text-text-secondary">{doc.type.replace(/_/g, " ")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${REVIEW_COLORS[doc.review_status] ?? "text-text-muted bg-surface-dim"}`}>
                      {doc.review_status.replace(/_/g, " ")}
                    </span>
                    <span className="text-[12px] text-text-muted">Open →</span>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="mb-2 text-[13px] text-text-secondary">
              No documents yet.{" "}
              {sourceFiles.length === 0
                ? "Upload your RFP files above, then run AI agents to generate the full bid package."
                : "Click Run AI Agents to generate the full bid package from your uploaded files."}
            </p>
            {PLACEHOLDER_DOCS.map((title) => (
              <div key={title} className="flex items-center justify-between rounded-lg border border-border/50 bg-surface/50 px-5 py-3.5 opacity-40">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[18px] text-text-muted">description</span>
                  <p className="text-[13px] font-medium text-text">{title}</p>
                </div>
                <span className="rounded bg-surface-dim px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">pending</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
