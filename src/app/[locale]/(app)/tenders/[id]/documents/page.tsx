"use client";

import { useState, useEffect } from "react";
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

const REVIEW_COLORS: Record<string, string> = {
  draft:             "text-text-secondary bg-white/5",
  ai_generated:      "text-[#00E5FF] bg-[#00E5FF]/10",
  in_review:         "text-[#F59E0B] bg-[#F59E0B]/10",
  changes_requested: "text-[#EF4444] bg-[#EF4444]/10",
  approved:          "text-[#10B981] bg-[#10B981]/10",
  final:             "text-brand bg-brand/10",
};

const PLACEHOLDER_DOCS = [
  "Technical Proposal", "Commercial Proposal", "Compliance Matrix",
  "Manpower Plan", "PPM Schedule", "Risk Register", "HSE Plan", "Executive Presentation",
];

export default function DocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  async function loadDocs() {
    const r = await fetch(`/api/documents?tender_id=${id}`);
    if (r.ok) setDocs(await r.json());
    setLoading(false);
  }

  useEffect(() => { loadDocs(); }, [id]);

  async function runAgents() {
    setRunning(true);
    await fetch(`/api/tenders/${id}/run-agents`, { method: "POST" });
    // Poll until done
    let tries = 0;
    const iv = setInterval(async () => {
      await loadDocs();
      const r = await fetch(`/api/tenders/${id}/agents`);
      const agents = await r.json();
      const allDone = Array.isArray(agents) && agents.every((a: { status: string }) => a.status === "completed" || a.status === "failed");
      if (allDone || ++tries > 60) { clearInterval(iv); setRunning(false); }
    }, 5000);
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
      <div className="flex items-center justify-between">
        <h2 className="text-[22px] font-semibold text-text">Documents</h2>
        <div className="flex gap-3">
          {docs.length > 0 && (
            <span className="text-[13px] text-text-secondary">{docs.filter((d) => d.review_status === "approved" || d.review_status === "final").length}/{docs.length} approved</span>
          )}
          <button
            onClick={runAgents}
            disabled={running || loading}
            className="flex items-center gap-2 rounded-lg bg-brand/15 px-4 py-2 text-[13px] font-semibold text-brand hover:bg-brand/25 disabled:opacity-50 transition-colors"
          >
            {running && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent" />}
            {running ? "Generating…" : "Run AI Agents"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1,2,3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-card" />)}
        </div>
      ) : docs.length > 0 ? (
        <AnimatePresence>
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }} className="flex flex-col gap-2">
            {docs.map((doc) => (
              <motion.button
                key={doc.id}
                variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                onClick={() => setOpenId(doc.id)}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 text-start hover:border-brand/30 transition-colors"
              >
                <div>
                  <p className="text-[14px] font-medium text-text">{doc.title}</p>
                  <p className="mt-0.5 text-[12px] capitalize text-text-secondary">{doc.type.replace(/_/g, " ")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${REVIEW_COLORS[doc.review_status] ?? "text-text-secondary bg-white/5"}`}>
                    {doc.review_status.replace(/_/g, " ")}
                  </span>
                  <span className="text-[12px] text-text-secondary">Open →</span>
                </div>
              </motion.button>
            ))}
          </motion.div>
        </AnimatePresence>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="mb-2 text-[14px] text-text-secondary">No documents yet. Run AI agents to generate all submission deliverables.</p>
          {PLACEHOLDER_DOCS.map((title) => (
            <div key={title} className="flex items-center justify-between rounded-xl border border-border/50 bg-card/50 px-5 py-4 opacity-40">
              <p className="text-[14px] font-medium text-text">{title}</p>
              <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-text-secondary">draft</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
