"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";

interface Doc { id: string; title: string; review_status: string; }
interface Tender { name?: string; readiness_score?: number; }

const REVIEW_COLORS: Record<string, string> = {
  draft:             "text-text-secondary",
  ai_generated:      "text-[#00E5FF]",
  in_review:         "text-[#F59E0B]",
  changes_requested: "text-[#EF4444]",
  approved:          "text-[#10B981]",
  final:             "text-brand",
};

const CHECKLIST = [
  "Technical Proposal",
  "Commercial Proposal",
  "Compliance Matrix",
  "Manpower Plan",
  "PPM Schedule",
  "Risk Register",
  "HSE Plan",
  "Executive Presentation",
];

export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const [tender, setTender] = useState<Tender | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/tenders/${id}`).then((r) => r.json()),
      fetch(`/api/documents?tender_id=${id}`).then((r) => r.json()),
    ]).then(([t, d]) => {
      setTender(t);
      if (Array.isArray(d)) setDocs(d);
    }).catch(console.error);
  }, [id]);

  async function exportPackage() {
    setExporting(true);
    try {
      const res = await fetch(`/api/tenders/${id}/export`, { method: "POST" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(tender?.name ?? "submission").replace(/[^a-z0-9]/gi, "_")}_package.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    finally { setExporting(false); }
  }

  const approved = docs.filter((d) => d.review_status === "approved" || d.review_status === "final");
  const readiness = tender?.readiness_score ?? 0;
  const isReady = readiness >= 70 || docs.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-[22px] font-semibold text-text">Export Submission Package</h2>
      <p className="text-[14px] text-text-secondary">
        Bundle all approved documents into a single DOCX submission package for client delivery.
      </p>

      {/* Readiness gate */}
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="mb-3 text-[11px] uppercase tracking-wide text-text-secondary">Submission Readiness</p>
        <div className="mb-2 flex items-center justify-between text-[13px]">
          <span className="text-text-secondary">Overall Readiness</span>
          <span className={`font-bold ${readiness >= 80 ? "text-[#10B981]" : readiness >= 50 ? "text-[#F59E0B]" : "text-text-secondary"}`}>
            {readiness > 0 ? `${readiness}%` : "Not assessed"}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/5">
          <motion.div
            className={`h-full rounded-full ${readiness >= 80 ? "bg-[#10B981]" : readiness >= 50 ? "bg-[#F59E0B]" : "bg-brand"}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(readiness, docs.length ? 30 : 0)}%` }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <p className="mt-3 text-[13px] text-text-secondary">
          {approved.length} of {docs.length || CHECKLIST.length} documents approved.
        </p>
      </div>

      {/* Package checklist */}
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="mb-4 text-[11px] uppercase tracking-wide text-text-secondary">Package Contents</p>
        <ul className="flex flex-col gap-2.5">
          {CHECKLIST.map((item) => {
            const found = docs.find((d) => d.title === item);
            return (
              <li key={item} className="flex items-center gap-3 text-[14px]">
                <span className={`h-2 w-2 shrink-0 rounded-full ${found ? "bg-[#10B981]" : "bg-white/20"}`} />
                <span className={found ? "text-text" : "text-text-secondary"}>{item}</span>
                {found && (
                  <span className={`ms-auto text-[11px] font-medium capitalize ${REVIEW_COLORS[found.review_status] ?? ""}`}>
                    {found.review_status.replace(/_/g, " ")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Export button */}
      <div className="flex flex-col gap-3">
        <button
          onClick={exportPackage}
          disabled={exporting || !isReady}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-brand px-6 py-4 text-[15px] font-bold text-background hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {exporting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />}
          {exporting ? "Generating package…" : "Export Submission Package (.docx)"}
        </button>
        {!isReady && (
          <p className="text-center text-[13px] text-text-secondary">
            Run AI agents first to generate documents before exporting.
          </p>
        )}
      </div>
    </div>
  );
}
