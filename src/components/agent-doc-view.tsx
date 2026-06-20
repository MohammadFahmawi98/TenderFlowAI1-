"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "@/i18n/navigation";

interface AgentRun {
  agent_type: string;
  status: "waiting" | "running" | "completed" | "failed";
  progress: number;
  current_task?: string;
  output_doc_id?: string;
  output_content?: string;
  error?: string;
}

interface DocVersion { id: string; content_html?: string; }
interface AgentDoc { id: string; title: string; current_version_id?: string; document_versions?: DocVersion[]; }

// ── Markdown → HTML ──────────────────────────────────────────────────────────

function b(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function parseMarkdownTable(lines: string[]): string {
  const rows = lines.map((l) =>
    l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()),
  );
  if (rows.length === 0) return "";
  const sepIdx = rows.findIndex((r) => r.every((c) => /^[-: ]+$/.test(c)));
  const header = rows[0];
  const data = rows.filter((_, i) => i !== 0 && i !== sepIdx);
  const th = `padding:9px 14px;text-align:left;font-weight:600;font-size:11.5px;background:#8B3520;color:white;border:1px solid #7a2d1a;white-space:nowrap`;
  const td = (odd: boolean) =>
    `padding:8px 14px;font-size:12.5px;border:1px solid #e5e7eb;vertical-align:top;line-height:1.5;background:${odd ? "#fdf9f7" : "white"}`;
  const thead = `<thead><tr>${header.map((h) => `<th style="${th}">${h}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${data.map((row, ri) =>
    `<tr>${row.map((cell) => `<td style="${td(ri % 2 === 1)}">${b(cell)}</td>`).join("")}</tr>`,
  ).join("")}</tbody>`;
  return `<div style="overflow-x:auto;margin:14px 0"><table style="width:100%;border-collapse:collapse;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">${thead}${tbody}</table></div>`;
}

function markdownToHtml(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { i++; continue; }

    if (t.startsWith("|")) {
      const tbl: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) tbl.push(lines[i++]);
      out.push(parseMarkdownTable(tbl));
      continue;
    }
    if (/^#{1,3}\s/.test(t)) {
      const lvl = t.match(/^(#+)/)?.[1].length ?? 1;
      const txt = t.replace(/^#+\s+/, "");
      out.push(lvl <= 2
        ? `<h2 style="font-weight:700;font-size:16px;margin:22px 0 8px;color:#1a1a1a;border-bottom:2px solid #C8A24A;padding-bottom:5px">${txt}</h2>`
        : `<h3 style="font-weight:600;font-size:14px;margin:16px 0 6px;color:#1a1a1a">${txt}</h3>`);
      i++; continue;
    }
    if (/^(\d+\.\s+)?[A-Z][A-Z\s\d&./:(),-]{2,79}$/.test(t)) {
      out.push(`<h3 style="font-weight:700;font-size:13px;margin:20px 0 7px;color:#8B3520;letter-spacing:0.04em">${t}</h3>`);
      i++; continue;
    }
    if (/^[-•*]\s/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^[-•*]\s/.test(lines[i].trim())) {
        items.push(b(lines[i].trim().replace(/^[-•*]\s+/, "")));
        i++;
      }
      out.push(`<ul style="margin:8px 0;padding-left:20px">${items.map((it) => `<li style="margin:4px 0;line-height:1.65">${it}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\d+\.\s/.test(t) && /^\d+\.\s/.test(lines[i + 1]?.trim() ?? "")) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(b(lines[i].trim().replace(/^\d+\.\s+/, "")));
        i++;
      }
      out.push(`<ol style="margin:8px 0;padding-left:20px">${items.map((it) => `<li style="margin:4px 0;line-height:1.65">${it}</li>`).join("")}</ol>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (!l || l.startsWith("|") || /^#{1,3}\s/.test(l) || /^[-•*]\s/.test(l) || /^(\d+\.\s+)?[A-Z][A-Z\s\d&./:(),-]{2,79}$/.test(l)) break;
      para.push(b(l));
      i++;
    }
    if (para.length) out.push(`<p style="margin:0 0 10px;line-height:1.7">${para.join(" ")}</p>`);
  }
  return out.join("\n");
}

// ── Export helpers (client-side) ─────────────────────────────────────────────

async function downloadDocx(title: string, content: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const paras: InstanceType<typeof Paragraph>[] = [];

  for (const line of content.split("\n")) {
    const l = line.trim();
    if (!l) { paras.push(new Paragraph({ text: "" })); continue; }
    if (/^\|[-: |]+\|$/.test(l)) continue; // separator row
    if (l.startsWith("|")) {
      const cells = l.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()).filter(Boolean);
      paras.push(new Paragraph({ children: [new TextRun({ text: cells.join("   |   "), size: 20 })] }));
    } else if (/^#{1,3}\s/.test(l)) {
      paras.push(new Paragraph({ text: l.replace(/^#+\s+/, ""), heading: HeadingLevel.HEADING_2 }));
    } else if (/^(\d+\.\s+)?[A-Z][A-Z\s\d&./:(),-]{2,79}$/.test(l)) {
      paras.push(new Paragraph({ text: l, heading: HeadingLevel.HEADING_3 }));
    } else if (/^[-•*]\s/.test(l)) {
      paras.push(new Paragraph({
        text: l.replace(/^[-•*]\s+/, "").replace(/\*\*(.+?)\*\*/g, "$1"),
        bullet: { level: 0 },
      }));
    } else {
      const clean = l.replace(/\*\*(.+?)\*\*/g, "$1");
      paras.push(new Paragraph({ children: [new TextRun(clean)] }));
    }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
        new Paragraph({ text: "" }),
        ...paras,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${title.replace(/\s+/g, "_")}.docx`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function downloadXlsx(title: string, content: string) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const lines = content.split("\n");
  let i = 0;
  let sheetCount = 0;
  const textRows: string[][] = [];
  let lastHeading = title;

  while (i < lines.length) {
    const l = lines[i].trim();
    if (!l) { i++; continue; }

    // Detect heading to name the sheet
    if (/^(\d+\.\s+)?[A-Z][A-Z\s\d&./:(),-]{2,79}$/.test(l) || /^#{1,3}\s/.test(l)) {
      lastHeading = l.replace(/^#+\s+/, "").slice(0, 28);
      i++; continue;
    }

    // Table block
    if (l.startsWith("|")) {
      const tblLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) tblLines.push(lines[i++]);

      const rows = tblLines
        .filter((row) => !/^\|[-: |]+\|$/.test(row.trim()))
        .map((row) =>
          row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()),
        );

      if (rows.length > 1) {
        const ws = XLSX.utils.aoa_to_sheet(rows);
        // Style header row
        const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
        for (let col = range.s.c; col <= range.e.c; col++) {
          const addr = XLSX.utils.encode_cell({ r: 0, c: col });
          if (ws[addr]) ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: "8B3520" } } };
        }
        const sheetName = (lastHeading || `Table ${sheetCount + 1}`).slice(0, 28);
        XLSX.utils.book_append_sheet(wb, ws, sheetName || `Sheet${++sheetCount}`);
        sheetCount++;
      }
      continue;
    }

    textRows.push([l.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^[-•*]\s+/, "")]);
    i++;
  }

  // If no tables found, export raw text
  if (sheetCount === 0) {
    const ws = XLSX.utils.aoa_to_sheet(textRows);
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 28));
  }

  XLSX.writeFile(wb, `${title.replace(/\s+/g, "_")}.xlsx`);
}

function openPdf(title: string, content: string) {
  const html = markdownToHtml(content);
  const win = window.open("", "_blank");
  if (!win) { alert("Please allow pop-ups to export PDF."); return; }
  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12.5px; color: #1a1a1a; padding: 40px 50px; max-width: 900px; margin: 0 auto; line-height: 1.6; }
  h1 { font-size: 20px; color: #8B3520; margin-bottom: 4px; }
  h2 { font-size: 15px; color: #1a1a1a; margin: 18px 0 7px; border-bottom: 2px solid #C8A24A; padding-bottom: 4px; }
  h3 { font-size: 13px; color: #8B3520; margin: 14px 0 5px; letter-spacing: 0.03em; }
  p { margin-bottom: 8px; }
  ul, ol { padding-left: 20px; margin: 6px 0; }
  li { margin: 3px 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11.5px; }
  th { background: #8B3520; color: white; padding: 7px 10px; text-align: left; font-size: 11px; border: 1px solid #7a2d1a; }
  td { padding: 6px 10px; border: 1px solid #d1d5db; vertical-align: top; }
  tr:nth-child(even) td { background: #fdf9f7; }
  .meta { color: #666; font-size: 11px; margin: 4px 0 16px; }
  .divider { border: none; border-top: 1px solid #C8A24A; margin: 14px 0; }
  @media print {
    body { padding: 20px 30px; }
    @page { margin: 20mm; }
  }
</style>
</head>
<body>
<h1>${title}</h1>
<p class="meta">Etihad International Hospitality — BidDesk &nbsp;|&nbsp; Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
<hr class="divider">
${html}
<script>setTimeout(() => { window.print(); }, 400 );<\/script>
</body>
</html>`);
  win.document.close();
}

// ── Export dropdown ───────────────────────────────────────────────────────────

function ExportDropdown({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function handle(format: "docx" | "xlsx" | "pdf") {
    setOpen(false);
    setLoading(format);
    try {
      if (format === "docx") await downloadDocx(title, content);
      else if (format === "xlsx") await downloadXlsx(title, content);
      else openPdf(title, content);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={!!loading}
        className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-[12px] text-text-secondary hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-60"
      >
        {loading ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <span className="material-symbols-outlined text-[14px]">download</span>
        )}
        Export
        <span className="material-symbols-outlined text-[12px]">expand_more</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute end-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
          >
            {[
              { fmt: "docx" as const, icon: "description", label: "Word (.docx)", sub: "Formatted document" },
              { fmt: "xlsx" as const, icon: "table_chart", label: "Excel (.xlsx)", sub: "Tables & data" },
              { fmt: "pdf"  as const, icon: "picture_as_pdf", label: "PDF (Print)", sub: "Print-ready layout" },
            ].map(({ fmt, icon, label, sub }) => (
              <button
                key={fmt}
                onClick={() => handle(fmt)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-surface-dim transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
                <div>
                  <p className="text-[12.5px] font-medium text-text">{label}</p>
                  <p className="text-[11px] text-text-muted">{sub}</p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Editor with live preview ──────────────────────────────────────────────────

type EditTab = "edit" | "split" | "preview";

function SplitEditor({
  value,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [tab, setTab] = useState<EditTab>("split");

  const tabBtn = (key: EditTab, icon: string, label: string) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      className={[
        "flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors",
        tab === key
          ? "bg-primary text-white"
          : "text-text-secondary hover:bg-surface-dim",
      ].join(" ")}
    >
      <span className="material-symbols-outlined text-[14px]">{icon}</span>
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface-dim px-3 py-2">
        <div className="flex gap-1">
          {tabBtn("edit", "code", "Edit")}
          {tabBtn("split", "vertical_split", "Split")}
          {tabBtn("preview", "visibility", "Preview")}
        </div>
        <p className="text-[11px] text-text-muted">
          Supports <strong>**bold**</strong>, <code className="bg-surface-mid px-1 rounded text-[10px]">| table |</code>, # headings, - lists
        </p>
      </div>

      {/* Editor / Preview panes */}
      <div className={`flex gap-3 ${tab === "split" ? "flex-row" : "flex-col"}`} style={{ minHeight: "55vh" }}>
        {/* Edit pane */}
        {(tab === "edit" || tab === "split") && (
          <div className={`flex flex-col ${tab === "split" ? "w-1/2" : "w-full"} flex-1`}>
            <p className="mb-1.5 text-[10px] uppercase tracking-wide text-text-muted font-medium">Markdown</p>
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 w-full resize-none rounded-lg border border-border bg-[#fafafa] p-4 font-mono text-[12.5px] leading-relaxed text-text outline-none focus:border-primary transition-colors"
              style={{ minHeight: tab === "split" ? "50vh" : "55vh" }}
              spellCheck={false}
              placeholder="Start typing or paste markdown content here…"
            />
          </div>
        )}

        {/* Preview pane */}
        {(tab === "preview" || tab === "split") && (
          <div className={`flex flex-col ${tab === "split" ? "w-1/2" : "w-full"} flex-1`}>
            <p className="mb-1.5 text-[10px] uppercase tracking-wide text-text-muted font-medium">Preview</p>
            <div
              className="flex-1 overflow-y-auto rounded-lg border border-border bg-surface p-5 text-[13px] leading-relaxed text-text"
              style={{ minHeight: tab === "split" ? "50vh" : "55vh" }}
              dangerouslySetInnerHTML={{ __html: markdownToHtml(value) || "<p style='color:#999'>Start typing to see a preview…</p>" }}
            />
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 border-t border-border pt-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 rounded bg-primary px-5 py-2 text-[13px] font-semibold text-white hover:bg-primary-btn disabled:opacity-60 transition-colors"
        >
          {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button
          onClick={onCancel}
          className="rounded border border-border px-5 py-2 text-[13px] text-text-secondary hover:bg-surface-dim transition-colors"
        >
          Cancel
        </button>
        <p className="ml-auto text-[11px] text-text-muted">Changes saved to AI output</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AgentDocumentView({
  tenderId,
  agentType,
  title,
  description,
}: {
  tenderId: string;
  agentType: string;
  title: string;
  description?: string;
}) {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [doc, setDoc] = useState<AgentDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const agents: AgentRun[] = await fetch(`/api/tenders/${tenderId}/agents`)
      .then((r) => r.json())
      .catch(() => []);
    const found = Array.isArray(agents) ? agents.find((a) => a.agent_type === agentType) ?? null : null;
    setRun(found);
    if (found?.output_doc_id) {
      const d = await fetch(`/api/documents/${found.output_doc_id}`).then((r) => r.json()).catch(() => null);
      setDoc(d);
    } else {
      setDoc(null);
    }
    setLoading(false);
    return found;
  }

  useEffect(() => {
    let active = true;
    async function poll() {
      const found = await load();
      if (!active) return;
      if (found?.status === "running" || found?.status === "waiting") {
        pollRef.current = setTimeout(poll, 3000);
      }
    }
    poll();
    return () => {
      active = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenderId, agentType]);

  function startEdit() {
    setEditContent(run?.output_content ?? "");
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    await fetch(`/api/tenders/${tenderId}/agents`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_type: agentType, output_content: editContent }),
    });
    setSaving(false);
    setEditing(false);
    await load();
  }

  async function copyContent() {
    await navigator.clipboard.writeText(run?.output_content ?? "").catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const html = (() => {
    if (editing) return null;
    if (doc) {
      const ver = doc.document_versions?.find((v) => v.id === doc.current_version_id) ?? doc.document_versions?.[0];
      if (ver?.content_html) return ver.content_html;
    }
    if (run?.output_content) return markdownToHtml(run.output_content);
    return null;
  })();

  // ── Loading skeleton
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-6 w-48 animate-pulse rounded bg-surface-mid" />
        <div className="h-64 animate-pulse rounded-lg bg-surface-mid" />
      </div>
    );
  }

  // ── No run yet
  if (!run) {
    return (
      <div className="flex flex-col gap-5">
        <h2 className="text-[18px] font-semibold text-text">{title}</h2>
        <EmptyState tenderId={tenderId} router={router} />
      </div>
    );
  }

  // ── Running / Waiting
  if (run.status === "waiting" || run.status === "running") {
    return (
      <div className="flex flex-col gap-5">
        <h2 className="text-[18px] font-semibold text-text">{title}</h2>
        <div className="rounded-lg border border-border bg-surface p-10 shadow-sm">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <div>
              <p className="text-[15px] font-semibold text-text">
                {run.status === "waiting" ? "Queued…" : "Generating…"}
              </p>
              <p className="mt-1 text-[13px] text-text-secondary">
                {run.current_task ?? "AI agent is processing tender data"}
              </p>
            </div>
            <div className="w-full max-w-xs">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-mid">
                <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${run.progress}%` }} transition={{ duration: 0.5 }} />
              </div>
              <p className="mt-1 text-[11px] text-text-muted">{run.progress}%</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Failed
  if (run.status === "failed") {
    return (
      <div className="flex flex-col gap-5">
        <h2 className="text-[18px] font-semibold text-text">{title}</h2>
        <div className="rounded-lg border border-danger/30 bg-danger-bg p-5">
          <p className="font-semibold text-danger">Agent failed</p>
          <p className="mt-1 text-[13px] text-text-secondary">{run.error ?? "Unknown error."}</p>
          <button onClick={() => router.push(`/tenders/${tenderId}`)} className="mt-4 rounded border border-danger/30 px-4 py-2 text-[13px] font-semibold text-danger hover:bg-danger-bg transition-colors">
            Go to Overview
          </button>
        </div>
      </div>
    );
  }

  // ── Completed
  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold text-text">{title}</h2>
          {description && <p className="mt-1 text-[13px] text-text-secondary">{description}</p>}
        </div>
        {!editing && html && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={copyContent}
              className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-[12px] text-text-secondary hover:border-primary/40 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">{copied ? "check" : "content_copy"}</span>
              {copied ? "Copied!" : "Copy"}
            </button>
            <ExportDropdown title={title} content={run.output_content ?? ""} />
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-[12px] text-text-secondary hover:border-primary/40 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">edit</span>
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      {editing ? (
        <SplitEditor
          value={editContent}
          onChange={setEditContent}
          onSave={saveEdit}
          onCancel={() => setEditing(false)}
          saving={saving}
        />
      ) : html ? (
        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          <div className="agent-content max-w-none text-[14px] leading-relaxed text-text" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      ) : (
        <EmptyState tenderId={tenderId} router={router} />
      )}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ tenderId, router }: { tenderId: string; router: ReturnType<typeof useRouter> }) {
  const [running, setRunning] = useState(false);
  async function runAgents() {
    setRunning(true);
    fetch(`/api/tenders/${tenderId}/run-agents`, { method: "POST" }).catch(console.error);
    await new Promise((r) => setTimeout(r, 800));
    router.push(`/tenders/${tenderId}`);
  }
  return (
    <div className="flex flex-col items-center gap-5 rounded-lg border border-border bg-surface px-8 py-16 text-center shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-light">
        <span className="material-symbols-outlined text-[24px] text-primary">smart_toy</span>
      </div>
      <div>
        <p className="text-[15px] font-semibold text-text">No AI output yet</p>
        <p className="mt-1 text-[13px] text-text-secondary">Run AI Agents to generate this section from the tender documents.</p>
      </div>
      <button onClick={runAgents} disabled={running} className="flex items-center gap-2 rounded bg-primary px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-primary-btn disabled:opacity-50 transition-colors">
        {running && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
        {running ? "Starting…" : "Run AI Agents"}
      </button>
    </div>
  );
}
