"use client";

import { useState, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface Tender {
  id: string;
  name: string;
  client?: string;
  submission_deadline?: string;
  contract_value?: number;
  status: string;
  readiness_score?: number;
  win_probability?: number;
}

const STATUS_COLORS: Record<string, string> = {
  analyzing: "text-[#00E5FF] bg-[#00E5FF]/10",
  in_progress: "text-[#F59E0B] bg-[#F59E0B]/10",
  in_review: "text-[#3B82F6] bg-[#3B82F6]/10",
  ready: "text-[#10B981] bg-[#10B981]/10",
  submitted: "text-[#10B981] bg-[#10B981]/10",
  archived: "text-[#94A3B8] bg-[#94A3B8]/10",
};

export function WorkspacesList() {
  const router = useRouter();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || !fileList.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      Array.from(fileList).forEach((f) => form.append("files", f));
      const res = await fetch("/api/tenders", { method: "POST", body: form });
      const data = await res.json();
      if (data.tenderId) {
        router.push(`/workspaces/${data.tenderId}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-12">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-[40px] font-bold text-text">WORKSPACES</h1>
          <p className="mt-1 text-[16px] text-text-secondary">
            Each tender becomes a dedicated AI workspace.
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-brand px-5 py-2.5 text-[14px] font-semibold text-background transition-opacity hover:opacity-90"
        >
          + New Tender
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Upload zone — shown when no tenders */}
      {tenders.length === 0 && (
        <motion.div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          animate={{ scale: dragging ? 1.01 : 1 }}
          className={[
            "flex min-h-[300px] cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 text-center transition-colors",
            dragging ? "border-ai bg-ai/[0.04]" : "border-border hover:border-brand/40",
          ].join(" ")}
        >
          {uploading ? (
            <>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              <p className="text-[16px] text-text-secondary">Analysing your RFP…</p>
            </>
          ) : (
            <>
              <p className="text-[22px] font-semibold text-text">
                Upload an RFP to create your first workspace
              </p>
              <p className="text-[14px] text-text-secondary">
                PDF · DOCX · XLSX · PPTX · ZIP · BOQ · Drawings · Specifications
              </p>
              <span className="rounded-lg bg-brand px-6 py-3 text-[14px] font-semibold text-background">
                Select RFP files
              </span>
            </>
          )}
        </motion.div>
      )}

      {/* Tender card grid */}
      <AnimatePresence>
        {tenders.length > 0 && (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {tenders.map((t) => (
              <motion.button
                key={t.id}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
                }}
                onClick={() => router.push(`/workspaces/${t.id}`)}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 text-start transition-colors hover:border-brand/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[16px] font-semibold leading-snug text-text">
                    {t.name}
                  </h3>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${STATUS_COLORS[t.status] ?? "text-text-secondary bg-white/5"}`}>
                    {t.status.replace("_", " ")}
                  </span>
                </div>
                {t.client && (
                  <p className="text-[13px] text-text-secondary">{t.client}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-text-secondary">
                  {t.submission_deadline && (
                    <span>Deadline: {new Date(t.submission_deadline).toLocaleDateString()}</span>
                  )}
                  {t.contract_value && (
                    <span>Value: {t.contract_value.toLocaleString()} AED</span>
                  )}
                </div>
                {(t.readiness_score !== undefined || t.win_probability !== undefined) && (
                  <div className="flex gap-3 border-t border-border pt-3">
                    {t.readiness_score !== undefined && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase tracking-wide text-text-secondary">Readiness</span>
                        <span className="text-[14px] font-semibold text-brand">{t.readiness_score}%</span>
                      </div>
                    )}
                    {t.win_probability !== undefined && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase tracking-wide text-text-secondary">Win Prob.</span>
                        <span className="text-[14px] font-semibold text-ai">{t.win_probability}%</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
