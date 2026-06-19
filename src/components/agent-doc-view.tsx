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
  error?: string;
}

interface DocVersion { id: string; content_html?: string; }
interface AgentDoc { id: string; title: string; current_version_id?: string; document_versions?: DocVersion[]; }

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

  const html = (() => {
    if (!doc) return null;
    const version = doc.document_versions?.find((v) => v.id === doc.current_version_id) ?? doc.document_versions?.[0];
    return version?.content_html ?? null;
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold text-text">{title}</h2>
          {description && <p className="mt-1 text-[13px] text-text-secondary">{description}</p>}
        </div>
        {doc && (
          <a
            href={`/tenders/${tenderId}/documents`}
            className="shrink-0 rounded border border-border px-3 py-1.5 text-[12px] text-text-secondary hover:border-primary/40 hover:text-primary transition-colors"
          >
            Edit in Documents →
          </a>
        )}
      </div>

      {html ? (
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
