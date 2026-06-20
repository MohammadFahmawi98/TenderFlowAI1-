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
  done:       "text-success bg-success-bg",
  running:    "text-warning bg-warning-bg",
  failed:     "text-danger bg-danger-bg",
};

function fileIcon(mime: string) {
  if (mime.includes("pdf"))   return "picture_as_pdf";
  if (mime.includes("word") || mime.includes("docx")) return "description";
  if (mime.includes("sheet") || mime.includes("xlsx") || mime.includes("csv")) return "table_chart";
  if (mime.includes("zip"))   return "folder_zip";
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
  const [docs, setDocs]           = useState<Doc[]>([]);
  const [sourceFiles, setFiles]   = useState<SourceFile[]>([]);
  const [openId, setOpenId]       = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [running, setRunning]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef              = useRef<HTMLInputElement>(null);

  async function loadDocs() {
    const [docsRes, filesRes] = await Promise.all([
      fetch(`/api/documents?tender_id=${id}`),
      fetch(`/api/tenders/${id}/files`),
    ]);
    if (docsRes.ok)  setDocs(await docsRes.json());
    if (filesRes.ok) setFiles(await filesRes.json());
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

  const openDoc = docs.find((d) => d.id === openId);
  const openVersion = openDoc?.document_versions?.find((v) => v.id === openDoc.current_version_id)
    ?? openDoc?.document_versions?.[0];

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
      {/* Hidden file input */}
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
            <p className="text-[12px] text-text-secondary mt-0.5">RFP documents, BOQs, drawings — all files uploaded for this bid</p>
          </div>
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

        {loading ? (
          <div className="h-20 animate-pulse rounded-lg bg-surface-mid" />
        ) : sourceFiles.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border py-8 cursor-pointer hover:bg-surface-dim transition-colors"
          >
            <span className="material-symbols-outlined text-[32px] text-text-muted">upload_file</span>
            <p className="text-[13px] text-text-secondary">Drop files here or click to upload</p>
            <p className="text-[11px] text-text-muted">PDF · DOCX · XLSX · PPTX · ZIP</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border-light bg-surface-dim">
                  <th className="px-4 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">File</th>
                  <th className="px-3 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Size</th>
                  <th className="px-3 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Extraction</th>
                  <th className="px-3 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Added</th>
                </tr>
              </thead>
              <tbody>
                {sourceFiles.map((f) => (
                  <tr key={f.id} className="border-b border-border-light last:border-0 hover:bg-surface-dim transition-colors">
                    <td className="px-4 py-3 flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-[18px] text-primary shrink-0">{fileIcon(f.mime ?? "")}</span>
                      <span className="truncate font-medium text-text max-w-xs">{f.original_name ?? f.name}</span>
                    </td>
                    <td className="px-3 py-3 text-text-secondary whitespace-nowrap">{fmtSize(f.size_bytes)}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${EXTRACT_COLORS[f.extraction_status] ?? "text-text-muted bg-surface-dim"}`}>
                        {f.extraction_status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-text-secondary whitespace-nowrap">
                      {new Date(f.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
