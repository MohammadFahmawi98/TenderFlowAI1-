"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
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

// ── Markdown → HTML renderer with proper table support ───────────────────────

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
  const th = `padding:9px 14px;text-align:left;font-weight:600;font-size:12px;background:#8B3520;color:white;border:1px solid #7a2d1a;white-space:nowrap`;
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
    const raw = lines[i];
    const t = raw.trim();
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
      out.push(
        lvl <= 2
          ? `<h2 style="font-weight:700;font-size:16px;margin:22px 0 8px;color:#1a1a1a;border-bottom:2px solid #C8A24A;padding-bottom:5px">${txt}</h2>`
          : `<h3 style="font-weight:600;font-size:14px;margin:16px 0 6px;color:#1a1a1a">${txt}</h3>`,
      );
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

// ── Main component ───────────────────────────────────────────────────────────

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

  function exportSection() {
    const content = run?.output_content ?? "";
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(run?.output_content ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  const html = (() => {
    if (editing) return null;
    if (doc) {
      const version = doc.document_versions?.find((v) => v.id === doc.current_version_id) ?? doc.document_versions?.[0];
      if (version?.content_html) return version.content_html;
    }
    if (run?.output_content) return markdownToHtml(run.output_content);
    return null;
  })();

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-6 w-48 animate-pulse rounded bg-surface-mid" />
        <div className="h-64 animate-pulse rounded-lg bg-surface-mid" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex flex-col gap-5">
        <h2 className="text-[18px] font-semibold text-text">{title}</h2>
        <EmptyState tenderId={tenderId} router={router} />
      </div>
    );
  }

  if (run.status === "waiting" || run.status === "running") {
    return (
      <div className="flex flex-col gap-5">
        <h2 className="text-[18px] font-semibold text-text">{title}</h2>
        <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${run.progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <p className="mt-1 text-[11px] text-text-muted">{run.progress}%</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (run.status === "failed") {
    return (
      <div className="flex flex-col gap-5">
        <h2 className="text-[18px] font-semibold text-text">{title}</h2>
        <div className="rounded-lg border border-danger/30 bg-danger-bg p-5">
          <p className="font-semibold text-danger">Agent failed</p>
          <p className="mt-1 text-[13px] text-text-secondary">{run.error ?? "Unknown error. Try running agents again."}</p>
          <button
            onClick={() => router.push(`/tenders/${tenderId}`)}
            className="mt-4 rounded border border-danger/30 px-4 py-2 text-[13px] font-semibold text-danger hover:bg-danger-bg transition-colors"
          >
            Go to Overview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold text-text">{title}</h2>
          {description && <p className="mt-1 text-[13px] text-text-secondary">{description}</p>}
        </div>
        {!editing && html && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={copyToClipboard}
              title="Copy raw content"
              className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-[12px] text-text-secondary hover:border-primary/40 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">{copied ? "check" : "content_copy"}</span>
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={exportSection}
              title="Download as .txt"
              className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-[12px] text-text-secondary hover:border-primary/40 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">download</span>
              Export
            </button>
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

      {/* Edit mode */}
      {editing ? (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] text-text-muted">
            Edit raw content below. Markdown tables (<code>| col | col |</code>), <strong>bold</strong>, bullet lists, and headings are supported.
          </p>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="h-[60vh] w-full resize-y rounded-lg border border-border bg-surface p-4 font-mono text-[12.5px] leading-relaxed text-text outline-none focus:border-primary transition-colors"
            spellCheck={false}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={saveEdit}
              disabled={saving}
              className="flex items-center gap-2 rounded bg-primary px-5 py-2 text-[13px] font-semibold text-white hover:bg-primary-btn disabled:opacity-60 transition-colors"
            >
              {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded border border-border px-5 py-2 text-[13px] text-text-secondary hover:bg-surface-dim transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : html ? (
        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          <div
            className="agent-content max-w-none text-[14px] leading-relaxed text-text"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      ) : (
        <EmptyState tenderId={tenderId} router={router} />
      )}
    </div>
  );
}

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
        <p className="mt-1 text-[13px] text-text-secondary">
          Run AI Agents to generate this section from the tender documents.
        </p>
      </div>
      <button
        onClick={runAgents}
        disabled={running}
        className="flex items-center gap-2 rounded bg-primary px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-primary-btn disabled:opacity-50 transition-colors"
      >
        {running && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
        {running ? "Starting…" : "Run AI Agents"}
      </button>
    </div>
  );
}
